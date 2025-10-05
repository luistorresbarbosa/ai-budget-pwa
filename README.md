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

## Próximos passos sugeridos

1. Expandir a sincronização do Firestore para escrever documentos a partir das várias páginas.
2. Substituir o mock state por fontes de dados reais e sincronização offline.
3. Adicionar autenticação e regras de segurança na base de dados.
4. Expandir a suíte de testes para cobrir casos críticos de negócio.
