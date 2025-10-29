import { useMemo } from 'react';

type ExpenseType = 'fixa' | 'variavel';

interface ExpenseTypeDonutChartProps {
  fixedTotal: number;
  variableTotal: number;
  displayCurrency: string;
  formatCurrency(amount: number, currency: string): string;
}

interface Segment {
  type: ExpenseType;
  startAngle: number;
  endAngle: number;
  value: number;
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians)
  };
}

function describeArc(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number
) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);

  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

const LABELS: Record<ExpenseType, string> = {
  fixa: 'Fixas',
  variavel: 'Variáveis'
};

const COLORS: Record<ExpenseType, { start: string; end: string }> = {
  fixa: { start: '#1e293b', end: '#6366f1' },
  variavel: { start: '#0f766e', end: '#22d3ee' }
};

export default function ExpenseTypeDonutChart({
  fixedTotal,
  variableTotal,
  displayCurrency,
  formatCurrency
}: ExpenseTypeDonutChartProps) {
  const total = fixedTotal + variableTotal;

  const segments = useMemo<Segment[]>(() => {
    if (total <= 0) {
      return [];
    }

    const baseStart = -90;
    const variableAngle = (variableTotal / total) * 360;
    const fixedAngle = (fixedTotal / total) * 360;
    const result: Segment[] = [];

    if (variableTotal > 0) {
      result.push({
        type: 'variavel',
        startAngle: baseStart,
        endAngle: baseStart + variableAngle,
        value: variableTotal
      });
    }

    if (fixedTotal > 0) {
      result.push({
        type: 'fixa',
        startAngle: baseStart + variableAngle,
        endAngle: baseStart + variableAngle + fixedAngle,
        value: fixedTotal
      });
    }

    return result;
  }, [fixedTotal, variableTotal, total]);

  const percentageByType = useMemo(() => {
    if (total <= 0) {
      return { fixa: 0, variavel: 0 } as Record<ExpenseType, number>;
    }
    return {
      fixa: (fixedTotal / total) * 100,
      variavel: (variableTotal / total) * 100
    } satisfies Record<ExpenseType, number>;
  }, [fixedTotal, variableTotal, total]);

  const hasData = total > 0;

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Distribuição por tipo
          </h3>
          <p className="text-xs text-slate-500">
            Como as despesas pendentes até ao final do ano se dividem entre fixas e variáveis.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
          {formatCurrency(total, displayCurrency)}
        </span>
      </header>

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
        <svg viewBox="0 0 200 200" className="h-40 w-40" role="img" aria-label="Distribuição das despesas por tipo">
          <defs>
            {(['fixa', 'variavel'] as ExpenseType[]).map((type) => (
              <linearGradient key={type} id={`expense-type-${type}`} x1="0%" x2="100%" y1="0%" y2="100%">
                <stop offset="0%" stopColor={COLORS[type].start} stopOpacity={0.85} />
                <stop offset="100%" stopColor={COLORS[type].end} />
              </linearGradient>
            ))}
          </defs>
          <circle
            cx={100}
            cy={100}
            r={70}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={20}
            strokeDasharray="4 6"
          />
          {segments.map((segment) => (
            <path
              key={segment.type}
              d={describeArc(100, 100, 70, segment.startAngle, segment.endAngle)}
              fill="none"
              stroke={`url(#expense-type-${segment.type})`}
              strokeWidth={20}
              strokeLinecap="round"
            />
          ))}
          <text
            x={100}
            y={96}
            textAnchor="middle"
            className="text-sm font-medium fill-slate-500"
          >
            {hasData ? 'Pendentes' : 'Sem dados'}
          </text>
          {hasData && (
            <text x={100} y={118} textAnchor="middle" className="text-lg font-semibold fill-slate-900">
              {total.toLocaleString('pt-PT', { maximumFractionDigits: 0 })}
            </text>
          )}
        </svg>

        <div className="flex-1 space-y-3 text-sm text-slate-600">
          {(['fixa', 'variavel'] as ExpenseType[]).map((type) => (
            <div key={type} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: `linear-gradient(135deg, ${COLORS[type].start}, ${COLORS[type].end})` }}
                  aria-hidden="true"
                />
                <span className="font-medium text-slate-700">{LABELS[type]}</span>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {percentageByType[type].toFixed(0)}%
                </p>
                <p className="font-semibold text-slate-900">
                  {hasData ? formatCurrency(type === 'fixa' ? fixedTotal : variableTotal, displayCurrency) : '—'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
