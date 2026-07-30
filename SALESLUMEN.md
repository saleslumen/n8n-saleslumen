# Saleslumen n8n package — agent harmony

One npm package (`n8n-nodes-saleslumen`), one node per product, shared credential.

## Ownership (do not cross)

| Owner | Paths |
| --- | --- |
| Front / orchestrator | `package.json`, `credentials/`, `nodes/shared/`, `AGENTS.md`, `SALESLUMEN.md`, `.github/`, root configs |
| Emails agent | `nodes/SaleslumenEmails/**` only |
| Campaigns agent | `nodes/SaleslumenCampaigns/**` only |
| Workflows agent | `nodes/SaleslumenWorkflows/**` only |
| Apps Script agent | `nodes/SaleslumenAppsScript/**` only |

Do **not** edit another agent’s folder. Do **not** change `package.json` credentials/nodes lists (already registered). Do **not** add runtime `dependencies`.

## Shared system (use these)

- Credential type name: `saleslumenApi` (`credentials/SaleslumenApi.credentials.ts`)
- Headers injected: `sl-api-key`, `sl-organization-id` — never org API key as `Authorization: Bearer`
- Transport: `nodes/shared/transport.ts` → `saleslumenApiRequest`, `mapSaleslumenApiError`, `parseNdjson`, `sleep`, `PRODUCT_BASE_URLS`
- Style: **programmatic** `execute()` for every product node
- Docs to follow: root `AGENTS.md` + `.agents/*` + [n8n UX guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/ux-guidelines/)
- Monorepo API source of truth: `/home/qasim/Repositories/saleslumen/developers/docs/website/docs/<product>/`

## Product hosts

| Product | Base URL |
| --- | --- |
| Emails | `https://emails.saleslumenapis.com` |
| Campaigns | `https://campaigns.saleslumenapis.com` |
| Workflows | `https://workflows.saleslumenapis.com` |
| Apps Script | `https://script.saleslumenapis.com` |

## Node naming

| Display name | `name` | Folder / class |
| --- | --- | --- |
| Saleslumen Emails | `saleslumenEmails` | `SaleslumenEmails` |
| Saleslumen Campaigns | `saleslumenCampaigns` | `SaleslumenCampaigns` |
| Saleslumen Workflows | `saleslumenWorkflows` | `SaleslumenWorkflows` |
| Saleslumen Apps Script | `saleslumenAppsScript` | `SaleslumenAppsScript` |

Each folder must contain: `<Class>.node.ts`, `<Class>.node.json`, `saleslumen.svg`, `saleslumen.dark.svg` (or product-specific icons). Import shared helpers with a relative path (`../shared/transport`).

## Quality bar before done

1. Implementation complete for the assigned v1 operations (not stubs)
2. `continueOnFail()` + `pairedItem` respected
3. Actionable errors (especially 402 credits)
4. English-only UI copy; Title Case labels; sentence-case actions/descriptions
5. From package root: `npm run build` and `npm run lint` succeed after your changes (fix only your files if needed)

## v1 operation scopes

### Emails (wedge — richest)

- Discover → `GET /v1/tools:discover` with poll on `pending`/`running`
- Verify → `POST /v1/tools:verify` (`text/plain`, NDJSON fan-out)
- Verify Catch-All → `POST /v1/tools:verifyCatchAll`
- Docs: `developers/docs/website/docs/emails/guides/discover-and-validate.md`, `.../reference/apis/tools.md`

### Campaigns

- Core lifecycle: campaign CRUD; person enroll; sequence CRUD + reorder steps; step CRUD (archive on delete)
- Host: campaigns API; docs under `developers/docs/website/docs/campaigns/`
- Prefer declarative-friendly REST inside programmatic `execute` (resource+operation switch)

### Workflows

- Create/get workflow; start execution; get execution status (getting-started path)
- Host: workflows API; docs under `developers/docs/website/docs/workflows/`

### Apps Script

- Create/get project; run function (quickstart path)
- Host: script API; docs under `developers/docs/website/docs/apps-script/`

## Verified-node constraints

- MIT, no runtime dependencies, no `process.env` / filesystem
- One third-party service (Saleslumen) with product nodes — not unrelated APIs
- Publish later via GitHub Actions provenance (orchestrator owns release)
