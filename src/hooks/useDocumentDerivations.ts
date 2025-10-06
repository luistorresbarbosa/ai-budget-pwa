import { useEffect, useRef } from 'react';
import { useAppState } from '../state/AppStateContext';
import { validateFirebaseConfig } from '../services/firebase';
import { persistExpense } from '../services/expenses';
import { persistTimelineEntry } from '../services/timeline';
import {
  deriveExpenseFromDocument,
  deriveTimelineEntryFromExpense
} from '../services/expenseDerivation';
import type { Expense, TimelineEntry } from '../data/models';

function expenseHasChanged(existingExpense: Expense, nextExpense: Expense): boolean {
  return (
    existingExpense.accountId !== nextExpense.accountId ||
    existingExpense.description !== nextExpense.description ||
    existingExpense.category !== nextExpense.category ||
    existingExpense.amount !== nextExpense.amount ||
    existingExpense.currency !== nextExpense.currency ||
    existingExpense.dueDate !== nextExpense.dueDate ||
    existingExpense.recurrence !== nextExpense.recurrence ||
    existingExpense.fixed !== nextExpense.fixed ||
    existingExpense.status !== nextExpense.status
  );
}

function timelineEntryHasChanged(existingEntry: TimelineEntry, nextEntry: TimelineEntry): boolean {
  return (
    existingEntry.date !== nextEntry.date ||
    existingEntry.description !== nextEntry.description ||
    existingEntry.amount !== nextEntry.amount ||
    existingEntry.currency !== nextEntry.currency ||
    existingEntry.linkedExpenseId !== nextEntry.linkedExpenseId
  );
}

export function useDocumentDerivations(): void {
  const documents = useAppState((state) => state.documents);
  const accounts = useAppState((state) => state.accounts);
  const expenses = useAppState((state) => state.expenses);
  const timelineEntries = useAppState((state) => state.timeline);
  const addExpense = useAppState((state) => state.addExpense);
  const addTimelineEntry = useAppState((state) => state.addTimelineEntry);
  const settings = useAppState((state) => state.settings);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    const config = settings.firebaseConfig;
    if (!config || !validateFirebaseConfig(config)) {
      return;
    }
    if (documents.length === 0 || accounts.length === 0) {
      return;
    }
    if (isProcessingRef.current) {
      return;
    }

    isProcessingRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        for (const document of documents) {
          const existingExpense = expenses.find(
            (expense) => expense.documentId === document.id || expense.id === `doc-exp-${document.id}`
          );
          const derivedExpense = deriveExpenseFromDocument(document, accounts, existingExpense ?? undefined);

          if (derivedExpense && (!existingExpense || expenseHasChanged(existingExpense, derivedExpense))) {
            await persistExpense(derivedExpense, config);
            if (!cancelled) {
              addExpense(derivedExpense);
            }
          }

          if (!derivedExpense) {
            continue;
          }

          const existingTimelineEntry = timelineEntries.find(
            (entry) =>
              entry.linkedExpenseId === derivedExpense.id ||
              entry.id === `doc-timeline-${document.id}`
          );
          const derivedTimelineEntry = deriveTimelineEntryFromExpense(
            derivedExpense,
            existingTimelineEntry ?? undefined
          );

          if (
            derivedTimelineEntry &&
            (!existingTimelineEntry || timelineEntryHasChanged(existingTimelineEntry, derivedTimelineEntry))
          ) {
            await persistTimelineEntry(derivedTimelineEntry, config);
            if (!cancelled) {
              addTimelineEntry(derivedTimelineEntry);
            }
          }
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
  }, [accounts, addExpense, addTimelineEntry, documents, expenses, settings.firebaseConfig, timelineEntries]);
}
