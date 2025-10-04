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

export function subscribeToCollection<T extends { id: string }>(
  db: Firestore,
  path: CollectionPath,
  callback: (items: T[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  const collectionRef = getCollection<T>(db, path);
  return onSnapshot(
    collectionRef,
    (snapshot) => {
      const items = snapshot.docs.map((docSnapshot) => mapSnapshot<T>(docSnapshot.data(), docSnapshot.id));
      callback(items);
    },
    (error) => {
      console.error(`Erro a sincronizar a coleção ${path}`, error);
      onError?.(error);
    }
  );
}

export async function saveDocument<T extends { id: string }>(db: Firestore, path: CollectionPath, data: T): Promise<void> {
  const { id, ...rest } = data;
  await setDoc(doc(db, path, id), rest as DocumentData, { merge: true });
}

export async function createDocument<T extends { id?: string }>(
  db: Firestore,
  path: CollectionPath,
  data: WithOptionalId<T>
): Promise<string> {
  if (data.id) {
    await saveDocument(db, path, data as WithId<T>);
    return data.id;
  }
  const { id, ...rest } = data;
  const docRef = await addDoc(collection(db, path), rest as DocumentData);
  return docRef.id;
}

export async function deleteDocumentById(db: Firestore, path: CollectionPath, id: string): Promise<void> {
  await deleteDoc(doc(db, path, id));
}
