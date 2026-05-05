"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Account, AppData, Expense } from "./types";

const STORAGE_KEY = "simple-expenses:v1";
const CURRENT_VERSION = 1;

const emptyData: AppData = {
  accounts: [],
  expenses: [],
  version: CURRENT_VERSION,
};

const listeners = new Set<() => void>();
let cache: AppData | null = null;

function readFromStorage(): AppData {
  if (typeof window === "undefined") return emptyData;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      version: parsed.version ?? CURRENT_VERSION,
    };
  } catch {
    return emptyData;
  }
}

function writeToStorage(data: AppData) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getSnapshot(): AppData {
  if (cache === null) cache = readFromStorage();
  return cache;
}

function getServerSnapshot(): AppData {
  return emptyData;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cache = readFromStorage();
      listeners.forEach((l) => l());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function update(mutator: (current: AppData) => AppData) {
  const next = mutator(cache ?? readFromStorage());
  cache = next;
  writeToStorage(next);
  listeners.forEach((l) => l());
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useHydratedData(): { data: AppData; hydrated: boolean } {
  const data = useAppData();
  const hydrated = useIsHydrated();
  return { data, hydrated };
}

function useIsHydrated(): boolean {
  const subscribeHydrate = (cb: () => void) => {
    cb();
    return () => {};
  };
  const snap = useSyncExternalStore(
    subscribeHydrate,
    () => true,
    () => false,
  );
  return snap;
}

export const accountActions = {
  add(input: Omit<Account, "id" | "createdAt">): Account {
    const account: Account = {
      ...input,
      id: uid(),
      createdAt: new Date().toISOString(),
    };
    update((d) => ({ ...d, accounts: [...d.accounts, account] }));
    return account;
  },
  update(id: string, patch: Partial<Omit<Account, "id" | "createdAt">>) {
    update((d) => ({
      ...d,
      accounts: d.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  },
  remove(id: string) {
    update((d) => ({
      ...d,
      accounts: d.accounts.filter((a) => a.id !== id),
      expenses: d.expenses.filter((e) => e.accountId !== id),
    }));
  },
};

export const expenseActions = {
  add(input: Omit<Expense, "id" | "createdAt">): Expense {
    const expense: Expense = {
      ...input,
      id: uid(),
      createdAt: new Date().toISOString(),
    };
    update((d) => ({ ...d, expenses: [...d.expenses, expense] }));
    return expense;
  },
  update(id: string, patch: Partial<Omit<Expense, "id" | "createdAt">>) {
    update((d) => ({
      ...d,
      expenses: d.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  },
  remove(id: string) {
    update((d) => ({
      ...d,
      expenses: d.expenses.filter((e) => e.id !== id),
    }));
  },
};

export function exportData(): string {
  return JSON.stringify(getSnapshot(), null, 2);
}

export function importData(json: string) {
  const parsed = JSON.parse(json) as AppData;
  update(() => ({
    accounts: parsed.accounts ?? [],
    expenses: parsed.expenses ?? [],
    version: CURRENT_VERSION,
  }));
}

export function resetData() {
  update(() => ({ ...emptyData }));
}

export function useEnsureHydrated() {
  useEffect(() => {
    cache = readFromStorage();
    listeners.forEach((l) => l());
  }, []);
}
