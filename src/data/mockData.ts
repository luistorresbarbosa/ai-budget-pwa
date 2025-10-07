import type { Account, DocumentMetadata, Expense, TimelineEntry, Transfer } from './models';

export const mockAccounts: Account[] = [
  {
    id: 'acc-1',
    name: 'Conta Corrente',
    type: 'corrente',
    balance: 2350.23,
    currency: 'EUR',
    validationStatus: 'validada'
  },
  {
    id: 'acc-2',
    name: 'Poupança Objetivos',
    type: 'poupanca',
    balance: 5400,
    currency: 'EUR',
    validationStatus: 'validada'
  }
];

export const mockExpenses: Expense[] = [
  {
    id: 'exp-1',
    accountId: 'acc-1',
    description: 'Renda',
    category: 'Habitação',
    amount: 850,
    currency: 'EUR',
    dueDate: new Date().toISOString(),
    recurrence: 'mensal',
    fixed: true,
    status: 'planeado'
  },
  {
    id: 'exp-2',
    accountId: 'acc-1',
    description: 'Ginásio',
    category: 'Saúde',
    amount: 39.9,
    currency: 'EUR',
    dueDate: new Date().toISOString(),
    recurrence: 'mensal',
    fixed: true,
    status: 'pago'
  }
];

export const mockTransfers: Transfer[] = [
  {
    id: 'transf-1',
    fromAccountId: 'acc-1',
    toAccountId: 'acc-2',
    amount: 200,
    currency: 'EUR',
    scheduleDate: new Date().toISOString(),
    notes: 'Guardar para férias',
    status: 'agendado'
  }
];

export const mockDocuments: DocumentMetadata[] = [
  {
    id: 'doc-1',
    originalName: 'Fatura_Energia.pdf',
    uploadDate: new Date().toISOString(),
    sourceType: 'fatura',
    amount: 62.3,
    currency: 'EUR',
    dueDate: new Date().toISOString(),
    accountHint: 'Conta Corrente',
    companyName: 'Energia Lisboa',
    expenseType: 'Luz',
    extractedAt: new Date().toISOString()
  }
];

export const mockTimeline: TimelineEntry[] = [
  {
    id: 'tl-1',
    date: new Date().toISOString(),
    type: 'despesa',
    description: 'Renda',
    amount: 850,
    currency: 'EUR',
    linkedExpenseId: 'exp-1'
  },
  {
    id: 'tl-2',
    date: new Date().toISOString(),
    type: 'transferencia',
    description: 'Poupança Férias',
    amount: 200,
    currency: 'EUR',
    linkedTransferId: 'transf-1'
  }
];
