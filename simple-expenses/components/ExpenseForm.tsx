"use client";

import { useState } from "react";
import { expenseActions } from "@/lib/storage";
import { todayIso } from "@/lib/format";
import {
  DEFAULT_CATEGORIES,
  type Account,
  type Expense,
} from "@/lib/types";

interface Props {
  accounts: Account[];
  expense?: Expense;
  defaultAccountId?: string;
  onDone?: () => void;
  onCancel?: () => void;
}

export function ExpenseForm({
  accounts,
  expense,
  defaultAccountId,
  onDone,
  onCancel,
}: Props) {
  const [accountId, setAccountId] = useState(
    expense?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? "",
  );
  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(expense?.amount?.toString() ?? "");
  const [category, setCategory] = useState(
    expense?.category ?? DEFAULT_CATEGORIES[0],
  );
  const [date, setDate] = useState(expense?.date ?? todayIso());
  const [notes, setNotes] = useState(expense?.notes ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId) return;
    const payload = {
      accountId,
      description: description.trim(),
      amount: Number(amount) || 0,
      category,
      date,
      notes: notes.trim() || undefined,
    };
    if (!payload.description || payload.amount <= 0) return;
    if (expense) {
      expenseActions.update(expense.id, payload);
    } else {
      expenseActions.add(payload);
    }
    onDone?.();
  }

  if (accounts.length === 0) {
    return (
      <p className="text-sm text-ink-600 dark:text-ink-400">
        Crie primeiro pelo menos uma conta ou cartão.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label">Descrição</label>
        <input
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex: Supermercado, Netflix"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Valor</label>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Data</label>
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Conta / Cartão</label>
          <select
            className="select"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
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
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {DEFAULT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Notas</label>
        <textarea
          className="textarea"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <div className="flex gap-2 pt-2">
        <button type="submit" className="btn-primary">
          {expense ? "Guardar alterações" : "Adicionar despesa"}
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
