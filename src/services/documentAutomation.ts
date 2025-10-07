import type { Account, DocumentMetadata, Expense, RecurringExpenseCandidate, TimelineEntry } from '../data/models';
import { persistAccount } from './accounts';
import { persistExpense } from './expenses';
import { persistTimelineEntry } from './timeline';
import {
  deriveExpenseFromDocument,
  deriveTimelineEntryFromExpense,
  findAccountByHint
} from './expenseDerivation';
import { validateFirebaseConfig, type FirebaseConfig } from './firebase';

interface ProcessDocumentContext {
  document: DocumentMetadata;
  accounts: Account[];
  expenses: Expense[];
  timelineEntries: TimelineEntry[];
  firebaseConfig: FirebaseConfig;
}

interface ProcessDocumentCallbacks {
  onAccountUpsert?: (account: Account) => void;
  onExpenseUpsert?: (expense: Expense) => void;
  onTimelineUpsert?: (entry: TimelineEntry) => void;
}

interface EnsureAccountOptions {
  accountHint?: string;
  fallbackName?: string;
  document: DocumentMetadata;
  existingAccounts: Account[];
}

interface EnsureAccountResult {
  account: Account | undefined;
  accounts: Account[];
  created: boolean;
}

interface ExpenseUpsertResult {
  expenses: Expense[];
  expense?: Expense;
}

interface TimelineUpsertResult {
  timelineEntries: TimelineEntry[];
  entry?: TimelineEntry;
}

function normaliseIdentifier(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

function buildAutoAccountId(
  base: string | undefined,
  documentId: string,
  existingAccounts: Account[]
): string {
  const baseIdentifier = normaliseIdentifier(base ?? '') || normaliseIdentifier(documentId) || crypto.randomUUID();
  const trimmedBase = baseIdentifier.slice(-24) || crypto.randomUUID().replace(/[^a-z0-9]/gi, '').slice(-24);
  let candidate = `acc-auto-${trimmedBase}`;
  let counter = 1;
  while (existingAccounts.some((account) => account.id === candidate)) {
    const suffix = `-${counter++}`;
    candidate = `acc-auto-${trimmedBase.slice(0, Math.max(4, 24 - suffix.length))}${suffix}`;
  }
  return candidate;
}

function mergeAccountMetadata(
  accountHint: string | undefined,
  document: DocumentMetadata
): Account['metadata'] | undefined {
  const metadataEntries: Record<string, unknown> = {};
  const hints = new Set<string>();

  if (accountHint) {
    metadataEntries.identifier = accountHint;
    metadataEntries.number = accountHint;
    metadataEntries.iban = accountHint;
    hints.add(accountHint);
  }

  if (document.companyName) {
    hints.add(document.companyName);
  }

  hints.add(document.originalName);

  if (hints.size > 0) {
    metadataEntries.hints = Array.from(hints);
  }

  return Object.keys(metadataEntries).length > 0 ? (metadataEntries as Account['metadata']) : undefined;
}

function ensureAccount(options: EnsureAccountOptions): EnsureAccountResult {
  const { accountHint, fallbackName, document, existingAccounts } = options;

  if (accountHint) {
    const matched = findAccountByHint(accountHint, existingAccounts);
    if (matched) {
      return { account: matched, accounts: existingAccounts, created: false };
    }
  }

  const trimmedFallback = fallbackName?.trim();
  if (trimmedFallback) {
    const matchedByName = existingAccounts.find((account) => account.name.toLowerCase() === trimmedFallback.toLowerCase());
    if (matchedByName) {
      return { account: matchedByName, accounts: existingAccounts, created: false };
    }
  }

  const newAccount: Account = {
    id: buildAutoAccountId(accountHint ?? trimmedFallback ?? document.id, document.id, existingAccounts),
    name:
      trimmedFallback ||
      (accountHint ? `Conta ${accountHint}` : document.companyName ? `${document.companyName} (validar)` : 'Conta por validar'),
    type: 'outro',
    balance: 0,
    currency: document.currency ?? 'EUR',
    validationStatus: 'validacao-manual',
    metadata: mergeAccountMetadata(accountHint, document)
  };

  const nextAccounts = [newAccount, ...existingAccounts.filter((account) => account.id !== newAccount.id)];
  return { account: newAccount, accounts: nextAccounts, created: true };
}

function computeNextDueDate(
  dayOfMonth: number | undefined,
  referenceIso?: string,
  existingDueDate?: string
): string | undefined {
  if (existingDueDate) {
    return existingDueDate;
  }

  const reference = referenceIso ? new Date(referenceIso) : new Date();
  if (Number.isNaN(reference.getTime())) {
    return undefined;
  }

  const safeDay = Number.isFinite(dayOfMonth) ? Math.min(Math.max(Math.round(dayOfMonth as number), 1), 28) : undefined;
  const day = safeDay ?? Math.min(reference.getUTCDate(), 28);

  const candidate = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), day));
  if (candidate.getTime() <= reference.getTime()) {
    candidate.setUTCMonth(candidate.getUTCMonth() + 1);
  }
  return candidate.toISOString();
}

