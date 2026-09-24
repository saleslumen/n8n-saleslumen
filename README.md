# @saleslumen/n8n-nodes-saleslumen

Use Saleslumen Emails, Campaigns, Workflows, and Apps Script from one n8n action node.

## Installation

To install the package in n8n:

1. Open **Settings → Community Nodes**.
2. Select **Install**.
3. Enter `@saleslumen/n8n-nodes-saleslumen` as the npm package name.
4. Accept the community-node installation notice and select **Install**.

After installation, add the **Saleslumen** node to a workflow.

## Authentication

Create a **Saleslumen API** credential in n8n with:

- **Authentication**: API Key or Access Token. Use one credential type at a time.
- **API Key**: Your organization API key, such as `sl_key_...`. Sent as `sl-api-key`.
- **Access Token**: A user OAuth2 access token or user JWT. Sent as `Authorization: Bearer`. Required for workflow start and resume, and for Apps Script run.
- **Organization ID**: Your organization UUID. Sent as `sl-organization-id`.
- **Namespace ID**: Your namespace UUID. Sent as `sl-namespace-id`. Leave it empty to stay on the organization.

Organization API keys are never sent as bearer tokens. An access-token credential does not send `sl-api-key`.

## Resources and operations

| Resource | Operations |
| --- | --- |
| Email | Discover; verify with Standard, Catch-All, or both |
| Campaign | Create, get, list, update, delete, and lifecycle commands; set variables and sender accounts; enroll a person; create, get, list, replace, and delete sequences |
| Workflow | Create, update, get, and list workflows; publish, activate, and deactivate; start, resume, cancel, get, and list executions |
| Apps Script | Create and get projects, update project content, and run functions |

## Example: verify an email address

1. Create a workflow and add a **Manual Trigger** node.
2. Add the **Saleslumen** node and connect it to the trigger.
3. Select or create your **Saleslumen API** credential.
4. Set **Resource** to **Email**.
5. Set **Operation** to **Verify**.
6. Select **Standard** under **Features**.
7. Enter `alex@example.com` in **Email**. Alternatively, leave **Email** empty and provide an `email` field in each incoming item.
8. Run the workflow. The node emits one item for each verification result.

For API behavior and response fields, see the [Saleslumen developer documentation](https://developers.saleslumen.com).

## Development

```bash
npm install
npm run build
npm run lint
npm test
npm run dev
```

Development rules are documented in `AGENTS.md` and `SALESLUMEN.md`.
