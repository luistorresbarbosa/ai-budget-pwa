import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { AppStateProvider, createAppStore, useAppState } from './AppStateContext';

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
