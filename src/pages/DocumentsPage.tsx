import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  CalendarDays,
  Clock,
  Euro,
  FileText,
  Landmark,
  Loader2,
  Pencil,
  Save,
  Tag,
  Trash2,
  UploadCloud,
  XCircle
} from 'lucide-react';
import { useAppState } from '../state/AppStateContext';
import type { DocumentMetadata } from '../data/models';
import { extractPdfMetadata, isPdfFile } from '../services/pdfParser';
import { persistDocumentMetadata, removeDocumentMetadata } from '../services/documents';
import { validateFirebaseConfig } from '../services/firebase';
import { processDocumentForDerivedEntities } from '../services/documentAutomation';
import { findAccountByHint } from '../services/expenseDerivation';

interface UploadFeedback {
  type: 'success' | 'error' | 'info';
  message: string;
}

const feedbackStyles: Record<UploadFeedback['type'], string> = {
  success: 'rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-sm',
  error: 'rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm',
  info: 'rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 shadow-sm'
};

interface DocumentFormState {
  sourceType: DocumentMetadata['sourceType'];
  amount: string;
  currency: string;
  dueDate: string;
  accountHint: string;
  companyName: string;
  expenseType: string;
  notes: string;
  supplierId: string;
  supplierTaxId: string;
  statementAccountIban: string;
}

