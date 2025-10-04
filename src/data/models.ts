export type AccountType = 'corrente' | 'poupanca' | 'cartao' | 'outro';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
}

export interface Expense {
  id: string;
  accountId: string;
  description: string;
  category: string;
  amount: number;
  currency: string;
  dueDate: string;
  recurrence?: 'mensal' | 'anual' | 'semestral' | 'pontual';
  fixed: boolean;
  status: 'planeado' | 'pago' | 'em-analise';
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
  notes?: string;
  extractedAt?: string;
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
  firebaseConfig?: Record<string, string>;
  autoDetectFixedExpenses: boolean;
}
