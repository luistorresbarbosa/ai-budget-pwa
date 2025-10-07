import type { Supplier } from '../data/models';
import type { FirebaseConfig } from './firebase';
import { initializeFirebase, validateFirebaseConfig } from './firebase';
import { createDocument, deleteDocumentById } from './firestore';

const SUPPLIERS_COLLECTION = 'suppliers';

export async function persistSupplier(supplier: Supplier, config: FirebaseConfig): Promise<void> {
  if (!validateFirebaseConfig(config)) {
    throw new Error('Configuração Firebase inválida.');
  }
  const { db } = await initializeFirebase(config);
  await createDocument<Supplier>(db, SUPPLIERS_COLLECTION, supplier);
}

export async function removeSupplierById(id: string, config: FirebaseConfig): Promise<void> {
  if (!validateFirebaseConfig(config)) {
    throw new Error('Configuração Firebase inválida.');
  }
  const { db } = await initializeFirebase(config);
  await deleteDocumentById(db, SUPPLIERS_COLLECTION, id);
}
