import { FirebaseApp, deleteApp, getApps, initializeApp } from 'firebase/app';
import { Firestore, getFirestore } from 'firebase/firestore';
import { logFirebaseEvent } from './integrationLogger';

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

export function looksLikeServiceAccountConfig(config: unknown): boolean {
  if (!config || typeof config !== 'object') {
    return false;
  }
  const candidate = config as Record<string, unknown>;
  if (candidate.type === 'service_account') {
    return true;
  }
  const hasPrivateKey = typeof candidate.private_key === 'string';
  const hasClientEmail = typeof candidate.client_email === 'string';
  const hasUniverseDomain = typeof candidate.universe_domain === 'string';
  return Boolean(hasPrivateKey && hasClientEmail && hasUniverseDomain);
}

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
    logFirebaseEvent('Reutilização de instância Firebase em cache.', {
      details: { projectId: config.projectId }
    });
    return { app: firebaseApp, db: firestoreDb as Firestore };
  }

  if (firebaseApp) {
    logFirebaseEvent('Reinicialização da app Firebase anterior.', {
      details: { projectId: cachedConfig?.projectId }
    });
    await deleteApp(firebaseApp);
    firebaseApp = null;
    firestoreDb = null;
    cachedConfig = null;
  }

  logFirebaseEvent('→ Inicializar Firebase.', {
    details: {
      projectId: config.projectId,
      authDomain: config.authDomain
    }
  });
  const app = initializeApp(config);
  firebaseApp = app;
  firestoreDb = getFirestore(app);
  cachedConfig = cloneConfig(config);
  logFirebaseEvent('← Firebase inicializado com sucesso.', {
    details: {
      projectId: config.projectId
    }
  });
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
    logFirebaseEvent('A terminar instância Firebase activa.', {
      details: { projectId: cachedConfig?.projectId }
    });
    await deleteApp(firebaseApp);
  }
  firebaseApp = null;
  firestoreDb = null;
  cachedConfig = null;
  logFirebaseEvent('Estado Firebase limpo.', {
    details: 'Instância e cache reiniciadas.'
  });
}
