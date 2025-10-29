import { useMemo } from 'react';
import type { MonthlyProjection } from '../../types/expenses';

interface MonthlyProjectionChartProps {
  data: MonthlyProjection[];
  formatCurrency(amount: number, currency: string): string;
  displayCurrency: string;
}

const COLOR_PALETTE = [
  '#0f172a',
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#7c3aed',
  '#ef4444',
  '#14b8a6',
  '#f97316',
  '#0ea5e9',
  '#facc15'
];

export function MonthlyProjectionChart({
  data,
  formatCurrency,
  displayCurrency
}: MonthlyProjectionChartProps) {
  const maxTotal = useMemo(() => {
    return data.reduce((max, month) => Math.max(max, month.totalAmount), 0);
  }, [data]);

  const expenseSummaries = useMemo(() => {
    const summary = new Map<
      string,
      { description: string; currency: string; total: number }
    >();

    data.forEach((month) => {
      Object.entries(month.expenses).forEach(([expenseKey, expense]) => {
        const existing = summary.get(expenseKey);
        if (existing) {
          existing.total += expense.amount;
        } else {
          summary.set(expenseKey, {
            description: expense.description,
            currency: expense.currency,
            total: expense.amount
          });
        }
      });
    });

    return Array.from(summary.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [data]);

  const expenseOrder = useMemo(
    () => expenseSummaries.map(([expenseKey]) => expenseKey),
    [expenseSummaries]
  );

  const colorByExpense = useMemo(() => {
    return expenseOrder.reduce<Record<string, string>>((acc, expenseKey, index) => {
      acc[expenseKey] = COLOR_PALETTE[index % COLOR_PALETTE.length];
      return acc;
    }, {});
  }, [expenseOrder]);

  const chartDimensions = useMemo(() => {
    const BAR_WIDTH = 48;
    const BAR_GAP = 28;
    const rawWidth = data.length * BAR_WIDTH + Math.max(0, data.length - 1) * BAR_GAP;
    const width = Math.max(rawWidth, 260);
    const height = 280;
    const margins = { top: 16, right: 24, bottom: 56, left: 72 };

    return {
      width: width + margins.left + margins.right,
      height,
      innerWidth: width,
      innerHeight: height - margins.top - margins.bottom,
      margins,
      barWidth: data.length > 0 ? Math.min(BAR_WIDTH, width / data.length - BAR_GAP) : BAR_WIDTH,
      barGap: BAR_GAP
    };
  }, [data.length]);

  const { width, height, innerWidth, innerHeight, margins, barWidth, barGap } = chartDimensions;
  const totalBarsWidth = data.length * barWidth + Math.max(0, data.length - 1) * barGap;
  const startOffset = Math.max((innerWidth - totalBarsWidth) / 2, 0);
  const numberOfTicks = 4;
  const tickValues = Array.from({ length: numberOfTicks + 1 }, (_, index) =>
    maxTotal === 0 ? 0 : (maxTotal / numberOfTicks) * index
  );

  return (
    <div className="space-y-6">
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Gráfico de barras com as projeções mensais de despesas"
          className="h-72 w-full"
        >
          <title>Despesas previstas por mês</title>
          <g transform={`translate(${margins.left}, ${margins.top})`}>
            <line
              x1={0}
              y1={innerHeight}
              x2={innerWidth}
              y2={innerHeight}
              className="stroke-slate-200"
              strokeWidth={1.5}
            />
            {tickValues.map((tick, index) => {
              if (index === 0) {
                return null;
              }
              const y = innerHeight - (maxTotal === 0 ? 0 : (tick / maxTotal) * innerHeight);
              return (
                <g key={tick}>
                  <line
                    x1={0}
                    y1={y}
                    x2={innerWidth}
                    y2={y}
                    className="stroke-slate-100"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={-16}
                    y={y + 4}
                    textAnchor="end"
                    className="text-[10px] font-medium fill-slate-400"
                  >
                    {formatCurrency(tick, displayCurrency)}
                  </text>
                </g>
              );
            })}

            {data.map((month, index) => {
              const baseX = startOffset + index * (barWidth + barGap);
              let stackedHeight = 0;
              let rendered = false;

              return (
                <g key={month.key} transform={`translate(${baseX}, 0)`}>
                  {expenseOrder.map((expenseKey) => {
                    const expense = month.expenses[expenseKey];
                    const amount = expense?.amount ?? 0;
                    if (amount <= 0 || maxTotal === 0) {
                      return null;
                    }
                    const heightRatio = amount / maxTotal;
                    const rectHeight = heightRatio * innerHeight;
                    const y = innerHeight - stackedHeight - rectHeight;
                    stackedHeight += rectHeight;
                    rendered = true;

                    return (
                      <rect
                        key={expenseKey}
                        x={0}
                        y={y}
                        width={barWidth}
                        height={rectHeight}
                        rx={8}
                        fill={colorByExpense[expenseKey]}
                      >
                        <title>
                          {month.label}: {expense.description} ·{' '}
                          {formatCurrency(amount, expense.currency)}
                        </title>
                      </rect>
                    );
                  })}
                  <text
                    x={barWidth / 2}
                    y={innerHeight + 20}
                    textAnchor="middle"
                    className="text-xs font-medium fill-slate-500"
                  >
                    {month.label}
                  </text>
                  {rendered && (
                    <text
                      x={barWidth / 2}
                      y={Math.max(innerHeight - stackedHeight - 8, 14)}
                      textAnchor="middle"
                      className="text-xs font-semibold fill-slate-900"
                    >
                      {Object.keys(month.totals).length === 1
                        ? (() => {
                            const currency = Object.keys(month.totals)[0];
                            return formatCurrency(month.totals[currency] ?? 0, currency);
                          })()
                        : month.totalAmount.toLocaleString('pt-PT', {
                            maximumFractionDigits: 0
                          })}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {expenseSummaries.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
          {expenseSummaries.map(([expenseKey, info]) => (
            <span key={expenseKey} className="inline-flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: colorByExpense[expenseKey] }}
                aria-hidden="true"
              />
              <span className="font-medium text-slate-700">
                {info.description}
              </span>
              <span className="text-slate-400">· {info.currency}</span>
            </span>
          ))}
        </div>
      )}

      <table className="sr-only">
        <caption>Totais previstos por mês e por despesa</caption>
        <thead>
          <tr>
            <th scope="col">Mês</th>
            {expenseSummaries.map(([expenseKey, info]) => (
              <th key={expenseKey} scope="col">
                {info.description}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((month) => (
            <tr key={month.key}>
              <th scope="row">{month.label}</th>
              {expenseSummaries.map(([expenseKey, info]) => {
                const expense = month.expenses[expenseKey];
                return (
                  <td key={expenseKey}>
                    {expense ? formatCurrency(expense.amount, expense.currency) : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default MonthlyProjectionChart;
