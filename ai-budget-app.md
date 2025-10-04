# AI Budget App — Regras e Requisitos

## Resumo
Quero construir uma app em Flutter para gerir as minhas despesas e transferências entre as minhas contas.

Este documento descreve as regras, funcionalidades e requisitos iniciais da aplicação. Deve ser usado como referência ao longo do desenvolvimento e atualizado sempre que o escopo mudar.

## Funcionalidades principais

- Área para fazer upload de PDFs (faturas, recibos, extractos bancários).
- Extracção automática de informação relevante dos PDFs usando a API da OpenAI.
- Área de transferências (passadas e futuras) para organizar dias chave e efetuar transferências entre contas.
- Timeline que mostra os dias em que as despesas/vencimentos vão acontecer.
- Guardar todo o histórico de faturas e extractos, assim como contas, pagamentos e despesas.

## Informação a extrair dos PDFs

Ao enviar um PDF para a API da OpenAI, a app deve tentar extrair as seguintes informações quando aplicável:

- Valor a pagar
- Data de débito directo / data de pagamento a efectuar
- Conta em que o pagamento vai ser efectuado (se aplicável)
- No caso do PDF ser um extracto bancário, detectar despesas fixas que ocorrem sempre (ex.: prestações)

Notas:

- Nem todos os campos estarão sempre presentes; a extração deve ser tolerante a lacunas.

## Segurança e configuração

- As chaves da API devem ficar guardadas nos settings da app (configurações locais/seguras). Definir como será o armazenamento seguro (ex.: keystore / secure storage) quando se implementar.

## Base de dados

- A base de dados online ainda não existe e necessita de ser criada — incluindo toda a sua estrutura e migrações.
- Dados a persistir (mínimo):
  - Faturas / recibos (apenas metadados extraídos — o PDF original **não** é guardado)
  - Extractos bancários (apenas transacções e metadados extraídos — o PDF original **não** é guardado)
  - Contas (ex.: conta corrente, poupança, cartões)
  - Pagamentos (agendados e históricos)
  - Despesas (categoria, valor, recorrência, conta associada)

## Regras de negócio iniciais

- Detectar e marcar despesas fixas recorrentes a partir dos extractos bancários (por exemplo, prestações, assinaturas).
- Permitir que o utilizador confirme/edite os dados extraídos antes de guardar.
- Ao criar transferências agendadas, garantir que há saldo/conta de origem definido e associar às despesas futuras relevantes.

## Interfaces/UX (nível alto)

- Upload de PDF: interface simples com preview e possibilidade de edição dos campos extraídos.
- Transferências: vista com histórico e agendadas, filtros por conta e datas.
- Timeline: calendário visual com os dias de débito/pagamento e acções sugeridas (ex.: agendar transferência).

## Organização deste ficheiro

- Este ficheiro deve ser mantido atualizado e conter as regras da app, decisões de arquitetura e pequenas notas de implementação.

## Próximos passos sugeridos

1. Definir o modelo de dados (entidades e relações) e criar um esquema inicial para a base de dados.
2. Scaffold de um projecto Flutter com as áreas principais (Upload PDFs, Transferências, Timeline, Settings).
3. Implementar a funcionalidade de upload de PDF e integração com a API da OpenAI (em modo de teste) — guardar chaves nos settings.
4. Criar endpoints/backend (ou usar BaaS) para persistência e sincronização dos dados.
5. Adicionar testes mínimos para validação da extração e persistência dos documentos.

### Estado da implementação (Abril 2024)

- Scaffold Flutter inicial criado com navegação por `NavigationBar` e ecrãs placeholder para Upload, Transferências, Timeline e Definições.
- Componentes de UI criados para placeholders (ex.: `EmptyPlaceholder`) e diálogos de mock para agendar transferências e guardar chave da OpenAI.
- `pubspec.yaml` inclui dependências principais previstas: `supabase_flutter`, `file_picker`, `flutter_secure_storage` e `intl`.
- Teste de widget inicial criado para garantir que as tabs principais são apresentadas.

