import { FormEvent, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Banknote,
  CreditCard,
  PiggyBank,
  PlusCircle,
  Save,
  Wallet2,
  XCircle,
  type LucideIcon
} from 'lucide-react';
import { useAppState } from '../state/AppStateContext';
import type { Account, AccountType } from '../data/models';
import { validateFirebaseConfig } from '../services/firebase';
import { persistAccount, removeAccountById } from '../services/accounts';

const typeLabels: Record<AccountType, string> = {
  corrente: 'Conta corrente',
  poupanca: 'Poupança',
  cartao: 'Cartão',
  outro: 'Outro'
};

const typeIcons: Record<AccountType, LucideIcon> = {
  corrente: Wallet2,
  poupanca: PiggyBank,
  cartao: CreditCard,
  outro: Banknote
};

interface AccountFormState {
  id?: string;
  name: string;
  type: AccountType;
  balance: string;
  currency: string;
}

const EMPTY_FORM: AccountFormState = {
  name: '',
  type: 'corrente',
  balance: '',
  currency: 'EUR'
};

function normaliseCurrency(value: string): string {
  const trimmed = value.trim().toUpperCase();
  if (trimmed.length !== 3) {
    return 'EUR';
  }
  return trimmed;
}

function formatNumberInput(value: string): string {
  return value.replace(/[^0-9,.-]/g, '');
}

