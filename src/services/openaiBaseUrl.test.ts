import { describe, expect, it } from 'vitest';
import { DEFAULT_OPENAI_BASE_URL, normaliseOpenAIBaseUrl } from './openai';

describe('normaliseOpenAIBaseUrl', () => {
  it('devolve a predefinição quando o valor é vazio ou inválido', () => {
    expect(normaliseOpenAIBaseUrl()).toBe(DEFAULT_OPENAI_BASE_URL);
    expect(normaliseOpenAIBaseUrl('')).toBe(DEFAULT_OPENAI_BASE_URL);
    expect(normaliseOpenAIBaseUrl('   ')).toBe(DEFAULT_OPENAI_BASE_URL);
    expect(normaliseOpenAIBaseUrl('nota-url')).toBe(DEFAULT_OPENAI_BASE_URL);
  });

  it('garante que o protocolo é sempre https e acrescenta /v1 quando necessário', () => {
    expect(normaliseOpenAIBaseUrl('api.openai.com/v1')).toBe('https://api.openai.com/v1');
    expect(normaliseOpenAIBaseUrl('http://api.openai.com/v1')).toBe('https://api.openai.com/v1');
    expect(normaliseOpenAIBaseUrl('https://api.openai.com')).toBe('https://api.openai.com/v1');
    expect(normaliseOpenAIBaseUrl('https://api.openai.com/v1/')).toBe('https://api.openai.com/v1');
  });

  it('mantém URLs personalizadas, apenas removendo barras supérfluas', () => {
    expect(
      normaliseOpenAIBaseUrl('https://contoso.openai.azure.com/openai/deployments/model')
    ).toBe('https://contoso.openai.azure.com/openai/deployments/model');
  });

  it('permite hosts locais sem forçar HTTPS', () => {
    expect(normaliseOpenAIBaseUrl('http://localhost:8787/v1')).toBe('http://localhost:8787/v1');
    expect(normaliseOpenAIBaseUrl('localhost:8787/v1')).toBe('https://localhost:8787/v1');
  });

  it('normaliza espaços em branco e caminhos adicionais', () => {
    expect(normaliseOpenAIBaseUrl('  https://api.openai.com/v1/chat ')).toBe(
      'https://api.openai.com/v1/chat'
    );
  });
});
