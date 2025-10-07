import type { RecurringExpenseCandidate, StatementSettlement } from '../data/models';
import { logOpenAIEvent } from './integrationLogger';

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

export function normaliseOpenAIBaseUrl(baseUrl?: string | null): string {
  const trimmed = (baseUrl ?? '').trim();
  if (!trimmed) {
    return DEFAULT_OPENAI_BASE_URL;
  }

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch (error) {
    console.warn('Base URL OpenAI inválida fornecida, a utilizar predefinição.', error);
    return DEFAULT_OPENAI_BASE_URL;
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLocalHost = hostname === 'localhost' || hostname.endsWith('.local');
  if (!hostname || (!isLocalHost && !hostname.includes('.'))) {
    return DEFAULT_OPENAI_BASE_URL;
  }

  const isStandardOpenAIHost = hostname === 'api.openai.com';

  if (isStandardOpenAIHost && parsed.protocol !== 'https:') {
    parsed.protocol = 'https:';
  }

  const path = parsed.pathname.replace(/\/+$|^\/+/g, '');

  if (isStandardOpenAIHost) {
    if (!path) {
      parsed.pathname = '/v1';
    } else if (!path.startsWith('v1')) {
      parsed.pathname = `/v1/${path}`.replace(/\/+/g, '/');
    } else {
      parsed.pathname = `/${path}`;
    }
  } else if (!parsed.pathname) {
    parsed.pathname = '/';
  }

  parsed.hash = '';

  const output = parsed.toString().replace(/\/+$|\/$/g, '');
  return output;
}

function now(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function summariseForLog(value: unknown): string {
  if (value == null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return value.length > 280 ? `${value.slice(0, 277)}…` : value;
  }
  try {
    const serialised = JSON.stringify(
      value,
      (_key, entry) => {
        if (typeof entry === 'string' && entry.length > 120) {
          return `${entry.slice(0, 117)}…`;
        }
        return entry;
      },
      2
    );
    return serialised.length > 600 ? `${serialised.slice(0, 597)}…` : serialised;
  } catch {
    return String(value);
  }
}

function isAbortError(error: unknown): error is DOMException {
  return error instanceof DOMException && error.name === 'AbortError';
}

function mapFetchError(error: unknown, context: string): Error {
  if (isAbortError(error)) {
    return error;
  }

  const rawMessage = error instanceof Error ? error.message : String(error);
  const lowerCaseMessage = rawMessage.toLowerCase();
  const looksLikeNetworkIssue =
    error instanceof TypeError ||
    lowerCaseMessage.includes('failed to fetch') ||
    lowerCaseMessage.includes('networkerror') ||
    lowerCaseMessage.includes('load failed');

  if (looksLikeNetworkIssue) {
    return new Error(
      `Não foi possível contactar a OpenAI durante ${context}. Verifique a ligação à Internet e se o endpoint permite pedidos directamente do browser (CORS).`
    );
  }

  return new Error(rawMessage);
}

export interface OpenAIConnectionConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export interface OpenAIValidationResult {
  success: boolean;
  message: string;
  model: string;
  latencyMs?: number;
  balance?: OpenAIBalanceInfo;
  balanceError?: string;
}

export interface OpenAIModelSummary {
  id: string;
  created?: number;
  ownedBy?: string;
}

export interface OpenAIBalanceInfo {
  totalGranted: number;
  totalUsed: number;
  totalAvailable: number;
  expiresAt?: number | null;
  currency?: string;
}

export class OpenAIBalanceUnavailableError extends Error {
  public readonly reason: 'session_key_required' | 'forbidden' | 'unknown';

  constructor(message: string, reason: 'session_key_required' | 'forbidden' | 'unknown' = 'unknown') {
    super(message);
    this.name = 'OpenAIBalanceUnavailableError';
    this.reason = reason;
  }
}

export interface OpenAIDocumentExtraction {
  sourceType?: 'fatura' | 'recibo' | 'extracto';
  amount?: number;
  currency?: string;
  dueDate?: string;
  accountHint?: string;
  companyName?: string;
  expenseType?: string;
  notes?: string;
  rawResponse?: unknown;
  recurringExpenses?: RecurringExpenseCandidate[];
  supplierTaxId?: string;
  statementAccountIban?: string;
  statementSettlements?: StatementSettlement[];
}

interface ResponsesJsonSchemaFormat {
  type: 'json_schema';
  name?: string;
  schema: Record<string, unknown>;
  strict?: boolean;
}

interface ResponsesTextConfig {
  format?: ResponsesJsonSchemaFormat;
  max_output_tokens?: number;
}

interface ResponsesInputContent {
  role: 'user';
  content: Array<
    | {
        type: 'input_text';
        text: string;
      }
    | {
        type: 'input_file';
        file_id: string;
      }
  >;
}

interface ResponsesRequest {
  model: string;
  input: ResponsesInputContent[];
  text?: ResponsesTextConfig;
  reasoning?: {
    effort?: 'low' | 'medium' | 'high';
  };
  max_output_tokens?: number;
}

function resolveBaseUrl(baseUrl?: string): string {
  return normaliseOpenAIBaseUrl(baseUrl);
}

async function parseOpenAIError(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    const message =
      payload?.error?.message || payload?.message || response.statusText || 'Erro desconhecido ao comunicar com a API';
    return `${response.status}: ${message}`;
  } catch (error) {
    console.error('Erro a ler resposta de erro OpenAI', error);
    return `${response.status}: ${response.statusText || 'Erro desconhecido ao comunicar com a API'}`;
  }
}

function extractTextFromResponsePayload(payload: any): string | undefined {
  if (!payload) return undefined;

  if (Array.isArray(payload?.output)) {
    const textChunks = payload.output
      .flatMap((item: any) => item?.content ?? [])
      .filter((content: any) => content?.type === 'output_text' || content?.type === 'text' || content?.text)
      .map((content: any) => content?.text)
      .filter(Boolean);
    if (textChunks.length > 0) {
      return textChunks.join('\n');
    }
  }

  if (Array.isArray(payload?.choices)) {
    const [firstChoice] = payload.choices;
    const messageContent = firstChoice?.message?.content;
    if (typeof messageContent === 'string') {
      return messageContent;
    }
    if (Array.isArray(messageContent)) {
      const textChunks = messageContent
        .map((part: any) => part?.text ?? part?.content ?? part)
        .filter((text: any) => typeof text === 'string');
      if (textChunks.length > 0) {
        return textChunks.join('\n');
      }
    }
  }

  if (typeof payload?.content === 'string') {
    return payload.content;
  }

  return undefined;
}

function extractJsonFromResponsePayload(payload: any): unknown {
  const text = extractTextFromResponsePayload(payload);
  if (!text) return undefined;

  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn('Resposta OpenAI não é JSON válido, devolvendo texto cru.', error);
    return text;
  }
}

