"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { useAppData } from "@/lib/storage";
import { formatMoney, monthKey, monthLabel } from "@/lib/format";

const HeroScene = dynamic(
  () => import("@/components/three/HeroScene").then((m) => m.HeroScene),
  { ssr: false, loading: () => <div className="h-64 sm:h-80" /> },
);

const CategoryBars3D = dynamic(
  () =>
    import("@/components/three/CategoryBars3D").then((m) => m.CategoryBars3D),
  { ssr: false, loading: () => <div className="h-64" /> },
);

export default function DashboardPage() {
  return (
    <ClientOnly fallback={<div className="text-ink-600">A carregar…</div>}>
      <Dashboard />
    </ClientOnly>
  );
}

function Dashboard() {
  const { accounts, expenses } = useAppData();

  const thisMonth = monthKey(new Date().toISOString());
  const monthExpenses = expenses.filter((e) => monthKey(e.date) === thisMonth);
  const monthTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const totalAll = expenses.reduce((s, e) => s + e.amount, 0);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of monthExpenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [monthExpenses]);

  const byAccountMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of monthExpenses) {
      map.set(e.accountId, (map.get(e.accountId) ?? 0) + e.amount);
    }
    return map;
  }, [monthExpenses]);

  const recent = [...expenses]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 5);

  if (accounts.length === 0) {
    return (
      <div className="card">
        <h1 className="text-xl font-semibold mb-2">Bem-vindo</h1>
        <p className="text-sm text-ink-600 dark:text-ink-400 mb-4">
          Comece por criar uma conta ou cartão para registar despesas.
        </p>
        <Link href="/accounts" className="btn-primary">
          Criar conta
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-ink-200 dark:border-ink-700 bg-gradient-to-br from-ink-100 via-white to-ink-50 dark:from-ink-800 dark:via-ink-900 dark:to-ink-800">
        <div className="absolute inset-0">
          <HeroScene
            accounts={accounts}
            monthSpend={monthTotal}
            allTimeSpend={totalAll}
          />
        </div>
        <div className="relative z-10 p-6 sm:p-8 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="text-xs uppercase tracking-widest text-ink-600 dark:text-ink-300">
              {monthLabel(thisMonth)}
            </div>
            <div className="mt-1 text-4xl sm:text-5xl font-semibold tabular-nums">
              {formatMoney(monthTotal)}
            </div>
            <div className="mt-2 text-sm text-ink-600 dark:text-ink-300">
              {monthExpenses.length} despesas este mês ·{" "}
              {formatMoney(totalAll)} no total
            </div>
          </motion.div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Por conta / cartão</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {accounts.map((a, i) => {
            const monthSpent = byAccountMonth.get(a.id) ?? 0;
            const total = expenses
              .filter((e) => e.accountId === a.id)
              .reduce((s, e) => s + e.amount, 0);
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 14, rotateX: -8 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ delay: i * 0.05, duration: 0.45 }}
                whileHover={{ y: -3, rotateX: 4, rotateY: -2 }}
                style={{ transformPerspective: 800 }}
                className="card flex items-start gap-3"
              >
                <span
                  className="h-10 w-10 rounded-full shrink-0 shadow-inner"
                  style={{ backgroundColor: a.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium truncate">{a.name}</div>
                    <div className="text-sm font-semibold tabular-nums">
                      {formatMoney(monthSpent, a.currency)}
                    </div>
                  </div>
                  <div className="text-xs text-ink-600 dark:text-ink-400 mt-1">
                    Total acumulado: {formatMoney(total, a.currency)}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {byCategory.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Categorias deste mês</h2>
          <div className="card overflow-hidden p-0">
            <div className="h-64">
              <CategoryBars3D data={byCategory} />
            </div>
            <div className="border-t border-ink-200 dark:border-ink-700 p-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {byCategory.map(([cat, value]) => (
                <div
                  key={cat}
                  className="flex items-center justify-between tabular-nums"
                >
                  <span className="truncate">{cat}</span>
                  <span className="font-medium">{formatMoney(value)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Despesas recentes</h2>
            <Link
              href="/expenses"
              className="text-sm text-ink-600 hover:text-ink-900 dark:text-ink-300"
            >
              Ver todas →
            </Link>
          </div>
          <div className="card divide-y divide-ink-200 dark:divide-ink-700">
            {recent.map((e, i) => {
              const account = accounts.find((a) => a.id === e.accountId);
              return (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between py-2 first:pt-0 last:pb-0 gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{e.description}</div>
                    <div className="text-xs text-ink-600 dark:text-ink-400">
                      {account?.name ?? "—"} · {e.category}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-medium tabular-nums">
                      {formatMoney(e.amount, account?.currency)}
                    </div>
                    <div className="text-xs text-ink-600 dark:text-ink-400">
                      {e.date}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
