# Knowgrph API Surfaces (Dev/Preview)

Knowgrph Canvas is primarily a client-side app. Local “API” surfaces used by the UI are implemented as Vite middleware during **dev** and **preview** runs.

## Endpoints

### Remote media fetch proxy

- Path: `/__fetch_remote?url=<encoded>`
- Purpose: serve remote images/media through same-origin to reduce CORS/ORB issues.
- Used by:
  - Node media panels (remote `image/video/iframe` sources)
  - Markdown slide backgrounds via `applyMediaProxySrc(...)`
- Implementation: [vite.config.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/vite.config.ts)

### Run markdown pipeline (dev tooling)

- Path: `/__run_markdown_pipeline` (POST)
- Purpose: allow the UI/dev workflow to trigger the repo-level markdown pipeline once.
- Implementation: [vite.config.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/vite.config.ts)

### YouTube transcript → Markdown (dev/preview)

- Path: `/__youtube_transcript` (POST)
- Purpose: convert a YouTube URL/ID into Markdown (Slidev-compatible `---` splits) so Canvas can ingest it like any Markdown document.
- Used by:
  - Source Files → YouTube import button
- Implementation:
  - Vite middleware: [vite.config.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/vite.config.ts)
  - Python command: [youtube_cmd.py](file:///Users/huijoohwee/Documents/GitHub/knowgrph/knowgrph_parser/youtube_cmd.py)

## Production note

These middleware endpoints exist for local development and preview builds. For production deployments, mirror the same routes in a real server (or replace them with a dedicated service) so the UI can continue to:
- Proxy remote media safely
- Trigger pipeline tasks where appropriate