## Assunções

- A extração de dados por PDF será feita via upload para a API da OpenAI (ou serviço equivalente).
- A app deverá proteger as chaves de API no armazenamento local seguro.
- A base de dados será online (p.ex. Postgres, Firebase, ou outro) — implementação a decidir.

---

Arquivo original (resumo):

> Quero contruir uma app em Flutter para gerir as minhas despesas e transferencias entre as minhas contas.
>
> Esta app deve fazer upload de pdf's para a api da open ai para extrair informação relevante como:
>
> - Valor a pagar
> - Data de débito directo\pagamento a efetuar
> - Conta em que o pagamento vai ser efetuado(se aplicavel)
> - No caso do pdf ser o exrtract o bancario, deve detetar despesas fixas que ocorrem sempre (exemplo: prestações)
>
> Nota: as chaves da api devem ficar guardadas nos settings
>
> A nivel do modus openadi, app deve:
>
> - Ter uma area para fazer upload de pdf's
> - Ter uma aread de transferencias (passadas e futuras) para organizar dias chave para efetuar transferencias para determinads contas (contas onde vão exisitr despesas)
> - Mostrar uma timeline dos dias em que as despesas vão acontecer
>
> A base de dados online ainda não existe e necessita de ser criada - incluindo toda a sua estrutura.
>
> Deveremos guardar todo o historico de faturas e extratos, assim como contas, pagamentos e despesas.
>
> Deveremos ter um ficheiro .md (devidamente organizado) com todas as regras desta app para que possas sempre consultar e organizar conforme vamos afinado o seu scope.

## Modelo de dados (entidades principais)

Aviso importante: o modelo de dados abaixo é apenas um exemplo ilustrativo para orientar o design inicial. Não deve ser tratado como uma regra fixa — nomes, tipos, índices e relações devem ser adaptados conforme requisitos funcionais, desempenho, legislação e escolhas tecnológicas.

Nota: abaixo está um modelo inicial e simplificado. Ajustar nomes de campos, índices e tipos conforme a base de dados escolhida.

- Account (Conta)
  - id (UUID)
  - name (string)
  - type (enum: checking, savings, card, other)
  - last4 (opcional, para cartões)
  - currency
  - created_at, updated_at

- Document (Documento PDF)
  - id (UUID)
  - account_id (nullable) — ligação a `Account` se aplicável
  - processed_at (timestamp)
  - extracted_text (text) — texto extraído do PDF
  - file_hash (opcional) — hash do ficheiro para referência, se necessário
  - source (enum: invoice, receipt, statement, other)
  - original_filename (text)
  - processing_notes (text)

- ExtractedItem (Dados extraídos do PDF)
  - id (UUID)
  - document_id (UUID)
  - field (enum: amount, due_date, account, description, vendor, transaction_date, category)
  - value (string/JSON)
  - confidence (float optional)
  - normalized (JSON) — valor normalizado (ex.: amount numerico, date ISO)

- DocumentExtraction (Armazenamento temporário de extrações)
  - id (UUID)
  - document_id (UUID opcional)
  - file_name (text)
  - structured_payload (JSON)
  - raw_response (JSON opcional)
  - source (text, default app_upload)
  - created_at (timestamp)

- Transaction / Payment (Pagamento / Transacção)
  - id (UUID)
  - account_id (UUID)
  - amount (decimal)
  - date (date)
  - description
  - category
  - recurring_rule_id (nullable)
  - status (enum: scheduled, completed, failed)
  - linked_document_id (nullable)

- RecurringRule (Regra de recorrência)
  - id (UUID)
  - account_id
  - description
  - amount (nullable)
  - frequency (enum: monthly, weekly, yearly, custom)
  - day_of_month (nullable)
  - start_date, end_date
  - notes

