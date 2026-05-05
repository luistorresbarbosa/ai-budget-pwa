export type AccountType = "checking" | "savings" | "credit" | "debit" | "cash";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  currency: string;
  color: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  accountId: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  notes?: string;
  createdAt: string;
}

export interface AppData {
  accounts: Account[];
  expenses: Expense[];
  version: number;
}

export const DEFAULT_CATEGORIES = [
  "Alimentação",
  "Transportes",
  "Casa",
  "Saúde",
  "Lazer",
  "Educação",
  "Compras",
  "Subscrições",
  "Outros",
] as const;

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  credit: "Cartão de crédito",
  debit: "Cartão de débito",
  cash: "Dinheiro",
};

export const ACCOUNT_COLORS = [
  "#0ea5e9",
  "#22c55e",
  "#f97316",
  "#a855f7",
  "#ef4444",
  "#14b8a6",
  "#eab308",
  "#ec4899",
];
