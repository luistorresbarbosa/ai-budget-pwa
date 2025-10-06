export type IntegrationLogSource = 'openai' | 'firebase';

export interface IntegrationLogEntry {
  timestamp: number;
  message: string;
}

export interface IntegrationLogsState {
  openai: IntegrationLogEntry[];
  firebase: IntegrationLogEntry[];
}

export const MAX_INTEGRATION_LOGS = 20;
