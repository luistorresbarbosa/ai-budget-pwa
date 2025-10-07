import { describe, expect, it } from 'vitest';
import {
  MIN_INTEGRATION_LOGS_PAGE_SIZE,
  normaliseLogsPerPage,
  paginateLogs
} from './settingsLogsPagination';
import {
  DEFAULT_INTEGRATION_LOGS_PAGE_SIZE,
  MAX_INTEGRATION_LOGS
} from '../types/integrationLogs';

describe('settingsLogsPagination', () => {
  describe('normaliseLogsPerPage', () => {
    it('devolve a predefinição quando o valor é inválido', () => {
      expect(normaliseLogsPerPage(undefined)).toBe(DEFAULT_INTEGRATION_LOGS_PAGE_SIZE);
      expect(normaliseLogsPerPage(null)).toBe(DEFAULT_INTEGRATION_LOGS_PAGE_SIZE);
      expect(normaliseLogsPerPage(Number.NaN)).toBe(DEFAULT_INTEGRATION_LOGS_PAGE_SIZE);
    });

    it('arredonda e respeita limites mínimo e máximo', () => {
      expect(normaliseLogsPerPage(1.8)).toBe(1);
      expect(normaliseLogsPerPage(0)).toBe(DEFAULT_INTEGRATION_LOGS_PAGE_SIZE);
      expect(normaliseLogsPerPage(-10)).toBe(DEFAULT_INTEGRATION_LOGS_PAGE_SIZE);
      expect(normaliseLogsPerPage(1000)).toBe(MAX_INTEGRATION_LOGS);
    });
  });

  describe('paginateLogs', () => {
    const buildItems = (total: number) => Array.from({ length: total }, (_, index) => index + 1);

    it('devolve estrutura vazia quando não existem elementos', () => {
      const result = paginateLogs([], DEFAULT_INTEGRATION_LOGS_PAGE_SIZE, 2);
      expect(result.items).toEqual([]);
      expect(result.page).toBe(1);
      expect(result.totalItems).toBe(0);
      expect(result.totalPages).toBe(1);
      expect(result.hasMultiplePages).toBe(false);
    });

    it('limita o número de elementos por página e calcula intervalos correctamente', () => {
      const result = paginateLogs(buildItems(12), DEFAULT_INTEGRATION_LOGS_PAGE_SIZE, 1);
      expect(result.items).toEqual([1, 2, 3, 4, 5]);
      expect(result.rangeStart).toBe(1);
      expect(result.rangeEnd).toBe(5);
      expect(result.totalPages).toBe(3);
      expect(result.hasMultiplePages).toBe(true);
    });

    it('traz a última página válida quando o pedido excede o total disponível', () => {
      const result = paginateLogs(buildItems(9), 4, 5);
      expect(result.page).toBe(3);
      expect(result.items).toEqual([9]);
      expect(result.rangeStart).toBe(9);
      expect(result.rangeEnd).toBe(9);
    });

    it('assegura que o número de página mínimo é 1', () => {
      const result = paginateLogs(buildItems(3), DEFAULT_INTEGRATION_LOGS_PAGE_SIZE, -10);
      expect(result.page).toBe(1);
    });

    it('tolera actualizações de tamanho para valores fora dos limites', () => {
      const result = paginateLogs(buildItems(30), MIN_INTEGRATION_LOGS_PAGE_SIZE - 10, 1);
      expect(result.pageSize).toBeGreaterThan(0);
      expect(result.items.length).toBe(result.pageSize);
    });
  });
});
