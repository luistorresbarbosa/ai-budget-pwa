import type { DocumentMetadata } from '../data/models';

export interface PdfExtractionRequest {
  file: File;
  accountContext?: string;
}

export interface PdfExtractionResult extends Partial<DocumentMetadata> {
  rawResponse?: unknown;
}

export async function extractPdfMetadata(_request: PdfExtractionRequest): Promise<PdfExtractionResult> {
  // TODO: Integrar com a API da OpenAI quando a chave estiver configurada.
  // Por enquanto devolvemos um resultado mock para permitir testes da UI.
  await new Promise((resolve) => setTimeout(resolve, 600));
  return {
    sourceType: 'fatura',
    amount: 42,
    currency: 'EUR',
    dueDate: new Date().toISOString(),
    notes: 'Extração simulada (mock)'
  } satisfies PdfExtractionResult;
}
