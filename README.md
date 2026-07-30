# n8n-nodes-saleslumen

Saleslumen verified community nodes — one package, one node per product:

| Node | Host | v1 ops |
| --- | --- | --- |
| Saleslumen Emails | `emails.saleslumenapis.com` | Discover, Verify, Verify Catch-All |
| Saleslumen Campaigns | `campaigns.saleslumenapis.com` | Campaign create/get/list/update, Person enroll |
| Saleslumen Workflows | `workflows.saleslumenapis.com` | Workflow create/get/list, Execution start/get |
| Saleslumen Apps Script | `script.saleslumenapis.com` | Project create/get/update content, Function run |

## Auth

Credential **Saleslumen API**:

- `sl-api-key: sl_key_...`
- `sl-organization-id: <uuid>`

Never send an organization API key as `Authorization: Bearer`.

## Develop

```bash
npm install
npm run build
npm run lint
npm run dev
```

Agent rules: `AGENTS.md` + `SALESLUMEN.md`. Docs: https://developers.saleslumen.com
