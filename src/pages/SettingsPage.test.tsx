import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from './SettingsPage';
import { AppStateProvider } from '../state/AppStateContext';
import type { AppSettings } from '../data/models';
import { DEFAULT_INTEGRATION_LOGS_PAGE_SIZE_SETTING } from '../data/models';
import * as integrationLogger from '../services/integrationLogger';

const baseTimestamp = 1_700_000_000_000;

const sampleLogsState = {
  openai: Array.from({ length: 4 }, (_, index) => ({
    timestamp: baseTimestamp + index * 1_000,
    message: `OpenAI evento ${index + 1}`
  })),
  firebase: Array.from({ length: 4 }, (_, index) => ({
    timestamp: baseTimestamp + index * 1_000 + 500,
    message: `Firebase evento ${index + 1}`
  }))
};

const cloneLogsState = () => ({
  openai: sampleLogsState.openai.map((entry) => ({ ...entry })),
  firebase: sampleLogsState.firebase.map((entry) => ({ ...entry }))
});

function renderSettingsPage(settings?: Partial<AppSettings>) {
  const baseSettings: AppSettings = {
    autoDetectFixedExpenses: true,
    integrationLogsPageSize: DEFAULT_INTEGRATION_LOGS_PAGE_SIZE_SETTING,
    ...settings
  };

  return render(
    <AppStateProvider initialState={{ settings: baseSettings }}>
      <SettingsPage />
    </AppStateProvider>
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    window.localStorage?.clear();
    vi.restoreAllMocks();
    vi.spyOn(integrationLogger, 'getIntegrationLogs').mockImplementation(() => cloneLogsState());
    vi
      .spyOn(integrationLogger, 'subscribeToIntegrationLogs')
      .mockImplementation((listener: (state: typeof sampleLogsState) => void) => {
        listener(cloneLogsState());
        return () => {};
      });
    vi.spyOn(integrationLogger, 'logFirebaseEvent').mockImplementation(() => ({
      timestamp: Date.now(),
      message: 'mock'
    }));
    vi.spyOn(integrationLogger, 'logOpenAIEvent').mockImplementation(() => ({
      timestamp: Date.now(),
      message: 'mock'
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it('renderiza inputs para configurar integrações da OpenAI e do Firebase', () => {
    renderSettingsPage();

    expect(screen.getByLabelText('Chave API OpenAI')).toBeInTheDocument();
    expect(screen.getByLabelText('Endpoint (opcional)')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Modelo/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Configuração Firebase (JSON)')).toBeInTheDocument();
  });

  it('apresenta o resumo dos logs apenas com a opção de exportação', async () => {
    renderSettingsPage();

    expect(await screen.findByRole('button', { name: /Exportar logs/ })).toBeInTheDocument();
    expect(screen.getByText(/Total de 8 eventos/i)).toBeInTheDocument();
    expect(screen.queryByText(/Sem eventos registados/i)).not.toBeInTheDocument();
  });

  it('exibe botões para remoção rápida das entidades', () => {
    renderSettingsPage();

    expect(screen.getByRole('button', { name: /Remover contas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remover fornecedores/i })).toBeInTheDocument();
  });
});
