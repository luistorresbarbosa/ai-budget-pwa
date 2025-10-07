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
  Supplier,
  TimelineEntry,
  Transfer
} from '../data/models';
import { DEFAULT_INTEGRATION_LOGS_PAGE_SIZE_SETTING } from '../data/models';
import { loadPersistedSettings, persistSettings } from './settingsPersistence';

export interface AppState {
  accounts: Account[];
  expenses: Expense[];
  suppliers: Supplier[];
  transfers: Transfer[];
  documents: DocumentMetadata[];
  timeline: TimelineEntry[];
  settings: AppSettings;
  addAccount: (account: Account) => void;
  addDocument: (doc: DocumentMetadata) => void;
  addExpense: (expense: Expense) => void;
  addSupplier: (supplier: Supplier) => void;
  addTransfer: (transfer: Transfer) => void;
  addTimelineEntry: (entry: TimelineEntry) => void;
  removeAccount: (accountId: string) => void;
  removeDocument: (documentId: string) => void;
  removeExpense: (expenseId: string) => void;
  removeSupplier: (supplierId: string) => void;
  removeTransfer: (transferId: string) => void;
  removeTimelineEntry: (entryId: string) => void;
  setAccounts: (accounts: Account[]) => void;
  setExpenses: (expenses: Expense[]) => void;
  setSuppliers: (suppliers: Supplier[]) => void;
  setTransfers: (transfers: Transfer[]) => void;
  setDocuments: (documents: DocumentMetadata[]) => void;
  setTimeline: (timeline: TimelineEntry[]) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  autoDetectFixedExpenses: true,
  integrationLogsPageSize: DEFAULT_INTEGRATION_LOGS_PAGE_SIZE_SETTING
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
    suppliers: initialState?.suppliers ?? [],
    transfers: initialState?.transfers ?? [],
    documents: initialState?.documents ?? [],
    timeline: initialState?.timeline ?? [],
    settings: resolveInitialSettings(initialState),
    addAccount: (account) =>
      set((state) => ({
        accounts: [account, ...state.accounts.filter((existing) => existing.id !== account.id)]
      })),
    addDocument: (doc) =>
      set((state) => ({
        documents: [doc, ...state.documents.filter((existing) => existing.id !== doc.id)]
      })),
    addExpense: (expense) =>
      set((state) => ({
        expenses: [expense, ...state.expenses.filter((existing) => existing.id !== expense.id)]
      })),
    addSupplier: (supplier) =>
      set((state) => ({
        suppliers: [supplier, ...state.suppliers.filter((existing) => existing.id !== supplier.id)]
      })),
    addTransfer: (transfer) =>
      set((state) => ({
        transfers: [transfer, ...state.transfers.filter((existing) => existing.id !== transfer.id)]
      })),
    addTimelineEntry: (entry) =>
      set((state) => ({
        timeline: [entry, ...state.timeline.filter((existing) => existing.id !== entry.id)]
      })),
    removeAccount: (accountId) =>
      set((state) => ({
        accounts: state.accounts.filter((account) => account.id !== accountId)
      })),
    removeDocument: (documentId) =>
      set((state) => ({
        documents: state.documents.filter((doc) => doc.id !== documentId)
      })),
    removeExpense: (expenseId) =>
      set((state) => ({
        expenses: state.expenses.filter((expense) => expense.id !== expenseId)
      })),
    removeSupplier: (supplierId) =>
      set((state) => ({
        suppliers: state.suppliers.filter((supplier) => supplier.id !== supplierId)
      })),
    removeTransfer: (transferId) =>
      set((state) => ({
        transfers: state.transfers.filter((transfer) => transfer.id !== transferId)
      })),
    removeTimelineEntry: (entryId) =>
      set((state) => ({
        timeline: state.timeline.filter((entry) => entry.id !== entryId)
      })),
    setAccounts: (accounts) => set(() => ({ accounts })),
    setExpenses: (expenses) => set(() => ({ expenses })),
    setSuppliers: (suppliers) => set(() => ({ suppliers })),
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
