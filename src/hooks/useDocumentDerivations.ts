import { useEffect, useRef } from 'react';
import { useAppState } from '../state/AppStateContext';
import { validateFirebaseConfig } from '../services/firebase';
import { processDocumentForDerivedEntities } from '../services/documentAutomation';

export function useDocumentDerivations(): void {
  const documents = useAppState((state) => state.documents);
  const accounts = useAppState((state) => state.accounts);
  const expenses = useAppState((state) => state.expenses);
  const timelineEntries = useAppState((state) => state.timeline);
  const addAccount = useAppState((state) => state.addAccount);
  const addExpense = useAppState((state) => state.addExpense);
  const addTimelineEntry = useAppState((state) => state.addTimelineEntry);
  const settings = useAppState((state) => state.settings);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    const config = settings.firebaseConfig;
    if (!config || !validateFirebaseConfig(config)) {
      return;
    }
    if (documents.length === 0) {
      return;
    }
    if (isProcessingRef.current) {
      return;
    }

    isProcessingRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        let accountsSnapshot = accounts;
        let expensesSnapshot = expenses;
        let timelineSnapshot = timelineEntries;

        for (const document of documents) {
          const result = await processDocumentForDerivedEntities(
            {
              document,
              accounts: accountsSnapshot,
              expenses: expensesSnapshot,
              timelineEntries: timelineSnapshot,
              firebaseConfig: config
            },
            {
              onAccountUpsert: (account) => {
                if (!cancelled) {
                  addAccount(account);
                }
              },
              onExpenseUpsert: (expense) => {
                if (!cancelled) {
                  addExpense(expense);
                }
              },
              onTimelineUpsert: (entry) => {
                if (!cancelled) {
                  addTimelineEntry(entry);
                }
              }
            }
          );

          accountsSnapshot = result.accounts;
          expensesSnapshot = result.expenses;
          timelineSnapshot = result.timelineEntries;
        }
      } catch (error) {
        console.error('Falha ao derivar despesas ou timeline a partir de documentos.', error);
      } finally {
        isProcessingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accounts, addAccount, addExpense, addTimelineEntry, documents, expenses, settings.firebaseConfig, timelineEntries]);
}
