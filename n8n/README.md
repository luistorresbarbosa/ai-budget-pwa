# n8n Workflows

Este directório contém workflows n8n relacionados com a automação da aplicação AI Budget App. Cada ficheiro JSON pode ser importado directamente no n8n.

## Scripts disponíveis

- `gmail-invoice-extractor.json`: monitoriza uma caixa de entrada Gmail à procura de faturas, extrai dados dos PDFs e envia os metadados para o Firebase Firestore.

## Utilização

1. Abra o n8n.
2. Importe o ficheiro JSON desejado através de **Import from File**.
3. Configure as credenciais referidas nas secções _Gmail API_, _OpenAI_ (ou outro serviço de extracção) e _Firebase_ conforme necessário.
4. Active o workflow.

Mantenha este directório actualizado com novos workflows quando necessário.
