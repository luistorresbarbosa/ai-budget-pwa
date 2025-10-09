import { FormEvent, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  ArrowRightLeft,
  CalendarDays,
  Euro,
  Pencil,
  PlusCircle,
  Save,
  Trash2,
  XCircle
} from 'lucide-react';
import { useAppState } from '../state/AppStateContext';
import type { DocumentMetadata, Transfer } from '../data/models';
import { validateFirebaseConfig } from '../services/firebase';
import { persistTransfer, removeTransferById } from '../services/transfers';
import { Modal } from '../components/Modal';

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
  const documents = useAppState((state) => state.documents);
  const addTransfer = useAppState((state) => state.addTransfer);
  const removeTransfer = useAppState((state) => state.removeTransfer);
  const settings = useAppState((state) => state.settings);

  const [draft, setDraft] = useState(() =>
    defaultTransfer(accounts[0]?.id ?? '', accounts[1]?.id ?? accounts[0]?.id ?? '')
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const resetDraft = () => {
    setEditingId(null);
    setDraft(defaultTransfer(accounts[0]?.id ?? '', accounts[1]?.id ?? accounts[0]?.id ?? ''));
  };

  const openCreateModal = () => {
    resetDraft();
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setError(null);
    setDeletingId(null);
    resetDraft();
  };

  const handleEdit = (transfer: Transfer) => {
    setEditingId(transfer.id);
    setDraft({ ...transfer });
    setIsModalOpen(true);
    setError(null);
  };

  type MonthlyRequirementEntry = {
    monthKey: string;
    monthLabel: string;
    total: number;
    currency: string;
    documents: DocumentMetadata[];
  };

  type AccountMonthlyRequirement = {
    accountId?: string;
    accountName: string;
    currency: string;
    months: MonthlyRequirementEntry[];
    total: number;
  };

  const {
    monthlySummaries,
    missingAmountDocs,
    missingDateDocs,
    missingAccountDocs
  } = useMemo(() => {
    const UNASSIGNED_KEY = '__unassigned__';
    const normalizedAccounts = accounts.map((account) => ({
      ...account,
      normalizedName: account.name.toLowerCase().trim()
    }));

    const monthsByAccount = new Map<string, Map<string, MonthlyRequirementEntry>>();
    const missingAmount: DocumentMetadata[] = [];
    const missingDate: DocumentMetadata[] = [];
    const missingAccount: DocumentMetadata[] = [];

    documents.forEach((doc) => {
      if (doc.amount == null) {
        missingAmount.push(doc);
        return;
      }

      if (!doc.dueDate) {
        missingDate.push(doc);
        return;
      }

      const dueDate = new Date(doc.dueDate);
      if (Number.isNaN(dueDate.getTime())) {
        missingDate.push(doc);
        return;
      }

      const monthKey = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = dueDate.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });

      const hint = doc.accountHint?.toLowerCase().trim();
      const matchedAccount = hint
        ? normalizedAccounts.find(
            (account) =>
              account.normalizedName === hint ||
              account.normalizedName.includes(hint) ||
              hint.includes(account.normalizedName)
          )
        : undefined;

      const accountKey = matchedAccount?.id ?? UNASSIGNED_KEY;
      if (!monthsByAccount.has(accountKey)) {
        monthsByAccount.set(accountKey, new Map());
      }

      const accountMonths = monthsByAccount.get(accountKey)!;
      const currency = doc.currency ?? matchedAccount?.currency ?? 'EUR';

      if (!accountMonths.has(monthKey)) {
        accountMonths.set(monthKey, {
          monthKey,
          monthLabel,
          total: 0,
          currency,
          documents: []
        });
      }

      const monthEntry = accountMonths.get(monthKey)!;
      monthEntry.total += doc.amount;
      monthEntry.documents.push(doc);
      if (!monthEntry.currency && currency) {
        monthEntry.currency = currency;
      }

      if (!matchedAccount) {
        missingAccount.push(doc);
      }
    });

    const summaries: AccountMonthlyRequirement[] = Array.from(monthsByAccount.entries()).map(
      ([accountKey, monthsMap]) => {
        const months = Array.from(monthsMap.values()).sort((a, b) =>
          a.monthKey.localeCompare(b.monthKey)
        );

        const account =
          accountKey === UNASSIGNED_KEY
            ? undefined
            : accounts.find((item) => item.id === accountKey);

        const total = months.reduce((sum, month) => sum + month.total, 0);

        return {
          accountId: account?.id,
          accountName: account?.name ?? 'Conta não identificada',
          currency: account?.currency ?? months[0]?.currency ?? 'EUR',
          months,
          total
        } satisfies AccountMonthlyRequirement;
      }
    );

    summaries.sort((a, b) => {
      if (a.accountId && !b.accountId) return -1;
      if (!a.accountId && b.accountId) return 1;
      return a.accountName.localeCompare(b.accountName, 'pt-PT');
    });

    return {
      monthlySummaries: summaries,
      missingAmountDocs: missingAmount,
      missingDateDocs: missingDate,
      missingAccountDocs: missingAccount
    };
  }, [accounts, documents]);

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = event.target;
    setDraft((prev) => ({
      ...prev,
      [name]:
        name === 'amount'
          ? Number(value)
          : name === 'currency'
          ? value.toUpperCase()
          : value
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFeedback(null);
    setError(null);

    const config = settings.firebaseConfig;
    if (!config || !validateFirebaseConfig(config)) {
      setError('Configure o Firebase nas definições antes de gerir transferências.');
      return;
    }

    if (!draft.fromAccountId || !draft.toAccountId) {
      setError('Selecione as contas de origem e destino.');
      return;
    }

    if (draft.fromAccountId === draft.toAccountId) {
      setError('Escolha contas diferentes para a transferência.');
      return;
    }

    if (!Number.isFinite(draft.amount) || draft.amount <= 0) {
      setError('Indique um valor válido.');
      return;
    }

    if (!draft.scheduleDate) {
      setError('Indique a data da transferência.');
      return;
    }

    const currency = (draft.currency || 'EUR').toUpperCase();
    const scheduleDate = new Date(draft.scheduleDate).toISOString();

    const transfer: Transfer = {
      ...draft,
      id: editingId ?? `transf-${crypto.randomUUID()}`,
      currency,
      scheduleDate
    };

    setIsSaving(true);
    try {
      await persistTransfer(transfer, config);
      addTransfer(transfer);
      setFeedback(editingId ? 'Transferência atualizada com sucesso.' : 'Transferência criada com sucesso.');
      resetDraft();
      setIsModalOpen(false);
    } catch (submitError) {
      console.error('Não foi possível guardar a transferência.', submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Não foi possível guardar a transferência. Tente novamente.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  const handleDelete = async (transferId: string) => {
    const config = settings.firebaseConfig;
    if (!config || !validateFirebaseConfig(config)) {
      setError('Configure o Firebase nas definições antes de gerir transferências.');
      return;
    }

    setFeedback(null);
    setError(null);
    setDeletingId(transferId);

    try {
      await removeTransferById(transferId, config);
      removeTransfer(transferId);
      if (editingId === transferId) {
        resetDraft();
        setIsModalOpen(false);
      }
      setFeedback('Transferência removida.');
    } catch (deleteError) {
      console.error('Não foi possível remover a transferência.', deleteError);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Não foi possível remover a transferência. Tente novamente.'
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
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Transferências</h1>
          <p className="max-w-2xl text-sm text-slate-500 sm:text-base">
            Planeie transferências entre contas e acompanhe as execuções futuras.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          <PlusCircle className="h-4 w-4" /> Nova transferência
        </button>
      </header>

      <AnimatePresence>
        {!isModalOpen && (feedback || error) && (
          <motion.p
            key={(feedback ?? error) as string}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
              error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {error ?? feedback}
          </motion.p>
        )}
      </AnimatePresence>

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar transferência' : 'Agendar transferência'}
        description={
          editingId
            ? 'Ajuste os detalhes da transferência seleccionada antes de sincronizar.'
            : 'Defina uma nova transferência entre contas e mantenha o plano actualizado.'
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2 text-sm text-slate-600">
              <span className="text-xs uppercase tracking-wide text-slate-400">De</span>
              <select
                name="fromAccountId"
                value={draft.fromAccountId}
                onChange={handleChange}
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
              <span className="text-xs uppercase tracking-wide text-slate-400">Para</span>
              <select
                name="toAccountId"
                value={draft.toAccountId}
                onChange={handleChange}
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
              <span className="text-xs uppercase tracking-wide text-slate-400">Valor</span>
              <input
                type="number"
                name="amount"
                value={Number.isFinite(draft.amount) ? draft.amount : ''}
                step="0.01"
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-slate-900/10"
              />
            </label>
            <label className="block space-y-2 text-sm text-slate-600">
              <span className="text-xs uppercase tracking-wide text-slate-400">Moeda</span>
              <input
                type="text"
                name="currency"
                value={draft.currency}
                onChange={handleChange}
                maxLength={3}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm uppercase text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-slate-900/10"
              />
            </label>
            <label className="block space-y-2 text-sm text-slate-600">
              <span className="text-xs uppercase tracking-wide text-slate-400">Data agendada</span>
              <input
                type="date"
                name="scheduleDate"
                value={draft.scheduleDate ? draft.scheduleDate.substring(0, 10) : ''}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    scheduleDate: event.target.value ? new Date(event.target.value).toISOString() : ''
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
              />
            </label>
            <label className="block space-y-2 text-sm text-slate-600">
              <span className="text-xs uppercase tracking-wide text-slate-400">Estado</span>
              <select
                name="status"
                value={draft.status}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
              >
                <option value="agendado">Agendado</option>
                <option value="executado">Executado</option>
                <option value="falhado">Falhado</option>
              </select>
            </label>
            <label className="sm:col-span-2 block space-y-2 text-sm text-slate-600">
              <span className="text-xs uppercase tracking-wide text-slate-400">Notas</span>
              <textarea
                name="notes"
                value={draft.notes ?? ''}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-slate-900/10"
                placeholder="Informações adicionais (opcional)"
              />
            </label>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                key={error}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm"
              >
                {error}
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
              {isSaving ? 'A guardar…' : editingId ? 'Guardar alterações' : 'Criar transferência'}
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

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
            Necessidades mensais por conta
          </h2>
          <p className="text-sm text-slate-500">
            Com base nos documentos importados com valor e data de vencimento identificados.
          </p>
        </div>

        {monthlySummaries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-500">
            Ainda não existem documentos com informação suficiente para calcular as necessidades mensais.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {(() => {
              const maxTotal = Math.max(0, ...monthlySummaries.map((s) => s.total));
              return monthlySummaries.map((summary) => (
              <div
                key={summary.accountId ?? 'unassigned'}
                className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-slate-900">
                      {summary.accountName}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Total previsto: {summary.total.toFixed(2)} {summary.currency}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      summary.accountId
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {summary.accountId
                      ? `${summary.months.length} mês${summary.months.length === 1 ? '' : 'es'}`
                      : 'Rever conta'}
                  </span>
                </div>
                <div className="mt-1">
                  <div className="h-2 w-full rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-slate-900 transition-all"
                      style={{ width: `${maxTotal > 0 ? Math.min(100, Math.round((summary.total / maxTotal) * 100)) : 0}%` }}
                    />
                  </div>
                </div>
                <ul className="divide-y divide-slate-100">
                  {summary.months.map((month) => (
                    <li
                      key={`${summary.accountId ?? 'unassigned'}-${month.monthKey}`}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <div className="space-y-1">
                        <span className="text-sm font-medium capitalize text-slate-900">
                          {month.monthLabel}
                        </span>
                        <span className="text-xs text-slate-500">
                          {month.documents.length} documento
                          {month.documents.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Euro className="h-4 w-4 text-slate-400" />
                        {month.total.toFixed(2)} {month.currency}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              ));
            })()}
          </div>
        )}

        {(missingAmountDocs.length > 0 ||
          missingDateDocs.length > 0 ||
          missingAccountDocs.length > 0) && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-2">
              <p className="font-medium">Alguns documentos precisam de revisão</p>
              <ul className="space-y-1 text-xs text-amber-700/90">
                {missingAmountDocs.length > 0 && (
                  <li>
                    <strong>{missingAmountDocs.length}</strong> sem valor identificado.
                  </li>
                )}
                {missingDateDocs.length > 0 && (
                  <li>
                    <strong>{missingDateDocs.length}</strong> sem data de vencimento válida.
                  </li>
                )}
                {missingAccountDocs.length > 0 && (
                  <li>
                    <strong>{missingAccountDocs.length}</strong> sem conta associada — atribua a conta correta para
                    melhorar a análise.
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
      </section>


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
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-2 text-sm text-slate-600">
                    <Euro className="h-4 w-4 text-slate-400" />
                    {transfer.amount.toFixed(2)} {transfer.currency}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleEdit(transfer)}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                  >
                    <Pencil className="h-4 w-4" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(transfer.id)}
                    disabled={deletingId === transfer.id}
                    className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    {deletingId === transfer.id ? 'A remover…' : 'Remover'}
                  </button>
                </div>
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
