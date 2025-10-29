import { useMemo } from 'react';

const COLOR_PALETTE = [
  '#0f172a',
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#7c3aed',
  '#ef4444',
  '#14b8a6',
  '#f97316',
  '#f43f5e',
  '#22d3ee'
];

export interface HorizontalBarChartDatum {
  id: string;
  label: string;
  value: number;
  meta?: string;
}

interface HorizontalBarChartProps {
  title: string;
  description?: string;
  data: HorizontalBarChartDatum[];
  emptyMessage: string;
  formatValue(datum: HorizontalBarChartDatum): string;
}

export function HorizontalBarChart({
  title,
  description,
  data,
  emptyMessage,
  formatValue
}: HorizontalBarChartProps) {
  const maxValue = useMemo(() => {
    if (data.length === 0) {
      return 0;
    }
    return data.reduce((max, item) => (item.value > max ? item.value : max), 0);
  }, [data]);

  if (data.length === 0 || maxValue === 0) {
    return (
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
        <header className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </header>
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="space-y-1">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </header>

      <div className="space-y-3">
        {data.map((item, index) => {
          const width = maxValue === 0 ? 0 : Math.max((item.value / maxValue) * 100, 6);
          const color = COLOR_PALETTE[index % COLOR_PALETTE.length];
          return (
            <article key={item.id} className="space-y-2">
              <div className="flex items-baseline justify-between gap-2 text-xs text-slate-500">
                <span className="text-sm font-medium text-slate-900">{item.label}</span>
                <span className="font-semibold text-slate-900">{formatValue(item)}</span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-100">
                <div
                  className="h-3 rounded-full"
                  style={{ width: `${width}%`, backgroundColor: color }}
                  aria-hidden="true"
                />
              </div>
              {item.meta && <p className="text-[11px] text-slate-500">{item.meta}</p>}
            </article>
          );
        })}
      </div>

      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Valor</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.id}>
              <td>{item.label}</td>
              <td>{formatValue(item)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default HorizontalBarChart;
