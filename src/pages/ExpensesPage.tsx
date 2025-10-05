import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Euro, RefreshCcw } from 'lucide-react';
import { useAppState } from '../state/AppStateContext';
import type { Expense } from '../data/models';

const statusStyles: Record<Expense['status'], string> = {
  planeado: 'border-amber-200 bg-amber-50 text-amber-700',
  pago: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'em-analise': 'border-sky-200 bg-sky-50 text-sky-700'
};

const statusLabels: Record<Expense['status'], string> = {
  planeado: 'Planeado',
  pago: 'Pago',
  'em-analise': 'Em análise'
};

type StatusFilter = 'todas' | Expense['status'];

function ExpensesPage() {
  const expenses = useAppState((state) => state.expenses);
  const accounts = useAppState((state) => state.accounts);
  const [accountFilter, setAccountFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todas');

  const accountById = useMemo(
    () =>
      accounts.reduce<Record<string, string>>((acc, account) => {
        acc[account.id] = account.name;
        return acc;
      }, {}),
    [accounts]
  );

  const filtered = useMemo(
    () =>
      expenses.filter((expense) => {
        const matchAccount = accountFilter ? expense.accountId === accountFilter : true;
        const matchStatus = statusFilter === 'todas' ? true : expense.status === statusFilter;
        return matchAccount && matchStatus;
      }),
    [expenses, accountFilter, statusFilter]
  );

  const totalPlaneado = filtered
    .filter((item) => item.status !== 'pago')
    .reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-8"
    >
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Despesas</h1>
        <p className="max-w-2xl text-sm text-slate-500 sm:text-base">
          Revise despesas fixas e variáveis, confirme dados extraídos e acompanhe pagamentos.
        </p>
      </header>

      <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-[2fr_1fr] md:items-center">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-wide text-slate-400">Conta</span>
            <select
              value={accountFilter}
              onChange={(event) => setAccountFilter(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
            >
              <option value="">Todas</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-wide text-slate-400">Estado</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
            >
              <option value="todas">Todas</option>
              <option value="planeado">Planeado</option>
              <option value="pago">Pago</option>
              <option value="em-analise">Em análise</option>
            </select>
          </label>
        </div>
        <div className="rounded-2xl border border-slate-900 bg-slate-900 p-4 text-white shadow-sm">
          <span className="block text-xs uppercase tracking-wider text-slate-200">Total pendente</span>
          <strong className="mt-1 block text-2xl font-semibold">
            {totalPlaneado.toFixed(2)} EUR
          </strong>
        </div>
      </div>

      <div className="space-y-4">
        <motion.ul layout className="grid gap-3 md:hidden">
          {filtered.map((expense) => (
            <motion.li
              key={expense.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{expense.description}</p>
                  <small className="text-xs uppercase tracking-wide text-slate-400">
                    {accountById[expense.accountId] ?? 'Conta desconhecida'} · {expense.category}
                  </small>
                </div>
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusStyles[expense.status]}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {statusLabels[expense.status]}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                  <Euro className="h-4 w-4 text-slate-400" />
                  {expense.amount.toFixed(2)} {expense.currency}
                </span>
                <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                  <CalendarDays className="h-4 w-4 text-slate-400" />
                  {new Date(expense.dueDate).toLocaleDateString('pt-PT')}
                </span>
                {expense.recurrence && (
                  <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs uppercase tracking-wide text-slate-500">
                    <RefreshCcw className="h-4 w-4 text-slate-400" />
                    {expense.recurrence}
                  </span>
                )}
              </div>
            </motion.li>
          ))}
          {filtered.length === 0 && (
            <li className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-center text-sm text-slate-500">
              Nenhuma despesa encontrada para os filtros seleccionados.
            </li>
          )}
        </motion.ul>

        <div className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-semibold">Descrição</th>
                  <th className="px-6 py-4 font-semibold">Conta</th>
                  <th className="px-6 py-4 font-semibold">Categoria</th>
                  <th className="px-6 py-4 font-semibold">Valor</th>
                  <th className="px-6 py-4 font-semibold">Vencimento</th>
                  <th className="px-6 py-4 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((expense) => (
                  <motion.tr
                    key={expense.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-slate-900">{expense.description}</p>
                      {expense.recurrence && (
                        <small className="text-xs uppercase tracking-wide text-slate-400">
                          Recorrência: {expense.recurrence}
                        </small>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{accountById[expense.accountId]}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{expense.category}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-700">
                      {expense.amount.toFixed(2)} {expense.currency}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(expense.dueDate).toLocaleDateString('pt-PT')}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusStyles[expense.status]}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {statusLabels[expense.status]}
                      </span>
                    </td>
                  </motion.tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                      Nenhuma despesa encontrada para os filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

export default ExpensesPage;