function normaliseAccountHint(raw: unknown): string | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  const upper = trimmed.toUpperCase();
  const alphanumeric = upper.replace(/[^A-Z0-9]/g, '');
  if (!alphanumeric) {
    return undefined;
  }

  const fullIbanPattern = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;
  if (fullIbanPattern.test(alphanumeric)) {
    return alphanumeric;
  }

  const ibanPrefixMatch = alphanumeric.match(/^([A-Z]{2}\d{2})/);
  const trailingDigitsMatch = alphanumeric.match(/(\d{4,})$/);
  if (ibanPrefixMatch && trailingDigitsMatch) {
    const tail = trailingDigitsMatch[1].slice(-8);
    return `${ibanPrefixMatch[1]}-${tail}`;
  }

  if (trailingDigitsMatch) {
    const tail = trailingDigitsMatch[1].slice(-8);
    if (alphanumeric.length > tail.length) {
      const head = alphanumeric.slice(0, Math.min(4, alphanumeric.length - tail.length));
      if (head) {
        return `${head}-${tail}`;
      }
    }
    return tail;
  }

  if (alphanumeric.length <= 12) {
    return alphanumeric;
  }

  return `${alphanumeric.slice(0, 4)}-${alphanumeric.slice(-4)}`;
}

function normaliseRecurringExpenses(raw: unknown): RecurringExpenseCandidate[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const candidates: RecurringExpenseCandidate[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const candidate = entry as Record<string, unknown>;
    const descriptionRaw = candidate.description;
    if (typeof descriptionRaw !== 'string') {
      continue;
    }

    const description = descriptionRaw.trim();
    if (!description) {
      continue;
    }

    const averageAmount = typeof candidate.averageAmount === 'number' ? candidate.averageAmount : undefined;
    const currency = typeof candidate.currency === 'string' ? candidate.currency : undefined;
    const dayOfMonth = typeof candidate.dayOfMonth === 'number' ? candidate.dayOfMonth : undefined;
    const accountHint = typeof candidate.accountHint === 'string' ? candidate.accountHint : undefined;
    const notes = typeof candidate.notes === 'string' ? candidate.notes : undefined;

    const monthsObserved = Array.isArray(candidate.monthsObserved)
      ? (candidate.monthsObserved as unknown[])
          .map((month) => (typeof month === 'string' ? month.trim() : ''))
          .filter((month): month is string => month.length > 0)
      : undefined;

    candidates.push({
      description,
      averageAmount,
      currency,
      dayOfMonth,
      accountHint,
      monthsObserved,
      notes
    });
  }

  return candidates;
}

