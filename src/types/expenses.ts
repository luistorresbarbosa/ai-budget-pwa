export interface MonthlyProjection {
  key: string;
  label: string;
  totals: Record<string, number>;
  totalAmount: number;
  typeTotals: Record<'fixa' | 'variavel', number>;
}
