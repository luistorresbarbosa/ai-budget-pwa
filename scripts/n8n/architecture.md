# Architecture Notes

The orchestration is split into modular concerns so the repository can evolve into a full monorepo:

- **Workflows (n8n)** – automation and integration logic.
- **Shared configuration** – supplier catalog that informs the Gmail query and can be reused by supporting services.
- **Data services** – Firebase/Firestore stores the historical invoice metadata produced by the AI agent.

## n8n workflow stages

1. **Scheduling** – `Daily Schedule` cron trigger kicks off the flow.
2. **Query preparation** – `Build Supplier Query` composes a Gmail search string from supplier tags/emails.
3. **Multi-account fetch** – `Fetch Gmail A/B` search two Gmail inboxes using OAuth credentials.
4. **Attachment expansion** – `Flatten Attachments` converts Gmail messages into individual PDF items.
5. **AI enrichment** – `Extract Invoice with AI Agent` converts the base64 payload into structured data using the built-in AI Agent and connected OpenAI chat model.
6. **Persistence** – `Store in Firebase` pushes results to Firestore for reporting and audit.

## Extending the system

- Replace the inline supplier list with a dedicated data source (REST API, database, etc.).
- Introduce monitoring/alerting workflows for failed executions.
- Add additional Firebase collections or BigQuery exports for analytics.
- Package shared TypeScript/Node utilities under `packages/` as the AI agent or other services are implemented.

