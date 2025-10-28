import { useRef, useState } from 'react';
import { Loader2, UploadCloud } from 'lucide-react';
import { useAppState } from '../../state/AppStateContext';
import { isPdfFile, extractPdfMetadata } from '../../services/pdfParser';
import { validateFirebaseConfig } from '../../services/firebase';
import { persistDocumentMetadata } from '../../services/documents';
import { processDocumentForDerivedEntities } from '../../services/documentAutomation';
import type { DocumentMetadata } from '../../data/models';

type UploadFeedbackType = 'success' | 'error' | 'info';

export interface DocumentUploadFeedback {
  type: UploadFeedbackType;
  message: string;
}

interface DocumentUploadButtonProps {
  onFeedback: (feedback: DocumentUploadFeedback) => void;
  className?: string;
}

export function DocumentUploadButton({ onFeedback, className }: DocumentUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const documents = useAppState((state) => state.documents);
  const accounts = useAppState((state) => state.accounts);
  const expenses = useAppState((state) => state.expenses);
  const suppliers = useAppState((state) => state.suppliers);
  const timelineEntries = useAppState((state) => state.timeline);
  const addAccount = useAppState((state) => state.addAccount);
  const addDocument = useAppState((state) => state.addDocument);
  const addExpense = useAppState((state) => state.addExpense);
  const addSupplier = useAppState((state) => state.addSupplier);
  const addTimelineEntry = useAppState((state) => state.addTimelineEntry);
  const settings = useAppState((state) => state.settings);

  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!isPdfFile(file)) {
      onFeedback({ type: 'error', message: 'Por favor escolha um ficheiro PDF.' });
      return;
    }

    if (!settings.openAIApiKey) {
      onFeedback({ type: 'error', message: 'Configure a chave da OpenAI nas definições antes de carregar PDFs.' });
      return;
    }

    if (!settings.firebaseConfig || !validateFirebaseConfig(settings.firebaseConfig)) {
      onFeedback({ type: 'error', message: 'Configure o Firebase nas definições antes de carregar PDFs.' });
      return;
    }

    setIsUploading(true);
    onFeedback({ type: 'info', message: 'A extrair informação via OpenAI…' });

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
        statementSettlements: isStatement ? extraction.statementSettlements ?? [] : existingDocument?.statementSettlements
      };

      await persistDocumentMetadata(metadata, settings.firebaseConfig);
      addDocument(metadata);

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

      onFeedback({ type: 'success', message: 'Documento processado com sucesso.' });
    } catch (error) {
      console.error('Falha ao processar documento.', error);
      onFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Não foi possível processar o documento. Tente novamente.'
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={handleSelectFile}
        className={
          className ??
          'inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-60'
        }
        disabled={isUploading}
      >
        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
        {isUploading ? 'A carregar…' : 'Upload de Documento'}
      </button>
    </>
  );
}

