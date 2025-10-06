import type { DocumentMetadata } from '../data/models';
import {
  extractPdfMetadataWithOpenAI,
  type ExtractPdfWithOpenAIOptions,
  type OpenAIDocumentExtraction,
  type OpenAIConnectionConfig
} from './openai';

export interface PdfExtractionRequest {
  file: File;
  accountContext?: string;
  openAI?: Partial<OpenAIConnectionConfig> & { apiKey?: string };
}

export interface PdfExtractionResult extends Partial<DocumentMetadata> {
  rawResponse?: unknown;
}

export function isPdfFile(file: File): boolean {
  const typeIsPdf = file.type === 'application/pdf';
  const nameIsPdf = file.name.toLowerCase().endsWith('.pdf');
  return typeIsPdf || nameIsPdf;
}

function normalisePdfFile(file: File): File {
  const safeType = file.type === 'application/pdf' ? file.type : 'application/pdf';
  const hasLowercaseExtension = file.name.endsWith('.pdf');

  if (hasLowercaseExtension && file.type === safeType) {
    return file;
  }

  const lastDotIndex = file.name.lastIndexOf('.');
  const baseName = lastDotIndex > 0 ? file.name.slice(0, lastDotIndex) : file.name;
  const normalisedName = `${baseName || 'document'}.pdf`;

  try {
    return new File([file], normalisedName, { type: safeType, lastModified: file.lastModified });
  } catch (error) {
    console.warn('Não foi possível normalizar o ficheiro PDF. A enviar com o nome original.', error);
    return file;
  }
}

function hasValidOpenAIConfig(config?: PdfExtractionRequest['openAI']): config is OpenAIConnectionConfig {
  return Boolean(config && config.apiKey);
}

async function extractWithOpenAI(request: PdfExtractionRequest): Promise<PdfExtractionResult> {
  const { openAI, file, accountContext } = request;
  if (!hasValidOpenAIConfig(openAI)) {
    throw new Error('Configuração OpenAI inválida.');
  }

  const pdfFile = normalisePdfFile(file);
  const options: ExtractPdfWithOpenAIOptions = {
    file: pdfFile,
    accountContext,
    config: {
      apiKey: openAI.apiKey,
      baseUrl: openAI.baseUrl,
      model: openAI.model
    }
  };

  const extraction: OpenAIDocumentExtraction = await extractPdfMetadataWithOpenAI(options);
  return {
    sourceType: extraction.sourceType ?? 'fatura',
    amount: extraction.amount,
    currency: extraction.currency,
    dueDate: extraction.dueDate,
    accountHint: extraction.accountHint,
    notes: extraction.notes,
    rawResponse: extraction.rawResponse
  } satisfies PdfExtractionResult;
}

export async function extractPdfMetadata(request: PdfExtractionRequest): Promise<PdfExtractionResult> {
  if (!hasValidOpenAIConfig(request.openAI)) {
    throw new Error('É necessário configurar a API da OpenAI para ler PDFs.');
  }

  if (!isPdfFile(request.file)) {
    throw new Error('O ficheiro selecionado não parece ser um PDF válido.');
  }

  return await extractWithOpenAI(request);
}