## Esquema inicial de BD (exemplo SQL simplificado)
Nota importante: o esquema SQL abaixo é um exemplo simplificado e **apenas** demonstrativo. Não o encares como uma especificação obrigatória — serve como ponto de partida que pode (e deve) ser alterado.

-- Tabelas principais (exemplo usando Postgres)

CREATE TABLE accounts (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  last4 TEXT,
  currency TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE documents (
  id UUID PRIMARY KEY,
  account_id UUID REFERENCES accounts(id),
  processed_at TIMESTAMP DEFAULT now(),
  extracted_text TEXT,
  file_hash TEXT,
  source TEXT
);

CREATE TABLE extracted_items (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  field TEXT,
  value TEXT,
  confidence REAL,
  normalized JSONB
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  account_id UUID REFERENCES accounts(id),
  amount NUMERIC,
  date DATE,
  description TEXT,
  category TEXT,
  recurring_rule_id UUID,
  status TEXT,
  linked_document_id UUID REFERENCES documents(id)
);

CREATE TABLE recurring_rules (
  id UUID PRIMARY KEY,
  account_id UUID REFERENCES accounts(id),
  description TEXT,
  amount NUMERIC,
  frequency TEXT,
  day_of_month INT,
  start_date DATE,
  end_date DATE,
  notes TEXT
);

## Integração direta com Supabase (sem API separada)

Decisão: não haverá uma API separada. A app Flutter utiliza o SDK `supabase_flutter` para comunicar diretamente com os endpoints REST e Realtime do Supabase. Todas as credenciais (URL, anon key e service role) são fornecidas via `--dart-define` para facilitar a rotação e evitar exposições no código-fonte.

Notas adicionais:

- O serviço `DocumentRepository` grava as extrações iniciais na tabela `document_extractions` antes de conciliá-las com `documents` e `transactions`.
- A aplicação inicializa o cliente Supabase no `main.dart` e gera logs informativos quando as variáveis de ambiente não estão definidas.

Recomendações e opções de implementação:

- Preferível (seguro): usar Supabase Edge Functions para executar o processamento server-side (chamada à OpenAI). Fluxo sugerido:
  1. A app faz upload do ficheiro para um bucket privado no Supabase Storage usando uma URL assinada ou regras RLS apropriadas.
  2. A app cria um registo `Document` na tabela com estado inicial (por exemplo, processing=false).
  3. A app invoca uma Supabase Edge Function (HTTP) passando o `document_id` — a Edge Function tem acesso a secrets (ex.: chave OpenAI) e pode buscar o ficheiro do Storage, chamar a API da OpenAI para extrair texto/entidades e gravar `ExtractedItem` e atualizar o `Document`.
  4. A Edge Function apaga o ficheiro do Storage após processamento, deixando apenas os metadados/extrações na DB.

- Alternativa (menos seguro): processar directamente na app (cliente) chamando a OpenAI a partir da app. Esta opção exige guardar a chave no dispositivo (ex.: `flutter_secure_storage`) e tem riscos (exposição da chave). Só usar se compreendermos e aceitarmos o trade-off.

- Segurança das chaves: não inclua a chave da OpenAI no código distribuído. Use Secrets nas Edge Functions ou outro secret manager. Se for necessário usar a chave no cliente, garantir rotação frequente e monitorização.

- Regras de acesso: configurar Row Level Security (RLS) no Supabase para garantir que cada utilizador só acede aos seus documentos/contas.

Endpoints / chamadas (substituem a API externa):

- Upload para Supabase Storage (direct upload com URL assinada ou token temporário).
- POST /functions/v1/process-document (Supabase Edge Function) — recebe { document_id } e inicia/realiza o processamento.
- Supabase realtime / subscriptions para notificar a app quando os `ExtractedItem` estiverem prontos.

Notas:

- As Edge Functions funcionam como o "backend" seguro sem teres de gerir uma API separada.
- Garantir que a Edge Function usa a chave de serviço apropriada e que a app cliente não tem acesso a essa chave.

## Fluxo de upload e extração (processo)

1. O utilizador faz upload do PDF pelo app.
2. A app realiza upload do ficheiro para um bucket privado no Supabase Storage e cria um registo `Document` na base de dados com estado inicial (por exemplo, processing=false).
3. A app invoca uma Supabase Edge Function (ou esta é disparada por trigger) passando o `document_id` — a Edge Function obtém o ficheiro do Storage, chama a API da OpenAI para extrair texto/entidades, grava `ExtractedItem` e actualiza o `Document`.
4. A Edge Function apaga o ficheiro do Storage após o processamento; apenas os metadados e o texto extraído ficam armazenados.
5. Se a decisão for processar no cliente (menos seguro), a app pode chamar directamente a OpenAI e gravar os `ExtractedItem` no Supabase; isto exige medidas fortes de rotação/segurança da chave.
6. Resultado da extração é normalizado (quantias, datas) e guardado em `ExtractedItem`.
7. O sistema tenta mapear `ExtractedItem`s para `Transaction` ou sinaliza para revisão manual.
8. O utilizador pode rever/editar os valores extraídos antes de confirmar a criação/ligação à transacção.

## Armazenamento e segurança das chaves da API

- No Flutter: usar `flutter_secure_storage` para guardar a chave localmente (iOS Keychain / Android Keystore).
- Nas Supabase Edge Functions (ou outro ambiente server-side): usar variáveis de ambiente ou um secret manager (AWS Secrets Manager, GCP Secret Manager, Azure Key Vault).
- Nunca incluir chaves diretamente no código fonte ou em repositórios.

- Tratamento dos PDFs: os ficheiros enviados não devem ser guardados persistentemente. Se for necessário algum armazenamento temporário, garantir que o ciclo de vida do ficheiro é curto (eliminação após processamento) e que o armazenamento temporário é seguro e encriptado.


## Regras para detecção de despesas fixas / recorrentes

- Heurísticas iniciais:
  - Agrupar transacções por descrição e montante semelhante ao longo do tempo.
  - Se uma transacção aparece com periodicidade regular (ex.: mensal, +/- 2 dias) durante 3+ ciclos, sugerir como recorrente.
  - Usar o extracto bancário para identificar a mesma referência (ex.: NIB/entidade/descrição padrão).

- Workflow:
  1. Detectar padrões automaticamente no processamento de extratos.
  2. Criar uma `RecurringRule` sugerida com frequência e valor médio.
  3. Notificar o utilizador para confirmar/editar.

## Critérios de aceitação (exemplos)

- Upload de PDF cria um `Document` com estado `uploaded` e gera items extraídos.
- A extração deve identificar corretamente o valor e a data em 80% dos PDFs testados (teste inicial com amostra).
- Despesas recorrentes são identificadas e sugeridas para o utilizador.

## Checklist de implementação (primeira versão MVP)

1. Escolher stack backend e DB (ex.: Node + Postgres ou Firebase).
2. Scaffold backend com endpoints mínimos (upload, documentos, transacções).
3. Scaffold Flutter com páginas: Login (ou semauth), Upload, Document Detail (edição), Transferências, Timeline, Settings.
4. Implementar upload de ficheiros e armazenamento (storage local/cloud).
5. Integrar com OpenAI para extração (modo dev/teste) e guardar chaves em secure storage.
6. Implementar worker simples para processar extrações.
7. Criar UI para revisão/edição dos campos extraídos antes de confirmar.
8. Implementar deteção simples de recorrência e interface para gerir regras.

## Notas finais

- Este ficheiro deve continuar a evoluir. Quando avançarmos para a implementação, iremos:
  - adicionar diagramas ERD,
  - especificar tipos concretos (p.ex. Decimal/BigInt para montantes),
  - definir SLAs para processamento de PDFs e políticas de retry.

Se quiser, actualizo este ficheiro para um idioma/estilo diferente ou gero um ERD (.png) e um ficheiro SQL de migração completo para a BD escolhida.

