import type { FirebaseConfig } from '../services/firebase';
import { DEFAULT_INTEGRATION_LOGS_PAGE_SIZE } from '../types/integrationLogs';

export type AccountType = 'corrente' | 'poupanca' | 'cartao' | 'outro';

export type AccountValidationStatus = 'validada' | 'validacao-manual';

export interface AccountMetadata {
  iban?: string;
  ibanNumber?: string;
  accountNumber?: string;
  number?: string;
  identifier?: string;
  hints?: string[];
  aliases?: string[];
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  metadata?: AccountMetadata;
  validationStatus?: AccountValidationStatus;
}

export interface SupplierMetadata {
  taxId?: string;
  accountHints?: string[];
  aliases?: string[];
  notes?: string;
}

export interface Supplier {
  id: string;
  name: string;
  metadata?: SupplierMetadata;
}

export interface Expense {
  id: string;
  accountId: string;
  description: string;
  category: string;
  documentId?: string;
  amount: number;
  currency: string;
  dueDate: string;
  recurrence?: 'mensal' | 'anual' | 'semestral' | 'pontual';
  fixed: boolean;
  status: 'planeado' | 'pago' | 'em-analise';
  supplierId?: string;
  paidAt?: string;
}

export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currency: string;
  scheduleDate: string;
  notes?: string;
  status: 'agendado' | 'executado' | 'falhado';
}

export interface DocumentMetadata {
  id: string;
  originalName: string;
  uploadDate: string;
  sourceType: 'fatura' | 'recibo' | 'extracto';
  amount?: number;
  currency?: string;
  dueDate?: string;
  accountHint?: string;
  companyName?: string;
  expenseType?: string;
  notes?: string;
  extractedAt?: string;
  recurringExpenses?: RecurringExpenseCandidate[];
  supplierId?: string;
  supplierTaxId?: string;
  statementAccountIban?: string;
  statementSettlements?: StatementSettlement[];
}

export interface RecurringExpenseCandidate {
  description: string;
  averageAmount?: number;
  currency?: string;
  dayOfMonth?: number;
  accountHint?: string;
  monthsObserved?: string[];
  notes?: string;
}

export interface StatementSettlement {
  description?: string;
  amount?: number;
  currency?: string;
  settledOn?: string;
  documentIdHint?: string;
  expenseIdHint?: string;
  supplierName?: string;
  supplierTaxId?: string;
}

export interface TimelineEntry {
  id: string;
  date: string;
  type: 'despesa' | 'vencimento' | 'transferencia';
  description: string;
  amount: number;
  currency: string;
  linkedExpenseId?: string;
  linkedTransferId?: string;
}

export interface AppSettings {
  openAIApiKey?: string;
  openAIBaseUrl?: string;
  openAIModel?: string;
  firebaseConfig?: FirebaseConfig;
  autoDetectFixedExpenses: boolean;
  integrationLogsPageSize: number;
}

export const DEFAULT_INTEGRATION_LOGS_PAGE_SIZE_SETTING = DEFAULT_INTEGRATION_LOGS_PAGE_SIZE;
