import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, CalendarDays, Euro, FileText, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { useAppState } from '../state/AppStateContext';
import type { Account, DocumentMetadata, Expense, TimelineEntry } from '../data/models';
import { extractPdfMetadata, isPdfFile } from '../services/pdfParser';
import { persistDocumentMetadata, removeDocumentMetadata } from '../services/documents';
import { validateFirebaseConfig } from '../services/firebase';
import { persistExpense } from '../services/expenses';
import { persistTimelineEntry } from '../services/timeline';

interface UploadFeedback {
  type: 'success' | 'error' | 'info';
  message: string;
}

const feedbackStyles: Record<UploadFeedback['type'], string> = {
  success: 'rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-sm',
  error: 'rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm',
  info: 'rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 shadow-sm'
};

const ACCOUNT_IDENTIFIER_KEYS = ['iban', 'ibanNumber', 'accountNumber', 'number', 'identifier'] as const;

function normaliseIdentifier(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

function extractAccountCandidates(account: Account): string[] {
  const candidateValues = new Set<string>();
  candidateValues.add(account.id);
  candidateValues.add(account.name);

  const accountRecord = account as Account & Record<string, unknown>;
  for (const key of ACCOUNT_IDENTIFIER_KEYS) {
    const value = accountRecord[key];
    if (typeof value === 'string') {
      candidateValues.add(value);
    }
  }

  const metadata = accountRecord['metadata'];
  if (metadata && typeof metadata === 'object') {
    for (const key of ACCOUNT_IDENTIFIER_KEYS) {
      const value = (metadata as Record<string, unknown>)[key];
      if (typeof value === 'string') {
        candidateValues.add(value);
      }
    }
  }

  return Array.from(candidateValues).filter((candidate) => candidate.trim().length > 0);
}

function resolveAccountId(
  accountHint: string | undefined,
  accounts: Account[],
  existingAccountId?: string
): string | undefined {
  if (existingAccountId) {
    return existingAccountId;
  }
  if (accounts.length === 0) {
    return undefined;
  }
  if (!accountHint || accountHint.trim().length === 0) {
    return accounts.length === 1 ? accounts[0].id : undefined;
  }

  const normalisedHint = normaliseIdentifier(accountHint);
  if (!normalisedHint) {
    return accounts.length === 1 ? accounts[0].id : undefined;
  }

  for (const account of accounts) {
    const candidates = extractAccountCandidates(account)
      .map(normaliseIdentifier)
      .filter((candidate) => candidate.length > 0);

    const hasMatch = candidates.some((candidate) => {
      if (candidate === normalisedHint) {
        return true;
      }
      if (candidate.length < 4) {
        return false;
      }
      return candidate.includes(normalisedHint) || normalisedHint.includes(candidate);
    });

    if (hasMatch) {
      return account.id;
    }
  }

  return accounts.length === 1 ? accounts[0].id : undefined;
}

function findAccountByHint(accountHint: string | undefined, accounts: Account[]): Account | undefined {
  if (!accountHint || accountHint.trim().length === 0) {
    return undefined;
  }
  const normalisedHint = normaliseIdentifier(accountHint);
  if (!normalisedHint) {
    return undefined;
  }

  return accounts.find((account) => {
    const candidates = extractAccountCandidates(account)
      .map(normaliseIdentifier)
      .filter((candidate) => candidate.length > 0);

    return candidates.some((candidate) => {
      if (candidate === normalisedHint) {
        return true;
      }
      if (candidate.length < 4) {
        return false;
      }
      return candidate.includes(normalisedHint) || normalisedHint.includes(candidate);
    });
  });
}

function humaniseDocumentName(originalName: string): string {
  const withoutExtension = originalName.replace(/\.[^/.]+$/, '');
  const withSpaces = withoutExtension.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (withSpaces.length === 0) {
    return 'Documento';
  }
  return withSpaces
    .split(' ')
    .map((segment) => (segment.length > 0 ? segment[0].toUpperCase() + segment.slice(1) : segment))
    .join(' ');
}

function deriveExpenseFromDocument(
  metadata: DocumentMetadata,
  accounts: Account[],
  existingExpense?: Expense
): Expense | null {
  const resolvedAccountId = resolveAccountId(metadata.accountHint, accounts, existingExpense?.accountId);
  const resolvedAmount = metadata.amount ?? existingExpense?.amount;
  const resolvedDueDate = metadata.dueDate ?? existingExpense?.dueDate ?? metadata.uploadDate;

  if (!existingExpense && (resolvedAmount === undefined || !metadata.dueDate)) {
    return null;
  }
  if (!resolvedAccountId) {
    return existingExpense ?? null;
  }
  if (resolvedAmount === undefined) {
    return existingExpense ?? null;
  }

  const expense: Expense = {
    id: existingExpense?.id ?? `doc-exp-${metadata.id}`,
    documentId: metadata.id,
    accountId: resolvedAccountId,
    description: existingExpense?.description ?? humaniseDocumentName(metadata.originalName),
    category: existingExpense?.category ?? 'Outros',
    amount: resolvedAmount,
    currency: metadata.currency ?? existingExpense?.currency ?? 'EUR',
    dueDate: resolvedDueDate,
    recurrence: existingExpense?.recurrence,
    fixed: existingExpense?.fixed ?? true,
    status: existingExpense?.status ?? 'planeado'
  };

  return expense;
}

function deriveTimelineEntryFromExpense(
  expense: Expense,
  existingEntry?: TimelineEntry
): TimelineEntry | null {
  if (!expense.dueDate) {
    return existingEntry ?? null;
  }

  const entry: TimelineEntry = {
    id: existingEntry?.id ?? `doc-timeline-${expense.documentId ?? expense.id}`,
    date: expense.dueDate,
    type: 'despesa',
    description: existingEntry?.description ?? expense.description,
    amount: expense.amount,
    currency: expense.currency,
    linkedExpenseId: expense.id
  };

  return entry;
}

function UploadPage() {
  const documents = useAppState((state) => state.documents);
  const expenses = useAppState((state) => state.expenses);
  const timelineEntries = useAppState((state) => state.timeline);
  const accounts = useAppState((state) => state.accounts);
  const addDocument = useAppState((state) => state.addDocument);
  const addExpense = useAppState((state) => state.addExpense);
  const removeDocument = useAppState((state) => state.removeDocument);
  const addTimelineEntry = useAppState((state) => state.addTimelineEntry);
  const settings = useAppState((state) => state.settings);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<UploadFeedback | null>(null);

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
      const metadata: DocumentMetadata = {
        id: existingDocument?.id ?? crypto.randomUUID(),
        originalName: file.name,
        uploadDate: nowIsoString,
        sourceType: extraction.sourceType ?? 'fatura',
        amount: extraction.amount,
        currency: extraction.currency,
        dueDate: extraction.dueDate,
        accountHint: extraction.accountHint,
        notes: extraction.notes,
        extractedAt: new Date().toISOString()
      };

      await persistDocumentMetadata(metadata, settings.firebaseConfig);
      addDocument(metadata);

      const existingExpense = expenses.find((expense) => expense.documentId === metadata.id);
      const derivedExpense = deriveExpenseFromDocument(metadata, accounts, existingExpense);

      if (derivedExpense) {
        await persistExpense(derivedExpense, settings.firebaseConfig);
        addExpense(derivedExpense);

        const existingTimelineEntry = timelineEntries.find(
          (entry) => entry.linkedExpenseId === derivedExpense.id
        );
        const derivedTimelineEntry = deriveTimelineEntryFromExpense(
          derivedExpense,
          existingTimelineEntry
        );

        if (derivedTimelineEntry) {
          await persistTimelineEntry(derivedTimelineEntry, settings.firebaseConfig);
          addTimelineEntry(derivedTimelineEntry);
        }
      }
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

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-8"
    >
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Upload de PDFs</h1>
        <p className="max-w-2xl text-sm text-slate-500 sm:text-base">
          Envie faturas, recibos ou extractos para extrair automaticamente os dados relevantes.
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
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Histórico de documentos</h2>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 shadow-sm">
            {documents.length} registo{documents.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="grid gap-3">
          {documents.map((doc) => {
            const matchedAccount = findAccountByHint(doc.accountHint, accounts);
            return (
              <motion.article
                key={doc.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      <FileText className="h-4 w-4 text-slate-400" />
                      {doc.originalName}
                    </p>
                    <small className="text-xs uppercase tracking-wide text-slate-400">
                      {new Date(doc.uploadDate).toLocaleString('pt-PT')} · {doc.sourceType}
                    </small>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    {doc.accountHint && (
                      <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                        <Building2 className="h-4 w-4 text-slate-400" />
                        {matchedAccount ? matchedAccount.name : doc.accountHint}
                      </span>
                    )}
                    {doc.amount && (
                      <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                        <Euro className="h-4 w-4 text-slate-400" />
                        {doc.amount.toFixed(2)} {doc.currency}
                      </span>
                    )}
                    {doc.dueDate && (
                      <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                        <CalendarDays className="h-4 w-4 text-slate-400" />
                        Vencimento: {new Date(doc.dueDate).toLocaleDateString('pt-PT')}
                      </span>
                    )}
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
                {doc.notes && <p className="mt-3 text-sm text-slate-600">{doc.notes}</p>}
              </motion.article>
            );
          })}
          {documents.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-500">
              Ainda não carregou documentos.
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}

export default UploadPage;
