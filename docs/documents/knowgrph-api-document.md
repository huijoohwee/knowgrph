# Knowgrph API Surfaces (Dev/Preview)

Knowgrph Canvas is primarily a client-side app. Local “API” surfaces used by the UI are implemented as Vite middleware during **dev** and **preview** runs.

## Endpoints

### Remote media fetch proxy

- Path: `/__fetch_remote?url=<encoded>`
- Purpose: serve remote images/media through same-origin to reduce CORS/ORB issues.
- Limits: bounded upstream timeout and max response size (prevents hanging requests and unbounded memory).
- Used by:
  - Node media panels (remote `image/video/iframe` sources)
  - Markdown slide backgrounds via `applyMediaProxySrc(...)`
- Implementation: [vite.config.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/vite.config.ts)

### Run markdown pipeline (dev tooling)

- Path: `/__run_markdown_pipeline` (POST)
- Purpose: allow the UI/dev workflow to trigger the repo-level markdown pipeline once.
- Implementation: [vite.config.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/vite.config.ts)

### YouTube transcript conversion

- Path: `/__youtube_transcript?url=<encoded>[&lang=<code>]` (POST)
- Purpose: convert YouTube transcripts/subtitles/captions into Markdown for the Markdown Editor/Preview/Slides and return a transcript JSON payload for the Bottom Panel JSON Editor.
- Implementation: [vite.config.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/vite.config.ts)

## Production note

These middleware endpoints exist for local development and preview builds. For production deployments, mirror the same routes in a real server (or replace them with a dedicated service) so the UI can continue to:
- Proxy remote media safely
- Trigger pipeline tasks where appropriate
