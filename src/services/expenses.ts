import type { Expense } from '../data/models';
import type { FirebaseConfig } from './firebase';
import { initializeFirebase, validateFirebaseConfig } from './firebase';
import { createDocument, deleteDocumentById } from './firestore';

const EXPENSES_COLLECTION = 'expenses';

export async function persistExpense(expense: Expense, config: FirebaseConfig): Promise<void> {
  if (!validateFirebaseConfig(config)) {
    throw new Error('Configuração Firebase inválida.');
  }
  const { db } = await initializeFirebase(config);
  await createDocument<Expense>(db, EXPENSES_COLLECTION, expense);
}

export async function removeExpenseMetadata(id: string, config: FirebaseConfig): Promise<void> {
  if (!validateFirebaseConfig(config)) {
    throw new Error('Configuração Firebase inválida.');
  }
  const { db } = await initializeFirebase(config);
  await deleteDocumentById(db, EXPENSES_COLLECTION, id);
}
