"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ClientOnly } from "@/components/ClientOnly";
import { ExpenseForm } from "@/components/ExpenseForm";
import { Burst } from "@/components/Burst";
import { useAppData, expenseActions } from "@/lib/storage";
import { formatDate, formatMoney, monthKey } from "@/lib/format";
import { DEFAULT_CATEGORIES } from "@/lib/types";

export default function ExpensesPage() {
  return (
    <ClientOnly fallback={<div className="text-ink-600">A carregar…</div>}>
      <Expenses />
    </ClientOnly>
  );
}

function Expenses() {
  const { accounts, expenses } = useAppData();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [burstTrigger, setBurstTrigger] = useState(0);

  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");

  const months = useMemo(() => {
    const set = new Set(expenses.map((e) => monthKey(e.date)));
    return [...set].sort().reverse();
  }, [expenses]);

  const filtered = useMemo(() => {
    return expenses
      .filter((e) => accountFilter === "all" || e.accountId === accountFilter)
      .filter((e) => categoryFilter === "all" || e.category === categoryFilter)
      .filter((e) => monthFilter === "all" || monthKey(e.date) === monthFilter)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [expenses, accountFilter, categoryFilter, monthFilter]);

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  function remove(id: string, description: string) {
    if (confirm(`Apagar "${description}"?`)) expenseActions.remove(id);
  }

  return (
    <div className="space-y-5">
      <Burst trigger={burstTrigger} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Despesas</h1>
        {!creating && accounts.length > 0 && (
          <button onClick={() => setCreating(true)} className="btn-primary">
            Nova despesa
          </button>
        )}
      </div>

      <AnimatePresence>
        {creating && (
          <motion.div
            key="create-expense"
            initial={{ opacity: 0, rotateX: -20, y: -10, height: 0 }}
            animate={{ opacity: 1, rotateX: 0, y: 0, height: "auto" }}
            exit={{ opacity: 0, rotateX: -20, y: -10, height: 0 }}
            transition={{ duration: 0.4 }}
            style={{ transformPerspective: 900 }}
            className="card overflow-hidden"
          >
            <h2 className="font-medium mb-3">Nova despesa</h2>
            <ExpenseForm
              accounts={accounts}
              onDone={() => {
                setCreating(false);
                setBurstTrigger((t) => t + 1);
              }}
              onCancel={() => setCreating(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {accounts.length === 0 ? (
        <div className="card text-sm text-ink-600 dark:text-ink-400">
          Ainda não tem contas. Crie uma conta para começar a registar despesas.
        </div>
      ) : (
        <>
          <div className="card">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="label">Conta</label>
                <select
                  className="select"
                  value={accountFilter}
                  onChange={(e) => setAccountFilter(e.target.value)}
                >
                  <option value="all">Todas</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Categoria</label>
                <select
                  className="select"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">Todas</option>
                  {DEFAULT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Mês</label>
                <select
                  className="select"
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                >
                  <option value="all">Todos</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 text-sm text-ink-600 dark:text-ink-400">
              {filtered.length} despesas · Total {formatMoney(total)}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="card text-sm text-ink-600 dark:text-ink-400">
              Sem despesas com estes filtros.
            </div>
          ) : (
            <div className="card divide-y divide-ink-200 dark:divide-ink-700">
              <AnimatePresence initial={false}>
                {filtered.map((e, i) => {
                  const account = accounts.find((a) => a.id === e.accountId);
                  const isEditing = editingId === e.id;
                  if (isEditing) {
                    return (
                      <motion.div
                        key={e.id}
                        initial={{ opacity: 0, rotateY: 90 }}
                        animate={{ opacity: 1, rotateY: 0 }}
                        exit={{ opacity: 0, rotateY: -90 }}
                        transition={{ duration: 0.35 }}
                        style={{ transformPerspective: 900 }}
                        className="py-3 first:pt-0 last:pb-0"
                      >
                        <ExpenseForm
                          accounts={accounts}
                          expense={e}
                          onDone={() => setEditingId(null)}
                          onCancel={() => setEditingId(null)}
                        />
                      </motion.div>
                    );
                  }
                  return (
                    <motion.div
                      key={e.id}
                      layout
                      initial={{ opacity: 0, x: -16, rotateY: -25 }}
                      animate={{ opacity: 1, x: 0, rotateY: 0 }}
                      exit={{ opacity: 0, x: 16, rotateY: 25 }}
                      transition={{
                        delay: Math.min(i * 0.03, 0.3),
                        duration: 0.35,
                      }}
                      style={{ transformPerspective: 900 }}
                      className="py-3 first:pt-0 last:pb-0 flex items-start gap-3"
                    >
                      <span
                        className="h-3 w-3 rounded-full mt-1.5 shrink-0"
                        style={{ backgroundColor: account?.color ?? "#94a3b8" }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{e.description}</div>
                        <div className="text-xs text-ink-600 dark:text-ink-400">
                          {account?.name ?? "—"} · {e.category} ·{" "}
                          {formatDate(e.date)}
                        </div>
                        {e.notes && (
                          <div className="text-xs mt-1 text-ink-600 dark:text-ink-400">
                            {e.notes}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-medium tabular-nums">
                          {formatMoney(e.amount, account?.currency)}
                        </div>
                        <div className="flex gap-1 mt-1 justify-end">
                          <button
                            className="text-xs text-ink-600 hover:text-ink-900 dark:text-ink-300"
                            onClick={() => setEditingId(e.id)}
                          >
                            editar
                          </button>
                          <span className="text-ink-400">·</span>
                          <button
                            className="text-xs text-red-600 hover:text-red-700"
                            onClick={() => remove(e.id, e.description)}
                          >
                            apagar
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </div>
  );
}
