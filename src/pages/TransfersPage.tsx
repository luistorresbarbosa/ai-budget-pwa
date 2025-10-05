import { FormEvent, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRightLeft, CalendarDays, Euro, Plus } from 'lucide-react';
import { useAppState } from '../state/AppStateContext';
import type { Transfer } from '../data/models';

const defaultTransfer = (fromAccountId: string, toAccountId: string): Transfer => ({
  id: crypto.randomUUID(),
  fromAccountId,
  toAccountId,
  amount: 0,
  currency: 'EUR',
  scheduleDate: new Date().toISOString(),
  status: 'agendado'
});

function TransfersPage() {
  const accounts = useAppState((state) => state.accounts);
  const transfers = useAppState((state) => state.transfers);
  const addTransfer = useAppState((state) => state.addTransfer);

  const [draft, setDraft] = useState(() =>
    defaultTransfer(accounts[0]?.id ?? '', accounts[1]?.id ?? accounts[0]?.id ?? '')
  );

  function handleChange(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setDraft((prev) => ({ ...prev, [name]: name === 'amount' ? Number(value) : value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.fromAccountId || !draft.toAccountId) return;

    addTransfer({ ...draft, id: crypto.randomUUID() });
    setDraft(defaultTransfer(draft.fromAccountId, draft.toAccountId));
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-8"
    >
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Transferências</h1>
        <p className="max-w-2xl text-sm text-slate-500 sm:text-base">
          Planeie transferências entre contas e acompanhe as execuções futuras.
        </p>
      </header>

      <motion.form
        onSubmit={handleSubmit}
        className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35, ease: 'easeOut' }}
      >
        <div className="space-y-4">
          <label className="block space-y-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-wide text-slate-400">De</span>
            <select
              name="fromAccountId"
              value={draft.fromAccountId}
              onChange={handleChange}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-wide text-slate-400">Para</span>
            <select
              name="toAccountId"
              value={draft.toAccountId}
              onChange={handleChange}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-4">
          <label className="block space-y-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-wide text-slate-400">Valor (€)</span>
            <input
              type="number"
              name="amount"
              value={draft.amount}
              step="0.01"
              onChange={handleChange}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-slate-900/10"
            />
          </label>
          <label className="block space-y-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-wide text-slate-400">Data agendada</span>
            <input
              type="date"
              name="scheduleDate"
              value={draft.scheduleDate.substring(0, 10)}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, scheduleDate: new Date(event.target.value).toISOString() }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
            />
          </label>
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 sm:w-auto sm:px-6"
          >
            <Plus className="h-4 w-4" />
            <span>Adicionar transferência</span>
          </button>
        </div>
      </motion.form>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Agendadas</h2>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 shadow-sm">
            {transfers.length} transferência{transfers.length === 1 ? '' : 's'}
          </span>
        </div>
        <motion.ul layout className="grid gap-3">
          {transfers.map((transfer) => (
            <motion.li
              key={transfer.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <strong className="flex items-center gap-2 text-sm text-slate-900">
                  <ArrowRightLeft className="h-4 w-4 text-slate-400" />
                  {accounts.find((acc) => acc.id === transfer.fromAccountId)?.name} →{' '}
                  {accounts.find((acc) => acc.id === transfer.toAccountId)?.name}
                </strong>
                <span className="flex items-center gap-2 text-sm text-slate-600">
                  <Euro className="h-4 w-4 text-slate-400" />
                  {transfer.amount.toFixed(2)} {transfer.currency}
                </span>
              </div>
              <small className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                {new Date(transfer.scheduleDate).toLocaleDateString('pt-PT')} · {transfer.status}
              </small>
              {transfer.notes && <p className="mt-2 text-sm text-slate-600">{transfer.notes}</p>}
            </motion.li>
          ))}
          {transfers.length === 0 && (
            <li className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-500">
              Ainda não existem transferências agendadas.
            </li>
          )}
        </motion.ul>
      </div>
    </motion.section>
  );
}

export default TransfersPage;
