import { HorizontalBarChart, type HorizontalBarChartDatum } from './HorizontalBarChart';

export interface CategoryTotalsChartItem extends HorizontalBarChartDatum {
  currencyBreakdown: Record<string, number>;
}

interface CategoryTotalsBarChartProps {
  items: CategoryTotalsChartItem[];
  formatCurrency(amount: number, currency: string): string;
}

export function CategoryTotalsBarChart({ items, formatCurrency }: CategoryTotalsBarChartProps) {
  return (
    <HorizontalBarChart
      title="Totais por categoria"
      description="Categorias com maior volume de despesas no separador activo."
      data={items}
      emptyMessage="Ainda não existem despesas para calcular os totais por categoria."
      formatValue={(datum) => {
        const breakdown = (datum as CategoryTotalsChartItem).currencyBreakdown;
        const entries = Object.entries(breakdown);
        if (entries.length === 0) {
          return '—';
        }
        return entries
          .map(([currency, amount]) => formatCurrency(amount, currency))
          .join(' · ');
      }}
    />
  );
}

export default CategoryTotalsBarChart;