function buildRecurringExpenseId(documentId: string, description: string): string {
  const docSegment = normaliseIdentifier(documentId).slice(-12) || 'doc';
  const descriptionSegment = normaliseIdentifier(description).slice(0, 24) || 'item';
  return `doc-exp-${docSegment}-${descriptionSegment}`;
}

function hasExpenseChanged(existingExpense: Expense | undefined, nextExpense: Expense): boolean {
  if (!existingExpense) {
    return true;
  }
  return (
    existingExpense.accountId !== nextExpense.accountId ||
    existingExpense.description !== nextExpense.description ||
    existingExpense.category !== nextExpense.category ||
    existingExpense.amount !== nextExpense.amount ||
    existingExpense.currency !== nextExpense.currency ||
    existingExpense.dueDate !== nextExpense.dueDate ||
    existingExpense.recurrence !== nextExpense.recurrence ||
    existingExpense.fixed !== nextExpense.fixed ||
    existingExpense.status !== nextExpense.status
  );
}

function hasTimelineChanged(existingEntry: TimelineEntry | undefined, nextEntry: TimelineEntry): boolean {
  if (!existingEntry) {
    return true;
  }
  return (
    existingEntry.date !== nextEntry.date ||
    existingEntry.description !== nextEntry.description ||
    existingEntry.amount !== nextEntry.amount ||
    existingEntry.currency !== nextEntry.currency ||
    existingEntry.linkedExpenseId !== nextEntry.linkedExpenseId
  );
}

async function upsertExpense(
  expense: Expense,
  existingExpenses: Expense[],
  firebaseConfig: FirebaseConfig
): Promise<ExpenseUpsertResult> {
  const nextExpenses = [expense, ...existingExpenses.filter((item) => item.id !== expense.id)];
  await persistExpense(expense, firebaseConfig);
  return { expenses: nextExpenses, expense };
}

async function upsertTimelineEntry(
  entry: TimelineEntry,
  existingEntries: TimelineEntry[],
  firebaseConfig: FirebaseConfig
): Promise<TimelineUpsertResult> {
  const nextEntries = [entry, ...existingEntries.filter((item) => item.id !== entry.id)];
  await persistTimelineEntry(entry, firebaseConfig);
  return { timelineEntries: nextEntries, entry };
}

function buildRecurringExpense(
  candidate: RecurringExpenseCandidate,
  document: DocumentMetadata,
  accountId: string,
  existingExpense?: Expense
): Expense | null {
  const months = candidate.monthsObserved?.filter(Boolean) ?? [];
  if (months.length < 2) {
    return existingExpense ?? null;
  }

  const amount =
    typeof candidate.averageAmount === 'number' && Number.isFinite(candidate.averageAmount)
      ? Number(candidate.averageAmount)
      : existingExpense?.amount;

  if (amount === undefined) {
    return existingExpense ?? null;
  }

  const dueDate = computeNextDueDate(candidate.dayOfMonth, document.uploadDate, existingExpense?.dueDate);

  const expense: Expense = {
    id: existingExpense?.id ?? buildRecurringExpenseId(document.id, candidate.description),
    documentId: document.id,
    accountId,
    description: existingExpense?.description ?? candidate.description,
    category: existingExpense?.category ?? 'Despesas Fixas',
    amount,
    currency: candidate.currency ?? document.currency ?? existingExpense?.currency ?? 'EUR',
    dueDate: dueDate ?? document.dueDate ?? existingExpense?.dueDate ?? document.uploadDate,
    recurrence: 'mensal',
    fixed: true,
    status: existingExpense?.status ?? 'em-analise'
  };

  return expense;
}

async function ensureAccountPersisted(
  ensured: EnsureAccountResult,
  firebaseConfig: FirebaseConfig,
  callbacks: ProcessDocumentCallbacks
): Promise<Account[]> {
  if (!ensured.account) {
    return ensured.accounts;
  }

  if (ensured.created) {
    await persistAccount(ensured.account, firebaseConfig);
  }
  callbacks.onAccountUpsert?.(ensured.account);
  return ensured.accounts;
}

