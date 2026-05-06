"use client";

import { useState } from "react";
import { expenseActions } from "@/lib/storage";
import { todayIso } from "@/lib/format";
import {
  DEFAULT_CATEGORIES,
  FREQUENCY_LABELS,
  type Account,
  type Expense,
  type Frequency,
  type Recurrence,
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
  const [isRecurring, setIsRecurring] = useState(!!expense?.recurrence);
  const [frequency, setFrequency] = useState<Frequency>(
    expense?.recurrence?.frequency ?? "monthly",
  );
  const [interval, setIntervalValue] = useState(
    (expense?.recurrence?.interval ?? 1).toString(),
  );
  const [hasEndDate, setHasEndDate] = useState(!!expense?.recurrence?.endDate);
  const [endDate, setEndDate] = useState(expense?.recurrence?.endDate ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId) return;
    const recurrence: Recurrence | undefined = isRecurring
      ? {
          frequency,
          interval: Math.max(1, Number(interval) || 1),
          endDate: hasEndDate && endDate ? endDate : undefined,
        }
      : undefined;
    const payload = {
      accountId,
      description: description.trim(),
      amount: Number(amount) || 0,
      category,
      date,
      notes: notes.trim() || undefined,
      recurrence,
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
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">{isRecurring ? "Início" : "Data"}</label>
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

      <div className="rounded-lg border border-ink-200 dark:border-ink-700 p-3 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer touch-manipulation">
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            className="h-5 w-5 rounded border-ink-300 dark:bg-ink-800"
          />
          <span className="text-sm font-medium">
            Repetir esta despesa
          </span>
        </label>
        {isRecurring && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Frequência</label>
                <select
                  className="select"
                  value={frequency}
                  onChange={(ev) => setFrequency(ev.target.value as Frequency)}
                >
                  {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">A cada</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={interval}
                  onChange={(ev) => setIntervalValue(ev.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label">Termina</label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  className={
                    "btn flex-1 " +
                    (!hasEndDate
                      ? "bg-ink-900 text-white"
                      : "border border-ink-200 dark:border-ink-600 text-ink-600 dark:text-ink-200")
                  }
                  onClick={() => setHasEndDate(false)}
                >
                  Sempre
                </button>
                <button
                  type="button"
                  className={
                    "btn flex-1 " +
                    (hasEndDate
                      ? "bg-ink-900 text-white"
                      : "border border-ink-200 dark:border-ink-600 text-ink-600 dark:text-ink-200")
                  }
                  onClick={() => setHasEndDate(true)}
                >
                  Numa data
                </button>
              </div>
              {hasEndDate && (
                <input
                  className="input"
                  type="date"
                  value={endDate}
                  min={date}
                  onChange={(ev) => setEndDate(ev.target.value)}
                />
              )}
            </div>
            <p className="text-xs text-ink-600 dark:text-ink-400">
              Editar ou apagar uma ocorrência aplica-se a toda a série.
            </p>
          </div>
        )}
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
