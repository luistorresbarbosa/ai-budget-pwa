export interface MonthlyProjectionExpense {
  description: string;
  amount: number;
  currency: string;
}

export interface MonthlyProjection {
  key: string;
  label: string;
  totals: Record<string, number>;
  totalAmount: number;
  expenses: Record<string, MonthlyProjectionExpense>;
}