async function processInvoiceDocument(
  context: ProcessDocumentContext,
  callbacks: ProcessDocumentCallbacks,
  accountsSnapshot: Account[],
  expensesSnapshot: Expense[],
  timelineSnapshot: TimelineEntry[]
): Promise<{ accounts: Account[]; expenses: Expense[]; timelineEntries: TimelineEntry[] }> {
  const { document, firebaseConfig } = context;
  const accountResult = ensureAccount({
    accountHint: document.accountHint,
    fallbackName: document.companyName,
    document,
    existingAccounts: accountsSnapshot
  });

  const updatedAccounts = await ensureAccountPersisted(accountResult, firebaseConfig, callbacks);

  const existingExpense = expensesSnapshot.find(
    (expense) => expense.documentId === document.id || expense.id === `doc-exp-${document.id}`
  );

  const derivedExpense = deriveExpenseFromDocument(document, updatedAccounts, existingExpense ?? undefined);
  let currentExpenses = expensesSnapshot;
  let currentTimeline = timelineSnapshot;

  if (derivedExpense && hasExpenseChanged(existingExpense, derivedExpense)) {
    const { expenses, expense } = await upsertExpense(derivedExpense, expensesSnapshot, firebaseConfig);
    currentExpenses = expenses;
    callbacks.onExpenseUpsert?.(expense!);

    const existingTimelineEntry = timelineSnapshot.find((entry) => {
      if (entry.linkedExpenseId === derivedExpense.id) {
        return true;
      }
      if (entry.id === `doc-timeline-${document.id}`) {
        return true;
      }
      if (entry.id === `doc-timeline-${derivedExpense.id}`) {
        return true;
      }
      return false;
    });
    const derivedTimelineEntry = deriveTimelineEntryFromExpense(derivedExpense, existingTimelineEntry ?? undefined);

    if (derivedTimelineEntry && hasTimelineChanged(existingTimelineEntry, derivedTimelineEntry)) {
      const { timelineEntries, entry } = await upsertTimelineEntry(
        derivedTimelineEntry,
        timelineSnapshot,
        firebaseConfig
      );
      currentTimeline = timelineEntries;
      callbacks.onTimelineUpsert?.(entry!);
    }
  }

  return { accounts: updatedAccounts, expenses: currentExpenses, timelineEntries: currentTimeline };
}

async function processStatementDocument(
  context: ProcessDocumentContext,
  callbacks: ProcessDocumentCallbacks,
  accountsSnapshot: Account[],
  expensesSnapshot: Expense[],
  timelineSnapshot: TimelineEntry[]
): Promise<{ accounts: Account[]; expenses: Expense[]; timelineEntries: TimelineEntry[] }> {
  const { document, firebaseConfig } = context;
  const recurringExpenses = document.recurringExpenses ?? [];
  let currentAccounts = accountsSnapshot;
  let currentExpenses = expensesSnapshot;
  let currentTimeline = timelineSnapshot;

  for (const candidate of recurringExpenses) {
    if (!candidate || typeof candidate.description !== 'string' || candidate.description.trim().length === 0) {
      continue;
    }

    const accountResult = ensureAccount({
      accountHint: candidate.accountHint ?? document.accountHint,
      fallbackName: document.companyName ?? candidate.description,
      document,
      existingAccounts: currentAccounts
    });

    currentAccounts = await ensureAccountPersisted(accountResult, firebaseConfig, callbacks);

    const accountId = accountResult.account?.id;
    if (!accountId) {
      continue;
    }

    const expenseId = buildRecurringExpenseId(document.id, candidate.description);
    const existingExpense = currentExpenses.find((expense) => expense.id === expenseId);
    const derivedExpense = buildRecurringExpense(candidate, document, accountId, existingExpense);

    if (!derivedExpense) {
      continue;
    }

    if (!existingExpense || hasExpenseChanged(existingExpense, derivedExpense)) {
      const { expenses, expense } = await upsertExpense(derivedExpense, currentExpenses, firebaseConfig);
      currentExpenses = expenses;
      callbacks.onExpenseUpsert?.(expense!);

      const existingTimelineEntry = currentTimeline.find(
        (entry) =>
          entry.linkedExpenseId === derivedExpense.id || entry.id === `doc-timeline-${derivedExpense.id}`
      );
      const derivedTimelineEntry = deriveTimelineEntryFromExpense(derivedExpense, existingTimelineEntry ?? undefined);

      if (derivedTimelineEntry && hasTimelineChanged(existingTimelineEntry, derivedTimelineEntry)) {
        const { timelineEntries, entry } = await upsertTimelineEntry(
          derivedTimelineEntry,
          currentTimeline,
          firebaseConfig
        );
        currentTimeline = timelineEntries;
        callbacks.onTimelineUpsert?.(entry!);
      }
    }
  }

  return { accounts: currentAccounts, expenses: currentExpenses, timelineEntries: currentTimeline };
}

export async function processDocumentForDerivedEntities(
  context: ProcessDocumentContext,
  callbacks: ProcessDocumentCallbacks = {}
): Promise<{ accounts: Account[]; expenses: Expense[]; timelineEntries: TimelineEntry[] }> {
  const { document, firebaseConfig, accounts, expenses, timelineEntries } = context;

  if (!validateFirebaseConfig(firebaseConfig)) {
    throw new Error('Configuração Firebase inválida.');
  }

  if (document.sourceType === 'extracto') {
    return await processStatementDocument(context, callbacks, accounts, expenses, timelineEntries);
  }

  return await processInvoiceDocument(context, callbacks, accounts, expenses, timelineEntries);
}
