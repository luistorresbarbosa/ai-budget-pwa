import { HorizontalBarChart, type HorizontalBarChartDatum } from './HorizontalBarChart';

export interface TopFixedExpensesChartItem extends HorizontalBarChartDatum {
  currency: string;
}

interface TopFixedExpensesChartProps {
  items: TopFixedExpensesChartItem[];
  formatCurrency(amount: number, currency: string): string;
  description?: string;
  emptyMessage?: string;
}

export function TopFixedExpensesChart({
  items,
  formatCurrency,
  description,
  emptyMessage
}: TopFixedExpensesChartProps) {
  return (
    <HorizontalBarChart
      title="Top 10 despesas fixas"
      description={
        description ?? 'Despesas recorrentes com maior impacto durante o período seleccionado.'
      }
      data={items}
      emptyMessage={emptyMessage ?? 'Sem despesas fixas registadas neste separador.'}
      formatValue={(datum) => formatCurrency(datum.value, (datum as TopFixedExpensesChartItem).currency)}
    />
  );
}

export default TopFixedExpensesChart;
