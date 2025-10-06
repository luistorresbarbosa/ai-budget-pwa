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

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    console.warn('JSON de configuração Firebase inválido detectado ao migrar definições antigas.', error);
    return null;
  }
}

function toFirebaseConfigCandidate(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return parseJsonObject(value);
  }
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return null;
}

function sanitiseFirebaseConfig(value: unknown): FirebaseConfig | undefined {
  const candidateObject = toFirebaseConfigCandidate(value);
  if (!candidateObject) {
    return undefined;
  }
  const entries = Object.entries(candidateObject)
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

const OPENAI_API_KEY_CANDIDATES = ['openAIApiKey', 'openaiApiKey', 'openAiApiKey'] as const;
const OPENAI_BASE_URL_CANDIDATES = ['openAIBaseUrl', 'openaiBaseUrl'] as const;
const OPENAI_MODEL_CANDIDATES = ['openAIModel', 'openaiModel'] as const;
const FIREBASE_CONFIG_CANDIDATES = ['firebaseConfig', 'firebaseConfigJson', 'firebaseConfigJSON', 'firebase'] as const;

function pickString(
  source: Record<string, unknown>,
  keys: readonly string[],
  predicate: (value: string) => boolean = () => true
): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && predicate(value)) {
      return value;
    }
  }
  return undefined;
}

function pickBoolean(source: Record<string, unknown>, keys: readonly string[]): boolean | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'boolean') {
      return value;
    }
  }
  return undefined;
}

function sanitiseSettings(settings: unknown): StoredSettings | null {
  if (!settings || typeof settings !== 'object') {
    return null;
  }

  const parsed = settings as Record<string, unknown>;
  const result: StoredSettings = {};

  const openAIApiKey = pickString(parsed, OPENAI_API_KEY_CANDIDATES, (value) => value.length > 0);
  if (openAIApiKey) {
    result.openAIApiKey = openAIApiKey;
  }

  const openAIBaseUrl = pickString(parsed, OPENAI_BASE_URL_CANDIDATES);
  if (openAIBaseUrl) {
    result.openAIBaseUrl = openAIBaseUrl;
  }

  const openAIModel = pickString(parsed, OPENAI_MODEL_CANDIDATES);
  if (openAIModel) {
    result.openAIModel = openAIModel;
  }

  const autoDetect = pickBoolean(parsed, ['autoDetectFixedExpenses', 'autoDetectRecurringExpenses']);
  if (typeof autoDetect === 'boolean') {
    result.autoDetectFixedExpenses = autoDetect;
  }

  const logsPageSize = Number(parsed.integrationLogsPageSize ?? parsed.logsPerPage ?? parsed.integrationLogsPageSizeSetting);
  if (
    Number.isInteger(logsPageSize) &&
    logsPageSize >= 1 &&
    logsPageSize <= MAX_INTEGRATION_LOGS
  ) {
    result.integrationLogsPageSize = logsPageSize;
  }
  let firebaseConfig: FirebaseConfig | undefined;
  for (const key of FIREBASE_CONFIG_CANDIDATES) {
    firebaseConfig = sanitiseFirebaseConfig(parsed[key]);
    if (firebaseConfig) {
      break;
    }
  }
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