export default function AccountsPage() {
  const accounts = useAppState((state) => state.accounts);
  const addAccount = useAppState((state) => state.addAccount);
  const removeAccount = useAppState((state) => state.removeAccount);
  const settings = useAppState((state) => state.settings);
  const [formState, setFormState] = useState<AccountFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalBalance = useMemo(
    () => accounts.reduce((sum, account) => sum + account.balance, 0),
    [accounts]
  );

  const pendingValidation = useMemo(
    () => accounts.filter((account) => account.validationStatus === 'validacao-manual').length,
    [accounts]
  );

  const handleEdit = (account: Account) => {
    setEditingId(account.id);
    setFormState({
      id: account.id,
      name: account.name,
      type: account.type,
      balance: account.balance.toString(),
      currency: account.currency
    });
    setFeedback(null);
    setError(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormState(EMPTY_FORM);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    setError(null);

    const config = settings.firebaseConfig;
    if (!config || !validateFirebaseConfig(config)) {
      setError('Configure o Firebase nas definições antes de gerir contas.');
      return;
    }

    const trimmedName = formState.name.trim();
    if (!trimmedName) {
      setError('Indique um nome para a conta.');
      return;
    }

    const normalisedBalance = formState.balance.replace(',', '.');
    const parsedBalance = Number.parseFloat(normalisedBalance || '0');
    if (!Number.isFinite(parsedBalance)) {
      setError('Valor de saldo inválido.');
      return;
    }

    const previousAccount = editingId ? accounts.find((item) => item.id === editingId) : undefined;

    const account: Account = {
      id: editingId ?? `acc-${crypto.randomUUID()}`,
      name: trimmedName,
      type: formState.type,
      balance: Number(parsedBalance.toFixed(2)),
      currency: normaliseCurrency(formState.currency || 'EUR'),
      metadata: previousAccount?.metadata,
      validationStatus: previousAccount?.validationStatus ?? 'validada'
    };

    setIsSaving(true);
    try {
      await persistAccount(account, config);
      addAccount(account);
      setFeedback(editingId ? 'Conta atualizada com sucesso.' : 'Conta criada com sucesso.');
      resetForm();
    } catch (submitError) {
      console.error('Não foi possível guardar a conta.', submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Não foi possível guardar a conta. Tente novamente.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (accountId: string) => {
    const config = settings.firebaseConfig;
    if (!config || !validateFirebaseConfig(config)) {
      setError('Configure o Firebase nas definições antes de gerir contas.');
      return;
    }

    setFeedback(null);
    setError(null);
    setDeletingId(accountId);

    try {
      await removeAccountById(accountId, config);
      removeAccount(accountId);
      if (editingId === accountId) {
        resetForm();
      }
      setFeedback('Conta removida.');
    } catch (deleteError) {
      console.error('Não foi possível remover a conta.', deleteError);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Não foi possível remover a conta. Tente novamente.'
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
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Contas</h1>
        <p className="max-w-2xl text-sm text-slate-500 sm:text-base">
          Registe e acompanhe todas as contas para associar correctamente despesas e transferências.
        </p>
      </header>

      <motion.div
        layout
        className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-[1fr_1fr]"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {editingId ? 'Editar conta' : 'Nova conta'}
              </p>
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId ? 'Atualize os detalhes da conta' : 'Adicionar nova conta'}
              </h2>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] uppercase tracking-wide text-slate-400">
              {editingId ? 'Em edição' : 'Rápido'}
            </span>
          </div>

          <label className="block space-y-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-wide text-slate-400">Nome da conta</span>
            <input
              value={formState.name}
              onChange={(event) => setFormState((state) => ({ ...state, name: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
              placeholder="Conta principal, Cartão VISA…"
            />
          </label>

          <label className="block space-y-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-wide text-slate-400">Tipo</span>
            <select
              value={formState.type}
              onChange={(event) =>
                setFormState((state) => ({ ...state, type: event.target.value as AccountType }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
            >
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-2 text-sm text-slate-600">
              <span className="text-xs uppercase tracking-wide text-slate-400">Saldo atual</span>
              <input
                value={formState.balance}
                onChange={(event) =>
                  setFormState((state) => ({ ...state, balance: formatNumberInput(event.target.value) }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
                placeholder="0,00"
                inputMode="decimal"
              />
            </label>
            <label className="block space-y-2 text-sm text-slate-600">
              <span className="text-xs uppercase tracking-wide text-slate-400">Moeda</span>
              <input
                value={formState.currency}
                onChange={(event) =>
                  setFormState((state) => ({ ...state, currency: event.target.value.toUpperCase() }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
                maxLength={3}
                placeholder="EUR"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {editingId ? <Save className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
              {editingId ? 'Guardar alterações' : 'Adicionar conta'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                <XCircle className="h-4 w-4" /> Cancelar
              </button>
            )}
          </div>

          <AnimatePresence>
            {(error || feedback) && (
              <motion.p
                key={error ?? feedback ?? 'feedback'}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
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
        </form>

        <div className="flex flex-col justify-between gap-6 rounded-3xl border border-slate-200 bg-slate-50/60 p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resumo</p>
            <h3 className="text-lg font-semibold text-slate-900">Saldo total</h3>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {totalBalance.toFixed(2)} EUR
            </p>
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
              {accounts.length === 0
                ? 'Nenhuma conta registada'
                : accounts.length === 1
                    ? '1 conta sincronizada'
                    : `${accounts.length} contas sincronizadas`}
            </p>
            {pendingValidation > 0 && (
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-amber-600">
                {pendingValidation === 1
                  ? '1 conta aguarda validação manual'
                  : `${pendingValidation} contas aguardam validação manual`}
              </p>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Organize as suas contas para facilitar a classificação de despesas e transferências.
          </p>
        </div>
      </motion.div>

      <motion.div layout className="space-y-4">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lista de contas</p>
            <h2 className="text-lg font-semibold text-slate-900">Gerir contas existentes</h2>
          </div>
        </header>
        <motion.ul layout className="grid gap-3 md:grid-cols-2">
          {accounts.map((account) => {
            const Icon = typeIcons[account.type];
            return (
              <motion.li
              key={account.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900/10 text-slate-700">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-slate-900">{account.name}</p>
                    <p className="text-xs uppercase tracking-wide text-slate-400">{typeLabels[account.type]}</p>
                    {account.validationStatus === 'validacao-manual' && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                        Validar conta
                      </span>
                    )}
                  </div>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {account.currency}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                <span className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1 font-semibold text-slate-700">
                  {account.balance.toFixed(2)} {account.currency}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleEdit(account)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  <Save className="h-4 w-4" /> Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(account.id)}
                  disabled={deletingId === account.id}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 shadow-sm transition hover:border-rose-400 hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Banknote className="h-4 w-4" />
                  {deletingId === account.id ? 'A remover…' : 'Remover'}
                </button>
              </div>
              </motion.li>
            );
          })}
          {accounts.length === 0 && (
            <li className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
              Ainda não existem contas. Adicione uma conta para começar.
            </li>
          )}
        </motion.ul>
      </motion.div>
    </motion.section>
  );
}
