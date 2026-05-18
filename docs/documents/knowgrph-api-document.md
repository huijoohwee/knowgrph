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
- Purpose: run the bounded rich-media goal loop with typed provider contracts, trace persistence, artifact provenance, resume, verification, and deterministic mock providers.
- Implementation: [superagent_harness.py](../../knowgrph_parser/superagent_harness.py) and [server.js](../../mcp/server.js)

### YouTube transcript conversion

- Path: `/__youtube_transcript?url=<encoded>[&lang=<code>]` (POST)
- Purpose: convert YouTube transcripts/subtitles/captions into Markdown for the Markdown Editor/Preview/Slides and return a transcript JSON payload for JSON-backed markdown workspace and UI Editor flows.
- Implementation: [vite.config.ts](../../canvas/vite.config.ts)

## Production note

These middleware endpoints exist for local development and preview builds. For production deployments, mirror the same routes in a real server (or replace them with a dedicated service) so the UI can continue to:
- Proxy remote media safely
- Trigger pipeline tasks where appropriate

Production API work must keep root-owned configuration, path policy, and provider dispatch as the single source of truth. Fix stale behavior in Dev, then sync the mirror and schema/API docs from the canonical source.
