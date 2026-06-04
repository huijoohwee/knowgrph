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
- Purpose: run the bounded long-horizon research/code/create artifact loop across `quick_triage`, `bounded_compile`, `deep_research`, and `parallel_build` task levels with typed provider contracts, `skill.select`, `research.scout`, `code.write_and_run`, bounded sandbox execution, trace persistence, artifact provenance, run memory, resume, verification, deterministic mock providers, optional local PixVerse MCP `providerMode`, and mobile-first responsive workspace metadata.
- Implementation: [superagent_harness.py](../../knowgrph_parser/superagent_harness.py), local stdio transport in [server.js](../../mcp/server.js), and local MCP tool-contract ownership in [local-tool-contract.js](../../mcp/local-tool-contract.js)
- Boundary: DeerFlow is conceptual inspiration only for message gateway, memory, tools, skills, subagents, sandboxed workspace artifacts, and minutes-to-hours runs. The API docs must not copy DeerFlow code, clone its architecture, or describe the local harness as a deployed Pages/WebMCP mutation route.
- Contract source: [README.md](../../mcp/README.md) and [knowgrph-mcp-service-prd-tad.companion.md](knowgrph-mcp/knowgrph-mcp-service-prd-tad.companion.md)

### API-native browser MCP bridge

- MCP tool: `knowgrph.browser_api.run`
- API-route operations: `health`, `search`, `searchDomain`, `resolve`, `login`, `cookieImport`, `skills`, `stats`, `feedback`, `verify`, `issues`, `execute`
- Native browser operations: `go`, `snap`, `click`, `fill`, `type`, `press`, `select`, `scroll`, `submit`, `screenshot`, `text`, `markdown`, `cookies`, `eval`, `sync`, `close`, `skill`, `sessions`
- Purpose: let any MCP client call a local browser/API runtime that resolves first-party browser routes, executes resolved skills, and can fall back to native browser capture/action flows without copying a vendor implementation.
- Safety: execution forwards `dry_run=true` by default, rejects non-loopback runtime URLs unless explicitly enabled by server environment, normalizes browser target URLs to credential-free `http`/`https`, requires `confirm_unsafe` for live route execution/native browser mutations, and requires `confirm_cookie_import` before cookie storage access.
- Configuration: MainPanel MCP owns `browser.apiNative.mcp.*` rows, direct browser-MCP `mcpServers` JSON using `UNBROWSE_URL`, and a separate local bridge config using `KNOWGRPH_BROWSER_API_RUNTIME_URL`. Target URLs are caller- or setting-supplied, validated before forwarding, and never injected from a default site.
- Contract source: [README.md](../../mcp/README.md), [local-tool-contract.js](../../mcp/local-tool-contract.js), and [knowgrph-mcp-service-prd-tad.companion.md](knowgrph-mcp/knowgrph-mcp-service-prd-tad.companion.md)

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
- Server-side storage fetch origin: `https://knowgrph-storage.huijoohwee.workers.dev` for Pages or future MCP Worker reads of published Source Files / markdown docs
- Payments API: `cloudflare/workers/knowgrph-payment` -> Cloudflare Worker `knowgrph-payment` at `airvio.co/api/payments/*`
- Dev-only tooling routes such as remote media proxying and markdown pipeline execution must be promoted to a real server route before relying on them in production.

Production API work must keep root-owned configuration, path policy, provider dispatch, and responsive workspace metadata as the single source of truth. Fix stale behavior in Dev, then sync the mirror and schema/API docs from the canonical source.

## Production Worker API

### Storage Worker: `knowgrph-storage`

Route owner: `cloudflare/workers/knowgrph-storage`. Cloudflare route: `airvio.co/api/storage/*`. The Worker owns the D1 schema/query layer through Drizzle; browser storage is cache-only and is not the canonical persistence surface.

