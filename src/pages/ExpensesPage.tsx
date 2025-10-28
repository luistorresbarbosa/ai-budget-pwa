import { FormEvent, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Euro, Pencil, PlusCircle, RefreshCcw, Save, Trash2, XCircle } from 'lucide-react';
import { useAppState } from '../state/AppStateContext';
import type { Expense } from '../data/models';
import { validateFirebaseConfig } from '../services/firebase';
import { persistExpense, removeExpenseMetadata } from '../services/expenses';
import { Modal } from '../components/Modal';
import {
  DocumentUploadButton,
  type DocumentUploadFeedback
} from '../components/documents/DocumentUploadButton';
import MonthlyProjectionChart from '../components/expenses/MonthlyProjectionChart';
import type { MonthlyProjection } from '../types/expenses';

const statusStyles: Record<Expense['status'], string> = {
  planeado: 'border-amber-200 bg-amber-50 text-amber-700',
  pago: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'em-analise': 'border-sky-200 bg-sky-50 text-sky-700'
};

const statusLabels: Record<Expense['status'], string> = {
  planeado: 'Pendente',
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
  recurrenceEndDate: string;
  recurrenceStartDate: string;
  fixed: boolean;
  status: Expense['status'];
  supplierId: string;
  documentId: string;
  recurringExpenseId?: string;
}

const EMPTY_FORM: ExpenseFormState = {
  accountId: '',
  description: '',
  category: '',
  amount: '',
  currency: 'EUR',
  dueDate: '',
  recurrence: '',
  recurrenceEndDate: '',
  recurrenceStartDate: '',
  fixed: false,
  status: 'planeado',
  supplierId: '',
  documentId: ''
};

type ToastState = DocumentUploadFeedback | null;

function parseDateOnly(value: string): Date | null {
  if (!value) {
    return null;
  }
  const [yearString, monthString, dayString] = value.split('-');
  const year = Number.parseInt(yearString ?? '', 10);
  const month = Number.parseInt(monthString ?? '', 10);
  const day = Number.parseInt(dayString ?? '', 10);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, day));
}

function toIsoDate(value: string): string | null {
  const parsed = parseDateOnly(value);
  return parsed ? parsed.toISOString() : null;
}

function generateMonthlyOccurrences(start: Date, end: Date): Date[] {
  const occurrences: Date[] = [];
  if (end < start) {
    return occurrences;
  }

  const startDay = start.getUTCDate();
  let current = new Date(start);

  while (current.getTime() <= end.getTime()) {
    occurrences.push(new Date(current));
    const baseYear = current.getUTCFullYear();
    const baseMonth = current.getUTCMonth();
    const nextMonthStart = new Date(Date.UTC(baseYear, baseMonth + 1, 1));
    const daysInNextMonth = new Date(
      Date.UTC(nextMonthStart.getUTCFullYear(), nextMonthStart.getUTCMonth() + 1, 0)
    ).getUTCDate();
    const day = Math.min(startDay, daysInNextMonth);
    current = new Date(
      Date.UTC(nextMonthStart.getUTCFullYear(), nextMonthStart.getUTCMonth(), day)
    );
  }

  return occurrences;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  }).format(amount);
}

