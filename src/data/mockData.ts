import type { Account, DocumentMetadata, Expense, Supplier, TimelineEntry, Transfer } from './models';

export const mockAccounts: Account[] = [
  {
    id: 'acc-1',
    name: 'Conta Corrente',
    type: 'corrente',
    currency: 'EUR',
    validationStatus: 'validada'
  },
  {
    id: 'acc-2',
    name: 'Poupança Objetivos',
    type: 'poupanca',
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
    status: 'planeado',
    supplierId: 'sup-1'
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
    status: 'pago',
    supplierId: 'sup-2',
    paidAt: new Date().toISOString()
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
    extractedAt: new Date().toISOString(),
    supplierId: 'sup-1'
  }
];

export const mockSuppliers: Supplier[] = [
  {
    id: 'sup-1',
    name: 'Energia Lisboa',
    metadata: {
      accountHints: ['PT50-1234']
    }
  },
  {
    id: 'sup-2',
    name: 'Move+ Ginásio'
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
