# AI Budget PWA

Aplicação web (PWA) para gestão inteligente de despesas pessoais. O projecto está configurado com [Vite](https://vitejs.dev/),
React e TypeScript, incluindo mock data, estado global via Zustand e uma estrutura inicial para as principais áreas da app:

- Upload de PDFs com extração (mock) de metadados.
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
```

## Integração com Firebase/Firestore

1. Crie um projecto Firebase e active o Firestore.
2. Copie as credenciais Web SDK disponibilizadas na consola Firebase.
3. Na aplicação, aceda a **Definições** → **Configuração Firebase (JSON)** e cole um JSON com os campos `apiKey`, `authDomain` e `projectId` (e restantes campos opcionais do SDK).
4. Ao guardar, a app inicializa o Firebase e começa a sincronizar as coleções `accounts`, `expenses`, `transfers`, `documents` e `timeline` em tempo-real.

## Próximos passos sugeridos

1. Integrar a API da OpenAI em `src/services/pdfParser.ts` para substituir os mocks.
2. Expandir a sincronização do Firestore para escrever documentos a partir das várias páginas.
3. Substituir o mock state por fontes de dados reais e sincronização offline.
4. Adicionar autenticação e regras de segurança na base de dados.
5. Expandir a suíte de testes para cobrir casos críticos de negócio.
