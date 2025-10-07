import { FormEvent, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Building2,
  Link2,
  NotepadText,
  PlusCircle,
  Save,
  ShieldCheck,
  Trash2,
  XCircle
} from 'lucide-react';
import { useAppState } from '../state/AppStateContext';
import type { Supplier } from '../data/models';
import { validateFirebaseConfig } from '../services/firebase';
import { persistSupplier, removeSupplierById } from '../services/suppliers';

interface SupplierFormState {
  id?: string;
  name: string;
  taxId: string;
  aliases: string;
  notes: string;
}

const EMPTY_FORM: SupplierFormState = {
  name: '',
  taxId: '',
  aliases: '',
  notes: ''
};

function normaliseAlias(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function parseAliases(value: string, referenceName: string): string[] {
  const reference = normaliseAlias(referenceName);
  const segments = value
    .split(/\r?\n|,/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const unique = new Map<string, string>();
  for (const segment of segments) {
    const normalised = normaliseAlias(segment);
    if (!normalised || normalised === reference) {
      continue;
    }
    if (!unique.has(normalised)) {
      unique.set(normalised, segment);
    }
  }
  return Array.from(unique.values());
}

export default function SuppliersPage() {
  const suppliers = useAppState((state) => state.suppliers);
  const addSupplier = useAppState((state) => state.addSupplier);
  const removeSupplier = useAppState((state) => state.removeSupplier);
  const settings = useAppState((state) => state.settings);
  const [formState, setFormState] = useState<SupplierFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const orderedSuppliers = useMemo(() => {
    return suppliers.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [suppliers]);

  const handleEdit = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setFormState({
      id: supplier.id,
      name: supplier.name,
      taxId: supplier.metadata?.taxId ?? '',
      aliases: supplier.metadata?.aliases?.join('\n') ?? '',
      notes: supplier.metadata?.notes ?? ''
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
      setError('Configure o Firebase nas definições antes de gerir fornecedores.');
      return;
    }

    const trimmedName = formState.name.trim();
    if (!trimmedName) {
      setError('Indique um nome para o fornecedor.');
      return;
    }

    const trimmedTaxId = formState.taxId.trim();
    const trimmedNotes = formState.notes.trim();
    const aliasList = parseAliases(formState.aliases, trimmedName);

    const previousSupplier = editingId ? suppliers.find((item) => item.id === editingId) : undefined;

    const metadata: Supplier['metadata'] | undefined = (() => {
      const base: Supplier['metadata'] = {
        ...previousSupplier?.metadata,
        taxId: trimmedTaxId || previousSupplier?.metadata?.taxId,
        notes: trimmedNotes || previousSupplier?.metadata?.notes,
        aliases: aliasList.length > 0 ? aliasList : previousSupplier?.metadata?.aliases,
        accountHints: previousSupplier?.metadata?.accountHints
      };

      if (!base.taxId) {
        delete base.taxId;
      }
      if (!base.notes) {
        delete base.notes;
      }
      if (!base.aliases || base.aliases.length === 0) {
        delete base.aliases;
      }
      if (!base.accountHints || base.accountHints.length === 0) {
        delete base.accountHints;
      }

      return Object.keys(base).length > 0 ? base : undefined;
    })();

    const supplier: Supplier = {
      id: editingId ?? `sup-${crypto.randomUUID()}`,
      name: trimmedName,
      metadata
    };

    setIsSaving(true);
    try {
      await persistSupplier(supplier, config);
      addSupplier(supplier);
      setFeedback(editingId ? 'Fornecedor atualizado com sucesso.' : 'Fornecedor criado com sucesso.');
      resetForm();
    } catch (submitError) {
      console.error('Não foi possível guardar o fornecedor.', submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Não foi possível guardar o fornecedor. Tente novamente.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (supplierId: string) => {
    const config = settings.firebaseConfig;
    if (!config || !validateFirebaseConfig(config)) {
      setError('Configure o Firebase nas definições antes de gerir fornecedores.');
      return;
    }

    setFeedback(null);
    setError(null);
    setDeletingId(supplierId);

    try {
      await removeSupplierById(supplierId, config);
      removeSupplier(supplierId);
      if (editingId === supplierId) {
        resetForm();
      }
      setFeedback('Fornecedor removido.');
    } catch (deleteError) {
      console.error('Não foi possível remover o fornecedor.', deleteError);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Não foi possível remover o fornecedor. Tente novamente.'
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
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Fornecedores</h1>
        <p className="max-w-2xl text-sm text-slate-500 sm:text-base">
          Centralize os fornecedores para facilitar o reconhecimento automático das despesas e extratos.
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
                {editingId ? 'Editar fornecedor' : 'Novo fornecedor'}
              </p>
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId ? 'Atualize os detalhes' : 'Adicionar novo fornecedor'}
              </h2>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] uppercase tracking-wide text-slate-400">
              {editingId ? 'Em edição' : 'Catálogo'}
            </span>
          </div>

          <label className="block space-y-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-wide text-slate-400">Nome do fornecedor</span>
            <input
              value={formState.name}
              onChange={(event) => setFormState((state) => ({ ...state, name: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
              placeholder="Santander, EDP, Vodafone…"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-2 text-sm text-slate-600">
              <span className="text-xs uppercase tracking-wide text-slate-400">Número fiscal (opcional)</span>
              <input
                value={formState.taxId}
                onChange={(event) => setFormState((state) => ({ ...state, taxId: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
                placeholder="NIF / VAT"
              />
            </label>
            <label className="block space-y-2 text-sm text-slate-600">
              <span className="text-xs uppercase tracking-wide text-slate-400">Notas internas</span>
              <input
                value={formState.notes}
                onChange={(event) => setFormState((state) => ({ ...state, notes: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
                placeholder="Ex.: Contacto comercial"
              />
            </label>
          </div>

          <label className="block space-y-2 text-sm text-slate-600">
            <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
              <Link2 className="h-3.5 w-3.5" /> Alias conhecidos (um por linha)
            </span>
            <textarea
              rows={3}
              value={formState.aliases}
              onChange={(event) => setFormState((state) => ({ ...state, aliases: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-slate-900/10"
              placeholder={"Crédito Habitação\nSeguro Vida"}
            />
            <p className="text-[11px] text-slate-400">
              Utilize alias para agrupar descrições de faturas ou movimentos ao fornecedor correto.
            </p>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {editingId ? <Save className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
              {editingId ? 'Guardar alterações' : 'Adicionar fornecedor'}
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
            <h3 className="text-lg font-semibold text-slate-900">Catálogo ativo</h3>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{suppliers.length}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
              {suppliers.length === 1 ? 'Fornecedor registado' : 'Fornecedores registados'}
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Mantenha alias actualizados para que os extractos reconheçam o fornecedor correcto automaticamente.
          </p>
        </div>
      </motion.div>

      <motion.div layout className="space-y-4">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lista de fornecedores</p>
            <h2 className="text-lg font-semibold text-slate-900">Gerir fornecedores existentes</h2>
          </div>
        </header>
        <motion.ul layout className="grid gap-3 md:grid-cols-2">
          {orderedSuppliers.map((supplier) => (
            <motion.li
              key={supplier.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900/10 text-slate-700">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-slate-900">{supplier.name}</p>
                    {supplier.metadata?.taxId && (
                      <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                        <ShieldCheck className="h-3.5 w-3.5" /> {supplier.metadata.taxId}
                      </p>
                    )}
                  </div>
                </div>
                {supplier.metadata?.aliases && supplier.metadata.aliases.length > 0 && (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {supplier.metadata.aliases.length}{' '}
                    {supplier.metadata.aliases.length === 1 ? 'alias' : 'alias'}
                  </span>
                )}
              </div>
              {supplier.metadata?.aliases && supplier.metadata.aliases.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                  <p className="font-semibold uppercase tracking-wide text-slate-400">Alias</p>
                  <ul className="mt-1 space-y-1">
                    {supplier.metadata.aliases.map((alias) => (
                      <li key={alias} className="flex items-center gap-2">
                        <Link2 className="h-3 w-3 text-slate-400" />
                        <span>{alias}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {supplier.metadata?.accountHints && supplier.metadata.accountHints.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500">
                  <p className="flex items-center gap-2 font-semibold uppercase tracking-wide text-slate-400">
                    <NotepadText className="h-3 w-3" /> Referências de conta
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {supplier.metadata.accountHints.map((hint) => (
                      <span key={hint} className="rounded-full border border-slate-200 px-3 py-1">
                        {hint}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleEdit(supplier)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  <Save className="h-4 w-4" /> Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(supplier.id)}
                  disabled={deletingId === supplier.id}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 shadow-sm transition hover:border-rose-400 hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  {deletingId === supplier.id ? 'A remover…' : 'Remover'}
                </button>
              </div>
            </motion.li>
          ))}
          {orderedSuppliers.length === 0 && (
            <li className="rounded-3xl border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-slate-500">
              Ainda não existem fornecedores. Adicione o primeiro para começar a mapear faturas.
            </li>
          )}
        </motion.ul>
      </motion.div>
    </motion.section>
  );
}
