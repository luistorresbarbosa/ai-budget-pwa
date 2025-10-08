import type { Transfer } from '../data/models';
import type { FirebaseConfig } from './firebase';
import { initializeFirebase, validateFirebaseConfig } from './firebase';
import { createDocument, deleteDocumentById } from './firestore';

const TRANSFERS_COLLECTION = 'transfers';

export async function persistTransfer(transfer: Transfer, config: FirebaseConfig): Promise<void> {
  if (!validateFirebaseConfig(config)) {
    throw new Error('Configuração Firebase inválida.');
  }
  const { db } = await initializeFirebase(config);
  await createDocument<Transfer>(db, TRANSFERS_COLLECTION, transfer);
}

export async function removeTransferById(id: string, config: FirebaseConfig): Promise<void> {
  if (!validateFirebaseConfig(config)) {
    throw new Error('Configuração Firebase inválida.');
  }
  const { db } = await initializeFirebase(config);
  await deleteDocumentById(db, TRANSFERS_COLLECTION, id);
}
