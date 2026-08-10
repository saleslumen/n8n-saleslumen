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

- **API Key**: Your organization API key, such as `sl_key_...`.
- **Organization ID**: Your organization UUID.

The credential sends `sl-api-key` and `sl-organization-id`. Organization API keys are never sent as bearer tokens.

## Resources and operations

| Resource | Operations |
| --- | --- |
| Email | Discover, Verify, Verify Catch-All |
| Campaign | Create, get, list, and update campaigns; enroll people; create, get, list, update, delete, and reorder sequences and steps |
| Workflow | Create, get, and list workflows; start and get executions |
| Apps Script | Create and get projects, update project content, and run functions |

## Example: verify an email address

1. Create a workflow and add a **Manual Trigger** node.
2. Add the **Saleslumen** node and connect it to the trigger.
3. Select or create your **Saleslumen API** credential.
4. Set **Resource** to **Email**.
5. Set **Operation** to **Verify**.
6. Enter `alex@example.com` in **Email**. Alternatively, leave **Email** empty and provide an `email` field in each incoming item.
7. Run the workflow. The node emits one item for each verification result.

For API behavior and response fields, see the [Saleslumen developer documentation](https://developers.saleslumen.com).

## Development

```bash
npm install
npm run build
npm run lint
npm run dev
```

Development rules are documented in `AGENTS.md` and `SALESLUMEN.md`.
