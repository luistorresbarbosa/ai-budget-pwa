import { describe, expect, it } from 'vitest';
import { inferMetadataFromText } from './pdfLocalExtractor';

describe('inferMetadataFromText', () => {
  it('detects amount, currency and due date from european formatted text', () => {
    const text = `Factura Nº 123\nTotal a pagar: 1.234,56 €\nPagamento até 15/09/2024`;

    const result = inferMetadataFromText(text);

    expect(result.amount).toBeCloseTo(1234.56, 2);
    expect(result.currency).toBe('EUR');
    expect(result.dueDate).toMatch(/^2024-09-15T/);
    expect(result.sourceType).toBe('fatura');
  });

  it('detects account hint from IBAN and statement keyword', () => {
    const text = `Extrato bancário Mensal\nIBAN PT50000201231234567890154\nSaldo disponível`;

    const result = inferMetadataFromText(text);

    expect(result.accountHint).toBe('PT50000201231234567890154');
    expect(result.sourceType).toBe('extracto');
  });

  it('falls back to notes describing missing fields', () => {
    const text = 'Recibo de renda referente a Agosto';

    const result = inferMetadataFromText(text);

    expect(result.sourceType).toBe('recibo');
    expect(result.notes).toMatch(/Extraído localmente/);
    expect(result.notes).toMatch(/valor por identificar/);
    expect(result.notes).toMatch(/data não encontrada/);
  });
});