function normaliseTaxId(raw: unknown): string | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed || undefined;
}

function normaliseStatementSettlements(raw: unknown): StatementSettlement[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const settlements: StatementSettlement[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const settlement: StatementSettlement = {
      description: typeof record.description === 'string' ? record.description.trim() || undefined : undefined,
      amount: typeof record.amount === 'number' ? record.amount : undefined,
      currency: typeof record.currency === 'string' ? record.currency : undefined,
      settledOn: typeof record.settledOn === 'string' ? record.settledOn : undefined,
      documentIdHint: typeof record.documentIdHint === 'string' ? record.documentIdHint : undefined,
      expenseIdHint: typeof record.expenseIdHint === 'string' ? record.expenseIdHint : undefined,
      supplierName: typeof record.supplierName === 'string' ? record.supplierName : undefined,
      supplierTaxId: typeof record.supplierTaxId === 'string' ? record.supplierTaxId : undefined
    };

    if (
      settlement.description ||
      settlement.amount != null ||
      settlement.documentIdHint ||
      settlement.expenseIdHint
    ) {
      settlements.push(settlement);
    }
  }

  return settlements;
}

export async function listOpenAIModels(
  config: OpenAIConnectionConfig,
  signal?: AbortSignal
): Promise<OpenAIModelSummary[]> {
  const baseUrl = resolveBaseUrl(config.baseUrl);

  logOpenAIEvent('→ GET /models');

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`
      },
      signal
    });
  } catch (error) {
    const mapped = mapFetchError(error, 'o carregamento da lista de modelos');
    if (!isAbortError(mapped)) {
      logOpenAIEvent('Falha ao obter lista de modelos da OpenAI.', {
        details: error instanceof Error ? error.message : String(error)
      });
    }
    throw mapped;
  }

  if (!response.ok) {
    const message = await parseOpenAIError(response);
    logOpenAIEvent('Erro ao obter lista de modelos da OpenAI.', {
      details: message
    });
    throw new Error(message);
  }

  const payload = await response.json();

  logOpenAIEvent('← Resposta OpenAI /models recebida.', {
    details: summariseForLog(payload)
  });

  const entries = Array.isArray(payload?.data) ? payload.data : [];
  const models: OpenAIModelSummary[] = entries
    .map((entry: any) => {
      const id = typeof entry?.id === 'string' ? entry.id : undefined;
      if (!id) {
        return undefined;
      }
      return {
        id,
        created: typeof entry?.created === 'number' ? entry.created : undefined,
        ownedBy: typeof entry?.owned_by === 'string' ? entry.owned_by : undefined
      } satisfies OpenAIModelSummary;
    })
    .filter(Boolean) as OpenAIModelSummary[];

  models.sort((a, b) => {
    if (a.id === DEFAULT_OPENAI_MODEL) {
      return -1;
    }
    if (b.id === DEFAULT_OPENAI_MODEL) {
      return 1;
    }
    return a.id.localeCompare(b.id, 'en');
  });

  return models;
}

export async function fetchOpenAIBalance(
  config: OpenAIConnectionConfig,
  signal?: AbortSignal
): Promise<OpenAIBalanceInfo> {
  const baseUrl = resolveBaseUrl(config.baseUrl);

  logOpenAIEvent('→ GET /dashboard/billing/credit_grants');

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/dashboard/billing/credit_grants`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`
      },
      signal
    });
  } catch (error) {
    const mapped = mapFetchError(error, 'a leitura do saldo disponível');
    if (!isAbortError(mapped)) {
      logOpenAIEvent('Falha ao obter saldo disponível da OpenAI.', {
        details: error instanceof Error ? error.message : String(error)
      });
    }
    throw mapped;
  }

  if (!response.ok) {
    const message = await parseOpenAIError(response);
    const normalised = message.toLowerCase();

    const requiresSessionKey = normalised.includes('session key');
    if (requiresSessionKey) {
      const humanMessage =
        'A OpenAI requer uma sessão autenticada no dashboard para consultar o saldo. Verifique o saldo diretamente na consola da OpenAI.';
      logOpenAIEvent('Saldo indisponível via API: sessão do dashboard requerida.', {
        details: message
      });
      throw new OpenAIBalanceUnavailableError(humanMessage, 'session_key_required');
    }

    if (response.status === 401 || response.status === 403) {
      const humanMessage =
        'Não foi possível consultar o saldo com a chave API fornecida. Confirme os acessos de faturação na conta da OpenAI.';
      logOpenAIEvent('Saldo indisponível via API: acesso negado.', {
        details: message
      });
      throw new OpenAIBalanceUnavailableError(humanMessage, 'forbidden');
    }

    logOpenAIEvent('Erro ao obter saldo disponível da OpenAI.', {
      details: message
    });
    throw new Error(message);
  }

  const payload = await response.json();

  logOpenAIEvent('← Resposta OpenAI /dashboard/billing/credit_grants recebida.', {
    details: summariseForLog(payload)
  });

  const totalGranted = Number(payload?.total_granted) || 0;
  const totalUsed = Number(payload?.total_used) || 0;
  const totalAvailable = Number(payload?.total_available) || 0;
  const expiresAt = typeof payload?.grants?.expires_at === 'number' ? payload.grants.expires_at : null;
  const currencyEntry = payload?.grants?.data?.find?.((grant: any) => typeof grant?.currency === 'string');
  const currency = currencyEntry?.currency ? String(currencyEntry.currency).toUpperCase() : undefined;

  return {
    totalGranted,
    totalUsed,
    totalAvailable,
    expiresAt,
    currency
  };
}

async function uploadFileToOpenAI(
  file: File,
  config: OpenAIConnectionConfig,
  signal?: AbortSignal
): Promise<{ id: string }> {
  const baseUrl = resolveBaseUrl(config.baseUrl);
  const formData = new FormData();
  formData.append('purpose', 'assistants');
  formData.append('file', file, file.name);

  logOpenAIEvent('→ POST /files', {
    details: {
      name: file.name,
      size: file.size,
      type: file.type || 'desconhecido'
    }
  });

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`
      },
      body: formData,
      signal
    });
  } catch (error) {
    const mapped = mapFetchError(error, 'o envio do ficheiro');
    if (!isAbortError(mapped)) {
      logOpenAIEvent('Falha ao enviar ficheiro para a OpenAI.', {
        details: error instanceof Error ? error.message : String(error)
      });
    }
    throw mapped;
  }

  if (!response.ok) {
    const errorMessage = await parseOpenAIError(response);
    logOpenAIEvent('Resposta de erro ao carregar ficheiro na OpenAI.', {
      details: {
        status: response.status,
        message: errorMessage
      }
    });
    throw new Error(errorMessage);
  }

  const payload = await response.json();
  if (!payload?.id) {
    logOpenAIEvent('Resposta inesperada ao carregar ficheiro na OpenAI.', {
      details: summariseForLog(payload)
    });
    throw new Error('Resposta inesperada ao carregar o ficheiro para a OpenAI.');
  }

  logOpenAIEvent('← POST /files concluído com sucesso.', {
    details: {
      id: payload.id,
      bytes: file.size
    }
  });

  return { id: payload.id };
}

