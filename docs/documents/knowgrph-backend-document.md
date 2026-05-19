# Knowgrph Backend (Dev/Preview Middleware)

Knowgrph is primarily a client-side app (Vite + React). “Backend” functionality used by the UI is implemented as Vite middleware for **dev** and **preview** runs.

## Endpoints

### Remote media fetch proxy

- Path: `/__fetch_remote?url=<encoded>`
- Purpose: serve remote images/media through same-origin to reduce CORS/ORB issues.
- Used by:
  - Node media panels (remote `image/video/iframe` sources)
  - Markdown slide backgrounds via `applyMediaProxySrc(...)`
- Policy: apply proxy to any remote URL; forbid hardcoded domain rewrites; enforce bounded upstream time and size

Implementation:
- Vite middleware: [vite.config.ts](../../canvas/vite.config.ts)
- URL utility: [url.ts](../../canvas/src/lib/url.ts)

### Run markdown pipeline (dev tooling)

- Path: `/__run_markdown_pipeline` (POST)
- Purpose: allow the UI/dev workflow to trigger the repo-level markdown pipeline once.

Implementation:
- Vite middleware: [vite.config.ts](../../canvas/vite.config.ts)

### YouTube transcript → Markdown (+ JSON source)

- Path: `/__youtube_transcript?url=<encoded>[&lang=<code>]` (POST)
- Purpose: fetch YouTube transcripts/subtitles/captions (manual or generated) and convert into Markdown for the Markdown Editor/Preview/Slides, while also returning a JSON source payload suitable for JSON-backed markdown workspace and UI Editor flows.
- Runtime constraints: bounded Python subprocess execution (timeout) to forbid hanging imports.

Implementation:
- Vite middleware: [vite.config.ts](../../canvas/vite.config.ts)
- Python command: `python3 -m knowgrph_parser youtube --emit json --url ... [--lang ...]` ([youtube_cmd.py](../../knowgrph_parser/youtube_cmd.py))

## Production note

These middleware endpoints exist for local development and preview builds. Current production is split by concern:

- Static SPA: `knowgrph/canvas/dist` -> `huijoohwee/content/knowgrph` -> Cloudflare Pages at `airvio.co/knowgrph`
- Storage and payments API: `cloudflare/workers/knowgrph-storage` -> Cloudflare Worker `knowgrph-storage` at `airvio.co/api/storage/*` and `airvio.co/api/payments/*`
- Dev-only tooling routes such as remote media proxying and markdown pipeline execution must be promoted to a real server route before relying on them in production.

## Production Worker API (Cloudflare)

The Cloudflare Worker at `airvio.co/api/storage/*` provides storage sync and document access endpoints. See `knowgrph-storage-sync-document.md` for full specification.

### Public document view

- Path: `/api/storage/doc/:workspaceId/:canonicalPath*` (GET)
- Purpose: serve a single document's markdown content as `text/markdown` for public sharing, import, or programmatic access.
- Response: `200 text/markdown; charset=utf-8` with raw `content_md` from D1 `documents` table; `404` if not found.
- No authentication required.
- Implementation: [index.ts](../../cloudflare/workers/knowgrph-storage/index.ts) — see ADR-009 in storage-sync-document.md.

### Sync endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/storage/push` | Push workspace mutations to D1 |
| POST | `/api/storage/pull` | Pull mutations since cursor from D1 |
| GET | `/api/storage/export/:workspaceId` | Full workspace snapshot (JSON) |
