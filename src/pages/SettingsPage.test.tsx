import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import SettingsPage from './SettingsPage';
import { AppStateProvider } from '../state/AppStateContext';
import type { AppSettings } from '../data/models';
import { DEFAULT_INTEGRATION_LOGS_PAGE_SIZE_SETTING } from '../data/models';

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
  });

  it('renderiza inputs para configurar integrações da OpenAI e do Firebase', () => {
    renderSettingsPage();

    expect(screen.getByLabelText('Chave API OpenAI')).toBeInTheDocument();
    expect(screen.getByLabelText('Endpoint (opcional)')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Modelo/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Configuração Firebase (JSON)')).toBeInTheDocument();
  });
});
