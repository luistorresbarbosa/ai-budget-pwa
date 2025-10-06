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

function hasValidOpenAIConfig(config?: PdfExtractionRequest['openAI']): config is OpenAIConnectionConfig {
  return Boolean(config && config.apiKey);
}

async function extractWithOpenAI(request: PdfExtractionRequest): Promise<PdfExtractionResult> {
  const { openAI, file, accountContext } = request;
  if (!hasValidOpenAIConfig(openAI)) {
    throw new Error('Configuração OpenAI inválida.');
  }

  const options: ExtractPdfWithOpenAIOptions = {
    file,
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

  return await extractWithOpenAI(request);
}
