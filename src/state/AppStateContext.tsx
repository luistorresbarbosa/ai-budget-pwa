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
import {
  mockAccounts,
  mockDocuments,
  mockExpenses,
  mockTimeline,
  mockTransfers
} from '../data/mockData';

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
  setAccounts: (accounts: Account[]) => void;
  setExpenses: (expenses: Expense[]) => void;
  setTransfers: (transfers: Transfer[]) => void;
  setDocuments: (documents: DocumentMetadata[]) => void;
  setTimeline: (timeline: TimelineEntry[]) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
}

export const createAppStore = (initialState?: Partial<AppState>) =>
  createStore<AppState>((set) => ({
    accounts: initialState?.accounts ?? mockAccounts,
    expenses: initialState?.expenses ?? mockExpenses,
    transfers: initialState?.transfers ?? mockTransfers,
    documents: initialState?.documents ?? mockDocuments,
    timeline: initialState?.timeline ?? mockTimeline,
    settings:
      initialState?.settings ??
      ({
        autoDetectFixedExpenses: true
      } satisfies AppSettings),
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
    setAccounts: (accounts) => set(() => ({ accounts })),
    setExpenses: (expenses) => set(() => ({ expenses })),
    setTransfers: (transfers) => set(() => ({ transfers })),
    setDocuments: (documents) => set(() => ({ documents })),
    setTimeline: (timeline) => set(() => ({ timeline })),
    updateSettings: (settings) =>
      set((state) => ({
        settings: { ...state.settings, ...settings }
      }))
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
