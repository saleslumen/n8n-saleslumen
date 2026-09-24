# Saleslumen n8n package — agent harmony

One scoped npm package (`@saleslumen/n8n-nodes-saleslumen`), one Saleslumen action node, and one shared credential.

## Ownership (do not cross)

| Owner | Paths |
| --- | --- |
| Front / orchestrator | `package.json`, `credentials/`, `nodes/shared/`, `AGENTS.md`, `SALESLUMEN.md`, `.github/`, root configs |
| Saleslumen node | `nodes/Saleslumen/**` |

Do **not** change `package.json` credentials/nodes lists unless the registered node or credential changes. Do **not** add runtime `dependencies`.

## Shared system (use these)

- Credential type name: `saleslumenApi` (`credentials/SaleslumenApi.credentials.ts`)
- Headers injected: exactly one of `sl-api-key` or `Authorization: Bearer`, plus `sl-organization-id`
- Transport: `nodes/shared/transport.ts` → `saleslumenApiRequest`, `mapSaleslumenApiError`, `parseNdjson`, `sleep`, `PRODUCT_BASE_URLS`
- Style: one programmatic node with resource-specific property and execution modules
- Docs to follow: root `AGENTS.md` + `.agents/*` + [n8n UX guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/ux-guidelines/)
- API reference: [Saleslumen developer documentation](https://developers.saleslumen.com)

## Product hosts

| Product | Base URL |
| --- | --- |
| Emails | `https://emails.saleslumenapis.com` |
| Campaigns | `https://campaigns.saleslumenapis.com` |
| Workflows | `https://workflows.saleslumenapis.com` |
| Apps Script | `https://script.saleslumenapis.com` |

## Node structure

| Purpose | Path |
| --- | --- |
| Registered node and codex | `nodes/Saleslumen/Saleslumen.node.ts`, `nodes/Saleslumen/Saleslumen.node.json` |
| Resource modules | `nodes/Saleslumen/appsScript.ts`, `campaigns.ts`, `emails.ts`, `workflows.ts` |
| Shared transport | `nodes/shared/transport.ts` |

The registered node exposes Email, Campaign, Workflow, and Apps Script as resources. Resource modules own their operation parameters and execution logic.

## Quality bar before done

1. Implementation complete for the assigned v1 operations (not stubs)
2. `continueOnFail()` + `pairedItem` respected
3. Actionable errors (especially 402 credits)
4. English-only UI copy; Title Case labels; sentence-case actions/descriptions
5. From package root: `npm run build` and `npm run lint` succeed after your changes (fix only your files if needed)

## v1 operation scopes

### Emails

- Discover → `GET /v1/tools:discover` with poll on `pending`/`running`
- Verify → `POST /v1/tools:verify` JSON `{ emails, features }` where `features` is `STANDARD`, `CATCH_ALL`, or both. Response is NDJSON.
- Docs: [Discover and validate](https://developers.saleslumen.com/en-US/emails/guides/discover-and-validate), [Tools API](https://developers.saleslumen.com/en-US/emails/reference/apis/tools)

### Campaigns

- Campaigns API 2.0.0 under `/v1/campaigns`
- Create sends `display_name`, `organization` (`organizations/{id}`), and `request_id`
- Lifecycle commands replace writing `state`: activate, pause, resume, complete, archive, unarchive
- Update sends `campaign`, `update_mask`, `etag`, and `request_id`
- People enroll with `POST /v1/campaigns/{id}/people`
- Sequences are trees. Create is triggered-only. Update replaces the tree. There is no step resource.
- Docs: [Campaigns](https://developers.saleslumen.com/en-US/campaigns)

### Workflows

- Create, update, get, list, publish, activate, deactivate
- Start and resume require a user access token. Cancel, get, and list accept an API key.
- Default start runs the published active workflow. `versionId` previews a draft.
- Docs: [Workflows](https://developers.saleslumen.com/en-US/workflows)

### Apps Script

- Create and get projects; replace content with `PUT /v1/projects/{script_id}/content`
- Run is `POST /v1/scripts/{script_id}:run` and requires a user access token
- A started failure is HTTP 200 with `response.success` false. Read `response`, not `Operation.error`.
- Docs: [Apps Script](https://developers.saleslumen.com/en-US/apps-script)

## Verified-node constraints

- MIT, no runtime dependencies, no `process.env` / filesystem
- One third-party service and one regular action node with product resources
- Publish later via GitHub Actions provenance (orchestrator owns release)
