import { useEffect } from 'react';
import type { Unsubscribe } from 'firebase/firestore';
import type { Account, DocumentMetadata, Expense, TimelineEntry, Transfer } from '../data/models';
import { useAppState } from '../state/AppStateContext';
import { initializeFirebase, validateFirebaseConfig } from '../services/firebase';
import { subscribeToCollection } from '../services/firestore';

const COLLECTIONS = {
  accounts: 'accounts',
  expenses: 'expenses',
  transfers: 'transfers',
  documents: 'documents',
  timeline: 'timeline'
} as const;

export function useFirestoreSync() {
  const settings = useAppState((state) => state.settings);
  const setAccounts = useAppState((state) => state.setAccounts);
  const setExpenses = useAppState((state) => state.setExpenses);
  const setTransfers = useAppState((state) => state.setTransfers);
  const setDocuments = useAppState((state) => state.setDocuments);
  const setTimeline = useAppState((state) => state.setTimeline);

  useEffect(() => {
    const config = settings.firebaseConfig;
    if (!config) {
      setAccounts([]);
      setExpenses([]);
      setTransfers([]);
      setDocuments([]);
      setTimeline([]);
      return () => {
        // nothing to cleanup
      };
    }

    if (!validateFirebaseConfig(config)) {
      console.warn('Configuração Firebase inválida.');
      return () => {
        // nothing to cleanup
      };
    }

    let cancelled = false;
    const unsubscribers: Unsubscribe[] = [];
    const validConfig = config;

    (async () => {
      try {
        const { db } = await initializeFirebase(validConfig);
        if (cancelled) {
          return;
        }
        unsubscribers.push(
          subscribeToCollection<Account>(db, COLLECTIONS.accounts, setAccounts),
          subscribeToCollection<Expense>(db, COLLECTIONS.expenses, setExpenses),
          subscribeToCollection<Transfer>(db, COLLECTIONS.transfers, setTransfers),
          subscribeToCollection<DocumentMetadata>(db, COLLECTIONS.documents, setDocuments),
          subscribeToCollection<TimelineEntry>(db, COLLECTIONS.timeline, setTimeline)
        );
      } catch (error) {
        console.error('Erro ao sincronizar com o Firestore', error);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [settings.firebaseConfig, setAccounts, setExpenses, setTransfers, setDocuments, setTimeline]);
}
