import {
  CollectionReference,
  DocumentData,
  Firestore,
  Unsubscribe,
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import { logFirebaseEvent } from './integrationLogger';

function sanitizeFirestoreData<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as T;
}

export type WithOptionalId<T> = T & { id?: string };
export type WithId<T> = T & { id: string };

type CollectionPath = string;

type ExtractWithoutId<T> = T extends { id: string }
  ? Omit<T, 'id'>
  : T;

function mapSnapshot<T extends { id: string }>(snapshot: DocumentData, id: string): T {
  return { id, ...(snapshot as ExtractWithoutId<T>) } as T;
}

function getCollection<T extends { id: string }>(db: Firestore, path: CollectionPath): CollectionReference<DocumentData> {
  return collection(db, path);
}

interface FirestoreOperationOptions {
  skipLog?: boolean;
}

export function subscribeToCollection<T extends { id: string }>(
  db: Firestore,
  path: CollectionPath,
  callback: (items: T[]) => void,
  onError?: (error: unknown) => void,
  options?: FirestoreOperationOptions
): Unsubscribe {
  const collectionRef = getCollection<T>(db, path);
  if (!options?.skipLog) {
    logFirebaseEvent('Subscrição Firestore iniciada.', {
      details: { path }
    });
  }
  return onSnapshot(
    collectionRef,
    (snapshot) => {
      const items = snapshot.docs.map((docSnapshot) => mapSnapshot<T>(docSnapshot.data(), docSnapshot.id));
      if (!options?.skipLog) {
        logFirebaseEvent('Snapshot Firestore recebido.', {
          details: {
            path,
            documentos: snapshot.size
          }
        });
      }
      callback(items);
    },
    (error) => {
      console.error(`Erro a sincronizar a coleção ${path}`, error);
      if (!options?.skipLog) {
        logFirebaseEvent('Erro na subscrição Firestore.', {
          details: {
            path,
            erro: error instanceof Error ? error.message : String(error)
          }
        });
      }
      onError?.(error);
    }
  );
}

export async function saveDocument<T extends { id: string }>(
  db: Firestore,
  path: CollectionPath,
  data: T,
  options?: FirestoreOperationOptions
): Promise<void> {
  const { id, ...rest } = data;
  if (!options?.skipLog) {
    logFirebaseEvent('→ Guardar documento no Firestore.', {
      details: {
        path,
        id
      }
    });
  }
  const sanitizedData = sanitizeFirestoreData(rest as Record<string, unknown>);
  await setDoc(doc(db, path, id), sanitizedData as DocumentData, { merge: true });
  if (!options?.skipLog) {
    logFirebaseEvent('← Documento guardado no Firestore.', {
      details: {
        path,
        id
      }
    });
  }
}

export async function createDocument<T extends { id?: string }>(
  db: Firestore,
  path: CollectionPath,
  data: WithOptionalId<T>,
  options?: FirestoreOperationOptions
): Promise<string> {
  if (data.id) {
    await saveDocument(db, path, data as WithId<T>, options);
    return data.id;
  }
  const { id, ...rest } = data;
  if (!options?.skipLog) {
    logFirebaseEvent('→ Criar documento no Firestore.', {
      details: { path }
    });
  }
  const sanitizedData = sanitizeFirestoreData(rest as Record<string, unknown>);
  const docRef = await addDoc(collection(db, path), sanitizedData as DocumentData);
  if (!options?.skipLog) {
    logFirebaseEvent('← Documento criado no Firestore.', {
      details: {
        path,
        idGerado: docRef.id
      }
    });
  }
  return docRef.id;
}

export async function deleteDocumentById(
  db: Firestore,
  path: CollectionPath,
  id: string,
  options?: FirestoreOperationOptions
): Promise<void> {
  if (!options?.skipLog) {
    logFirebaseEvent('→ Remover documento do Firestore.', {
      details: { path, id }
    });
  }
  await deleteDoc(doc(db, path, id));
  if (!options?.skipLog) {
    logFirebaseEvent('← Documento removido do Firestore.', {
      details: { path, id }
    });
  }
}
