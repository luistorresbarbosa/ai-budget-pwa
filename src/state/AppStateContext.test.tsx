import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { AppStateProvider, createAppStore, useAppState } from './AppStateContext';
import { SETTINGS_STORAGE_KEY } from './settingsPersistence';

beforeEach(() => {
  if (typeof window !== 'undefined') {
    window.localStorage.clear();
  }
});

describe('AppState store', () => {
  it('permite actualizar as definições', () => {
    const store = createAppStore();
    const { result } = renderHook(() => useAppState((state) => state), {
      wrapper: ({ children }) => <AppStateProvider store={store}>{children}</AppStateProvider>
    });

    act(() => {
      result.current.updateSettings({ autoDetectFixedExpenses: false });
    });

    expect(result.current.settings.autoDetectFixedExpenses).toBe(false);

    const persisted = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    expect(persisted).toBeTruthy();
    expect(JSON.parse(persisted ?? '{}').autoDetectFixedExpenses).toBe(false);
  });

  it('carrega definições persistidas do localStorage', () => {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ autoDetectFixedExpenses: false, firebaseConfig: { apiKey: 'a', authDomain: 'b', projectId: 'c' } })
    );

    const store = createAppStore();
    const { result } = renderHook(() => useAppState((state) => state), {
      wrapper: ({ children }) => <AppStateProvider store={store}>{children}</AppStateProvider>
    });

    expect(result.current.settings.autoDetectFixedExpenses).toBe(false);
    expect(result.current.settings.firebaseConfig).toEqual({
      apiKey: 'a',
      authDomain: 'b',
      projectId: 'c'
    });
  });

  it('migra definições antigas com chaves legacy', () => {
    const legacyPayload = {
      openaiApiKey: 'sk-legacy',
      openaiBaseUrl: 'https://legacy.openai.test/v1',
      openaiModel: 'gpt-3.5-turbo',
      autoDetectRecurringExpenses: false,
      logsPerPage: '15',
      firebaseConfigJson: JSON.stringify({ apiKey: 'legacy', authDomain: 'legacy.firebaseapp.com', projectId: 'legacy-project' })
    };

    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(legacyPayload));

    const store = createAppStore();
    const { result } = renderHook(() => useAppState((state) => state), {
      wrapper: ({ children }) => <AppStateProvider store={store}>{children}</AppStateProvider>
    });

    expect(result.current.settings.openAIApiKey).toBe('sk-legacy');
    expect(result.current.settings.openAIBaseUrl).toBe('https://legacy.openai.test/v1');
    expect(result.current.settings.openAIModel).toBe('gpt-3.5-turbo');
    expect(result.current.settings.autoDetectFixedExpenses).toBe(false);
    expect(result.current.settings.integrationLogsPageSize).toBe(15);
    expect(result.current.settings.firebaseConfig).toEqual({
      apiKey: 'legacy',
      authDomain: 'legacy.firebaseapp.com',
      projectId: 'legacy-project'
    });
  });

  it('substitui coleções através dos setters', () => {
    const store = createAppStore();
    const { result } = renderHook(() => useAppState((state) => state), {
      wrapper: ({ children }) => <AppStateProvider store={store}>{children}</AppStateProvider>
    });

    const customAccounts = [
      {
        id: 'acc-1',
        name: 'Conta Teste',
        type: 'corrente',
        balance: 100,
        currency: 'EUR'
      }
    ] as typeof result.current.accounts;

    act(() => {
      result.current.setAccounts(customAccounts);
    });

    expect(result.current.accounts).toEqual(customAccounts);
  });
});
