import { DEFAULT_INTEGRATION_LOGS_PAGE_SIZE, MAX_INTEGRATION_LOGS } from '../types/integrationLogs';

const MIN_INTEGRATION_LOGS_PAGE_SIZE = 1;

export function normaliseLogsPerPage(value?: number | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_INTEGRATION_LOGS_PAGE_SIZE;
  }

  const rounded = Math.floor(value);
  if (rounded < MIN_INTEGRATION_LOGS_PAGE_SIZE) {
    return DEFAULT_INTEGRATION_LOGS_PAGE_SIZE;
  }

  if (rounded > MAX_INTEGRATION_LOGS) {
    return MAX_INTEGRATION_LOGS;
  }

  return rounded;
}

export interface PaginatedLogsResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  hasMultiplePages: boolean;
}

export function paginateLogs<T>(
  items: readonly T[],
  requestedPageSize: number,
  requestedPage: number
): PaginatedLogsResult<T> {
  const totalItems = items.length;
  const pageSize = normaliseLogsPerPage(requestedPageSize);
  const totalPages = totalItems === 0 ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(Math.floor(requestedPage) || 1, 1), totalPages);

  if (totalItems === 0) {
    return {
      items: [],
      page: 1,
      pageSize,
      totalItems: 0,
      totalPages: 1,
      rangeStart: 0,
      rangeEnd: 0,
      hasMultiplePages: false
    } satisfies PaginatedLogsResult<T>;
  }

  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const pageItems = items.slice(startIndex, endIndex);

  return {
    items: pageItems,
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
    rangeStart: startIndex + 1,
    rangeEnd: startIndex + pageItems.length,
    hasMultiplePages: totalPages > 1
  } satisfies PaginatedLogsResult<T>;
}

export { MIN_INTEGRATION_LOGS_PAGE_SIZE };
