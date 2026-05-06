"use client";

import { useState } from "react";
import { accountActions } from "@/lib/storage";
import {
  ACCOUNT_COLORS,
  ACCOUNT_TYPE_LABELS,
  type Account,
  type AccountType,
} from "@/lib/types";

interface Props {
  account?: Account;
  onDone?: () => void;
  onCancel?: () => void;
}

export function AccountForm({ account, onDone, onCancel }: Props) {
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<AccountType>(account?.type ?? "checking");
  const [currency, setCurrency] = useState(account?.currency ?? "EUR");
  const [color, setColor] = useState(account?.color ?? ACCOUNT_COLORS[0]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: name.trim(),
      type,
      currency: currency.trim().toUpperCase() || "EUR",
      color,
    };
    if (!payload.name) return;
    if (account) {
      accountActions.update(account.id, payload);
    } else {
      accountActions.add(payload);
    }
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label">Nome</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Conta Principal, Cartão Visa"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Tipo</label>
          <select
            className="select"
            value={type}
            onChange={(e) => setType(e.target.value as AccountType)}
          >
            {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Moeda</label>
          <input
            className="input"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            maxLength={3}
          />
        </div>
      </div>
      <div>
        <label className="label">Cor</label>
        <div className="flex flex-wrap gap-2">
          {ACCOUNT_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setColor(c)}
              className={
                "h-8 w-8 rounded-full ring-offset-2 ring-offset-white dark:ring-offset-ink-800 transition " +
                (color === c ? "ring-2 ring-ink-900 dark:ring-ink-100" : "")
              }
              style={{ backgroundColor: c }}
              aria-label={`cor ${c}`}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button type="submit" className="btn-primary">
          {account ? "Guardar alterações" : "Criar conta"}
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
