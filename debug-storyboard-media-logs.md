# Debug Session: storyboard-media-logs

- Status: OPEN
- Repo: `/Users/huijoohwee/Documents/GitHub/knowgrph`
- Scope: Canvas 2D Renderer storyboard -> FloatingPanel media -> drag/drop image/video -> Canvas -> Rich Media Panel
- Constraint: No business-logic modification before runtime evidence is collected

## Symptoms

- Browser console reports repeated `net::ERR_ABORTED` module and media requests while interacting with storyboard media insertion paths.
- Failure appears adjacent to Canvas/FloatingPanel/Rich Media flows and dev-server module loading.

## Hypotheses

1. Dynamic drag-drop media insertion triggers remount churn that aborts in-flight Vite module fetches.
2. Rich media source normalization misses canonical local-source reuse, forcing repeated teardown/reload cycles.
3. Canvas or FloatingPanel inspection/runtime hooks are causing an effect loop that continuously rebuilds media consumers.
4. Media token or object URL lifecycle is revoking or replacing active video/image sources before stabilization.
5. Route or layout state changes are racing with command-menu media insertion and causing aborted preview/module requests.

## Evidence Log

- Instrumentation confirmed storyboard drag/drop is single-fire and the reproduced payload URL is the tokenized `storage.accessUrl`, not a duplicate event loop.
- Pre-fix evidence from `.dbg/trae-debug-log-storyboard-media-logs.ndjson` shows storyboard media insertion persisted `kg_media_token` URLs into the primary media mutation path.
- Code-path trace confirmed the same long-lived token string was reused across:
  - FloatingPanel uploaded-media drag payloads
  - uploaded-media inline insertion into active card text
  - uploaded-media markdown source materialization for shared media files
- Root cause confirmed: synced uploaded media items kept reusing ephemeral `accessUrl` strings instead of deriving a fresh runtime URL from durable storage metadata (`publicUrl + runId`) at the moment of insertion/drag/materialization.
- Follow-up DOM tracing confirmed the user-facing storyboard "open media" action does not mount a canvas overlay panel directly; it opens `MediaLightbox`.
- The shared rich-media state contract originally missed storyboard fallback fields `mediaKind` + `mediaUrl`, so generic storyboard media could be misclassified as having no renderable image/video/audio payload.
- `MediaLightbox` originally mixed rendering paths: image used a raw `<img>` branch, video used a raw `<video>` branch, and audio used a raw `<audio>` branch.
- Root seam confirmed for the remaining visibility complaint: storyboard open-media bypassed the shared `RichMediaPanel` utilities for direct media surfaces.

## Fix

- Added `readUploadedMediaStorageRuntimeUrl()` and `readUploadedMediaPanelItemRuntimeUrl()` in `canvas/src/lib/storage/uploadedMediaPanelItems.ts` as the SSOT for browser-openable uploaded-media URLs.
- Rewired FloatingPanel uploaded-media drag payloads, inline card command candidates, and uploaded-media markdown materialization to call that SSOT helper instead of reusing stale `item.linkUrl` / `storage.accessUrl`.
- Kept the fix upstream and shared; no downstream storyboard-only patching or hardcoded alias layer was added.
- Extended `buildRichMediaPanelOverlayState()` to recognize storyboard fallback media fields `mediaKind` / `mediaUrl` and snake_case variants as real image/video/audio state.
- Reworked `MediaLightbox` so storyboard image, video, and audio openings all reuse the shared `RichMediaPanel` renderer instead of mixing raw media-element branches with panel rendering.

## Validation

- Focused regression: `uploadedMediaRuntimeUrl.test.ts`
  - confirms stale token strings are replaced for storage-derived runtime URLs
  - confirms uploaded-media drag payloads use fresh runtime URLs
- Focused regression: `richMediaPanelGenericMediaFields.test.ts`
  - confirms storyboard fallback media fields are recognized by the shared Rich Media panel SSOT
- Focused regression: `mediaLightboxRichMediaPanel.test.tsx`
  - confirms storyboard lightbox image and video paths both mount the shared `RichMediaPanel`
  - confirms shared Flow Editor panel chrome is preserved in the opened lightbox surface
- Focused behavior regression: `testCardInlineTextEditorAtCommandInsertsUploadedMedia`
  - still inserts uploaded media through the shared inline-command path
  - still commits a browser-openable tokenized media URL, now derived at interaction time
- Focused local rerun:
  - `testUploadedMediaStorageRuntimeUrlRefreshesStaleToken`
  - `testUploadedMediaPanelItemRuntimeUrlRefreshesSyncedItemToken`
  - `testUploadedMediaDragPayloadUsesFreshRuntimeUrl`
  - `testRichMediaPanelOverlayStateRecognizesGenericStoryboardMediaFields`
  - `testMediaLightboxImageUsesRichMediaPanelSurface`
  - `testMediaLightboxVideoUsesRichMediaPanelSurface`
  - result: passing via direct `tsx` invocation in `canvas/`

## Status

- Fix implemented in source repo only.
- Debug instrumentation and session remain open pending interactive storyboard repro in the running app.

## Next Step

- Reproduce the exact storyboard drag/drop flow in the running app and confirm the opened image/video now render through the shared Rich Media panel without the prior non-visible state.
