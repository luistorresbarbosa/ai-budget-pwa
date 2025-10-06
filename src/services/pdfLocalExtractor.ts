import type { PdfExtractionResult } from './pdfParser';

interface LocalExtractionOptions {
  accountContext?: string;
}

interface AmountMatch {
  value: number;
  currency?: string;
}

let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null;

async function loadPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = (async () => {
      const [pdfjs, worker] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url')
      ]);
      if ('GlobalWorkerOptions' in pdfjs) {
        pdfjs.GlobalWorkerOptions.workerSrc = (worker as { default: string }).default;
      }
      return pdfjs;
    })();
  }
  return pdfjsLibPromise;
}

const leadingAmountPattern = /(?:(?<currencySymbol>€)|\b(?<currencyCode>[A-Z]{3})\b)\s*(?<amount>\d{1,3}(?:[\.\s]\d{3})*(?:[,.]\d{2})?|\d+(?:[,.]\d{2})?)/g;
const trailingAmountPattern = /(?<amount>\d{1,3}(?:[\.\s]\d{3})*(?:[,.]\d{2})?|\d+(?:[,.]\d{2})?)\s*(?:(?<currencySymbol>€)|\b(?<currencyCode>[A-Z]{3})\b)/g;
const isoDatePattern = /\b(\d{4}-\d{2}-\d{2})\b/;
const europeanDatePattern = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/;
const ibanPattern = /\b([A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}(?:[A-Z0-9]{0,16}))\b/;

function normaliseAmount(value: string): number | undefined {
  const normalised = value.replace(/\s/g, '').replace(/\.(?=\d{3}(?:[.,]|$))/g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalised);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function findAmount(text: string): AmountMatch | undefined {
  let match: RegExpExecArray | null;
  let best: AmountMatch | undefined;
  for (const pattern of [leadingAmountPattern, trailingAmountPattern]) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text))) {
      const { amount, currencyCode, currencySymbol } = match.groups ?? {};
      if (!amount) continue;
      const value = normaliseAmount(amount);
      if (value === undefined) continue;
      const currency = currencyCode ?? (currencySymbol ? 'EUR' : undefined);
      if (!best || value > best.value) {
        best = { value, currency };
      }
    }
  }
  return best;
}

function toIsoDateFromEuropean(day: string, month: string, year: string): string | undefined {
  const numericDay = Number.parseInt(day, 10);
  const numericMonth = Number.parseInt(month, 10);
  const numericYear = Number.parseInt(year.length === 2 ? `20${year}` : year, 10);

  if (
    !Number.isFinite(numericDay) ||
    !Number.isFinite(numericMonth) ||
    !Number.isFinite(numericYear) ||
    numericDay < 1 ||
    numericDay > 31 ||
    numericMonth < 1 ||
    numericMonth > 12
  ) {
    return undefined;
  }

  const isoDate = new Date(Date.UTC(numericYear, numericMonth - 1, numericDay)).toISOString();
  return isoDate;
}

function findDueDate(text: string): string | undefined {
  const isoMatch = text.match(isoDatePattern);
  if (isoMatch) {
    return new Date(`${isoMatch[1]}T00:00:00Z`).toISOString();
  }

  const europeanMatch = text.match(europeanDatePattern);
  if (europeanMatch) {
    return toIsoDateFromEuropean(europeanMatch[1], europeanMatch[2], europeanMatch[3]);
  }

  return undefined;
}

function detectSourceType(text: string): PdfExtractionResult['sourceType'] {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('extracto') || lowerText.includes('extrato') || lowerText.includes('statement')) {
    return 'extracto';
  }
  if (lowerText.includes('recibo') || lowerText.includes('receipt')) {
    return 'recibo';
  }
  return 'fatura';
}

function findAccountHint(text: string, accountContext?: string): string | undefined {
  const ibanMatch = text.match(ibanPattern);
  if (ibanMatch) {
    return ibanMatch[1];
  }
  if (accountContext) {
    const lowerContext = accountContext.toLowerCase();
    const contextIndex = text.toLowerCase().indexOf(lowerContext);
    if (contextIndex >= 0) {
      return accountContext;
    }
  }
  const accountLabelMatch = text.match(/conta[\s:]+([\w-]+)/i);
  if (accountLabelMatch) {
    return accountLabelMatch[1];
  }
  return undefined;
}

function buildNotes(result: PdfExtractionResult, text: string): string {
  const summary: string[] = ['Extraído localmente'];
  if (!result.amount) {
    summary.push('valor por identificar');
  }
  if (!result.dueDate) {
    summary.push('data não encontrada');
  }
  if (text.length > 0) {
    const preview = text.trim().split(/\s+/).slice(0, 20).join(' ');
    summary.push(`trecho: "${preview}…"`);
  }
  return summary.join(' · ');
}

export function inferMetadataFromText(text: string, options: LocalExtractionOptions = {}): PdfExtractionResult {
  const amount = findAmount(text);
  const dueDate = findDueDate(text);
  const sourceType = detectSourceType(text);
  const accountHint = findAccountHint(text, options.accountContext);

  const result: PdfExtractionResult = {
    sourceType,
    amount: amount?.value,
    currency: amount?.currency,
    dueDate,
    accountHint
  };

  return {
    ...result,
    notes: buildNotes(result, text)
  };
}

async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjs = await loadPdfjs();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const content = await page.getTextContent();
    const textItems = (content.items as Array<{ str?: string }>)
      .map((item) => item.str ?? '')
      .filter((segment) => segment.length > 0);
    pageTexts.push(textItems.join(' '));
  }

  return pageTexts.join('\n');
}

export async function extractMetadataLocally(
  file: File,
  options: LocalExtractionOptions = {}
): Promise<PdfExtractionResult> {
  const text = await extractTextFromPdf(file);
  return inferMetadataFromText(text, options);
}
