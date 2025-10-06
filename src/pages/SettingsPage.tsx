import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppState } from '../state/AppStateContext';
import {
  initializeFirebase,
  looksLikeServiceAccountConfig,
  resetFirebase,
  validateFirebaseConfig
} from '../services/firebase';
import type { FirebaseConfig } from '../services/firebase';
import {
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_MODEL,
  listOpenAIModels,
  validateOpenAIConnection
} from '../services/openai';
import {
  getIntegrationLogs,
  logFirebaseEvent,
  logOpenAIEvent,
  subscribeToIntegrationLogs
} from '../services/integrationLogger';
import type { IntegrationLogsState } from '../types/integrationLogs';
import {
  DEFAULT_INTEGRATION_LOGS_PAGE_SIZE,
  MAX_INTEGRATION_LOGS
} from '../types/integrationLogs';

const MIN_INTEGRATION_LOGS_PAGE_SIZE = 1;

function normaliseLogsPerPage(value?: number | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_INTEGRATION_LOGS_PAGE_SIZE;
  }
  const rounded = Math.floor(value);
  if (rounded < MIN_INTEGRATION_LOGS_PAGE_SIZE) {
    return DEFAULT_INTEGRATION_LOGS_PAGE_SIZE;
  }
  if (rounded > MAX_INTEGRATION_LOGS) {
    return MAX_INTEGRATION_LOGS;
  }
  return rounded;
}

interface PaginatedLogsResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  hasMultiplePages: boolean;
}

function paginateLogs<T>(
  items: readonly T[],
  requestedPageSize: number,
  requestedPage: number
): PaginatedLogsResult<T> {
  const totalItems = items.length;
  const pageSize = normaliseLogsPerPage(requestedPageSize);
  const totalPages = totalItems === 0 ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(Math.floor(requestedPage) || 1, 1), totalPages);
  const startIndex = totalItems === 0 ? 0 : (safePage - 1) * pageSize;
  const endIndex = totalItems === 0 ? 0 : Math.min(startIndex + pageSize, totalItems);
  const pageItems = items.slice(startIndex, endIndex);

  return {
    items: pageItems,
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
    rangeStart: totalItems === 0 ? 0 : startIndex + 1,
    rangeEnd: totalItems === 0 ? 0 : startIndex + pageItems.length,
    hasMultiplePages: totalItems > pageSize
  };
}

