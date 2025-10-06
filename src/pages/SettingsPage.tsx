import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppState } from '../state/AppStateContext';
import {
  initializeFirebase,
  looksLikeServiceAccountConfig,
  resetFirebase,
  validateFirebaseConfig
} from '../services/firebase';
import {
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_MODEL,
  validateOpenAIConnection
} from '../services/openai';
import {
  loadIntegrationLogs,
  persistIntegrationLogs
} from '../state/integrationLogsPersistence';
import type { IntegrationLogEntry, IntegrationLogSource } from '../types/integrationLogs';
import { MAX_INTEGRATION_LOGS } from '../types/integrationLogs';
import { persistAllIntegrationLogsToFirebase, persistIntegrationLogToFirebase } from '../services/integrationLogs';

const LOG_SLICE_SIZE = Math.max(MAX_INTEGRATION_LOGS - 1, 0);

function appendLogEntry(logs: IntegrationLogEntry[], entry: IntegrationLogEntry): IntegrationLogEntry[] {
  if (MAX_INTEGRATION_LOGS <= 0) {
    return logs;
  }
  if (LOG_SLICE_SIZE <= 0) {
    return [entry];
  }
  return [...logs.slice(-LOG_SLICE_SIZE), entry];
}

function SettingsPage() {
  const settings = useAppState((state) => state.settings);
  const updateSettings = useAppState((state) => state.updateSettings);
  const [apiKey, setApiKey] = useState(settings.openAIApiKey ?? '');
  const [openAIBaseUrl, setOpenAIBaseUrl] = useState(settings.openAIBaseUrl ?? DEFAULT_OPENAI_BASE_URL);
  const [openAIModel, setOpenAIModel] = useState(settings.openAIModel ?? DEFAULT_OPENAI_MODEL);
  const [autoDetect, setAutoDetect] = useState(settings.autoDetectFixedExpenses);
  const [firebaseConfig, setFirebaseConfig] = useState(
    settings.firebaseConfig ? JSON.stringify(settings.firebaseConfig, null, 2) : ''
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [testFeedback, setTestFeedback] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const storedLogs = useMemo(() => loadIntegrationLogs(), []);
  const [openAILogs, setOpenAILogs] = useState<IntegrationLogEntry[]>(storedLogs.openai);
  const [firebaseLogs, setFirebaseLogs] = useState<IntegrationLogEntry[]>(storedLogs.firebase);
  const firebaseConfigFromSettings = settings.firebaseConfig;
  const openAILogsRef = useRef(openAILogs);
  const firebaseLogsRef = useRef(firebaseLogs);
  const hasSyncedLogsWithFirebase = useRef(false);
  const lastSyncedFirebaseConfig = useRef<string | null>(null);

  useEffect(() => {
    openAILogsRef.current = openAILogs;
  }, [openAILogs]);

  useEffect(() => {
    firebaseLogsRef.current = firebaseLogs;
  }, [firebaseLogs]);

  useEffect(() => {
    persistIntegrationLogs({ openai: openAILogs, firebase: firebaseLogs });
  }, [openAILogs, firebaseLogs]);

  useEffect(() => {
    if (!firebaseConfigFromSettings || !validateFirebaseConfig(firebaseConfigFromSettings)) {
      hasSyncedLogsWithFirebase.current = false;
      lastSyncedFirebaseConfig.current = null;
      return;
    }
    const serialisedConfig = JSON.stringify(firebaseConfigFromSettings);
    if (lastSyncedFirebaseConfig.current !== serialisedConfig) {
      hasSyncedLogsWithFirebase.current = false;
    }
    if (hasSyncedLogsWithFirebase.current) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await persistAllIntegrationLogsToFirebase(firebaseConfigFromSettings, {
          openai: openAILogsRef.current,
          firebase: firebaseLogsRef.current
        });
        if (!cancelled) {
          hasSyncedLogsWithFirebase.current = true;
          lastSyncedFirebaseConfig.current = serialisedConfig;
        }
      } catch (error) {
        console.error('Não foi possível sincronizar logs existentes com o Firebase.', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [firebaseConfigFromSettings]);

  const persistLogRemotely = useCallback(
    async (source: IntegrationLogSource, entry: IntegrationLogEntry) => {
      if (!firebaseConfigFromSettings || !validateFirebaseConfig(firebaseConfigFromSettings)) {
        return;
      }
      try {
        await persistIntegrationLogToFirebase(firebaseConfigFromSettings, source, entry);
      } catch (error) {
        console.error('Não foi possível guardar o log no Firebase.', error);
      }
    },
    [firebaseConfigFromSettings]
  );

  const pushOpenAILog = useCallback(
    (message: string) => {
      const entry: IntegrationLogEntry = { timestamp: Date.now(), message };
      setOpenAILogs((logs) => appendLogEntry(logs, entry));
      void persistLogRemotely('openai', entry);
    },
    [persistLogRemotely]
  );

  const pushFirebaseLog = useCallback(
    (message: string) => {
      const entry: IntegrationLogEntry = { timestamp: Date.now(), message };
      setFirebaseLogs((logs) => appendLogEntry(logs, entry));
      void persistLogRemotely('firebase', entry);
    },
    [persistLogRemotely]
  );

  const formatLogTimestamp = useMemo(
    () =>
      new Intl.DateTimeFormat('pt-PT', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
    []
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const normalizedConfig = firebaseConfig.trim();
      const parsed = normalizedConfig
        ? (JSON.parse(normalizedConfig) as Record<string, unknown>)
        : undefined;
      if (parsed && looksLikeServiceAccountConfig(parsed)) {
        pushFirebaseLog('Configuração detectada como Service Account — requer configuração Web do Firebase.');
        setFeedback(
          'O JSON fornecido parece ser uma credencial de Service Account. Obtenha a configuração Web do Firebase (apiKey, authDomain, projectId, …) na consola do Firebase.'
        );
        return;
      }
      if (parsed && !validateFirebaseConfig(parsed)) {
        pushFirebaseLog('Configuração Firebase incompleta: campos obrigatórios em falta.');
        setFeedback('Configuração Firebase incompleta.');
        return;
      }
      let firebaseSettings: typeof settings.firebaseConfig;
      if (firebaseConfig.trim()) {
        pushFirebaseLog('A validar configuração Firebase fornecida…');
      }
      if (parsed && validateFirebaseConfig(parsed)) {
        firebaseSettings = parsed;
        await initializeFirebase(firebaseSettings);
        pushFirebaseLog('Ligação ao Firebase inicializada com sucesso.');
      } else {
        firebaseSettings = undefined;
        await resetFirebase();
        if (parsed) {
          pushFirebaseLog('Configuração Firebase inválida: faltam campos obrigatórios.');
        } else {
          pushFirebaseLog('Configuração Firebase removida.');
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
        firebaseConfig: firebaseSettings
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
        pushFirebaseLog('JSON inválido fornecido. Falha ao analisar a configuração do Firebase.');
        return;
      }
      const message = error instanceof Error ? error.message : 'Motivo desconhecido';
      setFeedback(`Não foi possível guardar as definições: ${message}`);
      pushFirebaseLog(`Erro ao guardar as definições: ${message}`);
    }
  }

  async function handleTestOpenAI() {
    if (!apiKey) {
      setTestFeedback('Insira uma chave da OpenAI antes de testar a ligação.');
      pushOpenAILog('Teste cancelado: chave da OpenAI em falta.');
      return;
    }

    setIsTesting(true);
    setTestFeedback('A validar ligação à OpenAI…');
    pushOpenAILog('A validar ligação à OpenAI…');
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
        setTestFeedback(messageParts.join(' '));
        pushOpenAILog(`Ligação validada com sucesso. Modelo: ${result.model}.`);
      } else {
        setTestFeedback(result.message);
        pushOpenAILog(`Falha na validação da ligação: ${result.message}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido ao contactar a OpenAI.';
      setTestFeedback(`Falha ao validar ligação: ${message}`);
      pushOpenAILog(`Erro ao contactar a OpenAI: ${message}`);
    } finally {
      setIsTesting(false);
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
              <input
                type="text"
                placeholder={DEFAULT_OPENAI_MODEL}
                value={openAIModel}
                onChange={(event) => setOpenAIModel(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-slate-900/10"
              />
            </label>
            <button
              type="button"
              onClick={handleTestOpenAI}
              disabled={isTesting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 md:w-auto"
            >
              {isTesting ? 'A validar…' : 'Testar ligação OpenAI'}
            </button>
            <AnimatePresence>
              {testFeedback && (
                <motion.p
                  key={testFeedback}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-sm"
                >
                  {testFeedback}
                </motion.p>
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
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Logs de ligação</p>
          <h2 className="text-lg font-semibold text-slate-900">Estado das integrações</h2>
          <p className="text-sm text-slate-500">Acompanhe o histórico recente de eventos das integrações com a OpenAI e o Firebase.</p>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">OpenAI</p>
              <span className="text-[10px] uppercase tracking-wide text-slate-400">Últimos {openAILogs.length} eventos</span>
            </div>
            <ul className="space-y-2 text-sm text-slate-600">
              {openAILogs.length === 0 ? (
                <li className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-400 shadow-sm">
                  Sem eventos registados.
                </li>
              ) : (
                openAILogs
                  .slice()
                  .reverse()
                  .map((entry) => (
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
          </div>
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Firebase</p>
              <span className="text-[10px] uppercase tracking-wide text-slate-400">Últimos {firebaseLogs.length} eventos</span>
            </div>
            <ul className="space-y-2 text-sm text-slate-600">
              {firebaseLogs.length === 0 ? (
                <li className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-400 shadow-sm">
                  Sem eventos registados.
                </li>
              ) : (
                firebaseLogs
                  .slice()
                  .reverse()
                  .map((entry) => (
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
          </div>
        </div>
      </motion.section>
    </motion.section>
  );
}

export default SettingsPage;
