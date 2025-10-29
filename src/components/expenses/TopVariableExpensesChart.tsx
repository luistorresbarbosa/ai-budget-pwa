import { HorizontalBarChart, type HorizontalBarChartDatum } from './HorizontalBarChart';

export interface TopVariableExpensesChartItem extends HorizontalBarChartDatum {
  currency: string;
}

interface TopVariableExpensesChartProps {
  items: TopVariableExpensesChartItem[];
  formatCurrency(amount: number, currency: string): string;
  description?: string;
  emptyMessage?: string;
}

export function TopVariableExpensesChart({
  items,
  formatCurrency,
  description,
  emptyMessage
}: TopVariableExpensesChartProps) {
  return (
    <HorizontalBarChart
      title="Top 10 despesas variáveis"
      description={
        description ?? 'Despesas pontuais com maior impacto durante o período seleccionado.'
      }
      data={items}
      emptyMessage={emptyMessage ?? 'Sem despesas variáveis registadas neste separador.'}
      formatValue={(datum) =>
        formatCurrency(datum.value, (datum as TopVariableExpensesChartItem).currency)
      }
    />
  );
}

export default TopVariableExpensesChart;
