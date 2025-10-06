import type { AppSettings } from '../data/models';
import { DEFAULT_INTEGRATION_LOGS_PAGE_SIZE, MAX_INTEGRATION_LOGS } from '../types/integrationLogs';
import { looksLikeServiceAccountConfig, validateFirebaseConfig } from '../services/firebase';
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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normaliseKey(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

const GENERAL_CONTAINER_KEYS = ['settings', 'configuration', 'config', 'preferences', 'state', 'payload', 'data', 'options'] as const;

function collectGeneralSources(base: Record<string, unknown>): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  const queue: Record<string, unknown>[] = [base];
  const visited = new Set<Record<string, unknown>>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    result.push(current);

    for (const [key, value] of Object.entries(current)) {
      const nested = asRecord(value);
      if (!nested) {
        continue;
      }
      if (GENERAL_CONTAINER_KEYS.some((candidate) => normaliseKey(candidate) === normaliseKey(key))) {
        queue.push(nested);
      }
    }
  }

  return result;
}

function collectContainerRecords(
  base: Record<string, unknown>,
  containerKeys: readonly string[]
): Record<string, unknown>[] {
  const matches: Record<string, unknown>[] = [];
  const seen = new Set<Record<string, unknown>>();
  const sources = collectGeneralSources(base);

  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      const candidate = asRecord(value);
      if (!candidate) {
        continue;
      }
      if (containerKeys.some((container) => normaliseKey(container) === normaliseKey(key))) {
        if (!seen.has(candidate)) {
          seen.add(candidate);
          matches.push(candidate);
        }
      }
    }
  }

  return matches;
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value.trim());
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    console.warn('JSON de configuração Firebase inválido detectado ao migrar definições antigas.', error);
    return null;
  }
}

const FIREBASE_NESTED_KEYS = ['config', 'configuration', 'settings', 'options', 'value'] as const;

function toFirebaseConfigCandidate(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = parseJsonObject(trimmed);
    if (!parsed) {
      return null;
    }
    return toFirebaseConfigCandidate(parsed) ?? parsed;
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (looksLikeServiceAccountConfig(record)) {
      return null;
    }
    for (const key of FIREBASE_NESTED_KEYS) {
      const nested = toFirebaseConfigCandidate(record[key]);
      if (nested) {
        return nested;
      }
    }
    return record;
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

const OPENAI_API_KEY_CANDIDATES = ['openAIApiKey', 'openaiApiKey', 'openAiApiKey', 'openAIKey', 'openaiKey'] as const;
const OPENAI_BASE_URL_CANDIDATES = ['openAIBaseUrl', 'openaiBaseUrl', 'openAIBaseURL', 'openaiBaseURL'] as const;
const OPENAI_MODEL_CANDIDATES = ['openAIModel', 'openaiModel', 'openAIModelName', 'openaiModelName'] as const;
const FIREBASE_CONFIG_CANDIDATES = ['firebaseConfig', 'firebaseConfigJson', 'firebaseConfigJSON', 'firebase', 'firebaseSettings', 'firebaseOptions'] as const;
const OPENAI_CONTAINER_KEYS = ['openAI', 'openai', 'openAi', 'openAISettings', 'openaiSettings'] as const;
const FIREBASE_CONTAINER_KEYS = ['firebase', 'firebaseConfig', 'firebaseSettings', 'firebaseOptions'] as const;
const OPENAI_API_KEY_NESTED_CANDIDATES = ['apiKey', 'key', 'token', 'secret'] as const;
const OPENAI_BASE_URL_NESTED_CANDIDATES = ['baseUrl', 'baseURL', 'url', 'endpoint'] as const;
const OPENAI_MODEL_NESTED_CANDIDATES = ['model', 'modelName', 'chatModel'] as const;
const LOGS_PAGE_SIZE_CANDIDATES = ['integrationLogsPageSize', 'logsPerPage', 'integrationLogsPageSizeSetting'] as const;

function pickStringFromSource(
  source: Record<string, unknown>,
  keys: readonly string[],
  predicate: (value: string) => boolean = () => true
): string | undefined {
  if (!keys.length) {
    return undefined;
  }
  const normalisedKeys = new Set(keys.map((key) => normaliseKey(key)));
  for (const [rawKey, rawValue] of Object.entries(source)) {
    if (typeof rawValue !== 'string') {
      continue;
    }
    const trimmed = rawValue.trim();
    if (!trimmed) {
      continue;
    }
    if (normalisedKeys.has(normaliseKey(rawKey)) && predicate(trimmed)) {
      return trimmed;
    }
  }
  return undefined;
}

function pickStringFromSources(
  sources: readonly Record<string, unknown>[],
  keys: readonly string[],
  predicate: (value: string) => boolean = () => true
): string | undefined {
  for (const source of sources) {
    const value = pickStringFromSource(source, keys, predicate);
    if (value) {
      return value;
    }
  }
  return undefined;
}

function pickBooleanFromSources(
  sources: readonly Record<string, unknown>[],
  keys: readonly string[]
): boolean | undefined {
  const normalisedKeys = new Set(keys.map((key) => normaliseKey(key)));
  for (const source of sources) {
    for (const [rawKey, rawValue] of Object.entries(source)) {
      if (typeof rawValue === 'boolean' && normalisedKeys.has(normaliseKey(rawKey))) {
        return rawValue;
      }
    }
  }
  return undefined;
}

function pickNumericFromSources(
  sources: readonly Record<string, unknown>[],
  keys: readonly string[]
): number | undefined {
  const normalisedKeys = new Set(keys.map((key) => normaliseKey(key)));
  for (const source of sources) {
    for (const [rawKey, rawValue] of Object.entries(source)) {
      if (!normalisedKeys.has(normaliseKey(rawKey))) {
        continue;
      }
      if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
        return rawValue;
      }
      if (typeof rawValue === 'string') {
        const parsed = Number(rawValue.trim());
        if (Number.isInteger(parsed)) {
          return parsed;
        }
      }
    }
  }
  return undefined;
}

