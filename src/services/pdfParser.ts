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

async function extractWithMockFallback(): Promise<PdfExtractionResult> {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return {
    sourceType: 'fatura',
    amount: 42,
    currency: 'EUR',
    dueDate: new Date().toISOString(),
    notes: 'Extração simulada (mock)'
  } satisfies PdfExtractionResult;
}

export async function extractPdfMetadata(request: PdfExtractionRequest): Promise<PdfExtractionResult> {
  try {
    if (hasValidOpenAIConfig(request.openAI)) {
      return await extractWithOpenAI(request);
    }
    return await extractWithMockFallback();
  } catch (error) {
    console.error('Falha ao extrair dados com a OpenAI, a devolver mock.', error);
    return await extractWithMockFallback();
  }
}
