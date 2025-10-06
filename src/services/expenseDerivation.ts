import type { Account, DocumentMetadata, Expense, TimelineEntry } from '../data/models';

const ACCOUNT_IDENTIFIER_KEYS = ['iban', 'ibanNumber', 'accountNumber', 'number', 'identifier'] as const;

function normaliseIdentifier(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

function extractAccountCandidates(account: Account): string[] {
  const candidateValues = new Set<string>();
  candidateValues.add(account.id);
  candidateValues.add(account.name);

  const accountRecord = account as Account & Record<string, unknown>;
  for (const key of ACCOUNT_IDENTIFIER_KEYS) {
    const value = accountRecord[key];
    if (typeof value === 'string') {
      candidateValues.add(value);
    }
  }

  const metadata = accountRecord['metadata'];
  if (metadata && typeof metadata === 'object') {
    for (const key of ACCOUNT_IDENTIFIER_KEYS) {
      const value = (metadata as Record<string, unknown>)[key];
      if (typeof value === 'string') {
        candidateValues.add(value);
      }
    }
  }

  return Array.from(candidateValues).filter((candidate) => candidate.trim().length > 0);
}

export function resolveAccountId(
  accountHint: string | undefined,
  accounts: Account[],
  existingAccountId?: string
): string | undefined {
  if (existingAccountId) {
    return existingAccountId;
  }
  if (accounts.length === 0) {
    return undefined;
  }
  if (!accountHint || accountHint.trim().length === 0) {
    return accounts.length === 1 ? accounts[0].id : undefined;
  }

  const normalisedHint = normaliseIdentifier(accountHint);
  if (!normalisedHint) {
    return accounts.length === 1 ? accounts[0].id : undefined;
  }

  for (const account of accounts) {
    const candidates = extractAccountCandidates(account)
      .map(normaliseIdentifier)
      .filter((candidate) => candidate.length > 0);

    const hasMatch = candidates.some((candidate) => {
      if (candidate === normalisedHint) {
        return true;
      }
      if (candidate.length < 4) {
        return false;
      }
      return candidate.includes(normalisedHint) || normalisedHint.includes(candidate);
    });

    if (hasMatch) {
      return account.id;
    }
  }

  return accounts.length === 1 ? accounts[0].id : undefined;
}

export function findAccountByHint(
  accountHint: string | undefined,
  accounts: Account[]
): Account | undefined {
  if (!accountHint || accountHint.trim().length === 0) {
    return undefined;
  }
  const normalisedHint = normaliseIdentifier(accountHint);
  if (!normalisedHint) {
    return undefined;
  }

  return accounts.find((account) => {
    const candidates = extractAccountCandidates(account)
      .map(normaliseIdentifier)
      .filter((candidate) => candidate.length > 0);

    return candidates.some((candidate) => {
      if (candidate === normalisedHint) {
        return true;
      }
      if (candidate.length < 4) {
        return false;
      }
      return candidate.includes(normalisedHint) || normalisedHint.includes(candidate);
    });
  });
}

function humaniseDocumentName(originalName: string): string {
  const withoutExtension = originalName.replace(/\.[^/.]+$/, '');
  const withSpaces = withoutExtension.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (withSpaces.length === 0) {
    return 'Documento';
  }
  return withSpaces
    .split(' ')
    .map((segment) => (segment.length > 0 ? segment[0].toUpperCase() + segment.slice(1) : segment))
    .join(' ');
}

export function deriveExpenseFromDocument(
  metadata: DocumentMetadata,
  accounts: Account[],
  existingExpense?: Expense
): Expense | null {
  const resolvedAccountId = resolveAccountId(metadata.accountHint, accounts, existingExpense?.accountId);
  const resolvedAmount = metadata.amount ?? existingExpense?.amount;
  const resolvedDueDate = metadata.dueDate ?? existingExpense?.dueDate ?? metadata.uploadDate;

  if (!existingExpense && (resolvedAmount === undefined || !metadata.dueDate)) {
    return null;
  }
  if (!resolvedAccountId) {
    return existingExpense ?? null;
  }
  if (resolvedAmount === undefined) {
    return existingExpense ?? null;
  }

  const expense: Expense = {
    id: existingExpense?.id ?? `doc-exp-${metadata.id}`,
    documentId: metadata.id,
    accountId: resolvedAccountId,
    description:
      existingExpense?.description ?? metadata.companyName ?? humaniseDocumentName(metadata.originalName),
    category: existingExpense?.category ?? metadata.expenseType ?? 'Outros',
    amount: resolvedAmount,
    currency: metadata.currency ?? existingExpense?.currency ?? 'EUR',
    dueDate: resolvedDueDate,
    recurrence: existingExpense?.recurrence,
    fixed: existingExpense?.fixed ?? true,
    status: existingExpense?.status ?? 'planeado'
  };

  return expense;
}

export function deriveTimelineEntryFromExpense(
  expense: Expense,
  existingEntry?: TimelineEntry
): TimelineEntry | null {
  if (!expense.dueDate) {
    return existingEntry ?? null;
  }

  const entry: TimelineEntry = {
    id: existingEntry?.id ?? `doc-timeline-${expense.documentId ?? expense.id}`,
    date: expense.dueDate,
    type: 'despesa',
    description: existingEntry?.description ?? expense.description,
    amount: expense.amount,
    currency: expense.currency,
    linkedExpenseId: expense.id
  };

  return entry;
}