function DocumentsPage() {
    const PAGE_SIZE_OPTIONS = [5, 10, 20] as const;

  const documents = useAppState((state) => state.documents);
  const expenses = useAppState((state) => state.expenses);
  const timelineEntries = useAppState((state) => state.timeline);
  const accounts = useAppState((state) => state.accounts);
  const suppliers = useAppState((state) => state.suppliers);
  const addAccount = useAppState((state) => state.addAccount);
  const addDocument = useAppState((state) => state.addDocument);
  const addExpense = useAppState((state) => state.addExpense);
  const addSupplier = useAppState((state) => state.addSupplier);
  const removeDocument = useAppState((state) => state.removeDocument);
  const addTimelineEntry = useAppState((state) => state.addTimelineEntry);
  const settings = useAppState((state) => state.settings);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<UploadFeedback | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(PAGE_SIZE_OPTIONS[0]);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [documentForm, setDocumentForm] = useState<DocumentFormState | null>(null);
  const [documentFeedback, setDocumentFeedback] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [isSavingDocument, setIsSavingDocument] = useState(false);

  const sortedDocuments = useMemo(() => {
    return [...documents].sort((a, b) => {
      const aDate = new Date(a.uploadDate).getTime() || 0;
      const bDate = new Date(b.uploadDate).getTime() || 0;
      return bDate - aDate;
    });
  }, [documents]);

  useEffect(() => {
    setPage((current) => {
      const maxPage = Math.max(1, Math.ceil(sortedDocuments.length / pageSize));
      return Math.min(current, maxPage);
    });
  }, [pageSize, sortedDocuments.length]);

  const totalPages = Math.max(1, Math.ceil(sortedDocuments.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedDocuments = sortedDocuments.slice(
    (currentPage - 1) * pageSize,
    (currentPage - 1) * pageSize + pageSize
  );

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isPdfFile(file)) {
      setFeedback({ type: 'error', message: 'Por favor escolha um ficheiro PDF.' });
      event.target.value = '';
      return;
    }

    if (!settings.openAIApiKey) {
      setFeedback({
        type: 'error',
        message: 'Configure a chave da OpenAI nas definições antes de carregar PDFs.'
      });
      event.target.value = '';
      return;
    }

    if (!settings.firebaseConfig || !validateFirebaseConfig(settings.firebaseConfig)) {
      setFeedback({
        type: 'error',
        message: 'Configure o Firebase nas definições antes de carregar PDFs.'
      });
      event.target.value = '';
      return;
    }

    setIsUploading(true);
    setFeedback({
      type: 'info',
      message: 'A extrair informação via OpenAI…'
    });

    try {
      const normalizedName = file.name.toLocaleLowerCase();
      const existingDocument = documents.find(
        (document) => document.originalName.toLocaleLowerCase() === normalizedName
      );
      const nowIsoString = new Date().toISOString();
      const extraction = await extractPdfMetadata({
        file,
        openAI: settings.openAIApiKey
          ? {
              apiKey: settings.openAIApiKey,
              baseUrl: settings.openAIBaseUrl,
              model: settings.openAIModel
            }
          : undefined
      });
      const isStatement = extraction.sourceType === 'extracto';
      const amount = typeof extraction.amount === 'number' && !isStatement ? extraction.amount : undefined;
      const dueDate = typeof extraction.dueDate === 'string' && !isStatement ? extraction.dueDate : undefined;
      const accountHint = typeof extraction.accountHint === 'string' ? extraction.accountHint : undefined;
      const companyName =
        typeof extraction.companyName === 'string' && extraction.companyName.trim().length > 0
          ? extraction.companyName
          : existingDocument?.companyName;
      const expenseType =
        typeof extraction.expenseType === 'string' && extraction.expenseType.trim().length > 0
          ? extraction.expenseType
          : existingDocument?.expenseType;
      const notes = typeof extraction.notes === 'string' ? extraction.notes : undefined;

      const metadata: DocumentMetadata = {
        id: existingDocument?.id ?? crypto.randomUUID(),
        originalName: file.name,
        uploadDate: nowIsoString,
        sourceType: extraction.sourceType ?? 'fatura',
        amount,
        currency: extraction.currency ?? existingDocument?.currency,
        dueDate,
        accountHint,
        companyName,
        expenseType,
        notes,
        extractedAt: new Date().toISOString(),
        recurringExpenses: isStatement ? extraction.recurringExpenses ?? [] : existingDocument?.recurringExpenses,
        supplierId: existingDocument?.supplierId,
        supplierTaxId:
          typeof extraction.supplierTaxId === 'string' && extraction.supplierTaxId.trim().length > 0
            ? extraction.supplierTaxId
            : existingDocument?.supplierTaxId,
        statementAccountIban: isStatement
          ? extraction.statementAccountIban ?? existingDocument?.statementAccountIban
          : existingDocument?.statementAccountIban,
        statementSettlements: isStatement
          ? extraction.statementSettlements ?? []
          : existingDocument?.statementSettlements
      };

      await persistDocumentMetadata(metadata, settings.firebaseConfig);
      addDocument(metadata);
      setPage(1);

      await processDocumentForDerivedEntities(
        {
          document: metadata,
          accounts,
          expenses,
          suppliers,
          timelineEntries,
          firebaseConfig: settings.firebaseConfig
        },
        {
          onAccountUpsert: addAccount,
          onExpenseUpsert: addExpense,
          onSupplierUpsert: addSupplier,
          onTimelineUpsert: addTimelineEntry
        }
      );
      setFeedback({
        type: 'success',
        message: existingDocument
          ? 'Documento atualizado e guardado no Firebase.'
          : 'Documento processado e guardado no Firebase.'
      });
    } catch (error) {
      console.error(error);
      setFeedback({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Não foi possível extrair dados do PDF. Tente novamente.'
      });
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  }

  async function handleDelete(documentId: string) {
    if (!settings.firebaseConfig || !validateFirebaseConfig(settings.firebaseConfig)) {
      setFeedback({
        type: 'error',
        message: 'Configure o Firebase nas definições antes de remover documentos.'
      });
      return;
    }

    setDeletingId(documentId);
    try {
      await removeDocumentMetadata(documentId, settings.firebaseConfig);
      removeDocument(documentId);
      setFeedback({ type: 'success', message: 'Documento removido.' });
    } catch (error) {
      console.error(error);
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Não foi possível remover o documento.'
      });
    } finally {
      setDeletingId(null);
    }
  }

  function startEditingDocument(doc: DocumentMetadata) {
    setEditingDocumentId(doc.id);
    setDocumentForm({
      sourceType: doc.sourceType,
      amount: typeof doc.amount === 'number' ? doc.amount.toString() : '',
      currency: doc.currency ?? '',
      dueDate: doc.dueDate ? doc.dueDate.substring(0, 10) : '',
      accountHint: doc.accountHint ?? '',
      companyName: doc.companyName ?? '',
      expenseType: doc.expenseType ?? '',
      notes: doc.notes ?? '',
      supplierId: doc.supplierId ?? '',
      supplierTaxId: doc.supplierTaxId ?? '',
      statementAccountIban: doc.statementAccountIban ?? ''
    });
    setDocumentFeedback(null);
    setDocumentError(null);
  }

  function cancelEditingDocument() {
    setEditingDocumentId(null);
    setDocumentForm(null);
    setDocumentFeedback(null);
    setDocumentError(null);
  }

  function updateDocumentForm<K extends keyof DocumentFormState>(key: K, value: DocumentFormState[K]) {
    setDocumentForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSaveDocument() {
    if (!editingDocumentId || !documentForm) {
      return;
    }

    const config = settings.firebaseConfig;
    if (!config || !validateFirebaseConfig(config)) {
      setDocumentError('Configure o Firebase nas definições antes de editar documentos.');
      return;
    }

    const existing = documents.find((item) => item.id === editingDocumentId);
    if (!existing) {
      setDocumentError('Documento não encontrado.');
      return;
    }

    const trimmedAmount = documentForm.amount.trim();
    const parsedAmount = trimmedAmount
      ? Number.parseFloat(trimmedAmount.replace(',', '.'))
      : undefined;
    if (trimmedAmount && !Number.isFinite(parsedAmount)) {
      setDocumentError('Valor inválido.');
      return;
    }

    const trimmedCurrency = documentForm.currency.trim().toUpperCase();
    if (trimmedCurrency && trimmedCurrency.length !== 3) {
      setDocumentError('A moeda deve ter 3 letras.');
      return;
    }

    const dueDateIso = documentForm.dueDate ? new Date(documentForm.dueDate).toISOString() : undefined;

    const updated: DocumentMetadata = {
      ...existing,
      sourceType: documentForm.sourceType,
      amount: parsedAmount,
      currency: trimmedCurrency || undefined,
      dueDate: dueDateIso,
      accountHint: documentForm.accountHint.trim() || undefined,
      companyName: documentForm.companyName.trim() || undefined,
      expenseType: documentForm.expenseType.trim() || undefined,
      notes: documentForm.notes.trim() || undefined,
      supplierId: documentForm.supplierId || undefined,
      supplierTaxId: documentForm.supplierTaxId.trim() || undefined,
      statementAccountIban: documentForm.statementAccountIban.trim() || undefined
    };

    setIsSavingDocument(true);
    try {
      await persistDocumentMetadata(updated, config);
      addDocument(updated);
      setDocumentFeedback('Documento atualizado com sucesso.');
      setDocumentError(null);
    } catch (editError) {
      console.error('Não foi possível atualizar o documento.', editError);
      setDocumentError(
        editError instanceof Error
          ? editError.message
          : 'Não foi possível atualizar o documento. Tente novamente.'
      );
    } finally {
      setIsSavingDocument(false);
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-8"
    >
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Documentos</h1>
        <p className="max-w-2xl text-sm text-slate-500 sm:text-base">
          Carregue faturas, recibos ou extractos e consulte o histórico completo com todos os detalhes extraídos.
        </p>
      </header>

      <label className="group relative block cursor-pointer overflow-hidden rounded-3xl border border-dashed border-slate-300 bg-white p-6 shadow-sm transition hover:border-slate-400">
        <input className="sr-only" type="file" accept="application/pdf" onChange={handleUpload} disabled={isUploading} />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white transition-transform duration-300 group-hover:scale-110">
            {isUploading ? <Loader2 className="h-8 w-8 animate-spin" /> : <UploadCloud className="h-8 w-8" />}
          </span>
          <div className="space-y-1">
            <strong className="block text-lg font-semibold text-slate-900">
              {isUploading ? 'A processar…' : 'Carregar PDF'}
            </strong>
            <p className="text-sm text-slate-500">
              Os ficheiros são processados localmente antes de enviar para a API.
            </p>
          </div>
        </div>
      </label>

      <AnimatePresence>
        {feedback && (
          <motion.p
            key={feedback.message}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className={feedbackStyles[feedback.type]}
          >
            {feedback.message}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white/70 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Histórico de documentos</h2>
            <p className="text-xs text-slate-500">
              Página {currentPage} de {totalPages} · {sortedDocuments.length} registo
              {sortedDocuments.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
              Por página
              <select
                className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 shadow-sm focus:border-slate-300 focus:outline-none"
                value={pageSize}
                onChange={(event) => {
                  const value = Number.parseInt(event.target.value, 10) as (typeof PAGE_SIZE_OPTIONS)[number];
                  setPageSize(value);
                  setPage(1);
                }}
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage === 1 || sortedDocuments.length === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:opacity-60"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={currentPage === totalPages || sortedDocuments.length === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:opacity-60"
              >
                Seguinte
              </button>
            </div>
          </div>
        </div>
        <div className="grid gap-3">
          {paginatedDocuments.map((doc) => {
            const accountHint = doc.sourceType === 'extracto'
              ? doc.statementAccountIban ?? doc.accountHint
              : doc.accountHint;
            const matchedAccount = findAccountByHint(accountHint, accounts);
            const supplier = doc.supplierId
              ? suppliers.find((item) => item.id === doc.supplierId)
              : undefined;
            const supplierLabel = supplier?.name ?? doc.companyName;
            const shouldShowAmount = doc.sourceType !== 'extracto' && typeof doc.amount === 'number';
            return (
              <motion.article
                key={doc.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                        <FileText className="h-4 w-4 text-slate-400" />
                        {doc.originalName}
                      </p>
                      <small className="text-xs uppercase tracking-wide text-slate-400">
                        {new Date(doc.uploadDate).toLocaleString('pt-PT')} · {doc.sourceType}
                      </small>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEditingDocument(doc)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                      >
                        <Pencil className="h-4 w-4" />
                        {editingDocumentId === doc.id ? 'A editar' : 'Editar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id)}
                        disabled={deletingId === doc.id}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                        {deletingId === doc.id ? 'A remover…' : 'Remover'}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    {supplierLabel && (
                      <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                        <Building2 className="h-4 w-4 text-slate-400" />
                        {supplierLabel}
                      </span>
                    )}
                    {doc.expenseType && (
                      <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                        <Tag className="h-4 w-4 text-slate-400" />
                        {doc.expenseType}
                      </span>
                    )}
                    {accountHint && (
                      <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                        <Landmark className="h-4 w-4 text-slate-400" />
                        {matchedAccount ? matchedAccount.name : accountHint}
                      </span>
                    )}
                    {shouldShowAmount && (
                      <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                        <Euro className="h-4 w-4 text-slate-400" />
                        {doc.amount!.toFixed(2)} {doc.currency}
                      </span>
                    )}
                    {doc.dueDate && (
                      <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                        <CalendarDays className="h-4 w-4 text-slate-400" />
                        Vencimento: {new Date(doc.dueDate).toLocaleDateString('pt-PT')}
                      </span>
                    )}
                    {doc.extractedAt && (
                      <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                        <Clock className="h-4 w-4 text-slate-400" />
                        Extraído: {new Date(doc.extractedAt).toLocaleString('pt-PT')}
                      </span>
                    )}
                  </div>
                  {doc.notes && <p className="text-sm text-slate-600">{doc.notes}</p>}
                  {editingDocumentId === doc.id && documentForm && (
                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="block space-y-1 text-xs font-medium text-slate-500">
                          <span className="uppercase tracking-wide text-slate-400">Tipo</span>
                          <select
                            value={documentForm.sourceType}
                            onChange={(event) =>
                              updateDocumentForm('sourceType', event.target.value as DocumentMetadata['sourceType'])
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
                          >
                            <option value="fatura">Fatura</option>
                            <option value="recibo">Recibo</option>
                            <option value="extracto">Extracto</option>
                          </select>
                        </label>
                        <label className="block space-y-1 text-xs font-medium text-slate-500">
                          <span className="uppercase tracking-wide text-slate-400">Valor</span>
                          <input
                            type="number"
                            step="0.01"
                            value={documentForm.amount}
                            onChange={(event) => updateDocumentForm('amount', event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-slate-900/10"
                          />
                        </label>
                        <label className="block space-y-1 text-xs font-medium text-slate-500">
                          <span className="uppercase tracking-wide text-slate-400">Moeda</span>
                          <input
                            type="text"
                            maxLength={3}
                            value={documentForm.currency}
                            onChange={(event) => updateDocumentForm('currency', event.target.value.toUpperCase())}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm uppercase text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-slate-900/10"
                          />
                        </label>
                        <label className="block space-y-1 text-xs font-medium text-slate-500">
                          <span className="uppercase tracking-wide text-slate-400">Vencimento</span>
                          <input
                            type="date"
                            value={documentForm.dueDate}
                            onChange={(event) => updateDocumentForm('dueDate', event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
                          />
                        </label>
                        <label className="block space-y-1 text-xs font-medium text-slate-500 md:col-span-2">
                          <span className="uppercase tracking-wide text-slate-400">Empresa</span>
                          <input
                            type="text"
                            value={documentForm.companyName}
                            onChange={(event) => updateDocumentForm('companyName', event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-slate-900/10"
                          />
                        </label>
                        <label className="block space-y-1 text-xs font-medium text-slate-500">
                          <span className="uppercase tracking-wide text-slate-400">Conta / IBAN</span>
                          <input
                            type="text"
                            value={documentForm.statementAccountIban}
                            onChange={(event) => updateDocumentForm('statementAccountIban', event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-slate-900/10"
                          />
                        </label>
                        <label className="block space-y-1 text-xs font-medium text-slate-500">
                          <span className="uppercase tracking-wide text-slate-400">Sugestão de conta</span>
                          <input
                            type="text"
                            value={documentForm.accountHint}
                            onChange={(event) => updateDocumentForm('accountHint', event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-slate-900/10"
                          />
                        </label>
                        <label className="block space-y-1 text-xs font-medium text-slate-500">
                          <span className="uppercase tracking-wide text-slate-400">Tipo de despesa</span>
                          <input
                            type="text"
                            value={documentForm.expenseType}
                            onChange={(event) => updateDocumentForm('expenseType', event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-slate-900/10"
                          />
                        </label>
                        <label className="block space-y-1 text-xs font-medium text-slate-500">
                          <span className="uppercase tracking-wide text-slate-400">Fornecedor</span>
                          <select
                            value={documentForm.supplierId}
                            onChange={(event) => updateDocumentForm('supplierId', event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10"
                          >
                            <option value="">Sem fornecedor</option>
                            {suppliers.map((supplier) => (
                              <option key={supplier.id} value={supplier.id}>
                                {supplier.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block space-y-1 text-xs font-medium text-slate-500">
                          <span className="uppercase tracking-wide text-slate-400">NIF fornecedor</span>
                          <input
                            type="text"
                            value={documentForm.supplierTaxId}
                            onChange={(event) => updateDocumentForm('supplierTaxId', event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-slate-900/10"
                          />
                        </label>
                        <label className="md:col-span-2 block space-y-1 text-xs font-medium text-slate-500">
                          <span className="uppercase tracking-wide text-slate-400">Notas</span>
                          <textarea
                            value={documentForm.notes}
                            onChange={(event) => updateDocumentForm('notes', event.target.value)}
                            rows={3}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-slate-900/10"
                          />
                        </label>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSaveDocument}
                          disabled={isSavingDocument}
                          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-60"
                        >
                          <Save className="h-4 w-4" />
                          {isSavingDocument ? 'A guardar…' : 'Guardar'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditingDocument}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                        >
                          <XCircle className="h-4 w-4" />
                          Cancelar
                        </button>
                      </div>
                      {(documentError || documentFeedback) && (
                        <p
                          className={`rounded-xl border px-3 py-2 text-xs ${
                            documentError
                              ? 'border-rose-200 bg-rose-50 text-rose-700'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {documentError ?? documentFeedback}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </motion.article>
            );
          })}
          {sortedDocuments.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-500">
              Ainda não carregou documentos.
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}

export default DocumentsPage;