const toastStyles: Record<DocumentUploadFeedback['type'], string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  error: 'border-rose-200 bg-rose-50 text-rose-700',
  info: 'border-slate-200 bg-slate-50 text-slate-600'
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
  const [toast, setToast] = useState<ToastState>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [accountFilter, setAccountFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todas');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const requiresRecurrenceWindow =
    formState.recurrence !== '' && formState.recurrence !== 'pontual';
  const dueDateLabel = requiresRecurrenceWindow
    ? 'Data inicial da recorrência'
    : 'Data de vencimento';

  const handleUploadFeedback = (feedback: DocumentUploadFeedback) => {
    setToast(feedback);
  };

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
      recurrenceEndDate: expense.recurrenceEndDate
        ? expense.recurrenceEndDate.substring(0, 10)
        : '',
      recurrenceStartDate: expense.recurrenceStartDate
        ? expense.recurrenceStartDate.substring(0, 10)
        : '',
      fixed: expense.fixed,
      status: expense.status,
      supplierId: expense.supplierId ?? '',
      documentId: expense.documentId ?? '',
      recurringExpenseId: expense.recurringExpenseId
    });
    setIsModalOpen(true);
    setFormError(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormState({
      ...EMPTY_FORM,
      accountId: accounts[0]?.id ?? ''
    });
  };

  const openCreateModal = () => {
    resetForm();
    setFormError(null);
    setToast(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormError(null);
    setToast(null);
    setDeletingId(null);
    resetForm();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setToast(null);
    setFormError(null);

    const config = settings.firebaseConfig;
    if (!config || !validateFirebaseConfig(config)) {
      setFormError('Configure o Firebase nas definições antes de gerir despesas.');
      return;
    }

    if (!formState.accountId) {
      setFormError('Selecione a conta associada.');
      return;
    }

    const trimmedDescription = formState.description.trim();
    if (!trimmedDescription) {
      setFormError('Indique uma descrição para a despesa.');
      return;
    }

    const trimmedCategory = formState.category.trim();
    if (!trimmedCategory) {
      setFormError('Indique uma categoria.');
      return;
    }

    if (!formState.dueDate) {
      setFormError('Indique a data de vencimento.');
      return;
    }

    const parsedAmount = Number.parseFloat(formState.amount.replace(',', '.'));
    if (!Number.isFinite(parsedAmount)) {
      setFormError('Valor da despesa inválido.');
      return;
    }

    const currency = formState.currency.trim().toUpperCase() || 'EUR';
    const startDate = parseDateOnly(formState.dueDate);
    if (!startDate) {
      setFormError('Data de vencimento inválida.');
      return;
    }

    const endDate = formState.recurrenceEndDate ? parseDateOnly(formState.recurrenceEndDate) : null;
    const recurrenceStartIsoInput = formState.recurrenceStartDate
      ? toIsoDate(formState.recurrenceStartDate) ?? undefined
      : undefined;
    const recurrenceEndIsoString = endDate ? endDate.toISOString() : undefined;
    const requiresWindow = Boolean(formState.recurrence && formState.recurrence !== 'pontual');

    if (requiresWindow && !endDate) {
      setFormError('Indique a data final da recorrência.');
      return;
    }

    if (requiresWindow && endDate && endDate < startDate) {
      setFormError('A data final deve ser posterior à data inicial.');
      return;
    }

    const baseExpenseData: Pick<
      Expense,
      'accountId' | 'description' | 'category' | 'amount' | 'currency' | 'recurrence' | 'fixed' | 'supplierId' | 'documentId'
    > = {
      accountId: formState.accountId,
      description: trimmedDescription,
      category: trimmedCategory,
      amount: parsedAmount,
      currency,
      recurrence: formState.recurrence || undefined,
      fixed: formState.fixed,
      supplierId: formState.supplierId || undefined,
      documentId: formState.documentId || undefined
    };

    const shouldGenerateSeries = !editingId && requiresWindow && endDate;

    if (shouldGenerateSeries && endDate) {
      const occurrences = generateMonthlyOccurrences(startDate, endDate);
      if (occurrences.length === 0) {
        setFormError('Não existem ocorrências dentro do intervalo indicado.');
        return;
      }

      const seriesId = formState.recurringExpenseId ?? `rec-${crypto.randomUUID()}`;
      const recurrenceStartIso = startDate.toISOString();
      const recurrenceEndIso = endDate.toISOString();

      setIsSaving(true);
      try {
        const expensesToPersist: Expense[] = occurrences.map((occurrence) => ({
          ...baseExpenseData,
          id: `exp-${crypto.randomUUID()}`,
          dueDate: occurrence.toISOString(),
          status: 'planeado',
          recurringExpenseId: seriesId,
          recurrenceStartDate: recurrenceStartIso,
          recurrenceEndDate: recurrenceEndIso
        }));

        await Promise.all(expensesToPersist.map((item) => persistExpense(item, config)));
        expensesToPersist.forEach((item) => addExpense(item));
        setToast({
          type: 'success',
          message: `Foram criadas ${occurrences.length} despesas recorrentes.`
        });
        resetForm();
        setIsModalOpen(false);
      } catch (submitError) {
        console.error('Não foi possível guardar a despesa recorrente.', submitError);
        setFormError(
          submitError instanceof Error
            ? submitError.message
            : 'Não foi possível guardar as despesas recorrentes. Tente novamente.'
        );
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const recurrenceStartIso =
      recurrenceStartIsoInput ?? (requiresWindow ? startDate.toISOString() : undefined);

    const expense: Expense = {
      id: formState.id ?? `exp-${crypto.randomUUID()}`,
      ...baseExpenseData,
      dueDate: startDate.toISOString(),
      status: formState.status,
      recurringExpenseId: formState.recurringExpenseId,
      recurrenceStartDate: recurrenceStartIso,
      recurrenceEndDate: recurrenceEndIsoString
    };

    setIsSaving(true);
    try {
      await persistExpense(expense, config);
      addExpense(expense);
      setToast({
        type: 'success',
        message: editingId ? 'Despesa atualizada com sucesso.' : 'Despesa criada com sucesso.'
      });
      resetForm();
      setIsModalOpen(false);
    } catch (submitError) {
      console.error('Não foi possível guardar a despesa.', submitError);
      setFormError(
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
      setFormError('Configure o Firebase nas definições antes de gerir despesas.');
      return;
    }

    setToast(null);
    setFormError(null);
    setDeletingId(expenseId);

    try {
      await removeExpenseMetadata(expenseId, config);
      removeExpense(expenseId);
      if (editingId === expenseId) {
        resetForm();
        setIsModalOpen(false);
      }
      setToast({ type: 'success', message: 'Despesa removida.' });
    } catch (deleteError) {
      console.error('Não foi possível remover a despesa.', deleteError);
      setFormError(
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

  const monthlyProjections = useMemo<MonthlyProjection[]>(() => {
    if (expenses.length === 0) {
      return [];
    }

    const now = new Date();
    const startOfCurrentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const accumulator = new Map<string, { label: string; totals: Record<string, number> }>();

    expenses.forEach((expense) => {
      if (expense.status === 'pago') {
        return;
      }
      const due = new Date(expense.dueDate);
      if (Number.isNaN(due.getTime())) {
        return;
      }
      if (due.getTime() < startOfCurrentMonth.getTime()) {
        return;
      }
      const key = `${due.getUTCFullYear()}-${String(due.getUTCMonth() + 1).padStart(2, '0')}`;
      const label = due.toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' });
      const existing = accumulator.get(key);
      const totals = existing?.totals ?? {};
      totals[expense.currency] = (totals[expense.currency] ?? 0) + expense.amount;
      accumulator.set(key, { label, totals });
    });

    return Array.from(accumulator.entries())
      .map(([key, value]) => ({
        key,
        label: value.label,
        totals: value.totals,
        totalAmount: Object.values(value.totals).reduce((sum, amount) => sum + amount, 0)
      }))
      .sort((a, b) => (a.key < b.key ? -1 : 1))
      .slice(0, 12);
  }, [expenses]);

  const projectionTotalsByCurrency = useMemo(() => {
    return monthlyProjections.reduce<Record<string, number>>((acc, month) => {
      Object.entries(month.totals).forEach(([currency, amount]) => {
        acc[currency] = (acc[currency] ?? 0) + amount;
      });
      return acc;
    }, {});
  }, [monthlyProjections]);

  const currencyOrder = useMemo(() => {
    return Object.keys(projectionTotalsByCurrency).sort();
  }, [projectionTotalsByCurrency]);

  const projectionTotalsSummary = useMemo(() => {
    const entries = Object.entries(projectionTotalsByCurrency);
    if (entries.length === 0) {
      return 'Sem despesas futuras registadas.';
    }
    return entries
      .map(([currency, amount]) => formatCurrency(amount, currency))
      .join(' · ');
  }, [projectionTotalsByCurrency]);

  const highestProjection = useMemo(() => {
    if (monthlyProjections.length === 0) {
      return null;
    }
    return monthlyProjections.reduce((acc, item) => {
      return item.totalAmount > acc.totalAmount ? item : acc;
    }, monthlyProjections[0]);
  }, [monthlyProjections]);

  const monthlyAverageByCurrency = useMemo(() => {
    if (monthlyProjections.length === 0) {
      return {} as Record<string, number>;
    }
    return currencyOrder.reduce<Record<string, number>>((acc, currency) => {
      acc[currency] =
        (projectionTotalsByCurrency[currency] ?? 0) / monthlyProjections.length;
      return acc;
    }, {});
  }, [currencyOrder, projectionTotalsByCurrency, monthlyProjections]);

  const nextProjectionMonth = monthlyProjections[0] ?? null;

  const formatProjectionTotals = (projection: MonthlyProjection) =>
    Object.entries(projection.totals)
      .map(([currency, amount]) => formatCurrency(amount, currency))
      .join(' · ');

  const filtered = useMemo(
    () =>
      expenses.filter((expense) => {
        const matchAccount = accountFilter ? expense.accountId === accountFilter : true;
        const matchStatus = statusFilter === 'todas' ? true : expense.status === statusFilter;
        return matchAccount && matchStatus;
      }),
    [expenses, accountFilter, statusFilter]
  );

  const totalPendente = filtered
    .filter((item) => item.status !== 'pago')
    .reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-8"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Despesas</h1>
          <p className="max-w-2xl text-sm text-slate-500 sm:text-base">
            Revise despesas fixas e variáveis, confirme dados extraídos e acompanhe pagamentos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DocumentUploadButton onFeedback={handleUploadFeedback} />
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <PlusCircle className="h-4 w-4" /> Nova despesa
          </button>
        </div>
      </header>

      <AnimatePresence>
        {!isModalOpen && toast && (
          <motion.p
            key={`${toast.type}-${toast.message}`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${toastStyles[toast.type]}`}
          >
            {toast.message}
          </motion.p>
        )}
      </AnimatePresence>

      {monthlyProjections.length > 0 ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-slate-900">
                Projeção de despesas futuras
              </h2>
              <p className="text-sm text-slate-500">
                Totais previstos por mês para despesas ainda pendentes.
              </p>
            </div>
            <span className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm">
              {projectionTotalsSummary}
            </span>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
            <MonthlyProjectionChart
              data={monthlyProjections}
              currencyOrder={currencyOrder}
              formatCurrency={formatCurrency}
            />

            <aside className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Insights rápidos
                </h3>
                <div className="mt-3 space-y-3 text-sm text-slate-600">
                  {nextProjectionMonth && (
                    <div>
                      <p className="font-medium text-slate-900">Próximo mês previsto</p>
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        {nextProjectionMonth.label}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatProjectionTotals(nextProjectionMonth)}
                      </p>
                    </div>
                  )}
                  {highestProjection && (
                    <div>
                      <p className="font-medium text-slate-900">Mês com maior impacto</p>
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        {highestProjection.label}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatProjectionTotals(highestProjection)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {currencyOrder.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Média mensal por moeda
                  </h4>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    {currencyOrder.map((currency) => (
                      <li key={currency} className="flex items-center justify-between">
                        <span>{currency}</span>
                        <span className="font-medium text-slate-900">
                          {formatCurrency(monthlyAverageByCurrency[currency] ?? 0, currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          Ainda não existem despesas futuras planeadas. Registe novas despesas ou carregue documentos
          para começar a projetar os próximos meses.
        </section>
      )}

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar despesa' : 'Nova despesa'}
        description={
          editingId
            ? 'Atualize os dados da despesa seleccionada e sincronize com o Firebase.'
            : 'Registe manualmente uma nova despesa e associe às contas e fornecedores.'
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
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
              <span className="text-xs uppercase tracking-wide text-slate-400">{dueDateLabel}</span>
              <input
                type="date"
                value={formState.dueDate}
                onChange={(event) => setFormState((prev) => ({ ...prev, dueDate: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
              />
            </label>

            {requiresRecurrenceWindow && (
              <label className="block space-y-2 text-sm text-slate-600">
                <span className="text-xs uppercase tracking-wide text-slate-400">
                  Data final da recorrência
                </span>
                <input
                  type="date"
                  value={formState.recurrenceEndDate}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, recurrenceEndDate: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
                />
              </label>
            )}

            <label className="block space-y-2 text-sm text-slate-600">
              <span className="text-xs uppercase tracking-wide text-slate-400">Recorrência</span>
              <select
                value={formState.recurrence}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    recurrence: event.target.value as Expense['recurrence'] | '',
                    recurrenceEndDate:
                      event.target.value && event.target.value !== 'pontual'
                        ? prev.recurrenceEndDate
                        : '',
                    recurrenceStartDate:
                      event.target.value && event.target.value !== 'pontual'
                        ? prev.recurrenceStartDate
                        : ''
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
                <option value="planeado">Pendente</option>
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

            <label className="block space-y-2 text-sm text-slate-600 md:col-span-2">
              <span className="text-xs uppercase tracking-wide text-slate-400">Documento associado</span>
              <input
                type="text"
                value={formState.documentId}
                onChange={(event) => setFormState((prev) => ({ ...prev, documentId: event.target.value }))}
                placeholder="ID do documento (opcional)"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-slate-900/10"
              />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 md:col-span-2">
              <input
                type="checkbox"
                checked={formState.fixed}
                onChange={(event) => setFormState((prev) => ({ ...prev, fixed: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/10"
              />
              Despesa fixa
            </label>
          </div>

          <AnimatePresence>
            {formError && (
              <motion.p
                key={formError}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm"
              >
                {formError}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'A guardar…' : editingId ? 'Guardar alterações' : 'Criar despesa'}
            </button>
            <button
              type="button"
              onClick={closeModal}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <XCircle className="h-4 w-4" /> Cancelar
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
        </form>
      </Modal>

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
              <option value="planeado">Pendente</option>
              <option value="pago">Pago</option>
              <option value="em-analise">Em análise</option>
            </select>
          </label>
        </div>
        <div className="rounded-2xl border border-slate-900 bg-slate-900 p-4 text-white shadow-sm">
          <span className="block text-xs uppercase tracking-wider text-slate-200">Total pendente</span>
          <strong className="mt-1 block text-2xl font-semibold">
            {totalPendente.toFixed(2)} EUR
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
                {expense.recurrenceEndDate && (
                  <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs uppercase tracking-wide text-slate-500">
                    <CalendarDays className="h-4 w-4 text-slate-400" />
                    Até {new Date(expense.recurrenceEndDate).toLocaleDateString('pt-PT')}
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
                      {expense.recurrenceEndDate && (
                        <small className="block text-xs uppercase tracking-wide text-slate-400">
                          Até {new Date(expense.recurrenceEndDate).toLocaleDateString('pt-PT')}
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
