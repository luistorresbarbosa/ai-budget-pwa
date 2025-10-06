import type { AppSettings } from '../data/models';
import { DEFAULT_INTEGRATION_LOGS_PAGE_SIZE, MAX_INTEGRATION_LOGS } from '../types/integrationLogs';
import { validateFirebaseConfig } from '../services/firebase';
import type { FirebaseConfig } from '../services/firebase';

const SETTINGS_STORAGE_KEY = 'ai-budget-settings';

type StoredSettings = Partial<AppSettings>;

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

function sanitiseFirebaseConfig(value: unknown): FirebaseConfig | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => typeof v === 'string')
    .map(([key, v]) => [key, v as string]);
  if (!entries.length) {
    return undefined;
  }
  const candidate = Object.fromEntries(entries) as FirebaseConfig;
  if (!validateFirebaseConfig(candidate)) {
    return undefined;
  }
  return candidate;
}

function sanitiseSettings(settings: unknown): StoredSettings | null {
  if (!settings || typeof settings !== 'object') {
    return null;
  }

  const parsed = settings as Record<string, unknown>;
  const result: StoredSettings = {};

  if (typeof parsed.openAIApiKey === 'string') {
    result.openAIApiKey = parsed.openAIApiKey;
  }
  if (typeof parsed.openAIBaseUrl === 'string') {
    result.openAIBaseUrl = parsed.openAIBaseUrl;
  }
  if (typeof parsed.openAIModel === 'string') {
    result.openAIModel = parsed.openAIModel;
  }
  if (typeof parsed.autoDetectFixedExpenses === 'boolean') {
    result.autoDetectFixedExpenses = parsed.autoDetectFixedExpenses;
  }
  const logsPageSize = Number(parsed.integrationLogsPageSize);
  if (
    Number.isInteger(logsPageSize) &&
    logsPageSize >= 1 &&
    logsPageSize <= MAX_INTEGRATION_LOGS
  ) {
    result.integrationLogsPageSize = logsPageSize;
  }
  const firebaseConfig = sanitiseFirebaseConfig(parsed.firebaseConfig);
  if (firebaseConfig) {
    result.firebaseConfig = firebaseConfig;
  }

  return Object.keys(result).length > 0 ? result : null;
}

export function loadPersistedSettings(): StoredSettings | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    const sanitised = sanitiseSettings(parsed);
    if (!sanitised) {
      storage.removeItem(SETTINGS_STORAGE_KEY);
    }
    return sanitised;
  } catch (error) {
    console.warn('Não foi possível ler as definições persistidas.', error);
    storage.removeItem(SETTINGS_STORAGE_KEY);
    return null;
  }
}

export function persistSettings(settings: AppSettings): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    const payload: StoredSettings = {
      autoDetectFixedExpenses: settings.autoDetectFixedExpenses,
      integrationLogsPageSize: settings.integrationLogsPageSize || DEFAULT_INTEGRATION_LOGS_PAGE_SIZE
    };
    if (settings.openAIApiKey) {
      payload.openAIApiKey = settings.openAIApiKey;
    }
    if (settings.openAIBaseUrl) {
      payload.openAIBaseUrl = settings.openAIBaseUrl;
    }
    if (settings.openAIModel) {
      payload.openAIModel = settings.openAIModel;
    }
    if (settings.firebaseConfig && validateFirebaseConfig(settings.firebaseConfig)) {
      payload.firebaseConfig = { ...settings.firebaseConfig };
    }
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Não foi possível guardar as definições.', error);
  }
}

export function clearPersistedSettings(): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(SETTINGS_STORAGE_KEY);
  } catch (error) {
    console.warn('Não foi possível remover as definições persistidas.', error);
  }
}

export { SETTINGS_STORAGE_KEY };
