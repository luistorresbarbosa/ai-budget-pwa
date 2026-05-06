"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ClientOnly } from "@/components/ClientOnly";
import { AccountForm } from "@/components/AccountForm";
import { useAppData, accountActions } from "@/lib/storage";
import { formatMoney } from "@/lib/format";
import { ACCOUNT_TYPE_LABELS } from "@/lib/types";

export default function AccountsPage() {
  return (
    <ClientOnly fallback={<div className="text-ink-600">A carregar…</div>}>
      <Accounts />
    </ClientOnly>
  );
}

function Accounts() {
  const { accounts, expenses } = useAppData();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      map.set(e.accountId, (map.get(e.accountId) ?? 0) + e.amount);
    }
    return map;
  }, [expenses]);

  function remove(id: string, name: string) {
    if (
      confirm(
        `Apagar "${name}"? Todas as despesas associadas também serão removidas.`,
      )
    ) {
      accountActions.remove(id);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Contas e cartões</h1>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="btn-primary hidden md:inline-flex"
          >
            Nova conta
          </button>
        )}
      </div>
      {!creating && (
        <button
          onClick={() => setCreating(true)}
          className="fab"
          aria-label="Nova conta"
        >
          <span className="text-2xl leading-none">+</span>
          Conta
        </button>
      )}

      <AnimatePresence>
        {creating && (
          <motion.div
            key="create"
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="card overflow-hidden"
          >
            <h2 className="font-medium mb-3">Nova conta</h2>
            <AccountForm
              onDone={() => setCreating(false)}
              onCancel={() => setCreating(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {accounts.length === 0 && !creating && (
        <div className="card text-sm text-ink-600 dark:text-ink-400">
          Ainda não tem contas. Crie a primeira para começar.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {accounts.map((a, i) => {
          const isEditing = editingId === a.id;
          const count = expenses.filter((e) => e.accountId === a.id).length;
          const total = totals.get(a.id) ?? 0;
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 16, rotateX: -10 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ delay: i * 0.05, duration: 0.45 }}
              whileHover={!isEditing ? { y: -4, rotateX: 4, rotateY: -3 } : {}}
              style={{ transformPerspective: 900 }}
              className="card"
            >
              <AnimatePresence mode="wait" initial={false}>
                {isEditing ? (
                  <motion.div
                    key="edit"
                    initial={{ opacity: 0, rotateY: 90 }}
                    animate={{ opacity: 1, rotateY: 0 }}
                    exit={{ opacity: 0, rotateY: -90 }}
                    transition={{ duration: 0.35 }}
                  >
                    <AccountForm
                      account={a}
                      onDone={() => setEditingId(null)}
                      onCancel={() => setEditingId(null)}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="view"
                    initial={{ opacity: 0, rotateY: -90 }}
                    animate={{ opacity: 1, rotateY: 0 }}
                    exit={{ opacity: 0, rotateY: 90 }}
                    transition={{ duration: 0.35 }}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="h-10 w-10 rounded-full shrink-0 shadow-inner"
                        style={{ backgroundColor: a.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{a.name}</div>
                        <div className="text-xs text-ink-600 dark:text-ink-400">
                          {ACCOUNT_TYPE_LABELS[a.type]} · {a.currency}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-semibold tabular-nums">
                          {formatMoney(total, a.currency)}
                        </div>
                        <div className="text-xs text-ink-600 dark:text-ink-400">
                          {count} despesas
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button
                        className="btn-ghost"
                        onClick={() => setEditingId(a.id)}
                      >
                        Editar
                      </button>
                      <button
                        className="btn-danger"
                        onClick={() => remove(a.id, a.name)}
                      >
                        Apagar
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
