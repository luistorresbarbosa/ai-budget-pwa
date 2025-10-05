const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

function now(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
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
  name: string;
  schema: Record<string, unknown>;
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

async function uploadFileToOpenAI(
  file: File,
  config: OpenAIConnectionConfig,
  signal?: AbortSignal
): Promise<{ id: string }> {
  const baseUrl = resolveBaseUrl(config.baseUrl);
  const formData = new FormData();
  formData.append('purpose', 'assistants');
  formData.append('file', file);

  const response = await fetch(`${baseUrl}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`
    },
    body: formData,
    signal
  });

  if (!response.ok) {
    throw new Error(await parseOpenAIError(response));
  }

  const payload = await response.json();
  if (!payload?.id) {
    throw new Error('Resposta inesperada ao carregar o ficheiro para a OpenAI.');
  }

  return { id: payload.id };
}

async function deleteOpenAIFile(fileId: string, config: OpenAIConnectionConfig): Promise<void> {
  const baseUrl = resolveBaseUrl(config.baseUrl);
  try {
    await fetch(`${baseUrl}/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${config.apiKey}`
      }
    });
  } catch (error) {
    console.warn('Não foi possível remover o ficheiro temporário da OpenAI.', error);
  }
}

async function callOpenAIResponses(
  request: ResponsesRequest,
  config: OpenAIConnectionConfig,
  signal?: AbortSignal
): Promise<any> {
  const baseUrl = resolveBaseUrl(config.baseUrl);
  const response = await fetch(`${baseUrl}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request),
    signal
  });

  if (!response.ok) {
    throw new Error(await parseOpenAIError(response));
  }

  return response.json();
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
    return {
      success: true,
      message: 'Ligação validada com sucesso.',
      model,
      latencyMs
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
