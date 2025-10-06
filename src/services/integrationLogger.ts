import type { IntegrationLogEntry, IntegrationLogSource, IntegrationLogsState } from '../types/integrationLogs';
import { MAX_INTEGRATION_LOGS } from '../types/integrationLogs';
import { loadIntegrationLogs, persistIntegrationLogs } from '../state/integrationLogsPersistence';

type IntegrationLogsListener = (state: IntegrationLogsState) => void;

interface AppendIntegrationLogOptions {
  details?: unknown;
  timestamp?: number;
}

const listeners = new Set<IntegrationLogsListener>();

let cachedLogs: IntegrationLogsState | null = null;

function cloneLogsState(state: IntegrationLogsState): IntegrationLogsState {
  return {
    openai: [...state.openai],
    firebase: [...state.firebase]
  };
}

function getCachedLogs(): IntegrationLogsState {
  if (!cachedLogs) {
    cachedLogs = loadIntegrationLogs();
  }
  return cachedLogs;
}

function truncate(value: string, limit = 800): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}…`;
}

function normaliseDetailValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.length > 160 ? `${value.slice(0, 157)}…` : value;
  }
  return value;
}

function serialiseDetails(details: unknown): string | null {
  if (details == null) {
    return null;
  }
  if (typeof details === 'string') {
    return truncate(details);
  }
  try {
    const json = JSON.stringify(
      details,
      (_key, value) => normaliseDetailValue(value),
      2
    );
    return truncate(json);
  } catch (error) {
    console.warn('Não foi possível serializar detalhes de log.', error);
    return truncate(String(details));
  }
}

function appendEntry(entries: IntegrationLogEntry[], entry: IntegrationLogEntry): IntegrationLogEntry[] {
  if (MAX_INTEGRATION_LOGS <= 0) {
    return entries;
  }
  if (entries.length < MAX_INTEGRATION_LOGS) {
    return [...entries, entry];
  }
  return [...entries.slice(-(MAX_INTEGRATION_LOGS - 1)), entry];
}

function notifyListeners(state: IntegrationLogsState): void {
  for (const listener of listeners) {
    try {
      listener(cloneLogsState(state));
    } catch (error) {
      console.error('Listener de logs falhou.', error);
    }
  }

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent<IntegrationLogsState>('integration-logs:updated', {
        detail: cloneLogsState(state)
      })
    );
  }
}

export function getIntegrationLogs(): IntegrationLogsState {
  return cloneLogsState(getCachedLogs());
}

export function subscribeToIntegrationLogs(listener: IntegrationLogsListener): () => void {
  listeners.add(listener);
  listener(getIntegrationLogs());
  return () => {
    listeners.delete(listener);
  };
}

function buildMessage(message: string, options?: AppendIntegrationLogOptions): string {
  const details = options?.details;
  if (details == null) {
    return message;
  }
  const serialised = serialiseDetails(details);
  if (!serialised) {
    return message;
  }
  return `${message}\nDetalhes: ${serialised}`;
}

export function appendIntegrationLog(
  source: IntegrationLogSource,
  message: string,
  options?: AppendIntegrationLogOptions
): IntegrationLogEntry {
  const state = getCachedLogs();
  const entry: IntegrationLogEntry = {
    timestamp: options?.timestamp ?? Date.now(),
    message: buildMessage(message, options)
  };

  const nextState: IntegrationLogsState = {
    openai: source === 'openai' ? appendEntry(state.openai, entry) : [...state.openai],
    firebase: source === 'firebase' ? appendEntry(state.firebase, entry) : [...state.firebase]
  };

  cachedLogs = nextState;
  persistIntegrationLogs(nextState);
  notifyListeners(nextState);

  return entry;
}

export function logOpenAIEvent(message: string, options?: AppendIntegrationLogOptions): IntegrationLogEntry {
  return appendIntegrationLog('openai', message, options);
}

export function logFirebaseEvent(message: string, options?: AppendIntegrationLogOptions): IntegrationLogEntry {
  return appendIntegrationLog('firebase', message, options);
}

export type { AppendIntegrationLogOptions };
