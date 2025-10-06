import { logOpenAIEvent } from './integrationLogger';

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

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

export interface OpenAIDocumentExtraction {
  sourceType?: 'fatura' | 'recibo' | 'extracto';
  amount?: number;
  currency?: string;
  dueDate?: string;
  accountHint?: string;
  notes?: string;
  rawResponse?: unknown;
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
  if (!baseUrl) {
    return DEFAULT_OPENAI_BASE_URL;
  }
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
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
    logOpenAIEvent('Falha ao obter lista de modelos da OpenAI.', {
      details: error instanceof Error ? error.message : String(error)
    });
    throw error;
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
    logOpenAIEvent('Falha ao obter saldo disponível da OpenAI.', {
      details: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }

  if (!response.ok) {
    const message = await parseOpenAIError(response);
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
    logOpenAIEvent('Falha ao enviar ficheiro para a OpenAI.', {
      details: error instanceof Error ? error.message : String(error)
    });
    throw error;
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
    logOpenAIEvent('Falha ao contactar a OpenAI (endpoint /responses).', {
      details: error instanceof Error ? error.message : String(error)
    });
    throw error;
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
    try {
      balance = await fetchOpenAIBalance(config, signal);
    } catch (error) {
      logOpenAIEvent('Aviso: não foi possível obter saldo disponível após validar a ligação.', {
        details: error instanceof Error ? error.message : String(error)
      });
    }

    return {
      success: true,
      message: 'Ligação validada com sucesso.',
      model,
      latencyMs,
      balance
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
                  'Analisa o PDF fornecido e devolve um JSON com os campos "sourceType", "amount", "currency", "dueDate", "accountHint" e "notes". ' +
                  'sourceType deve ser um de: fatura, recibo ou extracto. amount deve ser número. dueDate deve estar em ISO 8601 se existir. ' +
                  (accountContext
                    ? `A conta de contexto preferencial é "${accountContext}". Considera-a ao interpretar o documento. `
                    : '') +
                  'Se um campo não existir, devolve null.'
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
                notes: {
                  type: ['string', 'null']
                }
              },
              required: ['sourceType', 'amount', 'currency', 'dueDate', 'accountHint', 'notes'],
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
        accountHint: typeof parsed.accountHint === 'string' ? parsed.accountHint : undefined,
        notes: typeof parsed.notes === 'string' ? parsed.notes : undefined,
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
