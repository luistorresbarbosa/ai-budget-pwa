import type { IntegrationLogEntry, IntegrationLogsState } from '../types/integrationLogs';
import { MAX_INTEGRATION_LOGS } from '../types/integrationLogs';

const LOGS_STORAGE_KEY = 'ai-budget-integration-logs';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getStorage(): StorageLike | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    try {
      return (globalThis as { localStorage: StorageLike }).localStorage;
    } catch (error) {
      console.warn('Não foi possível aceder ao localStorage.', error);
      return null;
    }
  }
  return null;
}

function sanitiseLogEntry(value: unknown): IntegrationLogEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  const timestamp = candidate.timestamp;
  const message = candidate.message;
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    return null;
  }
  if (typeof message !== 'string') {
    return null;
  }
  return { timestamp, message };
}

function trimLogs(logs: IntegrationLogEntry[]): IntegrationLogEntry[] {
  if (logs.length <= MAX_INTEGRATION_LOGS) {
    return logs;
  }
  return logs.slice(-MAX_INTEGRATION_LOGS);
}

function sanitiseLogList(value: unknown): IntegrationLogEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const entries = value
    .map((item) => sanitiseLogEntry(item))
    .filter((entry): entry is IntegrationLogEntry => Boolean(entry))
    .sort((a, b) => a.timestamp - b.timestamp);
  return trimLogs(entries);
}

export function loadIntegrationLogs(): IntegrationLogsState {
  const storage = getStorage();
  if (!storage) {
    return { openai: [], firebase: [] };
  }
  try {
    const raw = storage.getItem(LOGS_STORAGE_KEY);
    if (!raw) {
      return { openai: [], firebase: [] };
    }
    const parsed = JSON.parse(raw) as Record<string, unknown> | unknown;
    if (!parsed || typeof parsed !== 'object') {
      storage.removeItem(LOGS_STORAGE_KEY);
      return { openai: [], firebase: [] };
    }
    const candidate = parsed as Record<string, unknown>;
    const openai = sanitiseLogList(candidate.openai);
    const firebase = sanitiseLogList(candidate.firebase);
    return { openai, firebase };
  } catch (error) {
    console.warn('Não foi possível ler os logs persistidos.', error);
    storage.removeItem(LOGS_STORAGE_KEY);
    return { openai: [], firebase: [] };
  }
}

export function persistIntegrationLogs(logs: IntegrationLogsState): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    const payload: IntegrationLogsState = {
      openai: trimLogs([...logs.openai]),
      firebase: trimLogs([...logs.firebase])
    };
    storage.setItem(LOGS_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Não foi possível guardar os logs de integração.', error);
  }
}

export function clearIntegrationLogs(): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(LOGS_STORAGE_KEY);
  } catch (error) {
    console.warn('Não foi possível remover os logs de integração persistidos.', error);
  }
}

export { LOGS_STORAGE_KEY };
