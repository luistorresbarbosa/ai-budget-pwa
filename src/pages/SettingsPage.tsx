import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
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
  validateOpenAIConnection
} from '../services/openai';
import {
  getIntegrationLogs,
  logFirebaseEvent,
  logOpenAIEvent,
  subscribeToIntegrationLogs
} from '../services/integrationLogger';
import type { IntegrationLogsState } from '../types/integrationLogs';

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
  const [openAITestFeedback, setOpenAITestFeedback] = useState<string | null>(null);
  const [firebaseTestFeedback, setFirebaseTestFeedback] = useState<string | null>(null);
  const [isTestingOpenAI, setIsTestingOpenAI] = useState(false);
  const [isTestingFirebase, setIsTestingFirebase] = useState(false);
  const [logsState, setLogsState] = useState<IntegrationLogsState>(() => getIntegrationLogs());
  const openAILogs = logsState.openai;
  const firebaseLogs = logsState.firebase;
  useEffect(() => {
    return subscribeToIntegrationLogs((state) => {
      setLogsState(state);
    });
  }, []);

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
        setOpenAITestFeedback(messageParts.join(' '));
        logOpenAIEvent(`Ligação validada com sucesso. Modelo: ${result.model}.`);
      } else {
        setOpenAITestFeedback(result.message);
        logOpenAIEvent(`Falha na validação da ligação: ${result.message}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido ao contactar a OpenAI.';
      setOpenAITestFeedback(`Falha ao validar ligação: ${message}`);
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
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Logs de ligação</p>
            <h2 className="text-lg font-semibold text-slate-900">Estado das integrações</h2>
            <p className="text-sm text-slate-500">Acompanhe o histórico recente de eventos das integrações com a OpenAI e o Firebase.</p>
          </div>
          <button
            type="button"
            onClick={handleExportLogs}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-600 shadow-sm transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Exportar logs (.txt)
          </button>
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