function sanitiseSettings(settings: unknown): StoredSettings | null {
  if (!settings || typeof settings !== 'object') {
    return null;
  }

  const parsed = settings as Record<string, unknown>;
  const generalSources = collectGeneralSources(parsed);
  const openAISources = [
    ...collectContainerRecords(parsed, OPENAI_CONTAINER_KEYS),
    ...collectContainerRecords(parsed, ['openAIConfig', 'openaiConfig', 'openAIOptions', 'openaiOptions'])
  ];
  const firebaseSources = collectContainerRecords(parsed, FIREBASE_CONTAINER_KEYS);
  const result: StoredSettings = {};

  const openAIApiKey =
    pickStringFromSources(generalSources, OPENAI_API_KEY_CANDIDATES, (value) => value.length > 0) ??
    pickStringFromSources(openAISources, OPENAI_API_KEY_NESTED_CANDIDATES, (value) => value.length > 0);
  if (openAIApiKey) {
    result.openAIApiKey = openAIApiKey;
  }

  const openAIBaseUrl =
    pickStringFromSources(generalSources, OPENAI_BASE_URL_CANDIDATES) ??
    pickStringFromSources(openAISources, OPENAI_BASE_URL_NESTED_CANDIDATES);
  if (openAIBaseUrl) {
    result.openAIBaseUrl = openAIBaseUrl;
  }

  const openAIModel =
    pickStringFromSources(generalSources, OPENAI_MODEL_CANDIDATES) ??
    pickStringFromSources(openAISources, OPENAI_MODEL_NESTED_CANDIDATES);
  if (openAIModel) {
    result.openAIModel = openAIModel;
  }

  const autoDetect = pickBooleanFromSources(generalSources, [
    'autoDetectFixedExpenses',
    'autoDetectRecurringExpenses'
  ]);
  if (typeof autoDetect === 'boolean') {
    result.autoDetectFixedExpenses = autoDetect;
  }

  const logsPageSize = pickNumericFromSources(generalSources, LOGS_PAGE_SIZE_CANDIDATES);
  if (
    typeof logsPageSize === 'number' &&
    Number.isInteger(logsPageSize) &&
    logsPageSize >= 1 &&
    logsPageSize <= MAX_INTEGRATION_LOGS
  ) {
    result.integrationLogsPageSize = logsPageSize;
  }

  const firebaseSourcesToInspect = [...generalSources, ...firebaseSources, ...openAISources];
  let firebaseConfig: FirebaseConfig | undefined;
  for (const source of firebaseSourcesToInspect) {
    for (const key of FIREBASE_CONFIG_CANDIDATES) {
      const candidate = sanitiseFirebaseConfig(source[key]);
      if (candidate) {
        firebaseConfig = candidate;
        break;
      }
    }
    if (firebaseConfig) {
      break;
    }
    if (!firebaseConfig) {
      const nestedCandidate = sanitiseFirebaseConfig(source);
      if (nestedCandidate) {
        firebaseConfig = nestedCandidate;
        break;
      }
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
