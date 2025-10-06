import { useEffect } from 'react';
import { useAppState } from '../state/AppStateContext';
import { type FirebaseConfig, validateFirebaseConfig } from '../services/firebase';
import {
  getIntegrationLogDocumentId,
  persistAllIntegrationLogsToFirebase,
  persistIntegrationLogToFirebase
} from '../services/integrationLogs';
import { getIntegrationLogs, subscribeToIntegrationLogs } from '../services/integrationLogger';
import type { IntegrationLogEntry, IntegrationLogSource } from '../types/integrationLogs';

type QueuedLog = {
  source: IntegrationLogSource;
  entry: IntegrationLogEntry;
};

function buildKey(source: IntegrationLogSource, entry: IntegrationLogEntry): string {
  return getIntegrationLogDocumentId(source, entry);
}

async function syncEntry(
  config: FirebaseConfig,
  source: IntegrationLogSource,
  entry: IntegrationLogEntry
): Promise<void> {
  await persistIntegrationLogToFirebase(config, source, entry);
}

export function useIntegrationLogsSync(): void {
  const firebaseConfig = useAppState((state) => state.settings.firebaseConfig);

  useEffect(() => {
    if (!firebaseConfig || !validateFirebaseConfig(firebaseConfig)) {
      return;
    }

    const validConfig = firebaseConfig;
    const syncedEntries = new Set<string>();
    const pendingEntries = new Set<string>();
    const queuedEntries = new Map<string, QueuedLog>();
    let cancelled = false;
    let readyToProcessQueue = false;

    const processQueue = () => {
      if (!readyToProcessQueue || cancelled) {
        return;
      }
      queuedEntries.forEach(({ source, entry }, key) => {
        if (syncedEntries.has(key)) {
          queuedEntries.delete(key);
          return;
        }
        if (pendingEntries.has(key)) {
          return;
        }
        pendingEntries.add(key);
        void syncEntry(validConfig, source, entry)
          .then(() => {
            if (!cancelled) {
              syncedEntries.add(key);
            }
          })
          .catch((error) => {
            if (!cancelled) {
              console.error('Não foi possível sincronizar log de integração com o Firebase.', error);
            }
          })
          .finally(() => {
            pendingEntries.delete(key);
            if (syncedEntries.has(key)) {
              queuedEntries.delete(key);
            } else if (!cancelled) {
              setTimeout(() => {
                if (!cancelled) {
                  processQueue();
                }
              }, 1500);
            }
          });
      });
    };

    const enqueue = (source: IntegrationLogSource, entry: IntegrationLogEntry) => {
      if (cancelled) {
        return;
      }
      const key = buildKey(source, entry);
      if (syncedEntries.has(key) || pendingEntries.has(key)) {
        return;
      }
      queuedEntries.set(key, { source, entry });
      processQueue();
    };

    const unsubscribe = subscribeToIntegrationLogs((state) => {
      state.openai.forEach((entry) => enqueue('openai', entry));
      state.firebase.forEach((entry) => enqueue('firebase', entry));
    });

    const initialState = getIntegrationLogs();

    (async () => {
      try {
        await persistAllIntegrationLogsToFirebase(validConfig, initialState);
        if (cancelled) {
          return;
        }
        initialState.openai.forEach((entry) => {
          syncedEntries.add(buildKey('openai', entry));
        });
        initialState.firebase.forEach((entry) => {
          syncedEntries.add(buildKey('firebase', entry));
        });
      } catch (error) {
        if (!cancelled) {
          console.error('Não foi possível sincronizar logs existentes com o Firebase.', error);
        }
      } finally {
        if (!cancelled) {
          readyToProcessQueue = true;
          processQueue();
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe();
      queuedEntries.clear();
      pendingEntries.clear();
      syncedEntries.clear();
    };
  }, [firebaseConfig]);
}
