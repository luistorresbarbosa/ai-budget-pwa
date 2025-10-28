# Gmail Invoice Automation Monorepo

This repository starts a monorepo that orchestrates invoice extraction from two Gmail accounts, forwards the PDF attachments through n8n's AI Agent node, and archives the structured output in Firebase.

## Repository layout

```text
apps/
  n8n/
    workflows/
      gmail-invoice-orchestration.json   # Importable n8n workflow
packages/
  config/
    suppliers.yaml                       # Shared supplier metadata
```

- **apps/n8n/workflows** – contains importable workflows for n8n.
- **packages/config** – holds shared configuration assets that can be reused across services.

## Workflow overview

The `Daily Gmail Invoice Orchestration` workflow is designed to be imported directly into n8n. Once the required credentials and environment variables are configured, it will:

1. Run on a cron schedule every day at 01:00.
2. Build a Gmail search query from the supplier list (`packages/config/suppliers.yaml`).
3. Search for PDF invoices with matching supplier labels/emails in **two** Gmail accounts.
4. Flatten every PDF attachment into individual items.
5. Convert each PDF to base64 and send it to the built-in **AI Agent** node (backed by the connected OpenAI chat model) to extract structured invoice details.
6. Merge the AI response with the original metadata and store the result in Firebase/Firestore for history.

### Required credentials

| Node | Credential | Purpose |
| ---- | ---------- | ------- |
| `Fetch Gmail A` | **Gmail OAuth2** named `Gmail Account A` | OAuth connection to the first Gmail inbox. |
| `Fetch Gmail B` | **Gmail OAuth2** named `Gmail Account B` | OAuth connection to the second Gmail inbox. |
| `OpenAI Chat Model` | **OpenAI API** named `OpenAI Account` | API key and optional base URL for the chat model used by the AI Agent. |
| `Extract Invoice with AI Agent` | _Inherits the connected chat model_ | No additional credentials—ensure the chat model node is connected. |
| `Store in Firebase` | Bearer token header (`FIREBASE_BEARER_TOKEN`) | Short-lived Google OAuth token for the Firestore REST API. |

Configure these credentials inside your n8n instance after importing the workflow.

### Environment variables

| Variable | Description |
| -------- | ----------- |
| `AI_AGENT_MODEL` | Optional override for the OpenAI chat model ID (defaults to `gpt-4.1-mini`). |
| `FIREBASE_PROJECT_ID` | Firebase project identifier used to build the Firestore REST URL. |
| `FIREBASE_BEARER_TOKEN` | OAuth 2.0 access token with permission to write to Firestore. Injected into the Authorization header. |

Set the environment variables in n8n under **Settings → Environment Variables** or at the process level.

### Firebase document format

Documents are stored in `invoiceHistory` under the default Firestore database using the `messageId` as the document ID. Each document contains:

- Original Gmail metadata (message ID, Gmail account label, supplier hint, subject, run ID).
- A `processedAt` timestamp.
- An `aiExtraction` map containing the AI agent response payload.

### Supplier configuration

The supplier list can be edited in [`packages/config/suppliers.yaml`](packages/config/suppliers.yaml). Keep the `tag` aligned with Gmail labels that classify supplier messages. The same values are mirrored inside the workflow’s `Build Supplier Query` function node to keep the example self-contained—update both places or externalize the data source as you evolve the project.

## Next steps

- Wire up CI/CD or automation scripts for deploying configuration updates to n8n.
- Add unit/integration tests around any supporting services that consume data from Firebase.
- Expand the monorepo with additional packages (e.g., AI agent client, Firebase adapters) as the system grows.