Canonical public/browser URL space stays on `https://airvio.co/api/storage/*`. Server-side readers inside Cloudflare Pages or future MCP Workers should fetch from `https://knowgrph-storage.huijoohwee.workers.dev` to avoid custom-domain self-fetch rewrites while reusing the same Worker implementation and D1 data.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/storage/push` | Push local workspace mutations into D1 |
| POST | `/api/storage/pull` | Pull D1 mutations since a cursor |
| GET | `/api/storage/export/{workspaceId}` | Export the full workspace storage bundle as JSON |
| GET | `/api/storage/doc-default/{canonicalPath}` | Serve the latest markdown for one canonical Source File from the default published workspace |
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
| GET | `/api/payments/stripe/checkout/session?session_id=...` | Read minimal locally-owned Checkout payment state from D1, or server-refresh an existing open/unpaid row from Stripe |
| POST | `/api/payments/stripe/webhook` | Verify Stripe webhook signatures and store Checkout Session events |
| POST | `/api/payments/commerce/solana-pay/settle` | Confirm a Solana Pay ACP checkout session from an operator-owned Solana RPC transaction lookup |

Required production runtime configuration lives on `knowgrph-payment`, not on Cloudflare Pages project variables:

| Variable | Required For |
|---|---|
| `STRIPE_RESTRICTED_KEY` or `STRIPE_SECRET_KEY` | Stripe API authentication; Worker secret only, never visible Worker `[vars]` |
| `STRIPE_CHECKOUT_PRICE_ID` or `STRIPE_CHECKOUT_CURRENCY` + `STRIPE_CHECKOUT_UNIT_AMOUNT` + `STRIPE_CHECKOUT_PRODUCT_NAME` | Non-secret Worker `[vars]` server-owned checkout price authority |
| `STRIPE_CHECKOUT_MODE` | Optional non-secret Worker `[vars]` checkout mode, `payment` by default or `subscription` with `STRIPE_CHECKOUT_PRICE_ID` |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification; Worker secret only, never visible Worker `[vars]` |
| `STRIPE_CHECKOUT_RETURN_ORIGIN` | Optional non-secret Worker `[vars]` return-origin override |
| `SOLANA_PAY_RECIPIENT` | Solana Pay recipient address for `payment_rail="solana_pay"` checkout sessions |
| `SOLANA_PAY_SPL_TOKEN` | Required non-secret Worker `[vars]` mint address for non-SOL Solana Pay currencies such as USDC |
| `SOLANA_PAY_RPC_URL` | Worker secret or private binding used only by the Worker to confirm Solana Pay transfers |
| `SOLANA_PAY_LABEL`, `SOLANA_PAY_NETWORK`, `SOLANA_PAY_COMMITMENT`, `SOLANA_PAY_AMOUNT_SCALE` | Optional Solana Pay transfer URL and settlement normalization controls |

The explicit `--deploy-visible-vars --apply --yes --confirm=apply-stripe-payment-worker-config` configure path can deploy a freshly written checkout price authority before live Checkout smoke.

Checkout creation accepts `successUrl`, `cancelUrl`, optional `workspaceId`, and optional `agenticCommerceSessionId`. Agentic hosted Checkout also requires `expectedAmountTotal` and `expectedCurrency`; the ACP create route derives those from the checkout session before persistence. The Worker validates both return URLs against `STRIPE_CHECKOUT_RETURN_ORIGIN` when set, otherwise against the Checkout route origin; caller `Origin` headers never define hosted Checkout redirect authority. The ACP create route can also include `stripe_checkout { success_url, cancel_url, workspace_id }`; the Worker creates hosted Checkout through the same server-owned helper and returns `session.stripe_checkout.url`. Inline price tuples are checked against the ACP total before Stripe is called; Price-ID-backed sessions are checked against Stripe's returned `amount_total`/`currency`, and mismatched open Sessions are expired before any ACP session or Stripe audit row is written. If the local Stripe checkout audit row cannot be persisted after Stripe creation, the Worker expires the hosted Session before returning 500 so human and agentic callers do not receive an untracked Checkout URL. If Stripe creation succeeds but ACP session persistence fails before the handoff is owned, the Worker expires the hosted Session before returning 500 and refreshes the Stripe audit row to `expired` when D1 is still writable. The Worker appends `session_id={CHECKOUT_SESSION_ID}` to success URLs that omit it, sends `metadata[workspace_id]`, `metadata[acp_session_id]`, `metadata[expected_amount_total]`, and `metadata[expected_currency]` to Stripe when present, uses the ACP session id as `client_reference_id` for agentic reconciliation, and sends that same non-sensitive ACP id as Stripe `Idempotency-Key` so agentic Checkout retries cannot create duplicate hosted Sessions. Human Paywall Checkout intentionally omits Stripe idempotency so each Open Checkout action creates a fresh Session. Stripe webhook settlement claims each Stripe event id as `processing` with nullable `processed_at`, acknowledges same-payload `processing` or `processed` duplicate event ids without rewriting Checkout audit rows or replaying side effects, rejects conflicting payloads for an already recorded event id with 409, marks successful side effects `processed`, and marks failed side effects `failed` so Stripe retries can process the same event id later. Stale `processing` claims are reclaimed instead of being acknowledged forever. First-time settlement requires `metadata[acp_session_id]`, `client_reference_id`, amount, and currency to match the same fiat ACP checkout session; `checkout.session.async_payment_failed` marks the matching fiat ACP session `payment_failed`, refreshes the embedded `stripe_checkout` summary, and writes no proof. `checkout.session.expired` and status-route live refreshes that return `status=expired` mark the matching fiat ACP session `cancelled`, refresh `stripe_checkout`, trace `knowgrph.commerce.checkout_expired`, and write no proof. Later paid Stripe events for a `cancelled` or `payment_failed` ACP session update the Stripe audit row but cannot complete ACP, call OpenBOX, or write proof. Oversized `client_reference_id` values fail closed before the Stripe API call. Direct ACP delegate-token completion is accepted only for fiat sessions that did not request hosted Stripe Checkout and are not already `cancelled` or `payment_failed`; hosted Checkout sessions must complete through verified Stripe webhook or status refresh. Solana Pay ACP checkout sessions use `payment_rail="solana_pay"` and return `session.solana_pay.url` with a deterministic session reference, memo, recipient, amount, network, and SPL token when configured; the session remains `pending_onchain` until the Worker validates a submitted transaction signature through `SOLANA_PAY_RPC_URL`. Solana Pay settlement accepts the dedicated route or canonical checkout completion path, requires the generated reference and memo to appear in the confirmed transaction, validates recipient and amount against SPL token balance deltas or SOL lamport deltas, writes the normal ACP proof, and rejects the generic commerce webhook so an unverified callback cannot complete Solana Pay. If the browser or agent returns before Stripe delivers the webhook, the status route retrieves Stripe live status only for an existing locally-owned Checkout Session row, persists server-side Stripe audit fields in D1, returns only minimal payment state in public JSON, and settles the matching ACP fiat session only when `payment_status` is `paid` or `no_payment_required` and `metadata[acp_session_id]`, `client_reference_id`, amount, and currency still match; the route accepts only the canonical `session_id` query parameter, unknown `session_id` values fail with 404 before Stripe is called, legacy `id` aliases fail with 400, and `status=complete` alone does not unlock payment. Public status JSON omits customer identifiers, Stripe metadata, hosted Checkout URLs, and workspace ids; those values remain server-side in D1 for webhook/ACP reconciliation. The Canvas paywall creates a fresh server-managed Session through the Worker for each Open Checkout action, redirects the current browser window to the hosted Checkout URL, and treats that URL as session-only runtime state rather than a browser setting. Any Checkout return clears the transient URL; only paid or no-payment-required returns close the paywall, while cancelled/expired/unpaid returns remain locked. Run `npm run payment:stripe:configure` to validate operator-supplied environment values and dry-run the Worker secret names that would be applied; it rejects Stripe credential names in visible Worker `[vars]`, writes checkout price authority to `wrangler.toml` only with `-- --write-visible-vars --yes --confirm=apply-stripe-payment-worker-config`, rejects `STRIPE_CHECKOUT_MODE` and `STRIPE_CHECKOUT_RETURN_ORIGIN` process input because mode and return origin are non-secret Worker `[vars]` config that readiness must inspect, and never creates Stripe Products, Prices, Checkout Sessions, webhook endpoints, or D1 migrations. Mutating Cloudflare Worker secrets requires `-- --apply --yes --confirm=apply-stripe-payment-worker-config`; deploy `payment:worker:deploy` after visible Worker `[vars]` changes before live Checkout smoke. Apply D1 migrations separately with `npx wrangler d1 migrations apply knowgrph-storage --remote --config cloudflare/workers/knowgrph-payment/wrangler.toml`; the Stripe webhook processing migration rebuilds `stripe_webhook_events` so `processed_at` can stay `NULL` while an event is claimed as `processing`. Run `npm run payment:stripe:readiness` to check Worker secret names, visible Worker `[vars]` checkout mode, return origin, and price authority, plus remote D1 payment tables/columns/constraints without creating Stripe sessions; it fails if Stripe credentials appear in visible Worker `[vars]` and fails if checkout price authority, checkout mode, or return origin is hidden as a Worker secret. Add `-- --live-checkout-create` only for an intentional bounded hosted Checkout create-and-expire smoke after production config and schema are approved; the Worker creates, persists, expires, and withholds the hosted URL for that test Session. Use `-- --live-checkout-timeout-ms=<ms>` only when intentionally adjusting the smoke timeout. Current live context as of 2026-06-04: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are configured on `knowgrph-payment`, and remote D1 has no pending payment migrations; checkout still fails closed until visible Worker `[vars]` checkout price authority is configured and deployed.
