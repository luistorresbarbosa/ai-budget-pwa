import type { TimelineEntry } from '../data/models';
import type { FirebaseConfig } from './firebase';
import { initializeFirebase, validateFirebaseConfig } from './firebase';
import { createDocument, deleteDocumentById } from './firestore';

const TIMELINE_COLLECTION = 'timeline';

export async function persistTimelineEntry(entry: TimelineEntry, config: FirebaseConfig): Promise<void> {
  if (!validateFirebaseConfig(config)) {
    throw new Error('Configuração Firebase inválida.');
  }
  const { db } = await initializeFirebase(config);
  await createDocument<TimelineEntry>(db, TIMELINE_COLLECTION, entry);
}

export async function removeTimelineEntryById(id: string, config: FirebaseConfig): Promise<void> {
  if (!validateFirebaseConfig(config)) {
    throw new Error('Configuração Firebase inválida.');
  }
  const { db } = await initializeFirebase(config);
  await deleteDocumentById(db, TIMELINE_COLLECTION, id);
}
