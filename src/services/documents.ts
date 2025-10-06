import type { DocumentMetadata } from '../data/models';
import type { FirebaseConfig } from './firebase';
import { initializeFirebase, validateFirebaseConfig } from './firebase';
import { createDocument, deleteDocumentById } from './firestore';

const DOCUMENTS_COLLECTION = 'documents';

export async function persistDocumentMetadata(
  document: DocumentMetadata,
  config: FirebaseConfig
): Promise<void> {
  if (!validateFirebaseConfig(config)) {
    throw new Error('Configuração Firebase inválida.');
  }
  const { db } = await initializeFirebase(config);
  await createDocument<DocumentMetadata>(db, DOCUMENTS_COLLECTION, document);
}

export async function removeDocumentMetadata(id: string, config: FirebaseConfig): Promise<void> {
  if (!validateFirebaseConfig(config)) {
    throw new Error('Configuração Firebase inválida.');
  }
  const { db } = await initializeFirebase(config);
  await deleteDocumentById(db, DOCUMENTS_COLLECTION, id);
}
