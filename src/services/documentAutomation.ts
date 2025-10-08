import type {
  Account,
  DocumentMetadata,
  Expense,
  RecurringExpenseCandidate,
  StatementSettlement,
  Supplier,
  TimelineEntry
} from '../data/models';
import { persistAccount } from './accounts';
import { persistExpense } from './expenses';
import { persistSupplier } from './suppliers';
import { persistTimelineEntry } from './timeline';
import {
  buildDocumentExpenseDeduplicationKey,
  buildExpenseIdFromDeduplicationKey,
  buildRecurringExpenseDeduplicationKey,
  deriveExpenseFromDocument,
  deriveTimelineEntryFromExpense,
  findAccountByHint
} from './expenseDerivation';
import { validateFirebaseConfig, type FirebaseConfig } from './firebase';

interface ProcessDocumentContext {
  document: DocumentMetadata;
  accounts: Account[];
  expenses: Expense[];
  suppliers: Supplier[];
  timelineEntries: TimelineEntry[];
  firebaseConfig: FirebaseConfig;
}

interface ProcessDocumentCallbacks {
  onAccountUpsert?: (account: Account) => void;
  onExpenseUpsert?: (expense: Expense) => void;
  onSupplierUpsert?: (supplier: Supplier) => void;
  onTimelineUpsert?: (entry: TimelineEntry) => void;
}

interface EnsureAccountOptions {
  accountHint?: string;
  document: DocumentMetadata;
  existingAccounts: Account[];
}

interface EnsureAccountResult {
  account: Account | undefined;
  accounts: Account[];
  created: boolean;
}

