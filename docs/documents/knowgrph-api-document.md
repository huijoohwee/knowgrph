# Knowgrph API Surfaces (Dev/Preview)

Knowgrph Canvas is primarily a client-side app. Local “API” surfaces used by the UI are implemented as Vite middleware during **dev** and **preview** runs.

## Execution boundary

- Dev SSOT: `/Users/huijoohwee/Documents/GitHub/knowgrph`
- Prod artifact mirror: `/Users/huijoohwee/Documents/GitHub/huijoohwee/content/knowgrph`
- Cloudflare route: `airvio.co/knowgrph`

API and MCP contracts are owned upstream in Dev. Production mirrors should receive synced artifacts only after upstream validation passes; do not patch generated API behavior inside the publish directory.

## Endpoints

### Remote media fetch proxy

- Path: `/__fetch_remote?url=<encoded>`
- Purpose: serve remote images/media through same-origin to reduce CORS/ORB issues.
- Limits: bounded upstream timeout and max response size (prevents hanging requests and unbounded memory).
- Used by:
  - Node media panels (remote `image/video/iframe` sources)
  - Markdown slide backgrounds via `applyMediaProxySrc(...)`
- Implementation: [vite.config.ts](../../canvas/vite.config.ts)

### Run markdown pipeline (dev tooling)

- Path: `/__run_markdown_pipeline` (POST)
- Purpose: allow the UI/dev workflow to trigger the repo-level markdown pipeline once.
- Implementation: [vite.config.ts](../../canvas/vite.config.ts)

### Super-agent harness (CLI/MCP)

- CLI: `python3 -m knowgrph_parser superagent` or `python3 -m knowgrph_parser run-goal`
- MCP tool: `knowgrph.superagent.run`
- Purpose: run the bounded rich-media goal loop with typed provider contracts, trace persistence, artifact provenance, resume, verification, deterministic mock providers, and mobile-first responsive workspace metadata.
- Implementation: [superagent_harness.py](../../knowgrph_parser/superagent_harness.py) and [server.js](../../mcp/server.js)

### API-native browser MCP bridge

- MCP tool: `knowgrph.browser_api.run`
- API-route operations: `health`, `search`, `searchDomain`, `resolve`, `login`, `cookieImport`, `skills`, `stats`, `feedback`, `verify`, `issues`, `execute`
- Native browser operations: `go`, `snap`, `click`, `fill`, `type`, `press`, `select`, `scroll`, `submit`, `screenshot`, `text`, `markdown`, `cookies`, `eval`, `sync`, `close`, `skill`, `sessions`
- Purpose: let any MCP client call a local browser/API runtime that resolves first-party browser routes, executes resolved skills, and can fall back to native browser capture/action flows without copying a vendor implementation.
- Safety: execution forwards `dry_run=true` by default, rejects non-loopback runtime URLs unless explicitly enabled by server environment, requires `confirm_unsafe` for live route execution/native browser mutations, and requires `confirm_cookie_import` before cookie storage access.
- Configuration: MainPanel MCP owns `browser.apiNative.mcp.*` rows, direct browser-MCP `mcpServers` JSON using `UNBROWSE_URL`, and a separate local bridge config using `KNOWGRPH_BROWSER_API_RUNTIME_URL`. Target URLs are caller- or setting-supplied; the bridge does not inject a default site.

Responsive output contract:

- Workspace artifacts should expose widget bounds, fit strategy, edge anchors, overflow handling, and panel behavior for mobile, tablet, desktop, wide-canvas, and 1920x1080 proof classes.
- API or MCP wrappers must return responsive verification status alongside artifact paths so callers can tell whether generated Text, Image, Video, and Rich Media Panel widgets remain reachable on narrow screens.
- Editor Workspace launch paths must use the root workspace width defaults and shared canvas gutter token; downstream API/publish routes must not remap mobile pane widths locally.
- Dev, preview, Prod mirror, and Cloudflare production must consume the same responsive metadata; do not patch mobile behavior in downstream route handlers or generated publish files.

### YouTube transcript conversion

