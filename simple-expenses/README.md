# Simple Expenses

App web simples para gerir despesas em várias contas / cartões. 100% no browser
(localStorage), sem backend, sem login.

Stack: Next.js 14 (App Router) + TypeScript + Tailwind CSS.

## Funcionalidades

- Criar e editar contas / cartões (corrente, poupança, crédito, débito,
  dinheiro), com cor e moeda.
- Registar despesas com data, categoria, conta e notas.
- Filtrar despesas por conta, categoria e mês.
- Resumo mensal: total, totais por conta, top categorias, despesas recentes,
  saldo agregado estimado (saldo inicial − despesas).
- Exportar / importar JSON (backup local entre dispositivos).

## Desenvolvimento

```bash
cd simple-expenses
npm install
npm run dev
```

Abrir http://localhost:3000.

```bash
npm run build  # build de produção
npm run start  # servir build localmente
```

## Deploy automático no Vercel

Esta app vive numa subpasta de um repositório monorepo
(`luistorresbarbosa/ai-budget-pwa`). Para activar o auto-deploy:

1. No painel da Vercel, **Add New → Project** e ligar o repositório.
2. Em **Root Directory**, escolher `simple-expenses`.
3. **Framework Preset**: Next.js (auto-detectado).
4. **Install Command** / **Build Command** ficam pelos defaults.
5. **Deploy**.

A partir daí, qualquer push para `main` gera um deploy de produção e qualquer
PR contra `main` gera um preview — directamente pela integração GitHub da
Vercel, sem necessidade de webhooks adicionais.

### Alternativa: Deploy Hook

Se preferir manter o esquema do projecto principal (workflow em
`.github/workflows/vercel-deploy.yml`), crie um Deploy Hook próprio para esta
app na Vercel e adicione-o como secret no GitHub
(`SIMPLE_EXPENSES_DEPLOY_HOOK_URL`). Depois pode estender o workflow existente
para o invocar.

## Dados

Tudo é guardado em `localStorage` sob a chave `simple-expenses:v1`. Use
**Definições → Exportar / Importar JSON** para mover entre dispositivos. Ao
apagar uma conta, todas as despesas associadas são removidas.
