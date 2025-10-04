# AI Budget App — Regras e Requisitos

## Resumo
Quero construir uma PWA WEB app para gerir as minhas despesas e transferências entre as minhas contas.

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

- A base de dados em Firebase ainda não existe e necessita de ser criada — incluindo toda a sua estrutura e migrações.
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
- Despesas: vista com histórico, filtros por conta e datas.
- Timeline: calendário visual com os dias de débito/pagamento.

## Organização deste ficheiro

- Este ficheiro deve ser mantido atualizado e conter as regras da app, decisões de arquitetura e pequenas notas de implementação.

## Próximos passos sugeridos

1. Definir o modelo de dados (entidades) e criar um esquema inicial para a base de dados.
2. Scaffold de um projecto com as áreas principais (Upload PDFs, Transferências, Timeline, Settings).
3. Implementar a funcionalidade de upload de PDF e integração com a API da OpenAI (em modo de teste) — guardar chaves nos settings.
4. Criar endpoints (ou usar BaaS) para persistência e sincronização dos dados.
5. Adicionar testes mínimos para validação da extração e persistência dos documentos.

## Assunções

- A extração de dados por PDF será feita via upload para a API da OpenAI (ou serviço equivalente).
- A app deverá proteger as chaves de API no armazenamento local seguro.
- A base de dados será o Firebase e nao tera api/ backend intermedio.
