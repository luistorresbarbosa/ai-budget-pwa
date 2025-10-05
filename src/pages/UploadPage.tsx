import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Euro, FileText, Loader2, UploadCloud } from 'lucide-react';
import { useAppState } from '../state/AppStateContext';
import type { DocumentMetadata } from '../data/models';
import { extractPdfMetadata } from '../services/pdfParser';

interface UploadFeedback {
  type: 'success' | 'error' | 'info';
  message: string;
}

const feedbackStyles: Record<UploadFeedback['type'], string> = {
  success: 'rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-sm',
  error: 'rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm',
  info: 'rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 shadow-sm'
};

function UploadPage() {
  const documents = useAppState((state) => state.documents);
  const addDocument = useAppState((state) => state.addDocument);
  const settings = useAppState((state) => state.settings);
  const [isUploading, setIsUploading] = useState(false);
  const [feedback, setFeedback] = useState<UploadFeedback | null>(null);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setFeedback({ type: 'error', message: 'Por favor escolha um ficheiro PDF.' });
      return;
    }

    setIsUploading(true);
    setFeedback({
      type: 'info',
      message: settings.openAIApiKey
        ? 'A extrair informação via OpenAI…'
        : 'A extrair informação em modo simulado (adicione a chave OpenAI nas definições para OCR real).'
    });

    try {
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
        id: crypto.randomUUID(),
        originalName: file.name,
        uploadDate: new Date().toISOString(),
        sourceType: extraction.sourceType ?? 'fatura',
        amount: extraction.amount,
        currency: extraction.currency,
        dueDate: extraction.dueDate,
        accountHint: extraction.accountHint,
        notes: extraction.notes,
        extractedAt: new Date().toISOString()
      };

      addDocument(metadata);
      setFeedback({ type: 'success', message: 'Documento processado e adicionado à lista.' });
    } catch (error) {
      console.error(error);
      setFeedback({
        type: 'error',
        message: 'Não foi possível extrair dados do PDF. Tente novamente.'
      });
    } finally {
      setIsUploading(false);
      event.target.value = '';
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
          {documents.map((doc) => (
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
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
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
                </div>
              </div>
              {doc.notes && <p className="mt-3 text-sm text-slate-600">{doc.notes}</p>}
            </motion.article>
          ))}
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