async function deleteOpenAIFile(fileId: string, config: OpenAIConnectionConfig): Promise<void> {
  const baseUrl = resolveBaseUrl(config.baseUrl);
  try {
    logOpenAIEvent('→ DELETE /files', {
      details: { id: fileId }
    });
    await fetch(`${baseUrl}/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${config.apiKey}`
      }
    });
    logOpenAIEvent('← DELETE /files concluído.', {
      details: { id: fileId }
    });
  } catch (error) {
    console.warn('Não foi possível remover o ficheiro temporário da OpenAI.', error);
    logOpenAIEvent('Falha ao remover ficheiro temporário na OpenAI.', {
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

async function callOpenAIResponses(
  request: ResponsesRequest,
  config: OpenAIConnectionConfig,
  signal?: AbortSignal
): Promise<any> {
  const baseUrl = resolveBaseUrl(config.baseUrl);
  logOpenAIEvent('→ POST /responses', {
    details: {
      model: request.model,
      textPromptPreview: summariseForLog(
        request.input
          .flatMap((entry) => entry.content)
          .filter((content) => 'text' in content)
          .map((content) => (content as { text?: string }).text || '')
          .join('\n')
      ),
      hasFile: request.input.some((entry) => entry.content.some((content) => 'file_id' in content))
    }
  });

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request),
      signal
    });
  } catch (error) {
    const mapped = mapFetchError(error, 'a chamada ao endpoint /responses');
    if (!isAbortError(mapped)) {
      logOpenAIEvent('Falha ao contactar a OpenAI (endpoint /responses).', {
        details: error instanceof Error ? error.message : String(error)
      });
    }
    throw mapped;
  }

  if (!response.ok) {
    const errorMessage = await parseOpenAIError(response);
    logOpenAIEvent('Resposta de erro da OpenAI (endpoint /responses).', {
      details: {
        status: response.status,
        message: errorMessage
      }
    });
    throw new Error(errorMessage);
  }

  const payload = await response.json();
  logOpenAIEvent('← Resposta OpenAI /responses recebida.', {
    details: {
      status: response.status,
      body: summariseForLog(payload)
    }
  });

  return payload;
}

