# AI Budget PWA

Aplicação web (PWA) para gestão inteligente de despesas pessoais. O projecto está configurado com [Vite](https://vitejs.dev/),
React e TypeScript, incluindo mock data, estado global via Zustand e uma estrutura inicial para as principais áreas da app:

- Upload de PDFs com extração de metadados via OpenAI (com fallback mock quando não existir chave).
- Gestão de transferências entre contas.
- Timeline de eventos financeiros.
- Consulta de despesas com filtros.
- Definições para chaves e integrações.

O layout e os componentes usam [Tailwind CSS](https://tailwindcss.com/) e animações com [Framer Motion](https://www.framer.com/motion/) para criar uma experiência moderna e responsiva.

## Assets

- Os ícones PWA são carregados dinamicamente a partir do CDN do pacote `lucide-static`, evitando a necessidade de armazenar binários no repositório.

## Requisitos

- Node.js 18+
- npm 9+

## Scripts disponíveis

```bash
npm install      # Instala dependências
npm run dev      # Inicia servidor de desenvolvimento
npm run build    # Compila a aplicação para produção
npm run preview  # Pré-visualiza build de produção
npm run test     # Executa testes unitários com Vitest
npm run test:openai # Valida pedidos OpenAI usando variáveis de ambiente
```

## Integração com Firebase/Firestore

1. Crie um projecto Firebase e active o Firestore.
2. Copie as credenciais Web SDK disponibilizadas na consola Firebase.
3. Na aplicação, aceda a **Definições** → **Configuração Firebase (JSON)** e cole um JSON com os campos `apiKey`, `authDomain` e `projectId` (e restantes campos opcionais do SDK).
4. Ao guardar, a app inicializa o Firebase e começa a sincronizar as coleções `accounts`, `expenses`, `transfers`, `documents` e `timeline` em tempo-real.

## Integração com a API da OpenAI

1. Obtenha uma chave válida na [plataforma da OpenAI](https://platform.openai.com/).
2. Abra a app e aceda a **Definições** → secção **OpenAI**.
3. Introduza a chave e, opcionalmente, um endpoint alternativo/base URL e o modelo a utilizar (por defeito é usado `gpt-4o-mini`).
4. Utilize o botão **Testar ligação OpenAI** para validar a configuração — a app faz um pedido mínimo à API e apresenta a latência aproximada.
5. Depois de validada, carregue um PDF na página de **Upload** para que a extração ocorra via OpenAI. Se a ligação falhar, a app recorre automaticamente ao mock interno para que o fluxo continue funcional.

### Testar pedidos OpenAI via linha de comando

Quando quiser validar rapidamente se as credenciais funcionam fora da interface, utilize o comando `npm run test:openai`. O script lê as seguintes variáveis de ambiente:

- `OPENAI_API_KEY` (obrigatório)
- `OPENAI_BASE_URL` (opcional, para provedores compatíveis)
- `OPENAI_MODEL` (opcional, por defeito usa `gpt-4o-mini`)
- `OPENAI_TEST_PDF` (opcional, caminho local para um PDF a enviar no teste de extração)
- `OPENAI_ACCOUNT_CONTEXT` (opcional, envia uma dica de conta ao modelo)

Exemplo de execução apenas com validação de ligação:

```bash
OPENAI_API_KEY=sk-... npm run test:openai
```

Exemplo a incluir um PDF de teste:

```bash
OPENAI_API_KEY=sk-... OPENAI_TEST_PDF=./exemplos/fatura.pdf npm run test:openai
```

O comando devolve a latência medida no endpoint escolhido e, quando for fornecido um PDF, mostra a resposta estruturada devolvida pela OpenAI.

## Docker

O projecto inclui um `Dockerfile` multi-stage que gera os artefactos com Vite e serve a PWA estática via Nginx.

```bash
docker build -t ai-budget-pwa .
docker run --rm -p 8080:80 ai-budget-pwa
```

Após iniciar o container, a aplicação ficará disponível em `http://localhost:8080`.

## Deploy contínuo com Vercel

Para obter um deploy automático sempre que existir actividade no ramo principal ou um novo pull request para `main`, configure os [Deploy Hooks da Vercel](https://vercel.com/docs/deployments/deploy-hooks) e adicione-os como segredos no repositório GitHub:

- `VERCEL_DEPLOY_HOOK_URL` — hook de produção, accionado em `push` para `main`.
- `VERCEL_PREVIEW_DEPLOY_HOOK_URL` — hook opcional para pré-visualizações, accionado em pull requests direcionados a `main`.

Depois de configurar os segredos, o workflow em `.github/workflows/vercel-deploy.yml` invoca automaticamente os hooks via `curl`, garantindo que existe sempre uma versão actualizada no Vercel assim que o código chega a `main` ou quando um PR é actualizado.

## Próximos passos sugeridos

1. Expandir a sincronização do Firestore para escrever documentos a partir das várias páginas.
2. Substituir o mock state por fontes de dados reais e sincronização offline.
3. Adicionar autenticação e regras de segurança na base de dados.
4. Expandir a suíte de testes para cobrir casos críticos de negócio.
