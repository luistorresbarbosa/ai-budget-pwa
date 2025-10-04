import { motion } from 'framer-motion';
import type { TimelineEntry } from '../../data/models';

interface TimelineBoardProps {
  entries: TimelineEntry[];
}

const typeLabels: Record<TimelineEntry['type'], string> = {
  despesa: 'Despesa',
  vencimento: 'Vencimento',
  transferencia: 'Transferência'
};

const typeStyles: Record<TimelineEntry['type'], string> = {
  despesa: 'border-rose-200 bg-rose-50 text-rose-700',
  vencimento: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  transferencia: 'border-sky-200 bg-sky-50 text-sky-700'
};

export function TimelineBoard({ entries }: TimelineBoardProps) {
  const grouped = entries
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .reduce<Record<string, TimelineEntry[]>>((acc, entry) => {
      const day = entry.date.substring(0, 10);
      if (!acc[day]) acc[day] = [];
      acc[day].push(entry);
      return acc;
    }, {});

  const days = Object.entries(grouped);

  return (
    <motion.div layout className="grid gap-4">
      {days.map(([day, items]) => (
        <motion.article
          key={day}
          layout
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900">
              {new Date(day).toLocaleDateString('pt-PT', {
                weekday: 'long',
                day: 'numeric',
                month: 'short'
              })}
            </h3>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 shadow-sm">
              {items.length} evento{items.length === 1 ? '' : 's'}
            </span>
          </header>
          <ul className="space-y-3">
            {items.map((item) => (
              <motion.li
                key={item.id}
                layout
                className={`flex flex-col gap-2 rounded-2xl border px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between ${typeStyles[item.type]}`}
              >
                <div>
                  <strong className="text-sm font-semibold">{item.description}</strong>
                  <small className="block text-xs uppercase tracking-wide opacity-70">
                    {typeLabels[item.type]}
                  </small>
                </div>
                <span className="text-sm font-semibold">
                  {item.amount.toFixed(2)} {item.currency}
                </span>
              </motion.li>
            ))}
          </ul>
        </motion.article>
      ))}
      {days.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-500">
          Sem eventos na timeline ainda.
        </div>
      )}
    </motion.div>
  );
}