export async function validateOpenAIConnection(
  config: OpenAIConnectionConfig,
  signal?: AbortSignal
): Promise<OpenAIValidationResult> {
  const model = config.model || DEFAULT_OPENAI_MODEL;
  const started = now();
  const payload = await callOpenAIResponses(
    {
      model,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: 'Responde exactamente com a palavra "pong" para validar a ligação.'
            }
          ]
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'ping_validation',
          schema: {
            type: 'object',
            properties: {
              reply: { type: 'string', enum: ['pong'] }
            },
            required: ['reply'],
            additionalProperties: false
          }
        }
      }
    },
    config,
    signal
  );
  const finished = now();
  const latencyMs = Math.round(finished - started);

  const parsed = extractJsonFromResponsePayload(payload) as { reply?: string } | undefined;
  if (parsed && parsed.reply === 'pong') {
    let balance: OpenAIBalanceInfo | undefined;
    let balanceError: string | undefined;
    try {
      balance = await fetchOpenAIBalance(config, signal);
    } catch (error) {
      if (error instanceof OpenAIBalanceUnavailableError) {
        balanceError = error.message;
        logOpenAIEvent('Aviso: saldo indisponível após validar a ligação.', {
          details: {
            message: error.message,
            reason: error.reason
          }
        });
      } else {
        logOpenAIEvent('Aviso: não foi possível obter saldo disponível após validar a ligação.', {
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      success: true,
      message: 'Ligação validada com sucesso.',
      model,
      latencyMs,
      balance,
      balanceError
    };
  }

  return {
    success: false,
    message: 'A API respondeu mas o formato não foi o esperado.',
    model,
    latencyMs
  };
}

export interface ExtractPdfWithOpenAIOptions {
  file: File;
  config: OpenAIConnectionConfig;
  accountContext?: string;
  signal?: AbortSignal;
}

export async function extractPdfMetadataWithOpenAI({
  file,
  config,
  accountContext,
  signal
}: ExtractPdfWithOpenAIOptions): Promise<OpenAIDocumentExtraction> {
  const model = config.model || DEFAULT_OPENAI_MODEL;
  const uploaded = await uploadFileToOpenAI(file, config, signal);

  try {
    const payload = await callOpenAIResponses(
      {
        model,
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text:
                  'Analisa o PDF fornecido e devolve um JSON com os campos "sourceType", "amount", "currency", "dueDate", "accountHint", "companyName", "expenseType", "notes", "recurringExpenses", "supplierTaxId", "statementAccountIban" e "statementSettlements". ' +
                  'Identifica claramente se o documento é um extracto bancário ou uma fatura/recibo e preenche sourceType com essa informação. ' +
                  'sourceType deve ser um de: fatura, recibo ou extracto. amount deve ser número. dueDate deve estar em ISO 8601 se existir. ' +
                  'Para identificar o accountHint, dá prioridade a IBANs: procura explicitamente por campos etiquetados como "IBAN", remove espaços e devolve-o em maiúsculas. ' +
                  'Se o IBAN estiver truncado ou mascarado, inclui o prefixo disponível (por exemplo, país + dígitos de controlo) e garante que os últimos 4 a 8 dígitos visíveis são preservados para permitir a associação da conta. ' +
                  'Quando não existir IBAN, devolve outro identificador curto e estável da conta (ex.: número de conta interno), sem texto adicional. ' +
                  'Quando o documento for um extracto, deixa amount e dueDate como null, analisa os movimentos e devolve em recurringExpenses apenas as despesas fixas que se repetem em pelo menos dois meses diferentes com a mesma descrição. ' +
                  'Cada elemento de recurringExpenses deve incluir description, averageAmount (média dos valores observados), currency, dayOfMonth (dia mais provável do débito), accountHint, monthsObserved (lista de meses no formato YYYY-MM) e notes com detalhes relevantes. ' +
                  'Quando não se tratar de um extracto, devolve recurringExpenses como lista vazia. ' +
                  'Para extractos, identifica o IBAN principal da conta e devolve-o em statementAccountIban (em maiúsculas, sem espaços). ' +
                  'Lista também em statementSettlements as despesas pagas identificadas no extracto: cada item deve incluir description, amount, currency, settledOn (ISO 8601), documentIdHint (referência ao documento ou fatura se existir), expenseIdHint (identificador interno se visível), supplierName e supplierTaxId (quando disponível). ' +
                  'Se o fornecedor tiver número fiscal (NIF/VAT), devolve-o em supplierTaxId. ' +
                  (accountContext
                    ? `A conta de contexto preferencial é "${accountContext}". Considera-a ao interpretar o documento. `
                    : '') +
                  'Se um campo não existir, devolve null. companyName deve refletir a entidade emissora (empresa ou organização). expenseType deve indicar a categoria ou tipo da despesa (ex.: Luz, Água, Renda).'
              },
              {
                type: 'input_file',
                file_id: uploaded.id
              }
            ]
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'document_metadata',
            schema: {
              type: 'object',
              properties: {
                sourceType: {
                  type: ['string', 'null'],
                  enum: ['fatura', 'recibo', 'extracto', null]
                },
                amount: {
                  type: ['number', 'null']
                },
                currency: {
                  type: ['string', 'null']
                },
                dueDate: {
                  type: ['string', 'null']
                },
                accountHint: {
                  type: ['string', 'null']
                },
                companyName: {
                  type: ['string', 'null']
                },
                expenseType: {
                  type: ['string', 'null']
                },
                notes: {
                  type: ['string', 'null']
                },
                recurringExpenses: {
                  type: ['array', 'null'],
                  items: {
                    type: 'object',
                    properties: {
                      description: { type: ['string', 'null'] },
                      averageAmount: { type: ['number', 'null'] },
                      currency: { type: ['string', 'null'] },
                      dayOfMonth: { type: ['number', 'null'] },
                      accountHint: { type: ['string', 'null'] },
                      monthsObserved: {
                        type: ['array', 'null'],
                        items: { type: ['string', 'null'] }
                      },
                      notes: { type: ['string', 'null'] }
                    },
                    required: [
                      'description',
                      'averageAmount',
                      'currency',
                      'dayOfMonth',
                      'accountHint',
                      'monthsObserved',
                      'notes'
                    ],
                    additionalProperties: false
                  }
                },
                supplierTaxId: {
                  type: ['string', 'null']
                },
                statementAccountIban: {
                  type: ['string', 'null']
                },
                statementSettlements: {
                  type: ['array', 'null'],
                  items: {
                    type: 'object',
                    properties: {
                      description: { type: ['string', 'null'] },
                      amount: { type: ['number', 'null'] },
                      currency: { type: ['string', 'null'] },
                      settledOn: { type: ['string', 'null'] },
                      documentIdHint: { type: ['string', 'null'] },
                      expenseIdHint: { type: ['string', 'null'] },
                      supplierName: { type: ['string', 'null'] },
                      supplierTaxId: { type: ['string', 'null'] }
                    },
                    required: [
                      'description',
                      'amount',
                      'currency',
                      'settledOn',
                      'documentIdHint',
                      'expenseIdHint',
                      'supplierName',
                      'supplierTaxId'
                    ],
                    additionalProperties: false
                  }
                }
              },
              required: [
                'sourceType',
                'amount',
                'currency',
                'dueDate',
                'accountHint',
                'companyName',
                'expenseType',
                'notes',
                'recurringExpenses',
                'supplierTaxId',
                'statementAccountIban',
                'statementSettlements'
              ],
              additionalProperties: false
            }
          }
        }
      },
      config,
      signal
    );

    const parsed = extractJsonFromResponsePayload(payload) as Record<string, unknown> | undefined;
    if (parsed && typeof parsed === 'object') {
      return {
        sourceType: (parsed.sourceType as OpenAIDocumentExtraction['sourceType']) ?? undefined,
        amount: typeof parsed.amount === 'number' ? parsed.amount : undefined,
        currency: typeof parsed.currency === 'string' ? parsed.currency : undefined,
        dueDate: typeof parsed.dueDate === 'string' ? parsed.dueDate : undefined,
        accountHint: normaliseAccountHint(parsed.accountHint),
        companyName: typeof parsed.companyName === 'string' ? parsed.companyName : undefined,
        expenseType: typeof parsed.expenseType === 'string' ? parsed.expenseType : undefined,
        notes: typeof parsed.notes === 'string' ? parsed.notes : undefined,
        recurringExpenses: normaliseRecurringExpenses(parsed.recurringExpenses),
        supplierTaxId: normaliseTaxId(parsed.supplierTaxId),
        statementAccountIban: normaliseAccountHint(parsed.statementAccountIban),
        statementSettlements: normaliseStatementSettlements(parsed.statementSettlements),
        rawResponse: payload
      };
    }

    return { rawResponse: payload };
  } finally {
    deleteOpenAIFile(uploaded.id, config).catch((error) => {
      console.warn('Falha ao remover ficheiro temporário após extração.', error);
    });
  }
}

export { DEFAULT_OPENAI_BASE_URL, DEFAULT_OPENAI_MODEL };
