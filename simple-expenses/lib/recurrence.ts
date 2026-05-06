import type { Expense, Frequency } from "./types";

const VIRTUAL_SEP = "@";
const MAX_OCCURRENCES = 600;

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayStartOfDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addInterval(date: Date, freq: Frequency, n: number): Date {
  const d = new Date(date);
  switch (freq) {
    case "daily":
      d.setDate(d.getDate() + n);
      break;
    case "weekly":
      d.setDate(d.getDate() + n * 7);
      break;
    case "monthly": {
      const day = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + n);
      const lastDayOfMonth = new Date(
        d.getFullYear(),
        d.getMonth() + 1,
        0,
      ).getDate();
      d.setDate(Math.min(day, lastDayOfMonth));
      break;
    }
    case "yearly":
      d.setFullYear(d.getFullYear() + n);
      break;
  }
  return d;
}

export function expandExpenses(
  expenses: Expense[],
  rangeStart: Date,
  rangeEnd: Date,
): Expense[] {
  const out: Expense[] = [];
  for (const e of expenses) {
    const startDate = parseIso(e.date);
    if (!e.recurrence) {
      if (startDate >= rangeStart && startDate <= rangeEnd) out.push(e);
      continue;
    }
    const interval = Math.max(1, e.recurrence.interval || 1);
    const freq = e.recurrence.frequency;
    const ruleEnd = e.recurrence.endDate
      ? parseIso(e.recurrence.endDate)
      : null;
    const hardEnd = ruleEnd && ruleEnd < rangeEnd ? ruleEnd : rangeEnd;
    let current = startDate;
    let safety = 0;
    while (current <= hardEnd && safety < MAX_OCCURRENCES) {
      if (current >= rangeStart) {
        const iso = toIso(current);
        out.push({
          ...e,
          id: `${e.id}${VIRTUAL_SEP}${iso}`,
          date: iso,
        });
      }
      current = addInterval(current, freq, interval);
      safety++;
    }
  }
  return out;
}

export function getRealId(id: string): string {
  const at = id.indexOf(VIRTUAL_SEP);
  return at === -1 ? id : id.slice(0, at);
}

export function isVirtualOccurrence(id: string): boolean {
  return id.includes(VIRTUAL_SEP);
}

export function recurrenceLabel(e: Expense): string | null {
  if (!e.recurrence) return null;
  const labels: Record<Frequency, string> = {
    daily: "dia",
    weekly: "semana",
    monthly: "mês",
    yearly: "ano",
  };
  const n = Math.max(1, e.recurrence.interval || 1);
  const unit = labels[e.recurrence.frequency];
  const every = n === 1 ? `cada ${unit}` : `cada ${n} ${unit}s`;
  if (e.recurrence.endDate) return `${every}, até ${e.recurrence.endDate}`;
  return `${every}`;
}
