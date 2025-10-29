import { describe, expect, it } from 'vitest';
import { generateMonthlyOccurrences } from './ExpensesPage';

function isoDate(value: string): Date {
  return new Date(value);
}

describe('generateMonthlyOccurrences', () => {
  it('limits the number of occurrences when a cap is provided', () => {
    const start = isoDate('2024-01-15T00:00:00.000Z');
    const end = isoDate('2025-01-15T00:00:00.000Z');

    const occurrences = generateMonthlyOccurrences(start, end, { maxOccurrences: 6 });

    expect(occurrences).toHaveLength(6);
    expect(occurrences.at(0)?.toISOString()).toBe('2024-01-15T00:00:00.000Z');
    expect(occurrences.at(-1)?.toISOString()).toBe('2024-06-15T00:00:00.000Z');
  });

  it('stops at the provided end date when it happens first', () => {
    const start = isoDate('2024-01-15T00:00:00.000Z');
    const end = isoDate('2024-04-15T00:00:00.000Z');

    const occurrences = generateMonthlyOccurrences(start, end, { maxOccurrences: 6 });

    expect(occurrences).toHaveLength(4);
    expect(occurrences.at(-1)?.toISOString()).toBe('2024-04-15T00:00:00.000Z');
  });

  it('returns an empty array when the end date is before the start date', () => {
    const start = isoDate('2024-01-15T00:00:00.000Z');
    const end = isoDate('2023-12-15T00:00:00.000Z');

    const occurrences = generateMonthlyOccurrences(start, end, { maxOccurrences: 6 });

    expect(occurrences).toEqual([]);
  });
});
