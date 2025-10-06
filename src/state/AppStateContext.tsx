import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type PropsWithChildren
} from 'react';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type {
  Account,
  AppSettings,
  DocumentMetadata,
  Expense,
  TimelineEntry,
  Transfer
} from '../data/models';
import { loadPersistedSettings, persistSettings } from './settingsPersistence';

export interface AppState {
  accounts: Account[];
  expenses: Expense[];
  transfers: Transfer[];
  documents: DocumentMetadata[];
  timeline: TimelineEntry[];
  settings: AppSettings;
  addDocument: (doc: DocumentMetadata) => void;
  addExpense: (expense: Expense) => void;
  addTransfer: (transfer: Transfer) => void;
  removeDocument: (documentId: string) => void;
  removeExpense: (expenseId: string) => void;
  removeTransfer: (transferId: string) => void;
  setAccounts: (accounts: Account[]) => void;
  setExpenses: (expenses: Expense[]) => void;
  setTransfers: (transfers: Transfer[]) => void;
  setDocuments: (documents: DocumentMetadata[]) => void;
  setTimeline: (timeline: TimelineEntry[]) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  autoDetectFixedExpenses: true
};

function resolveInitialSettings(initialState?: Partial<AppState>): AppSettings {
  const persisted = loadPersistedSettings();
  return {
    ...DEFAULT_SETTINGS,
    ...(persisted ?? {}),
    ...(initialState?.settings ?? {})
  } satisfies AppSettings;
}

export const createAppStore = (initialState?: Partial<AppState>) =>
  createStore<AppState>((set) => ({
    accounts: initialState?.accounts ?? [],
    expenses: initialState?.expenses ?? [],
    transfers: initialState?.transfers ?? [],
    documents: initialState?.documents ?? [],
    timeline: initialState?.timeline ?? [],
    settings: resolveInitialSettings(initialState),
    addDocument: (doc) =>
      set((state) => ({
        documents: [doc, ...state.documents]
      })),
    addExpense: (expense) =>
      set((state) => ({
        expenses: [expense, ...state.expenses]
      })),
    addTransfer: (transfer) =>
      set((state) => ({
        transfers: [transfer, ...state.transfers]
      })),
    removeDocument: (documentId) =>
      set((state) => ({
        documents: state.documents.filter((doc) => doc.id !== documentId)
      })),
    removeExpense: (expenseId) =>
      set((state) => ({
        expenses: state.expenses.filter((expense) => expense.id !== expenseId)
      })),
    removeTransfer: (transferId) =>
      set((state) => ({
        transfers: state.transfers.filter((transfer) => transfer.id !== transferId)
      })),
    setAccounts: (accounts) => set(() => ({ accounts })),
    setExpenses: (expenses) => set(() => ({ expenses })),
    setTransfers: (transfers) => set(() => ({ transfers })),
    setDocuments: (documents) => set(() => ({ documents })),
    setTimeline: (timeline) => set(() => ({ timeline })),
    updateSettings: (settings) =>
      set((state) => {
        const merged = { ...state.settings, ...settings } satisfies AppSettings;
        persistSettings(merged);
        return {
          settings: merged
        };
      })
  }));

const AppStateContext = createContext<StoreApi<AppState> | null>(null);

interface AppStateProviderProps extends PropsWithChildren {
  store?: StoreApi<AppState>;
  initialState?: Partial<AppState>;
}

export function AppStateProvider({ children, store, initialState }: AppStateProviderProps) {
  const storeRef = useRef<StoreApi<AppState>>();
  const value = useMemo(() => {
    if (store) {
      return store;
    }
    if (!storeRef.current) {
      storeRef.current = createAppStore(initialState);
    }
    return storeRef.current;
  }, [initialState, store]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState<T>(selector: (state: AppState) => T): T {
  const store = useContext(AppStateContext);
  if (!store) {
    throw new Error('useAppState deve ser usado dentro de AppStateProvider');
  }
  return useStore(store, selector);
}
