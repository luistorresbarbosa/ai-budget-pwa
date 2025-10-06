import process from 'node:process';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { extractPdfMetadataWithOpenAI, validateOpenAIConnection } from '../src/services/openai';

interface CliOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  pdfPath?: string;
  accountContext?: string;
}

function formatBalanceAmount(amount: number, currency?: string): string {
  const normalisedCurrency = (currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: normalisedCurrency
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${normalisedCurrency}`;
  }
}

function resolveEnv(): CliOptions {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('✖︎ OPENAI_API_KEY não está definido.');
    process.exitCode = 1;
    throw new Error('OPENAI_API_KEY é obrigatório para testar a ligação.');
  }

  return {
    apiKey,
    baseUrl: process.env.OPENAI_BASE_URL || undefined,
    model: process.env.OPENAI_MODEL || undefined,
    pdfPath: process.env.OPENAI_TEST_PDF || undefined,
    accountContext: process.env.OPENAI_ACCOUNT_CONTEXT || undefined
  };
}

async function runValidation(options: CliOptions) {
  console.log('▶︎ A validar ligação à OpenAI...');
  const result = await validateOpenAIConnection({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    model: options.model
  });

  if (result.success) {
    console.log(`✓ Ligação validada (${result.model}) em ${result.latencyMs ?? '?'} ms`);
    if (result.balance) {
      const available = formatBalanceAmount(result.balance.totalAvailable, result.balance.currency);
      const granted = formatBalanceAmount(result.balance.totalGranted, result.balance.currency);
      const used = formatBalanceAmount(result.balance.totalUsed, result.balance.currency);
      const expires =
        typeof result.balance.expiresAt === 'number'
          ? new Date(result.balance.expiresAt * 1000).toLocaleDateString('pt-PT')
          : null;
      console.log(`  Saldo disponível: ${available} (limite ${granted}, utilizado ${used}).`);
      if (expires) {
        console.log(`  Créditos expiram a ${expires}.`);
      }
    } else if (result.balanceError) {
      console.log(`  Nota: ${result.balanceError}`);
    }
  } else {
    console.log('⚠︎ A API respondeu mas a validação falhou:');
    console.log(result.message);
  }
}

async function runExtractionIfRequested(options: CliOptions) {
  if (!options.pdfPath) {
    return;
  }

  const absolutePath = path.resolve(options.pdfPath);
  console.log(`▶︎ A carregar PDF em ${absolutePath} para testar extração...`);
  const data = await readFile(absolutePath);
  const arrayBuffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  ) as ArrayBuffer;
  const file = new File([arrayBuffer], path.basename(absolutePath), { type: 'application/pdf' });

  const extraction = await extractPdfMetadataWithOpenAI({
    file,
    config: {
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      model: options.model
    },
    accountContext: options.accountContext
  });

  console.log('✓ Resposta de extração:');
  console.dir(extraction, { depth: 4 });
}

async function main() {
  try {
    const options = resolveEnv();
    await runValidation(options);
    await runExtractionIfRequested(options);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`✖︎ ${error.message}`);
    } else {
      console.error('✖︎ Ocorreu um erro desconhecido.', error);
    }
    process.exitCode = process.exitCode || 1;
  }
}

await main();
