import { FormEvent, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Euro, Pencil, RefreshCcw, Save, Trash2, XCircle } from 'lucide-react';
import { useAppState } from '../state/AppStateContext';
import type { Expense } from '../data/models';
import { validateFirebaseConfig } from '../services/firebase';
import { persistExpense, removeExpenseMetadata } from '../services/expenses';

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

interface ExpenseFormState {
  id?: string;
  accountId: string;
  description: string;
  category: string;
  amount: string;
  currency: string;
  dueDate: string;
  recurrence: Expense['recurrence'] | '';
  fixed: boolean;
  status: Expense['status'];
  supplierId: string;
  documentId: string;
}

const EMPTY_FORM: ExpenseFormState = {
  accountId: '',
  description: '',
  category: '',
  amount: '',
  currency: 'EUR',
  dueDate: '',
  recurrence: '',
  fixed: false,
  status: 'planeado',
  supplierId: '',
  documentId: ''
};

function ExpensesPage() {
  const expenses = useAppState((state) => state.expenses);
  const accounts = useAppState((state) => state.accounts);
  const suppliers = useAppState((state) => state.suppliers);
  const addExpense = useAppState((state) => state.addExpense);
  const removeExpense = useAppState((state) => state.removeExpense);
  const settings = useAppState((state) => state.settings);
  const [formState, setFormState] = useState<ExpenseFormState>(() => ({
    ...EMPTY_FORM,
    accountId: accounts[0]?.id ?? ''
  }));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accountFilter, setAccountFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todas');

  useEffect(() => {
    if (!editingId) {
      const defaultAccountId = accounts[0]?.id || '';
      setFormState((prev) => ({
        ...prev,
        accountId: prev.accountId || defaultAccountId
      }));
    }
  }, [accounts, editingId]);

  const handleEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setFormState({
      id: expense.id,
      accountId: expense.accountId,
      description: expense.description,
      category: expense.category,
      amount: expense.amount.toString(),
      currency: expense.currency,
      dueDate: expense.dueDate.substring(0, 10),
      recurrence: expense.recurrence ?? '',
      fixed: expense.fixed,
      status: expense.status,
      supplierId: expense.supplierId ?? '',
      documentId: expense.documentId ?? ''
    });
    setFeedback(null);
    setError(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormState({
      ...EMPTY_FORM,
      accountId: accounts[0]?.id ?? ''
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    setError(null);

    const config = settings.firebaseConfig;
    if (!config || !validateFirebaseConfig(config)) {
      setError('Configure o Firebase nas definições antes de gerir despesas.');
      return;
    }

    if (!formState.accountId) {
      setError('Selecione a conta associada.');
      return;
    }

    const trimmedDescription = formState.description.trim();
    if (!trimmedDescription) {
      setError('Indique uma descrição para a despesa.');
      return;
    }

    const trimmedCategory = formState.category.trim();
    if (!trimmedCategory) {
      setError('Indique uma categoria.');
      return;
    }

    if (!formState.dueDate) {
      setError('Indique a data de vencimento.');
      return;
    }

    const parsedAmount = Number.parseFloat(formState.amount.replace(',', '.'));
    if (!Number.isFinite(parsedAmount)) {
      setError('Valor da despesa inválido.');
      return;
    }

    const currency = formState.currency.trim().toUpperCase() || 'EUR';
    const dueDateIso = new Date(formState.dueDate).toISOString();

    const expense: Expense = {
      id: formState.id ?? `exp-${crypto.randomUUID()}`,
      accountId: formState.accountId,
      description: trimmedDescription,
      category: trimmedCategory,
      amount: parsedAmount,
      currency,
      dueDate: dueDateIso,
      recurrence: formState.recurrence || undefined,
      fixed: formState.fixed,
      status: formState.status,
      supplierId: formState.supplierId || undefined,
      documentId: formState.documentId || undefined
    };

    setIsSaving(true);
    try {
      await persistExpense(expense, config);
      addExpense(expense);
      setFeedback(editingId ? 'Despesa atualizada com sucesso.' : 'Despesa criada com sucesso.');
      resetForm();
    } catch (submitError) {
      console.error('Não foi possível guardar a despesa.', submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Não foi possível guardar a despesa. Tente novamente.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (expenseId: string) => {
    const config = settings.firebaseConfig;
    if (!config || !validateFirebaseConfig(config)) {
      setError('Configure o Firebase nas definições antes de gerir despesas.');
      return;
    }

    setFeedback(null);
    setError(null);
    setDeletingId(expenseId);

    try {
      await removeExpenseMetadata(expenseId, config);
      removeExpense(expenseId);
      if (editingId === expenseId) {
        resetForm();
      }
      setFeedback('Despesa removida.');
    } catch (deleteError) {
      console.error('Não foi possível remover a despesa.', deleteError);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Não foi possível remover a despesa. Tente novamente.'
      );
    } finally {
      setDeletingId(null);
    }
  };

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

      <motion.form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
              {editingId ? 'Editar despesa' : 'Adicionar despesa'}
            </h2>
            <p className="text-xs text-slate-500">
              {editingId ? 'Atualize os dados da despesa selecionada.' : 'Registe manualmente uma nova despesa.'}
            </p>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
            >
              <XCircle className="h-4 w-4" />
              Cancelar edição
            </button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="block space-y-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-wide text-slate-400">Conta</span>
            <select
              value={formState.accountId}
              onChange={(event) => setFormState((prev) => ({ ...prev, accountId: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
            >
              <option value="">Selecionar conta…</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-wide text-slate-400">Descrição</span>
            <input
              type="text"
              value={formState.description}
              onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-slate-900/10"
            />
          </label>

          <label className="block space-y-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-wide text-slate-400">Categoria</span>
            <input
              type="text"
              value={formState.category}
              onChange={(event) => setFormState((prev) => ({ ...prev, category: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-slate-900/10"
            />
          </label>

          <label className="block space-y-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-wide text-slate-400">Valor</span>
            <input
              type="number"
              step="0.01"
              value={formState.amount}
              onChange={(event) => setFormState((prev) => ({ ...prev, amount: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-slate-900/10"
            />
          </label>

          <label className="block space-y-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-wide text-slate-400">Moeda</span>
            <input
              type="text"
              value={formState.currency}
              onChange={(event) => setFormState((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))}
              maxLength={3}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm uppercase text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-slate-900/10"
            />
          </label>

          <label className="block space-y-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-wide text-slate-400">Data de vencimento</span>
            <input
              type="date"
              value={formState.dueDate}
              onChange={(event) => setFormState((prev) => ({ ...prev, dueDate: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
            />
          </label>

          <label className="block space-y-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-wide text-slate-400">Recorrência</span>
            <select
              value={formState.recurrence}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  recurrence: event.target.value as Expense['recurrence'] | ''
                }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
            >
              <option value="">Sem recorrência</option>
              <option value="mensal">Mensal</option>
              <option value="semestral">Semestral</option>
              <option value="anual">Anual</option>
              <option value="pontual">Pontual</option>
            </select>
          </label>

          <label className="block space-y-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-wide text-slate-400">Estado</span>
            <select
              value={formState.status}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, status: event.target.value as Expense['status'] }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
            >
              <option value="planeado">Planeado</option>
              <option value="pago">Pago</option>
              <option value="em-analise">Em análise</option>
            </select>
          </label>

          <label className="block space-y-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-wide text-slate-400">Fornecedor</span>
            <select
              value={formState.supplierId}
              onChange={(event) => setFormState((prev) => ({ ...prev, supplierId: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
            >
              <option value="">Sem fornecedor</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-wide text-slate-400">Documento associado</span>
            <input
              type="text"
              value={formState.documentId}
              onChange={(event) => setFormState((prev) => ({ ...prev, documentId: event.target.value }))}
              placeholder="ID do documento (opcional)"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-slate-900/10"
            />
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
            <input
              type="checkbox"
              checked={formState.fixed}
              onChange={(event) => setFormState((prev) => ({ ...prev, fixed: event.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/10"
            />
            Despesa fixa
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'A guardar…' : editingId ? 'Guardar alterações' : 'Criar despesa'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => handleDelete(editingId)}
              disabled={deletingId === editingId}
              className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              {deletingId === editingId ? 'A remover…' : 'Remover'}
            </button>
          )}
        </div>

        <AnimatePresence>
          {(error || feedback) && (
            <motion.p
              key={(error ?? feedback) as string}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
                error
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {error ?? feedback}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.form>

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
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusStyles[expense.status]}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {statusLabels[expense.status]}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleEdit(expense)}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                  >
                    <Pencil className="h-4 w-4" />
                    Editar
                  </button>
                </div>
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
                  <th className="px-6 py-4 font-semibold">Ações</th>
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
                    <td className="px-6 py-4 text-sm">
                      <button
                        type="button"
                        onClick={() => handleEdit(expense)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </button>
                    </td>
                  </motion.tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500">
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