function SettingsPage() {
  const settings = useAppState((state) => state.settings);
  const updateSettings = useAppState((state) => state.updateSettings);
  const [apiKey, setApiKey] = useState(settings.openAIApiKey ?? '');
  const [openAIBaseUrl, setOpenAIBaseUrl] = useState(settings.openAIBaseUrl ?? DEFAULT_OPENAI_BASE_URL);
  const [openAIModel, setOpenAIModel] = useState(settings.openAIModel ?? DEFAULT_OPENAI_MODEL);
  const [availableOpenAIModels, setAvailableOpenAIModels] = useState<OpenAIModelSummary[]>([]);
  const [isLoadingOpenAIModels, setIsLoadingOpenAIModels] = useState(false);
  const [openAIModelsError, setOpenAIModelsError] = useState<string | null>(null);
  const [autoDetect, setAutoDetect] = useState(settings.autoDetectFixedExpenses);
  const [firebaseConfig, setFirebaseConfig] = useState(
    settings.firebaseConfig ? JSON.stringify(settings.firebaseConfig, null, 2) : ''
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [openAITestFeedback, setOpenAITestFeedback] = useState<string | null>(null);
  const [openAIBalance, setOpenAIBalance] = useState<OpenAIBalanceInfo | null>(null);
  const [firebaseTestFeedback, setFirebaseTestFeedback] = useState<string | null>(null);
  const [isTestingOpenAI, setIsTestingOpenAI] = useState(false);
  const [isTestingFirebase, setIsTestingFirebase] = useState(false);
  const [logsState, setLogsState] = useState<IntegrationLogsState>(() => getIntegrationLogs());
  const [logsPerPage, setLogsPerPage] = useState(() =>
    normaliseLogsPerPage(settings.integrationLogsPageSize)
  );
  const [openAILogsPage, setOpenAILogsPage] = useState(1);
  const [firebaseLogsPage, setFirebaseLogsPage] = useState(1);
  const openAILogs = logsState.openai;
  const firebaseLogs = logsState.firebase;
  const settingsFirebaseConfig = settings.firebaseConfig;
  const lastSyncedLogsSignatureRef = useRef<string | null>(null);
  const isSyncingLogsRef = useRef(false);

  useEffect(() => {
    return subscribeToIntegrationLogs((state) => {
      setLogsState(state);
    });
  }, []);

  useEffect(() => {
    setLogsPerPage(normaliseLogsPerPage(settings.integrationLogsPageSize));
  }, [settings.integrationLogsPageSize]);

  const logsPerPageOptions = useMemo(() => {
    const baseOptions = [
      5,
      10,
      15,
      20,
      DEFAULT_INTEGRATION_LOGS_PAGE_SIZE,
      MAX_INTEGRATION_LOGS,
      logsPerPage
    ];
    const filtered = baseOptions
      .map((value) => normaliseLogsPerPage(value))
      .filter((value) => value >= MIN_INTEGRATION_LOGS_PAGE_SIZE && value <= MAX_INTEGRATION_LOGS);
    const unique = Array.from(new Set(filtered));
    unique.sort((a, b) => a - b);
    return unique;
  }, [logsPerPage]);

  const logsPerPageSelectId = 'integration-logs-page-size';

  const sortedOpenAILogs = useMemo(() => openAILogs.slice().reverse(), [openAILogs]);
  const sortedFirebaseLogs = useMemo(() => firebaseLogs.slice().reverse(), [firebaseLogs]);

  const openAIPagination = useMemo(
    () => paginateLogs(sortedOpenAILogs, logsPerPage, openAILogsPage),
    [logsPerPage, openAILogsPage, sortedOpenAILogs]
  );

  const firebasePagination = useMemo(
    () => paginateLogs(sortedFirebaseLogs, logsPerPage, firebaseLogsPage),
    [firebaseLogsPage, logsPerPage, sortedFirebaseLogs]
  );

  useEffect(() => {
    if (openAILogsPage !== openAIPagination.page) {
      setOpenAILogsPage(openAIPagination.page);
    }
  }, [openAILogsPage, openAIPagination.page]);

  useEffect(() => {
    if (firebaseLogsPage !== firebasePagination.page) {
      setFirebaseLogsPage(firebasePagination.page);
    }
  }, [firebaseLogsPage, firebasePagination.page]);

  useEffect(() => {
    setOpenAILogsPage(1);
    setFirebaseLogsPage(1);
  }, [logsPerPage]);

  const {
    items: paginatedOpenAILogs,
    totalItems: openAILogsTotal,
    totalPages: openAILogsTotalPages,
    page: openAILogsCurrentPage,
    rangeStart: openAILogsRangeStart,
    rangeEnd: openAILogsRangeEnd,
    hasMultiplePages: shouldShowOpenAILogsPagination
  } = openAIPagination;

  const {
    items: paginatedFirebaseLogs,
    totalItems: firebaseLogsTotal,
    totalPages: firebaseLogsTotalPages,
    page: firebaseLogsCurrentPage,
    rangeStart: firebaseLogsRangeStart,
    rangeEnd: firebaseLogsRangeEnd,
    hasMultiplePages: shouldShowFirebaseLogsPagination
  } = firebasePagination;

  const handleOpenAIPreviousPage = useCallback(() => {
    setOpenAILogsPage((current) => {
      const clampedCurrent = Math.min(
        Math.max(current, 1),
        openAILogsTotalPages
      );
      return Math.max(1, clampedCurrent - 1);
    });
  }, [openAILogsTotalPages]);

  const handleOpenAINextPage = useCallback(() => {
    setOpenAILogsPage((current) => {
      const clampedCurrent = Math.min(
        Math.max(current, 1),
        openAILogsTotalPages
      );
      return Math.min(openAILogsTotalPages, clampedCurrent + 1);
    });
  }, [openAILogsTotalPages]);

  const handleFirebasePreviousPage = useCallback(() => {
    setFirebaseLogsPage((current) => {
      const clampedCurrent = Math.min(
        Math.max(current, 1),
        firebaseLogsTotalPages
      );
      return Math.max(1, clampedCurrent - 1);
    });
  }, [firebaseLogsTotalPages]);

  const handleFirebaseNextPage = useCallback(() => {
    setFirebaseLogsPage((current) => {
      const clampedCurrent = Math.min(
        Math.max(current, 1),
        firebaseLogsTotalPages
      );
      return Math.min(firebaseLogsTotalPages, clampedCurrent + 1);
    });
  }, [firebaseLogsTotalPages]);

  const handleLogsPerPageChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const parsedValue = Number(event.target.value);
      const nextValue = normaliseLogsPerPage(
        Number.isFinite(parsedValue) ? parsedValue : logsPerPage
      );
      setLogsPerPage(nextValue);
      setOpenAILogsPage(1);
      setFirebaseLogsPage(1);
      updateSettings({ integrationLogsPageSize: nextValue });
    },
    [logsPerPage, updateSettings]
  );

  const logsSignature = useMemo(() => JSON.stringify(logsState), [logsState]);
  const firebaseConfigSignature = useMemo(
    () => (settingsFirebaseConfig ? JSON.stringify(settingsFirebaseConfig) : null),
    [settingsFirebaseConfig]
  );

  useEffect(() => {
    if (!settingsFirebaseConfig || !validateFirebaseConfig(settingsFirebaseConfig)) {
      lastSyncedLogsSignatureRef.current = null;
      return;
    }

    const signature = `${firebaseConfigSignature ?? ''}|${logsSignature}`;
    if (lastSyncedLogsSignatureRef.current === signature || isSyncingLogsRef.current) {
      return;
    }

    isSyncingLogsRef.current = true;

    (async () => {
      try {
        const { persistAllIntegrationLogsToFirebase } = await import('../services/integrationLogs');
        await persistAllIntegrationLogsToFirebase(settingsFirebaseConfig, logsState);
        lastSyncedLogsSignatureRef.current = signature;
      } catch (error) {
        console.error('Não foi possível sincronizar logs existentes com o Firebase.', error);
      } finally {
        isSyncingLogsRef.current = false;
      }
    })();
  }, [firebaseConfigSignature, logsSignature, logsState, settingsFirebaseConfig]);

  const formatLogTimestamp = useMemo(
    () =>
      new Intl.DateTimeFormat('pt-PT', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
    []
  );

  const handleExportLogs = useCallback(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const exportLines: string[] = [];
    const formatEntry = (entry: { timestamp: number; message: string }) => {
      const timestamp = new Date(entry.timestamp).toISOString();
      return `[${timestamp}] ${entry.message}`;
    };

    exportLines.push('# Logs de integrações');
    exportLines.push('');
    exportLines.push('## OpenAI');
    if (openAILogs.length === 0) {
      exportLines.push('Sem eventos registados.');
    } else {
      exportLines.push(...openAILogs.map((entry) => formatEntry(entry)));
    }
    exportLines.push('');
    exportLines.push('## Firebase');
    if (firebaseLogs.length === 0) {
      exportLines.push('Sem eventos registados.');
    } else {
      exportLines.push(...firebaseLogs.map((entry) => formatEntry(entry)));
    }

    const blob = new Blob([exportLines.join('\n')], {
      type: 'text/plain;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `ai-budget-integration-logs-${timestamp}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [firebaseLogs, openAILogs]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const normalizedConfig = firebaseConfig.trim();
      const parsed = normalizedConfig
        ? (JSON.parse(normalizedConfig) as Record<string, unknown>)
        : undefined;
      if (parsed && looksLikeServiceAccountConfig(parsed)) {
        logFirebaseEvent('Configuração detectada como Service Account — requer configuração Web do Firebase.');
        setFeedback(
          'O JSON fornecido parece ser uma credencial de Service Account. Obtenha a configuração Web do Firebase (apiKey, authDomain, projectId, …) na consola do Firebase.'
        );
        return;
      }
      if (parsed && !validateFirebaseConfig(parsed)) {
        logFirebaseEvent('Configuração Firebase incompleta: campos obrigatórios em falta.');
        setFeedback('Configuração Firebase incompleta.');
        return;
      }
      let firebaseSettings: typeof settings.firebaseConfig;
      if (firebaseConfig.trim()) {
        logFirebaseEvent('A validar configuração Firebase fornecida…');
      }
      if (parsed && validateFirebaseConfig(parsed)) {
        firebaseSettings = parsed;
        await initializeFirebase(firebaseSettings);
        logFirebaseEvent('Ligação ao Firebase inicializada com sucesso.');
      } else {
        firebaseSettings = undefined;
        await resetFirebase();
        if (parsed) {
          logFirebaseEvent('Configuração Firebase inválida: faltam campos obrigatórios.');
        } else {
          logFirebaseEvent('Configuração Firebase removida.');
        }
      }
      const normalizedBaseUrl = openAIBaseUrl.trim();
      const normalizedModel = openAIModel.trim();

      updateSettings({
        openAIApiKey: apiKey || undefined,
        openAIBaseUrl:
          normalizedBaseUrl && normalizedBaseUrl !== DEFAULT_OPENAI_BASE_URL ? normalizedBaseUrl : undefined,
        openAIModel: normalizedModel && normalizedModel !== DEFAULT_OPENAI_MODEL ? normalizedModel : undefined,
        autoDetectFixedExpenses: autoDetect,
        firebaseConfig: firebaseSettings,
        integrationLogsPageSize: logsPerPage
      });
      setOpenAIBaseUrl(normalizedBaseUrl || DEFAULT_OPENAI_BASE_URL);
      setOpenAIModel(normalizedModel || DEFAULT_OPENAI_MODEL);
      setFirebaseConfig(firebaseSettings ? JSON.stringify(firebaseSettings, null, 2) : '');
      setFeedback(
        firebaseSettings
          ? 'Definições guardadas e ligação ao Firebase estabelecida.'
          : 'Definições guardadas. Configuração Firebase removida.'
      );
    } catch (error) {
      console.error(error);
      if (error instanceof SyntaxError) {
        setFeedback('JSON inválido. Verifique a configuração do Firebase.');
        logFirebaseEvent('JSON inválido fornecido. Falha ao analisar a configuração do Firebase.');
        return;
      }
      const message = error instanceof Error ? error.message : 'Motivo desconhecido';
      setFeedback(`Não foi possível guardar as definições: ${message}`);
      logFirebaseEvent(`Erro ao guardar as definições: ${message}`);
    }
  }

  async function handleTestOpenAI() {
    if (!apiKey) {
      setOpenAITestFeedback('Insira uma chave da OpenAI antes de testar a ligação.');
      logOpenAIEvent('Teste cancelado: chave da OpenAI em falta.');
      return;
    }

    setIsTestingOpenAI(true);
    setOpenAITestFeedback('A validar ligação à OpenAI…');
    setOpenAIBalance(null);
    logOpenAIEvent('A validar ligação à OpenAI…');
    try {
      const result = await validateOpenAIConnection(
        {
          apiKey,
          baseUrl: openAIBaseUrl,
          model: openAIModel
        },
        undefined
      );
      if (result.success) {
        const messageParts = [`Ligação válida (modelo ${result.model}).`];
        if (typeof result.latencyMs === 'number') {
          messageParts.push(`Latência aproximada: ${result.latencyMs}ms.`);
        }
        if (result.balance) {
          setOpenAIBalance(result.balance);
          const currency = (result.balance.currency || 'USD').toUpperCase();
          const formattedAvailable = (() => {
            try {
              return new Intl.NumberFormat('pt-PT', {
                style: 'currency',
                currency
              }).format(result.balance!.totalAvailable);
            } catch {
              return `${result.balance!.totalAvailable.toFixed(2)} ${currency}`;
            }
          })();
          messageParts.push(`Saldo disponível: ${formattedAvailable}.`);
        }
        setOpenAITestFeedback(messageParts.join(' '));
        logOpenAIEvent(`Ligação validada com sucesso. Modelo: ${result.model}.`);
      } else {
        setOpenAITestFeedback(result.message);
        setOpenAIBalance(null);
        logOpenAIEvent(`Falha na validação da ligação: ${result.message}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido ao contactar a OpenAI.';
      setOpenAITestFeedback(`Falha ao validar ligação: ${message}`);
      setOpenAIBalance(null);
      logOpenAIEvent(`Erro ao contactar a OpenAI: ${message}`);
    } finally {
      setIsTestingOpenAI(false);
    }
  }

  async function handleTestFirebase() {
    const trimmedConfig = firebaseConfig.trim();
    if (!trimmedConfig) {
      setFirebaseTestFeedback('Insira a configuração Firebase em JSON antes de testar a ligação.');
      logFirebaseEvent('Teste cancelado: configuração Firebase em falta.');
      return;
    }

    setIsTestingFirebase(true);
    setFirebaseTestFeedback('A validar ligação ao Firebase…');
    logFirebaseEvent('A validar ligação ao Firebase…');

    try {
      const parsedConfig = JSON.parse(trimmedConfig) as Partial<FirebaseConfig>;
      if (looksLikeServiceAccountConfig(parsedConfig)) {
        setFirebaseTestFeedback(
          'O JSON fornecido parece ser uma credencial de Service Account. Obtenha a configuração Web do Firebase (apiKey, authDomain, projectId, …) na consola do Firebase.'
        );
        logFirebaseEvent('Teste cancelado: configuração detectada como Service Account — requer configuração Web do Firebase.');
        return;
      }

      if (!validateFirebaseConfig(parsedConfig)) {
        setFirebaseTestFeedback('Configuração Firebase incompleta. Confirme se todos os campos obrigatórios estão presentes.');
        logFirebaseEvent('Teste falhou: configuração Firebase incompleta.');
        return;
      }

      const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
      await initializeFirebase(parsedConfig);
      const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const latency = Math.round(end - start);

      const successMessage = latency > 0
        ? `Ligação ao Firebase validada com sucesso. Latência aproximada: ${latency}ms.`
        : 'Ligação ao Firebase validada com sucesso.';
      setFirebaseTestFeedback(successMessage);
      logFirebaseEvent('Ligação ao Firebase validada com sucesso.');
    } catch (error) {
      if (error instanceof SyntaxError) {
        setFirebaseTestFeedback('JSON inválido. Verifique a configuração do Firebase.');
        logFirebaseEvent('Teste falhou: JSON inválido fornecido para a configuração Firebase.');
        return;
      }
      const message = error instanceof Error ? error.message : 'Erro desconhecido ao contactar o Firebase.';
      setFirebaseTestFeedback(`Falha ao validar ligação: ${message}`);
      logFirebaseEvent(`Erro ao validar a ligação Firebase: ${message}`);
    } finally {
      setIsTestingFirebase(false);
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-8"
    >
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Definições</h1>
        <p className="max-w-2xl text-sm text-slate-500 sm:text-base">
          Configure as integrações e preferências da app.
        </p>
      </header>
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35, ease: 'easeOut' }}
        className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">OpenAI</p>
            <label className="block space-y-2 text-sm text-slate-600">
              <span className="text-xs uppercase tracking-wide text-slate-400">Chave API OpenAI</span>
              <input
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-slate-900/10"
              />
            </label>
            <label className="block space-y-2 text-sm text-slate-600">
              <span className="text-xs uppercase tracking-wide text-slate-400">Endpoint (opcional)</span>
              <input
                type="url"
                placeholder={DEFAULT_OPENAI_BASE_URL}
                value={openAIBaseUrl}
                onChange={(event) => setOpenAIBaseUrl(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-slate-900/10"
              />
            </label>
            <label className="block space-y-2 text-sm text-slate-600">
              <span className="text-xs uppercase tracking-wide text-slate-400">Modelo</span>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={openAIModel}
                  onChange={(event) => setOpenAIModel(event.target.value)}
                  disabled={isLoadingOpenAIModels || (!hasOpenAIApiKey && availableOpenAIModels.length === 0)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  {openAIModelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleRefreshOpenAIModels}
                  disabled={!hasOpenAIApiKey || isLoadingOpenAIModels}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  {isLoadingOpenAIModels ? 'A carregar…' : 'Atualizar'}
                </button>
              </div>
              {!hasOpenAIApiKey && (
                <p className="text-xs text-slate-400">
                  Insira a chave da OpenAI para carregar modelos disponíveis automaticamente.
                </p>
              )}
              {openAIModelsError && (
                <p className="text-xs text-amber-600">{openAIModelsError}</p>
              )}
            </label>
            <button
              type="button"
              onClick={handleTestOpenAI}
              disabled={isTestingOpenAI}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 md:w-auto"
            >
              {isTestingOpenAI ? 'A validar…' : 'Testar ligação OpenAI'}
            </button>
            <AnimatePresence>
              {openAITestFeedback && (
                <motion.p
                  key={openAITestFeedback}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-sm"
                >
                  {openAITestFeedback}
                </motion.p>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {formattedOpenAIBalance && (
                <motion.div
                  key={`openai-balance-${formattedOpenAIBalance.available}-${formattedOpenAIBalance.used}`}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-sm"
                >
                  <p>
                    Saldo disponível: <span className="font-semibold text-slate-700">{formattedOpenAIBalance.available}</span>
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                    Limite: {formattedOpenAIBalance.granted} • Utilizado: {formattedOpenAIBalance.used}
                    {formattedOpenAIBalance.expiry
                      ? ` • Expira a ${formattedOpenAIBalance.expiry}`
                      : ''}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preferências</p>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
              <input
                type="checkbox"
                checked={autoDetect}
                onChange={(event) => setAutoDetect(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/30"
              />
              Detectar automaticamente despesas fixas
            </label>
          </div>
        </div>
        <label className="block space-y-2 text-sm text-slate-600">
          <span className="text-xs uppercase tracking-wide text-slate-400">Configuração Firebase (JSON)</span>
          <textarea
            rows={6}
            value={firebaseConfig}
            onChange={(event) => setFirebaseConfig(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-slate-900/10"
          />
        </label>
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleTestFirebase}
            disabled={isTestingFirebase}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 sm:w-auto"
          >
            {isTestingFirebase ? 'A validar…' : 'Testar ligação Firebase'}
          </button>
          <AnimatePresence>
            {firebaseTestFeedback && (
              <motion.p
                key={firebaseTestFeedback}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-sm"
              >
                {firebaseTestFeedback}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <button
          type="submit"
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 sm:w-auto sm:px-6"
        >
          Guardar
        </button>
        <AnimatePresence>
          {feedback && (
            <motion.p
              key={feedback}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 shadow-sm"
            >
              {feedback}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.form>
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.35, ease: 'easeOut' }}
        className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Logs de ligação</p>
            <h2 className="text-lg font-semibold text-slate-900">Estado das integrações</h2>
            <p className="text-sm text-slate-500">Acompanhe o histórico recente de eventos das integrações com a OpenAI e o Firebase.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
            <label
              htmlFor={logsPerPageSelectId}
              className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:flex-row sm:items-center sm:gap-3"
            >
              <span>Resultados por página</span>
              <select
                id={logsPerPageSelectId}
                value={logsPerPage}
                onChange={handleLogsPerPageChange}
                className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                {logsPerPageOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleExportLogs}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-600 shadow-sm transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              Exportar logs (.txt)
            </button>
          </div>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">OpenAI</p>
              <span className="text-[10px] uppercase tracking-wide text-slate-400">
                {openAILogsTotal === 0 ? 'Sem eventos registados' : `Total de ${openAILogsTotal} eventos`}
              </span>
            </div>
            <ul className="space-y-2 text-sm text-slate-600">
              {openAILogsTotal === 0 ? (
                <li className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-400 shadow-sm">
                  Sem eventos registados.
                </li>
              ) : (
                paginatedOpenAILogs.map((entry) => (
                  <li
                    key={`${entry.timestamp}-${entry.message}`}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                      {formatLogTimestamp.format(entry.timestamp)}
                    </span>
                    <br />
                    {entry.message}
                  </li>
                ))
              )}
            </ul>
            {openAILogsTotal > 0 && (
              <div className="flex flex-col gap-2 pt-1 text-[10px] uppercase tracking-wide text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Mostrando {openAILogsRangeStart}–{openAILogsRangeEnd} de {openAILogsTotal} (página {openAILogsCurrentPage} de {openAILogsTotalPages})
                </span>
                {shouldShowOpenAILogsPagination && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenAIPreviousPage}
                      disabled={openAILogsCurrentPage === 1}
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm transition hover:border-slate-400 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenAINextPage}
                      disabled={openAILogsCurrentPage === openAILogsTotalPages}
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm transition hover:border-slate-400 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Seguinte
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Firebase</p>
              <span className="text-[10px] uppercase tracking-wide text-slate-400">
                {firebaseLogsTotal === 0 ? 'Sem eventos registados' : `Total de ${firebaseLogsTotal} eventos`}
              </span>
            </div>
            <ul className="space-y-2 text-sm text-slate-600">
              {firebaseLogsTotal === 0 ? (
                <li className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-400 shadow-sm">
                  Sem eventos registados.
                </li>
              ) : (
                paginatedFirebaseLogs.map((entry) => (
                  <li
                    key={`${entry.timestamp}-${entry.message}`}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                      {formatLogTimestamp.format(entry.timestamp)}
                    </span>
                    <br />
                    {entry.message}
                  </li>
                ))
              )}
            </ul>
            {firebaseLogsTotal > 0 && (
              <div className="flex flex-col gap-2 pt-1 text-[10px] uppercase tracking-wide text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Mostrando {firebaseLogsRangeStart}–{firebaseLogsRangeEnd} de {firebaseLogsTotal} (página {firebaseLogsCurrentPage} de {firebaseLogsTotalPages})
                </span>
                {shouldShowFirebaseLogsPagination && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleFirebasePreviousPage}
                      disabled={firebaseLogsCurrentPage === 1}
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm transition hover:border-slate-400 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={handleFirebaseNextPage}
                      disabled={firebaseLogsCurrentPage === firebaseLogsTotalPages}
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm transition hover:border-slate-400 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Seguinte
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.section>
    </motion.section>
  );
}

export default SettingsPage;
