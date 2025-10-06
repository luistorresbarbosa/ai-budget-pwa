import type { FirebaseConfig } from './firebase';
import { initializeFirebase } from './firebase';
import { saveDocument } from './firestore';
import type { IntegrationLogEntry, IntegrationLogSource, IntegrationLogsState } from '../types/integrationLogs';

const COLLECTION_PATH = 'integrationLogs';

function buildDocumentId(source: IntegrationLogSource, entry: IntegrationLogEntry): string {
  return `${source}-${entry.timestamp}`;
}

function toDocument(source: IntegrationLogSource, entry: IntegrationLogEntry) {
  return {
    id: buildDocumentId(source, entry),
    source,
    message: entry.message,
    timestamp: entry.timestamp
  };
}

export async function persistIntegrationLogToFirebase(
  config: FirebaseConfig,
  source: IntegrationLogSource,
  entry: IntegrationLogEntry
): Promise<void> {
  const { db } = await initializeFirebase(config);
  await saveDocument(db, COLLECTION_PATH, toDocument(source, entry));
}

export async function persistAllIntegrationLogsToFirebase(
  config: FirebaseConfig,
  logs: IntegrationLogsState
): Promise<void> {
  const { db } = await initializeFirebase(config);
  const tasks: Array<Promise<void>> = [];
  for (const entry of logs.openai) {
    tasks.push(saveDocument(db, COLLECTION_PATH, toDocument('openai', entry)));
  }
  for (const entry of logs.firebase) {
    tasks.push(saveDocument(db, COLLECTION_PATH, toDocument('firebase', entry)));
  }
  await Promise.all(tasks);
}

export { COLLECTION_PATH as INTEGRATION_LOGS_COLLECTION };
