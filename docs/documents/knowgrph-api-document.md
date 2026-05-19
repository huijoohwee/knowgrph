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
- Storage and payments API: `cloudflare/workers/knowgrph-storage` -> Cloudflare Worker `knowgrph-storage` at `airvio.co/api/storage/*` and `airvio.co/api/payments/*`
- Dev-only tooling routes such as remote media proxying and markdown pipeline execution must be promoted to a real server route before relying on them in production.

Production API work must keep root-owned configuration, path policy, provider dispatch, and responsive workspace metadata as the single source of truth. Fix stale behavior in Dev, then sync the mirror and schema/API docs from the canonical source.
