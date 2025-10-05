import { FirebaseApp, deleteApp, getApps, initializeApp } from 'firebase/app';
import { Firestore, getFirestore } from 'firebase/firestore';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;
let cachedConfig: FirebaseConfig | null = null;

function configsAreEqual(a: FirebaseConfig, b: FirebaseConfig): boolean {
  return (
    a.apiKey === b.apiKey &&
    a.authDomain === b.authDomain &&
    a.projectId === b.projectId &&
    a.storageBucket === b.storageBucket &&
    a.messagingSenderId === b.messagingSenderId &&
    a.appId === b.appId
  );
}

function cloneConfig(config: FirebaseConfig): FirebaseConfig {
  return { ...config };
}

export function validateFirebaseConfig(config: Partial<FirebaseConfig>): config is FirebaseConfig {
  return Boolean(config.apiKey && config.authDomain && config.projectId);
}

export async function initializeFirebase(config: FirebaseConfig): Promise<{
  app: FirebaseApp;
  db: Firestore;
}> {
  if (!validateFirebaseConfig(config)) {
    throw new Error('Configuração Firebase incompleta.');
  }

  if (firebaseApp && cachedConfig && configsAreEqual(cachedConfig, config)) {
    return { app: firebaseApp, db: firestoreDb as Firestore };
  }

  if (firebaseApp) {
    await deleteApp(firebaseApp);
    firebaseApp = null;
    firestoreDb = null;
    cachedConfig = null;
  }

  const app = initializeApp(config);
  firebaseApp = app;
  firestoreDb = getFirestore(app);
  cachedConfig = cloneConfig(config);
  return { app, db: firestoreDb };
}

export function getFirebaseApp(): FirebaseApp {
  if (!firebaseApp) {
    const existingApp = getApps()[0];
    if (!existingApp) {
      throw new Error('Firebase não foi inicializado.');
    }
    firebaseApp = existingApp;
    firestoreDb = getFirestore(existingApp);
  }
  return firebaseApp;
}

export function getFirestoreDb(): Firestore {
  if (!firestoreDb) {
    if (!firebaseApp) {
      throw new Error('Firebase não foi inicializado.');
    }
    firestoreDb = getFirestore(firebaseApp);
  }
  return firestoreDb;
}

export function isFirebaseInitialized(): boolean {
  return Boolean(firebaseApp && firestoreDb);
}

export async function resetFirebase(): Promise<void> {
  if (firebaseApp) {
    await deleteApp(firebaseApp);
  }
  firebaseApp = null;
  firestoreDb = null;
  cachedConfig = null;
}
