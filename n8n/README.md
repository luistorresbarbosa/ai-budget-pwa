# n8n Workflows

Este directório contém workflows n8n relacionados com a automação da aplicação Gestor de Despesas. Cada ficheiro JSON pode ser importado directamente no n8n.

## Scripts disponíveis

- `gmail-invoice-extractor.json`: monitoriza uma caixa de entrada Gmail à procura de faturas, valida o remetente com base numa lista de fornecedores guardada no Firestore, extrai dados dos PDFs e envia os metadados para o Firebase Firestore através do nó oficial **Google Cloud Firestore**.

## Configuração necessária

### Variáveis de ambiente do n8n

Defina as seguintes variáveis no ficheiro `.env` do n8n (ou directamente nas credenciais, caso prefira):

- `FIREBASE_PROJECT_ID`: ID do projecto Firebase onde o Firestore está configurado.
- `FIREBASE_INVOICES_COLLECTION` (opcional): nome da coleção Firestore para guardar as faturas. Caso não seja definido, o workflow usa `invoices`.
- `FIREBASE_SUPPLIERS_COLLECTION` (opcional): nome da coleção Firestore que contém os fornecedores autorizados. O valor por defeito é `suppliers`.

### Credenciais a configurar

1. **Gmail OAuth2 Account** – credencial nativa do n8n para aceder ao Gmail.
2. **OpenAI API** – credencial do tipo **OpenAI** para o nó `OpenAI Chat Model`. Configure a chave com permissões para o modelo `gpt-4o-mini` (ou equivalente compatível com modo JSON).
3. **Firebase Service Account** – credencial do tipo **Google Cloud > Service Account** com o scope `https://www.googleapis.com/auth/datastore`. Esta credencial é usada pelos nós `Fetch Supplier Emails` e `Upload to Firestore` (Google Cloud Firestore) para ler a lista de fornecedores autorizados e criar/actualizar documentos.

> ℹ️ O nó `Extract PDF Text` carrega dinamicamente o pacote `pdf-parse`. Certifique-se de que o módulo está instalado no servidor do n8n (`npm install pdf-parse`) e que as execuções têm acesso ao mesmo.

### Estrutura da coleção de fornecedores

Crie uma coleção (por defeito `suppliers`) onde cada documento contenha, pelo menos, um endereço de e-mail do fornecedor. Os campos podem ser simples (`email`, `billingEmail`) ou listas (`emails`, `allowedSenders`). O workflow recolhe automaticamente todos os valores que se pareçam com um e-mail dentro do documento, pelo que é compatível com diferentes esquemas. Exemplos de documentos válidos:

```json
{
  "name": "Utilities Lda",
  "emails": ["contabilidade@utilities.pt", "invoices@utilities.pt"]
}
```

```json
{
  "displayName": "Fornecedor XPTO",
  "billingEmail": "finance@xpto.com"
}
```

> ⚠️ Caso a coleção não contenha documentos com e-mails válidos, o workflow ignora todas as mensagens para evitar processar fornecedores desconhecidos.

### Estrutura do workflow

1. **Cron ➜ Gmail** – procura mensagens recentes com anexos PDF de faturas.
2. **Fetch Supplier Emails ➜ Format Supplier Emails** – lê a coleção de fornecedores no Firestore e prepara a lista de e-mails autorizados.
3. **Filter Attachments** – filtra as mensagens com base na lista de fornecedores e separa cada anexo PDF válido.
4. **Prepare Binary** – normaliza o anexo e guarda metadados do e-mail (ID, snippet, fornecedor associado, data, etc.).
5. **Extract PDF Text** – converte o PDF em texto com o pacote `pdf-parse`, calcula métricas básicas (páginas, contagem de palavras) e gera o _prompt_ para o agente.
6. **OpenAI Chat Model ➜ Extract Invoice Data (AI Agent)** – o modelo `gpt-4o-mini` alimenta o nó **AI Agent**, que interpreta o _prompt_ e devolve um JSON estruturado com os dados da fatura.
7. **Wrap Parser Response + Merge Parser Metadata** – convertem a resposta textual do agente em JSON e combinam os metadados originais do e-mail.
8. **Shape Firestore Payload** – prepara um objeto JSON simples com os campos a guardar (datas, valores, detalhes da fatura e o resultado bruto do parser).
9. **Upload to Firestore** – usa o nó oficial **Google Cloud Firestore** em modo _upsert_ para criar/actualizar o documento na coleção definida.

> ⚠️ O ID do documento no Firestore corresponde ao `messageId` do Gmail. Isto garante idempotência: se a mesma mensagem for processada novamente, os dados são actualizados em vez de duplicados.

Depois de importar o workflow:

1. Abra cada credencial indicada acima e associe a conta correcta.
2. Ajuste os parâmetros (filtros Gmail, nomes de coleções, etc.) se necessário.
3. Active o workflow.

Mantenha este directório actualizado com novos workflows quando necessário.
