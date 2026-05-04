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

These middleware endpoints exist for local development and preview builds. For production deployments, mirror the same routes in a real server (or replace them with a dedicated service) so the UI can continue to:
- Proxy remote media safely
- Trigger pipeline tasks where appropriate
