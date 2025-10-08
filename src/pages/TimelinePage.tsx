import { FormEvent, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Euro, Pencil, Save, Trash2, XCircle } from 'lucide-react';
import { useAppState } from '../state/AppStateContext';
import { TimelineBoard } from '../components/timeline/TimelineBoard';
import type { TimelineEntry } from '../data/models';
import { validateFirebaseConfig } from '../services/firebase';
import { persistTimelineEntry, removeTimelineEntryById } from '../services/timeline';

interface TimelineFormState {
  id?: string;
  date: string;
  type: TimelineEntry['type'];
  description: string;
  amount: string;
  currency: string;
  linkedExpenseId: string;
  linkedTransferId: string;
}

const EMPTY_FORM: TimelineFormState = {
  date: new Date().toISOString().substring(0, 10),
  type: 'despesa',
  description: '',
  amount: '',
  currency: 'EUR',
  linkedExpenseId: '',
  linkedTransferId: ''
};

function TimelinePage() {
  const timeline = useAppState((state) => state.timeline);
  const expenses = useAppState((state) => state.expenses);
  const transfers = useAppState((state) => state.transfers);
  const addTimelineEntry = useAppState((state) => state.addTimelineEntry);
  const removeTimelineEntry = useAppState((state) => state.removeTimelineEntry);
  const settings = useAppState((state) => state.settings);

  const [formState, setFormState] = useState<TimelineFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedEntries = useMemo(
    () => timeline.slice().sort((a, b) => a.date.localeCompare(b.date)),
    [timeline]
  );

  const handleEdit = (entry: TimelineEntry) => {
    setEditingId(entry.id);
    setFormState({
      id: entry.id,
      date: entry.date.substring(0, 10),
      type: entry.type,
      description: entry.description,
      amount: entry.amount.toString(),
      currency: entry.currency,
      linkedExpenseId: entry.linkedExpenseId ?? '',
      linkedTransferId: entry.linkedTransferId ?? ''
    });
    setFeedback(null);
    setError(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormState({
      ...EMPTY_FORM,
      date: new Date().toISOString().substring(0, 10)
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    setError(null);

    const config = settings.firebaseConfig;
    if (!config || !validateFirebaseConfig(config)) {
      setError('Configure o Firebase nas definições antes de gerir a timeline.');
      return;
    }

    if (!formState.date) {
      setError('Indique a data do evento.');
      return;
    }

    const trimmedDescription = formState.description.trim();
    if (!trimmedDescription) {
      setError('Indique uma descrição.');
      return;
    }

    const parsedAmount = Number.parseFloat(formState.amount.replace(',', '.'));
    if (!Number.isFinite(parsedAmount)) {
      setError('Valor inválido.');
      return;
    }

    const currency = formState.currency.trim().toUpperCase() || 'EUR';
    const dateIso = new Date(formState.date).toISOString();

    const entry: TimelineEntry = {
      id: formState.id ?? `tl-${crypto.randomUUID()}`,
      date: dateIso,
      type: formState.type,
      description: trimmedDescription,
      amount: parsedAmount,
      currency,
      linkedExpenseId: formState.linkedExpenseId || undefined,
      linkedTransferId: formState.linkedTransferId || undefined
    };

    setIsSaving(true);
    try {
      await persistTimelineEntry(entry, config);
      addTimelineEntry(entry);
      setFeedback(editingId ? 'Evento atualizado com sucesso.' : 'Evento criado com sucesso.');
      resetForm();
    } catch (submitError) {
      console.error('Não foi possível guardar o evento da timeline.', submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Não foi possível guardar o evento. Tente novamente.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    const config = settings.firebaseConfig;
    if (!config || !validateFirebaseConfig(config)) {
      setError('Configure o Firebase nas definições antes de gerir a timeline.');
      return;
    }

    setFeedback(null);
    setError(null);
    setDeletingId(entryId);

    try {
      await removeTimelineEntryById(entryId, config);
      removeTimelineEntry(entryId);
      if (editingId === entryId) {
        resetForm();
      }
      setFeedback('Evento removido.');
    } catch (deleteError) {
      console.error('Não foi possível remover o evento da timeline.', deleteError);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Não foi possível remover o evento. Tente novamente.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-8"
    >
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Timeline</h1>
        <p className="max-w-2xl text-sm text-slate-500 sm:text-base">
          Visualize num só calendário todos os pagamentos, vencimentos e transferências.
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
              {editingId ? 'Editar evento' : 'Adicionar evento'}
            </h2>
            <p className="text-xs text-slate-500">
              {editingId
                ? 'Ajuste os detalhes do evento selecionado.'
                : 'Registe eventos manuais para completar a timeline.'}
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
            <span className="text-xs uppercase tracking-wide text-slate-400">Data</span>
            <input
              type="date"
              value={formState.date}
              onChange={(event) => setFormState((prev) => ({ ...prev, date: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
            />
          </label>
          <label className="block space-y-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-wide text-slate-400">Tipo</span>
            <select
              value={formState.type}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, type: event.target.value as TimelineEntry['type'] }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
            >
              <option value="despesa">Despesa</option>
              <option value="vencimento">Vencimento</option>
              <option value="transferencia">Transferência</option>
            </select>
          </label>
          <label className="block space-y-2 text-sm text-slate-600 md:col-span-2 lg:col-span-1">
            <span className="text-xs uppercase tracking-wide text-slate-400">Descrição</span>
            <input
              type="text"
              value={formState.description}
              onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
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
            <span className="text-xs uppercase tracking-wide text-slate-400">Despesa associada</span>
            <select
              value={formState.linkedExpenseId}
              onChange={(event) => setFormState((prev) => ({ ...prev, linkedExpenseId: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
            >
              <option value="">Sem ligação</option>
              {expenses.map((expense) => (
                <option key={expense.id} value={expense.id}>
                  {expense.description}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-wide text-slate-400">Transferência associada</span>
            <select
              value={formState.linkedTransferId}
              onChange={(event) => setFormState((prev) => ({ ...prev, linkedTransferId: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
            >
              <option value="">Sem ligação</option>
              {transfers.map((transfer) => (
                <option key={transfer.id} value={transfer.id}>
                  {transfer.notes ? `${transfer.notes} · ` : ''}
                  {transfer.amount.toFixed(2)} {transfer.currency}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'A guardar…' : editingId ? 'Guardar alterações' : 'Criar evento'}
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

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <TimelineBoard entries={timeline} />
        <motion.div
          layout
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Eventos</h2>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 shadow-sm">
              {sortedEntries.length}
            </span>
          </div>
          <motion.ul layout className="space-y-3">
            {sortedEntries.map((entry) => (
              <motion.li
                key={entry.id}
                layout
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{entry.description}</p>
                    <small className="flex items-center gap-1 text-xs uppercase tracking-wide text-slate-500">
                      <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                      {new Date(entry.date).toLocaleDateString('pt-PT')} · {entry.type}
                    </small>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900">
                    <Euro className="h-4 w-4 text-slate-400" />
                    {entry.amount.toFixed(2)} {entry.currency}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(entry)}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                  >
                    <Pencil className="h-4 w-4" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(entry.id)}
                    disabled={deletingId === entry.id}
                    className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    {deletingId === entry.id ? 'A remover…' : 'Remover'}
                  </button>
                </div>
              </motion.li>
            ))}
            {sortedEntries.length === 0 && (
              <li className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-4 text-sm text-slate-500">
                Ainda não existem eventos registados manualmente.
              </li>
            )}
          </motion.ul>
        </motion.div>
      </div>
    </motion.section>
  );
}

export default TimelinePage;