- Path: `/__youtube_transcript?url=<encoded>[&lang=<code>]` (POST)
- Purpose: convert YouTube transcripts/subtitles/captions into Markdown for the Markdown Editor/Preview/Slides and return a transcript JSON payload for JSON-backed markdown workspace and UI Editor flows.
- Implementation: [vite.config.ts](../../canvas/vite.config.ts)

## Production note

These middleware endpoints exist for local development and preview builds. Current production is split by concern:

- Static SPA: `knowgrph/canvas/dist` -> `huijoohwee/content/knowgrph` -> Cloudflare Pages at `airvio.co/knowgrph`
- Storage API: `cloudflare/workers/knowgrph-storage` -> Cloudflare Worker `knowgrph-storage` at `airvio.co/api/storage/*`
- Payments API: `cloudflare/workers/knowgrph-payment` -> Cloudflare Worker `knowgrph-payment` at `airvio.co/api/payments/*`
- Dev-only tooling routes such as remote media proxying and markdown pipeline execution must be promoted to a real server route before relying on them in production.

Production API work must keep root-owned configuration, path policy, provider dispatch, and responsive workspace metadata as the single source of truth. Fix stale behavior in Dev, then sync the mirror and schema/API docs from the canonical source.

## Production Worker API

### Storage Worker: `knowgrph-storage`

Route owner: `cloudflare/workers/knowgrph-storage`. Cloudflare route: `airvio.co/api/storage/*`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/storage/push` | Push local workspace mutations into D1 |
| POST | `/api/storage/pull` | Pull D1 mutations since a cursor |
| GET | `/api/storage/export/{workspaceId}` | Export the full workspace storage bundle as JSON |
| GET | `/api/storage/doc/{workspaceId}/{canonicalPath}` | Serve the latest markdown for one canonical Source File |
| GET | `/api/storage/source-files` | Serve the default workspace Source Files crawler index |
| GET | `/api/storage/source-files/{workspaceId}` | Serve a workspace-scoped Source Files crawler index |
| GET | `/api/storage/llms.txt` | Serve the default LLM crawler entrypoint |
| GET | `/api/storage/source-files/{workspaceId}/llms.txt` | Serve a workspace-scoped LLM crawler entrypoint |

Crawler access is read-only. It reads existing D1 document rows and doc-view links; it does not import, parse, render, mutate storage, or emulate Cloudflare Pay Per Crawl.

Pay Per Crawl headers are Cloudflare-owned:

| Header | Direction | Owner |
|---|---|---|
| `crawler-exact-price` | AI crawler request | Cloudflare/Web Bot Auth flow |
| `crawler-max-price` | AI crawler request | Cloudflare/Web Bot Auth flow |
| `crawler-price` | Cloudflare response | Cloudflare zone policy |
| `crawler-charged` | Cloudflare response | Cloudflare zone policy |
| `crawler-error` | Cloudflare response | Cloudflare zone policy |

### Payment Worker: `knowgrph-payment`

Route owner: `cloudflare/workers/knowgrph-payment`. Cloudflare route: `airvio.co/api/payments/*`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/payments/stripe/checkout/session` | Create a hosted Stripe Checkout Session server-side |
| GET | `/api/payments/stripe/checkout/session?session_id=...` | Read stored Checkout Session state from D1 |
| POST | `/api/payments/stripe/webhook` | Verify Stripe webhook signatures and store Checkout Session events |

Required production runtime configuration lives on `knowgrph-payment`, not on Cloudflare Pages project variables:

| Variable | Required For |
|---|---|
| `STRIPE_RESTRICTED_KEY` or `STRIPE_SECRET_KEY` | Stripe API authentication |
| `STRIPE_CHECKOUT_PRICE_ID` or `STRIPE_CHECKOUT_CURRENCY` + `STRIPE_CHECKOUT_UNIT_AMOUNT` + `STRIPE_CHECKOUT_PRODUCT_NAME` | Server-owned checkout price authority |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `STRIPE_CHECKOUT_RETURN_ORIGIN` | Optional return-origin override |

Current live context as of 2026-05-19: `STRIPE_SECRET_KEY` is configured on `knowgrph-payment`; checkout still fails closed until server-owned checkout price authority is configured.
