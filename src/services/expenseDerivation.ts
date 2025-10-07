import type {
  Account,
  DocumentMetadata,
  Expense,
  RecurringExpenseCandidate,
  TimelineEntry
} from '../data/models';

const ACCOUNT_IDENTIFIER_KEYS = ['iban', 'ibanNumber', 'accountNumber', 'number', 'identifier'] as const;
const ACCOUNT_ARRAY_METADATA_KEYS = ['hints', 'accountHints', 'aliases'] as const;

function normaliseIdentifier(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

function normaliseDeduplicationComponent(value: string | number | undefined): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toFixed(2);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const cleaned = trimmed.replace(/\s+/g, ' ');
    return cleaned
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
  return undefined;
}

function buildDeduplicationKey(components: (string | number | undefined)[]): string | undefined {
  const segments = components
    .map((component) => normaliseDeduplicationComponent(component))
    .filter((segment): segment is string => Boolean(segment));
  if (segments.length === 0) {
    return undefined;
  }
  return segments.join('|');
}

function computeStableHash(value: string): string {
  let h1 = 0xdeadbeef ^ value.length;
  let h2 = 0x41c6ce57 ^ value.length;

  for (let i = 0; i < value.length; i += 1) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const combined = (h2 & 0x1fffff) * 4294967296 + (h1 >>> 0);
  return combined.toString(36);
}

export function buildExpenseIdFromDeduplicationKey(prefix: string, deduplicationKey: string): string {
  const normalised = normaliseIdentifier(deduplicationKey);
  const hash = computeStableHash(normalised || deduplicationKey);
  return `${prefix}-${hash}`;
}

export function buildDocumentExpenseDeduplicationKey(metadata: DocumentMetadata): string | undefined {
  return buildDeduplicationKey([
    metadata.sourceType ?? 'fatura',
    metadata.companyName ?? metadata.originalName,
    metadata.amount,
    metadata.currency,
    metadata.dueDate,
    metadata.accountHint,
    metadata.supplierTaxId
  ]);
}

export function buildRecurringExpenseDeduplicationKey(
  candidate: RecurringExpenseCandidate,
  document: DocumentMetadata
): string | undefined {
  return buildDeduplicationKey([
    document.sourceType ?? 'extracto',
    document.statementAccountIban ?? document.accountHint,
    candidate.description,
    candidate.averageAmount,
    candidate.currency,
    candidate.accountHint,
    candidate.dayOfMonth
  ]);
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
    const metadataRecord = metadata as Record<string, unknown>;
    for (const key of ACCOUNT_IDENTIFIER_KEYS) {
      const value = metadataRecord[key];
      if (typeof value === 'string') {
        candidateValues.add(value);
      }
    }

    for (const key of ACCOUNT_ARRAY_METADATA_KEYS) {
      const value = metadataRecord[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string') {
            candidateValues.add(item);
          }
        }
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
  existingExpense?: Expense,
  supplierIdOverride?: string
): Expense | null {
  const resolvedAccountId = resolveAccountId(metadata.accountHint, accounts, existingExpense?.accountId);
  const resolvedAmount = metadata.amount ?? existingExpense?.amount;
  const resolvedDueDate = metadata.dueDate ?? existingExpense?.dueDate ?? metadata.uploadDate;
  const deduplicationKey = existingExpense?.deduplicationKey ?? buildDocumentExpenseDeduplicationKey(metadata);

  if (!existingExpense && (resolvedAmount === undefined || !metadata.dueDate)) {
    return null;
  }
  if (!resolvedAccountId) {
    return existingExpense ?? null;
  }
  if (resolvedAmount === undefined) {
    return existingExpense ?? null;
  }

  const expenseId =
    existingExpense?.id ??
    (deduplicationKey ? buildExpenseIdFromDeduplicationKey('exp', deduplicationKey) : `doc-exp-${metadata.id}`);

  const expense: Expense = {
    id: expenseId,
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
    status: existingExpense?.status ?? 'planeado',
    supplierId: supplierIdOverride ?? metadata.supplierId ?? existingExpense?.supplierId,
    deduplicationKey: deduplicationKey ?? existingExpense?.deduplicationKey
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
    id: existingEntry?.id ?? `doc-timeline-${expense.id}`,
    date: expense.dueDate,
    type: 'despesa',
    description: existingEntry?.description ?? expense.description,
    amount: expense.amount,
    currency: expense.currency,
    linkedExpenseId: expense.id
  };

  return entry;
}
