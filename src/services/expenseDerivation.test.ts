import { describe, expect, it } from 'vitest';
import type { Account, DocumentMetadata, Expense, RecurringExpenseCandidate } from '../data/models';
import {
  buildDocumentExpenseDeduplicationKey,
  buildExpenseIdFromDeduplicationKey,
  buildRecurringExpenseDeduplicationKey,
  deriveExpenseFromDocument
} from './expenseDerivation';

describe('expenseDerivation deduplication', () => {
  const baseAccount: Account = {
    id: 'acc-1',
    name: 'Conta Principal',
    type: 'corrente',
    balance: 0,
    currency: 'EUR'
  };

  const baseDocument: DocumentMetadata = {
    id: 'doc-1',
    originalName: 'fatura-gym.pdf',
    uploadDate: '2024-05-10T00:00:00.000Z',
    sourceType: 'fatura',
    amount: 29.9,
    currency: 'EUR',
    dueDate: '2024-05-20T00:00:00.000Z',
    accountHint: 'PT50000123456789012345',
    companyName: 'Ginásio Fit'
  };

  it('gera uma chave de deduplicação estável para faturas', () => {
    const keyA = buildDocumentExpenseDeduplicationKey(baseDocument);
    const keyB = buildDocumentExpenseDeduplicationKey({
      ...baseDocument,
      companyName: '  Ginásio   Fit  ',
      amount: 29.9
    });

    expect(keyA).toBeTruthy();
    expect(keyA).toBe(keyB);
  });

  it('atribui id e deduplicationKey determinísticos ao derivar despesas de documentos', () => {
    const expense = deriveExpenseFromDocument(baseDocument, [baseAccount]);
    expect(expense).toBeTruthy();
    const dedupKey = buildDocumentExpenseDeduplicationKey(baseDocument);

    expect(expense?.deduplicationKey).toBe(dedupKey);
    if (dedupKey) {
      expect(expense?.id).toBe(buildExpenseIdFromDeduplicationKey('exp', dedupKey));
    }
  });

  it('mantém o identificador existente quando já há uma despesa com chave própria', () => {
    const existingExpense: Expense = {
      id: 'custom-expense-id',
      deduplicationKey: 'manual|key',
      accountId: baseAccount.id,
      description: 'Ginásio Fit',
      category: 'Outros',
      amount: baseDocument.amount!,
      currency: baseDocument.currency!,
      dueDate: baseDocument.dueDate!,
      fixed: true,
      status: 'planeado',
      supplierId: undefined
    };

    const expense = deriveExpenseFromDocument(baseDocument, [baseAccount], existingExpense);
    expect(expense?.id).toBe(existingExpense.id);
    expect(expense?.deduplicationKey).toBe(existingExpense.deduplicationKey);
  });

  it('gera chaves estáveis para despesas recorrentes detectadas em extractos', () => {
    const candidate: RecurringExpenseCandidate = {
      description: 'Seguro Automóvel',
      averageAmount: 42.5,
      currency: 'EUR',
      accountHint: 'PT50000123456789012345',
      dayOfMonth: 12
    };

    const statement: DocumentMetadata = {
      ...baseDocument,
      sourceType: 'extracto',
      statementAccountIban: 'PT50000123456789012345',
      accountHint: 'PT50000123456789012345'
    };

    const keyA = buildRecurringExpenseDeduplicationKey(candidate, statement);
    const keyB = buildRecurringExpenseDeduplicationKey({ ...candidate }, statement);

    expect(keyA).toBeTruthy();
    expect(keyA).toBe(keyB);
  });
});
