"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { useAppData } from "@/lib/storage";
import { formatMoney, monthKey, monthLabel } from "@/lib/format";

export default function DashboardPage() {
  return (
    <ClientOnly fallback={<div className="text-ink-600">A carregar…</div>}>
      <Dashboard />
    </ClientOnly>
  );
}

function Dashboard() {
  const { accounts, expenses } = useAppData();

  const totals = useMemo(() => {
    const byAccount = new Map<string, number>();
    for (const a of accounts) byAccount.set(a.id, a.initialBalance);
    for (const e of expenses) {
      byAccount.set(e.accountId, (byAccount.get(e.accountId) ?? 0) - e.amount);
    }
    return byAccount;
  }, [accounts, expenses]);

  const thisMonth = monthKey(new Date().toISOString());
  const monthExpenses = expenses.filter((e) => monthKey(e.date) === thisMonth);
  const monthTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of monthExpenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
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
      <section>
        <h1 className="text-xl font-semibold mb-3">Resumo</h1>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="card">
            <div className="text-xs uppercase text-ink-600 dark:text-ink-400">
              {monthLabel(thisMonth)}
            </div>
            <div className="text-2xl font-semibold mt-1">
              {formatMoney(monthTotal)}
            </div>
            <div className="text-xs text-ink-600 dark:text-ink-400 mt-1">
              {monthExpenses.length} despesas este mês
            </div>
          </div>
          <div className="card">
            <div className="text-xs uppercase text-ink-600 dark:text-ink-400">
              Contas
            </div>
            <div className="text-2xl font-semibold mt-1">{accounts.length}</div>
            <div className="text-xs text-ink-600 dark:text-ink-400 mt-1">
              {expenses.length} despesas no total
            </div>
          </div>
          <div className="card">
            <div className="text-xs uppercase text-ink-600 dark:text-ink-400">
              Saldo agregado (estimado)
            </div>
            <div className="text-2xl font-semibold mt-1">
              {formatMoney(
                accounts.reduce(
                  (s, a) => s + (totals.get(a.id) ?? a.initialBalance),
                  0,
                ),
              )}
            </div>
            <div className="text-xs text-ink-600 dark:text-ink-400 mt-1">
              saldo inicial − despesas
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Por conta / cartão</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {accounts.map((a) => {
            const balance = totals.get(a.id) ?? a.initialBalance;
            const monthSpent = monthExpenses
              .filter((e) => e.accountId === a.id)
              .reduce((s, e) => s + e.amount, 0);
            return (
              <div key={a.id} className="card flex items-start gap-3">
                <span
                  className="h-10 w-10 rounded-full shrink-0"
                  style={{ backgroundColor: a.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium truncate">{a.name}</div>
                    <div className="text-sm font-semibold">
                      {formatMoney(balance, a.currency)}
                    </div>
                  </div>
                  <div className="text-xs text-ink-600 dark:text-ink-400 mt-1">
                    Este mês: {formatMoney(monthSpent, a.currency)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {byCategory.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Categorias deste mês</h2>
          <div className="card divide-y divide-ink-200 dark:divide-ink-700">
            {byCategory.map(([cat, value]) => (
              <div
                key={cat}
                className="flex items-center justify-between py-2 first:pt-0 last:pb-0"
              >
                <span>{cat}</span>
                <span className="font-medium">{formatMoney(value)}</span>
              </div>
            ))}
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
            {recent.map((e) => {
              const account = accounts.find((a) => a.id === e.accountId);
              return (
                <div
                  key={e.id}
                  className="flex items-center justify-between py-2 first:pt-0 last:pb-0 gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{e.description}</div>
                    <div className="text-xs text-ink-600 dark:text-ink-400">
                      {account?.name ?? "—"} · {e.category}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-medium">
                      {formatMoney(e.amount, account?.currency)}
                    </div>
                    <div className="text-xs text-ink-600 dark:text-ink-400">
                      {e.date}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