interface EnsureSupplierResult {
  supplier: Supplier | undefined;
  suppliers: Supplier[];
  created: boolean;
  updated: boolean;
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

function isLikelyIban(candidate: string | undefined): boolean {
  if (!candidate) {
    return false;
  }
  const normalised = candidate.replace(/\s+/g, '').toUpperCase();
  if (normalised.length < 15) {
    return false;
  }
  return /^[A-Z]{2}[0-9A-Z]{13,32}$/.test(normalised);
}

function ensureAccount(options: EnsureAccountOptions): EnsureAccountResult {
  const { accountHint, document, existingAccounts } = options;
  const trimmedHint = accountHint?.trim();

  if (trimmedHint) {
    const matched = findAccountByHint(trimmedHint, existingAccounts);
    if (matched) {
      return { account: matched, accounts: existingAccounts, created: false };
    }
  }

  // Do not auto-create accounts; require manual setup
  return { account: undefined, accounts: existingAccounts, created: false };
}

function ensureSupplier(document: DocumentMetadata, existingSuppliers: Supplier[]): EnsureSupplierResult {
  const baseName = document.companyName?.trim();
  const normalisedName = normaliseSupplierName(baseName);

  const matchedById = document.supplierId
    ? existingSuppliers.find((supplier) => supplier.id === document.supplierId)
    : undefined;

  let matchedByCanonicalName: Supplier | undefined;
  let matchedByAlias: Supplier | undefined;

  if (!matchedById && normalisedName) {
    matchedByCanonicalName = existingSuppliers.find(
      (supplier) => normaliseSupplierName(supplier.name) === normalisedName
    );
  }

  let matched = matchedById ?? matchedByCanonicalName ?? matchedByAlias;

  // If matched is a reference, resolve to canonical supplier
  if (matched?.referenceToId) {
    matched = existingSuppliers.find((s) => s.id === matched!.referenceToId) ?? matched;
  }

  if (matched) {
    const metadata = mergeSupplierMetadata(document, matched);
    const metadataSerialised = metadata ? JSON.stringify(metadata) : null;
    const existingMetadataSerialised = matched.metadata ? JSON.stringify(matched.metadata) : null;
    const requiresUpdate = metadataSerialised !== existingMetadataSerialised;

    if (!requiresUpdate) {
      return { supplier: matched, suppliers: existingSuppliers, created: false, updated: false };
    }

    const updatedSupplier: Supplier = {
      ...matched,
      metadata: metadata ?? matched.metadata
    };

    const nextSuppliers = [
      updatedSupplier,
      ...existingSuppliers.filter((supplier) => supplier.id !== updatedSupplier.id)
    ];
    return { supplier: updatedSupplier, suppliers: nextSuppliers, created: false, updated: true };
  }

  if (!baseName && !document.supplierId) {
    return { supplier: undefined, suppliers: existingSuppliers, created: false, updated: false };
  }

  const supplierName = baseName ?? document.originalName;
  const newSupplier: Supplier = {
    id: document.supplierId ?? buildAutoSupplierId(supplierName, document.id, existingSuppliers),
    name: supplierName,
    metadata: mergeSupplierMetadata(document, undefined)
  };

  if (!newSupplier.metadata) {
    delete newSupplier.metadata;
  }

  const nextSuppliers = [newSupplier, ...existingSuppliers.filter((supplier) => supplier.id !== newSupplier.id)];
  return { supplier: newSupplier, suppliers: nextSuppliers, created: true, updated: true };
}

function ensureSupplierForCandidate(
  candidate: RecurringExpenseCandidate,
  document: DocumentMetadata,
  existingSuppliers: Supplier[]
): EnsureSupplierResult {
  const name = candidate.description?.trim();
  if (!name) {
    return { supplier: undefined, suppliers: existingSuppliers, created: false, updated: false };
  }

  const matched = existingSuppliers.find((supplier) => supplierMatchesName(supplier, name));
  if (matched) {
    return { supplier: matched, suppliers: existingSuppliers, created: false, updated: false };
  }

  const syntheticDocument: DocumentMetadata = {
    ...document,
    companyName: name,
    accountHint: candidate.accountHint ?? document.accountHint,
    statementAccountIban: document.statementAccountIban
  };

  const metadata = mergeSupplierMetadata(syntheticDocument, undefined);
  const newSupplier: Supplier = {
    id: buildAutoSupplierId(name, document.id, existingSuppliers),
    name,
    metadata: metadata ?? undefined
  };

  if (!newSupplier.metadata) {
    delete newSupplier.metadata;
  }

  const nextSuppliers = [newSupplier, ...existingSuppliers.filter((supplier) => supplier.id !== newSupplier.id)];
  return { supplier: newSupplier, suppliers: nextSuppliers, created: true, updated: true };
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

function amountApproximatelyEquals(a: number | undefined, b: number | undefined): boolean {
  if (typeof a !== 'number' || typeof b !== 'number') {
    return false;
  }
  const delta = Math.abs(a - b);
  const tolerance = Math.max(0.5, Math.abs(b) * 0.02);
  return delta <= tolerance;
}

function buildAutoSupplierId(name: string | undefined, documentId: string, existingSuppliers: Supplier[]): string {
  const base = normaliseIdentifier(name ?? '') || normaliseIdentifier(documentId) || crypto.randomUUID();
  let candidate = `sup-${base.slice(0, 24) || 'novo'}`;
  let counter = 1;
  while (existingSuppliers.some((supplier) => supplier.id === candidate)) {
    const suffix = `-${counter++}`;
    candidate = `sup-${base.slice(0, Math.max(4, 24 - suffix.length))}${suffix}`;
  }
  return candidate;
}

function normaliseSupplierName(value: string | undefined): string {
  return (
    value
      ?.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase() ?? ''
  );
}

function buildSupplierNameCandidates(supplier: Supplier): string[] {
  const candidates = new Set<string>();
  if (supplier.name?.trim()) {
    candidates.add(supplier.name.trim());
  }
  return Array.from(candidates);
}

function supplierMatchesName(supplier: Supplier, candidateName: string | undefined): boolean {
  const target = normaliseSupplierName(candidateName);
  if (!target) {
    return false;
  }
  return buildSupplierNameCandidates(supplier).some(
    (candidate) => normaliseSupplierName(candidate) === target
  );
}

function mergeSupplierMetadata(
  document: DocumentMetadata,
  existing: Supplier | undefined
): Supplier['metadata'] | undefined {
  const accountHints = new Set<string>();
  existing?.metadata?.accountHints?.forEach((hint) => {
    if (typeof hint === 'string' && hint.trim()) {
      accountHints.add(hint);
    }
  });
  if (document.accountHint) {
    accountHints.add(document.accountHint);
  }
  if (document.statementAccountIban) {
    accountHints.add(document.statementAccountIban);
  }

  const metadata: Supplier['metadata'] = {
    ...existing?.metadata,
    taxId: document.supplierTaxId ?? existing?.metadata?.taxId,
    accountHints: accountHints.size > 0 ? Array.from(accountHints) : existing?.metadata?.accountHints,
    notes: existing?.metadata?.notes
  };

  if (!metadata.taxId && !metadata.accountHints && !metadata.notes) {
    return existing?.metadata;
  }

  return metadata;
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

async function settleExpensesFromStatement(
  settlements: StatementSettlement[],
  accountId: string,
  document: DocumentMetadata,
  expensesSnapshot: Expense[],
  firebaseConfig: FirebaseConfig,
  callbacks: ProcessDocumentCallbacks
): Promise<{ expenses: Expense[] }> {
  if (!Array.isArray(settlements) || settlements.length === 0) {
    return { expenses: expensesSnapshot };
  }

  let currentExpenses = expensesSnapshot;

  for (const settlement of settlements) {
    if (!settlement) {
      continue;
    }

    const candidateExpenses = currentExpenses.filter((expense) => expense.status !== 'pago');

    let matchedExpense = settlement.expenseIdHint
      ? candidateExpenses.find((expense) => expense.id === settlement.expenseIdHint)
      : undefined;

    if (!matchedExpense && settlement.documentIdHint) {
      matchedExpense = candidateExpenses.find((expense) => expense.documentId === settlement.documentIdHint);
    }

    const normalisedDescription = settlement.description ? normaliseIdentifier(settlement.description) : '';

    if (!matchedExpense && normalisedDescription) {
      matchedExpense = candidateExpenses.find((expense) => {
        if (expense.accountId !== accountId) {
          return false;
        }
        const expenseDescription = normaliseIdentifier(expense.description);
        if (!expenseDescription) {
          return false;
        }
        const descriptionMatches =
          expenseDescription === normalisedDescription ||
          expenseDescription.includes(normalisedDescription) ||
          normalisedDescription.includes(expenseDescription);

        if (!descriptionMatches) {
          return false;
        }

        if (settlement.amount != null) {
          return amountApproximatelyEquals(expense.amount, settlement.amount);
        }
        return true;
      });
    }

    if (!matchedExpense && settlement.amount != null) {
      matchedExpense = candidateExpenses.find((expense) => {
        if (expense.accountId !== accountId) {
          return false;
        }
        return amountApproximatelyEquals(expense.amount, settlement.amount);
      });
    }

    if (!matchedExpense || matchedExpense.accountId !== accountId) {
      continue;
    }

    if (matchedExpense.status === 'pago') {
      continue;
    }

    const paidAt = settlement.settledOn ?? matchedExpense.paidAt ?? document.uploadDate;
    const updatedExpense: Expense = {
      ...matchedExpense,
      status: 'pago',
      paidAt
    };

    await persistExpense(updatedExpense, firebaseConfig);
    callbacks.onExpenseUpsert?.(updatedExpense);

    currentExpenses = [
      updatedExpense,
      ...currentExpenses.filter((expense) => expense.id !== updatedExpense.id)
    ];
  }

  return { expenses: currentExpenses };
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
  supplierId: string | undefined,
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
  const deduplicationKey =
    existingExpense?.deduplicationKey ?? buildRecurringExpenseDeduplicationKey(candidate, document);
  const expenseId =
    existingExpense?.id ??
    (deduplicationKey
      ? buildExpenseIdFromDeduplicationKey('rec-exp', deduplicationKey)
      : buildRecurringExpenseId(document.id, candidate.description));

  const expense: Expense = {
    id: expenseId,
    documentId: document.id,
    accountId,
    description: existingExpense?.description ?? candidate.description,
    category: existingExpense?.category ?? 'Despesas Fixas',
    amount,
    currency: candidate.currency ?? document.currency ?? existingExpense?.currency ?? 'EUR',
    dueDate: dueDate ?? document.dueDate ?? existingExpense?.dueDate ?? document.uploadDate,
    recurrence: 'mensal',
    fixed: true,
    status: existingExpense?.status ?? 'em-analise',
    supplierId: existingExpense?.supplierId ?? supplierId,
    deduplicationKey: deduplicationKey ?? existingExpense?.deduplicationKey
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
  callbacks.onAccountUpsert?.(ensured.account);
  return ensured.accounts;
}

async function ensureSupplierPersisted(
  ensured: EnsureSupplierResult,
  firebaseConfig: FirebaseConfig,
  callbacks: ProcessDocumentCallbacks
): Promise<Supplier[]> {
  if (!ensured.supplier) {
    return ensured.suppliers;
  }

  if (ensured.created || ensured.updated) {
    await persistSupplier(ensured.supplier, firebaseConfig);
  }

  callbacks.onSupplierUpsert?.(ensured.supplier);
  return ensured.suppliers;
}

async function processInvoiceDocument(
  context: ProcessDocumentContext,
  callbacks: ProcessDocumentCallbacks,
  accountsSnapshot: Account[],
  expensesSnapshot: Expense[],
  suppliersSnapshot: Supplier[],
  timelineSnapshot: TimelineEntry[]
): Promise<{ accounts: Account[]; expenses: Expense[]; suppliers: Supplier[]; timelineEntries: TimelineEntry[] }> {
  const { document, firebaseConfig } = context;
  const supplierResult = ensureSupplier(document, suppliersSnapshot);
  const updatedSuppliers = await ensureSupplierPersisted(supplierResult, firebaseConfig, callbacks);
  const documentDedupKey = buildDocumentExpenseDeduplicationKey(document);
  const expectedExpenseId = documentDedupKey
    ? buildExpenseIdFromDeduplicationKey('exp', documentDedupKey)
    : undefined;
  const accountResult = ensureAccount({
    accountHint: document.accountHint,
    document,
    existingAccounts: accountsSnapshot
  });

  const updatedAccounts = await ensureAccountPersisted(accountResult, firebaseConfig, callbacks);

  const existingExpense = expensesSnapshot.find(
    (expense) =>
      expense.documentId === document.id ||
      expense.id === `doc-exp-${document.id}` ||
      (expectedExpenseId ? expense.id === expectedExpenseId : false) ||
      (documentDedupKey ? expense.deduplicationKey === documentDedupKey : false)
  );

  const supplierId = document.supplierId ?? supplierResult.supplier?.id ?? existingExpense?.supplierId;
  const derivedExpense = deriveExpenseFromDocument(
    document,
    updatedAccounts,
    existingExpense ?? undefined,
    supplierId
  );
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

  return {
    accounts: updatedAccounts,
    expenses: currentExpenses,
    suppliers: updatedSuppliers,
    timelineEntries: currentTimeline
  };
}

async function processStatementDocument(
  context: ProcessDocumentContext,
  callbacks: ProcessDocumentCallbacks,
  accountsSnapshot: Account[],
  expensesSnapshot: Expense[],
  suppliersSnapshot: Supplier[],
  timelineSnapshot: TimelineEntry[]
): Promise<{ accounts: Account[]; expenses: Expense[]; suppliers: Supplier[]; timelineEntries: TimelineEntry[] }> {
  const { document, firebaseConfig } = context;
  const recurringExpenses = document.recurringExpenses ?? [];
  let currentAccounts = accountsSnapshot;
  let currentExpenses = expensesSnapshot;
  let currentSuppliers = suppliersSnapshot;
  let currentTimeline = timelineSnapshot;

  const documentSupplierResult = ensureSupplier(document, currentSuppliers);
  currentSuppliers = await ensureSupplierPersisted(documentSupplierResult, firebaseConfig, callbacks);

  const statementAccountHint = document.statementAccountIban ?? document.accountHint;
  const statementAccountResult = ensureAccount({
    accountHint: statementAccountHint,
    document,
    existingAccounts: currentAccounts
  });

  currentAccounts = await ensureAccountPersisted(statementAccountResult, firebaseConfig, callbacks);
  const statementAccountId = statementAccountResult.account?.id;

  for (const candidate of recurringExpenses) {
    if (!candidate || typeof candidate.description !== 'string' || candidate.description.trim().length === 0) {
      continue;
    }

    const accountResult = ensureAccount({
      accountHint: candidate.accountHint ?? statementAccountHint,
      document,
      existingAccounts: currentAccounts
    });

    currentAccounts = await ensureAccountPersisted(accountResult, firebaseConfig, callbacks);

    const accountId = accountResult.account?.id ?? statementAccountId;
    if (!accountId) {
      continue;
    }

    const supplierResult = ensureSupplierForCandidate(candidate, document, currentSuppliers);
    currentSuppliers = await ensureSupplierPersisted(supplierResult, firebaseConfig, callbacks);
    const supplierId = supplierResult.supplier?.id;

    const fallbackExpenseId = buildRecurringExpenseId(document.id, candidate.description);
    const candidateDedupKey = buildRecurringExpenseDeduplicationKey(candidate, document);
    const hashedExpenseId = candidateDedupKey
      ? buildExpenseIdFromDeduplicationKey('rec-exp', candidateDedupKey)
      : undefined;
    const existingExpense = currentExpenses.find((expense) => {
      if (hashedExpenseId && expense.id === hashedExpenseId) {
        return true;
      }
      if (expense.id === fallbackExpenseId) {
        return true;
      }
      if (candidateDedupKey && expense.deduplicationKey === candidateDedupKey) {
        return true;
      }
      return false;
    });
    const derivedExpense = buildRecurringExpense(
      candidate,
      document,
      accountId,
      supplierId,
      existingExpense
    );

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

  if (statementAccountId) {
    const settlementResult = await settleExpensesFromStatement(
      document.statementSettlements ?? [],
      statementAccountId,
      document,
      currentExpenses,
      firebaseConfig,
      callbacks
    );
    currentExpenses = settlementResult.expenses;
  }

  return {
    accounts: currentAccounts,
    expenses: currentExpenses,
    suppliers: currentSuppliers,
    timelineEntries: currentTimeline
  };
}

export async function processDocumentForDerivedEntities(
  context: ProcessDocumentContext,
  callbacks: ProcessDocumentCallbacks = {}
): Promise<{ accounts: Account[]; expenses: Expense[]; suppliers: Supplier[]; timelineEntries: TimelineEntry[] }> {
  const { document, firebaseConfig, accounts, expenses, suppliers, timelineEntries } = context;

  if (!validateFirebaseConfig(firebaseConfig)) {
    throw new Error('Configuração Firebase inválida.');
  }

  if (document.sourceType === 'extracto') {
    return await processStatementDocument(context, callbacks, accounts, expenses, suppliers, timelineEntries);
  }

  return await processInvoiceDocument(context, callbacks, accounts, expenses, suppliers, timelineEntries);
}
