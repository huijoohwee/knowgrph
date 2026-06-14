# Implementation Plan: import-url-video-download

## Overview

Extend the Import URL row in the LaunchDropdown toolbar with a "Download local" affordance. When a video URL is detected, a Download_Local_Button appears in the `rightAddon` slot. Clicking it expands a VideoDownloadOptionsPanel for format/subtitle selection. The resolver uses the bridge-first pattern with HTTP POST fallback to a runtime-configurable native download endpoint. All five workspace fields are persisted on success.

Implementation order follows the dependency graph in the design: types first, pure logic next, bridge extension, UI layer last, endpoint adapters alongside.

---

## Tasks

- [ ] 1. Create shared types module
  - [ ] 1.1 Create `canvas/src/lib/video-download/types.ts` with all domain types
    - Define `VideoFormatId`, `VideoDownloadOptions`, `VideoDownloadRequest`, `VideoDownloadResultOk`, `VideoDownloadResultErr`, `VideoDownloadResult`, `VideoDownloadParseError`, `VideoDownloadResolverResult`
    - This is the single authoritative type source — no type duplicates allowed elsewhere
    - _Requirements: 5.1, 6.1, 6.2, 11.3, 12.1_

- [ ] 2. Implement pure eligibility detector
  - [ ] 2.1 Create `canvas/src/lib/video-download/isVideoDownloadEligible.ts`
    - Define `VIDEO_DOWNLOAD_ELIGIBLE_DOMAINS` as a `Set` constant — single definition in the codebase
    - Implement `isVideoDownloadEligible(value: unknown): boolean` using built-in `URL` constructor to strip subdomains
    - Must never throw for any input including non-string, null, undefined
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 10.4_
  - [ ]* 2.2 Write property test: eligibility returns boolean for any input (Property 1)
    - **Property 1: `isVideoDownloadEligible(value)` returns `boolean`, never throws**
    - Arbitrary: `fc.anything()`; assert `typeof result === 'boolean'` and no exception thrown
    - **Validates: Requirements 1.1, 1.4**
  - [ ]* 2.3 Write property test: eligible domain matching (Property 2)
    - **Property 2: Eligible domain matching**
    - Arbitrary: construct URLs with apex domains sampled from eligible set (random subdomain prefix) and non-eligible set; assert eligible → `true`, non-eligible → `false`
    - **Validates: Requirements 1.2, 1.3**
  - [ ]* 2.4 Write property test: eligibility is idempotent (Property 3)
    - **Property 3: Idempotence — `f(v) === f(v)` for any input**
    - Arbitrary: `fc.anything()`; call twice, compare results
    - **Validates: Requirements 1.6**

- [ ] 3. Implement Download_Result codec
  - [ ] 3.1 Create `canvas/src/lib/video-download/videoDownloadResultCodec.ts`
    - Implement `printVideoDownloadResult(result: VideoDownloadResult): string` — `JSON.stringify` wrapper
    - Implement `parseVideoDownloadResult(raw: unknown): VideoDownloadResult | VideoDownloadParseError` — accepts both raw object and JSON string; never throws; returns `{ kind: 'parse_error', reason, missingFields? }` for invalid input
    - Validate all required fields: `ok`, `filePath`, `fileName`, `mimeType`, `sizeBytes`, `sourceUrl`
    - _Requirements: 6.3, 6.4, 12.1, 12.2, 12.3, 12.4, 12.5_
  - [ ]* 3.2 Write property test: codec round-trip (Property 4)
    - **Property 4: `parseVideoDownloadResult(printVideoDownloadResult(r))` deep-equals `r`**
    - Arbitrary: `fc.record({ ok: fc.constant(true), filePath, fileName, mimeType, sizeBytes: fc.nat(), sourceUrl })`
    - **Validates: Requirements 12.1, 12.2, 12.3**
  - [ ]* 3.3 Write property test: codec parse errors never throw (Property 5)
    - **Property 5: `parseVideoDownloadResult(s)` never throws; invalid JSON → `kind === 'parse_error'`**
    - Arbitrary: `fc.string()` (any string, valid or not)
    - **Validates: Requirements 12.4, 12.5**

- [ ] 4. Update config.env.ts with video download endpoint key
  - [ ] 4.1 Add `VITE_VIDEO_DOWNLOAD_ENDPOINT` to the `metaEnv` record in `canvas/src/lib/config.env.ts`
    - Add `VITE_VIDEO_DOWNLOAD_ENDPOINT: import.meta.env.VITE_VIDEO_DOWNLOAD_ENDPOINT` to the satisfies record
    - _Requirements: 4.1, 4.4_

- [ ] 5. Extend workspaceActionBridge with optional downloadVideo field
  - [ ] 5.1 Add `downloadVideo?` field to `MarkdownWorkspaceActionBridge` type and merge in `getMarkdownWorkspaceActionBridge`
    - Import `VideoDownloadOptions` and `VideoDownloadResult` from `@/lib/video-download/types`
    - Add `downloadVideo?: (url: string, options: VideoDownloadOptions) => Promise<VideoDownloadResult>` to the interface
    - Add `if (bridge.downloadVideo) merged.downloadVideo = bridge.downloadVideo` to the merge loop in `getMarkdownWorkspaceActionBridge`
    - _Requirements: 11.4, 11.5_

- [ ] 6. Implement Download_Action_Resolver
  - [ ] 6.1 Create `canvas/src/lib/video-download/videoDownloadResolver.ts`
    - Implement `resolveVideoDownload(url, options?, opts?)` with in-flight dedup map keyed by `url + '|' + format`
    - Read endpoint URL from `readEnvString('VITE_VIDEO_DOWNLOAD_ENDPOINT', '')` at call time (not module load)
    - Return `{ ok: false, errorCode: 'not_configured' }` when endpoint is not a valid absolute HTTP(S) URL, without calling `fetchImpl`
    - Check `workspaceActionBridge.downloadVideo` at call time; delegate if present (bridge-first)
    - Apply configurable `AbortController` timeout (1,000–600,000 ms, default 300,000 ms); return `{ ok: false, error: 'download_timeout' }` on abort
    - Accept `fetchImpl` injection parameter defaulting to global `fetch`
    - POST `{ url, format?, subtitleLang? }` with `Content-Type: application/json` and `Accept: application/json` headers
    - Validate response via `parseVideoDownloadResult`; truncate error messages to 256 chars
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 6.3, 6.4, 8.5, 11.1, 11.2, 11.4, 11.5_
  - [ ]* 6.2 Write property test: resolver request body matches schema (Property 6)
    - **Property 6: For any valid url + options, `fetchImpl` receives correct JSON body and headers**
    - Arbitrary: valid url strings (1–2,048 chars) + `VideoDownloadOptions` objects with a configured `fetchImpl` spy
    - **Validates: Requirements 5.1, 5.2, 5.3**
  - [ ]* 6.3 Write property test: in-flight dedup returns same promise (Property 7)
    - **Property 7: Second call while first is in-flight returns the same `Promise` instance; `fetchImpl` called once**
    - Arbitrary: valid `(url, format)` pairs
    - **Validates: Requirements 8.5**
  - [ ]* 6.4 Write property test: missing or invalid endpoint → `not_configured` (Property 8)
    - **Property 8: Any endpoint value not starting with `http://` or `https://` → `{ ok: false, errorCode: 'not_configured' }` without calling `fetchImpl`**
    - Arbitrary: `fc.oneof(fc.constant(''), fc.string().filter(s => !s.startsWith('http://') && !s.startsWith('https://')))`
    - **Validates: Requirements 4.1, 4.2**
  - [ ]* 6.5 Write property test: error messages contain no stack traces (Property 9)
    - **Property 9: Error strings surfaced by resolver contain no stack-trace patterns and are ≤ 256 chars**
    - Arbitrary: error strings containing `at <name> (<location>)` patterns and internal paths
    - **Validates: Requirements 9.3, 9.4, 9.5**
  - [ ]* 6.6 Write property test: bridge delegation takes precedence over HTTP POST (Property 11)
    - **Property 11: When `bridge.downloadVideo` is a function, `fetchImpl` is not called; when absent, `fetchImpl` is called**
    - Arbitrary: valid `(url, options)` pairs; bridge stub present/absent
    - **Validates: Requirements 11.4, 11.5**

- [ ] 7. Checkpoint — core pure logic complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement workspace registration helper
  - [ ] 8.1 Create `canvas/src/lib/video-download/registerVideoDownloadInWorkspace.ts`
    - Use dynamic imports for `upsertWorkspaceTextDocument`, `setWorkspaceEntrySource`, `notifyWorkspaceFsChanged`, `WORKSPACE_ROOT_PATH` — matching the pattern in `launchDropdownFallbacks.ts`
    - Upsert workspace text document with `fileName` as the entry name; embed all five fields (`filePath`, `mimeType`, `sizeBytes`, `sourceUrl`) in the document text body
    - Call `setWorkspaceEntrySource(workspacePath, { kind: 'url', url: sourceUrl })` to register in source index
    - Call `notifyWorkspaceFsChanged({ op: 'writeFileText', path: workspacePath })`
    - Return `{ ok: true, workspacePath }` on success; `{ ok: false, error }` on any caught exception
    - _Requirements: 7.1, 7.2_
  - [ ]* 8.2 Write property test: workspace registration preserves all five result fields (Property 10)
    - **Property 10: After `registerVideoDownloadInWorkspace({ result: r, fs })`, the upserted document text contains `r.fileName`, `r.filePath`, `r.mimeType`, `r.sizeBytes`, and `r.sourceUrl`**
    - Arbitrary: valid `VideoDownloadResultOk` objects; use a mock `WorkspaceFs`
    - **Validates: Requirements 7.1, 7.2**

- [ ] 9. Extend launchDropdownFallbacks.ts with videoDownloadFallback
  - [ ] 9.1 Add `videoDownloadFallback` export to `canvas/src/features/toolbar/launchDropdownFallbacks.ts`
    - Accept `{ url, options, pushUiToast }` — match the existing fallback signature pattern
    - Push a persistent info toast (`ttlMs: null`, `busy: true`) at start
    - Dynamically import `resolveVideoDownload`, `registerVideoDownloadInWorkspace`, `getWorkspaceFs`
    - On resolver `ok: false`: push error toast (8s, dismissible)
    - On registration `ok: false`: push warning toast (8s, dismissible)
    - On full success: push success toast (5s); do NOT hardcode any URL or credential
    - _Requirements: 7.3, 7.4, 8.1, 8.3, 8.4, 9.2, 9.5, 10.1_

- [ ] 10. Create VideoDownloadOptionsPanel component
  - [ ] 10.1 Create `canvas/src/features/toolbar/VideoDownloadOptionsPanel.tsx`
    - Define `VIDEO_DOWNLOAD_FORMAT_PRESETS` constant array with `best`, `mp4`, `mp3`, `bestvideo+bestaudio`, and a `__custom__` sentinel
    - Implement stateless `VideoDownloadOptionsPanel` with props: `options`, `onOptionsChange`, `onConfirm`, `onCancel`, `isDownloading`, `endpointConfigured`
    - Show `role="alert"` notice with warning color when `endpointConfigured` is false
    - Disable Confirm button when `isDownloading || !endpointConfigured`; show `<Loader2 className="animate-spin">` and "Downloading…" label while in progress
    - Subtitle language input: `maxLength={35}`, `aria-label="Subtitle language"`
    - Custom format input: `maxLength={64}`, `aria-label="Custom format string"` — only shown when non-preset format selected
    - Use `UI_THEME_TOKENS` and `cn` from `@/lib/utils`; `aria-label="Video download options"` on root `<section>`
    - _Requirements: 2.3, 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 8.2_
  - [ ]* 10.2 Write unit tests for VideoDownloadOptionsPanel
    - Render with `endpointConfigured: false` → verify notice rendered and Confirm button disabled
    - Render with `endpointConfigured: true`, `isDownloading: true` → verify spinner and "Downloading…" label
    - Render with `endpointConfigured: true`, `isDownloading: false` → verify Confirm button enabled
    - _Requirements: 3.7, 8.2_

- [ ] 11. Wire Download_Local_Button and VideoDownloadOptionsPanel into LaunchDropdown
  - [ ] 11.1 Add new state and derived value to `canvas/src/lib/toolbar/LaunchDropdown.impl.tsx`
    - Add imports: `Download` from `lucide-react`, `isVideoDownloadEligible` from `@/lib/video-download/isVideoDownloadEligible`, `VideoDownloadOptionsPanel` from `@/features/toolbar/VideoDownloadOptionsPanel`, `readEnvString` from `@/lib/config.env`, `VideoDownloadOptions` type
    - Add state: `downloadOptionsOpen` (boolean, default `false`), `downloadOptions` (`VideoDownloadOptions`, default `{ format: 'best', subtitleLang: '' }`), `isDownloading` (boolean, default `false`)
    - Add `endpointConfigured` memo: reads `VITE_VIDEO_DOWNLOAD_ENDPOINT` once via `readEnvString`; stable across re-renders
    - Add `isVideoEligible` derived: `isVideoDownloadEligible(urlDraft)`
    - _Requirements: 2.1, 2.2, 3.5, 4.1_
  - [ ] 11.2 Add reset logic and Download_Local_Button to `LaunchDropdown.impl.tsx`
    - In the existing `open` change `useEffect`: reset `downloadOptionsOpen`, `downloadOptions`, `isDownloading` to defaults when dropdown closes
    - Render `Download_Local_Button` inside the `rightAddon` section when `isVideoEligible` is true:
      - `aria-label="Download local video"`, `title="Download local video"`, `aria-pressed={downloadOptionsOpen}`
      - Toggle `downloadOptionsOpen` on click
      - Use `UI_RESPONSIVE_IMPORT_URL_ADDON_ACTION_CLASSNAME`, `UI_THEME_TOKENS.button.activeBg/activeText` when pressed, `UI_THEME_TOKENS.button.text` when unpressed
      - Icon: `<Download className={menuIconClass} strokeWidth={1.6} aria-hidden="true" />`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7_
  - [ ] 11.3 Render VideoDownloadOptionsPanel and wire confirm/cancel handlers in `LaunchDropdown.impl.tsx`
    - Render `<VideoDownloadOptionsPanel>` after `<ImportUrlPrompt>` when `downloadOptionsOpen` is true (still inside `urlInputOpen` section)
    - `onConfirm`: guard `!urlDraft.trim() || isDownloading`; set `isDownloading(true)`; call `loadLaunchDropdownFallbackModule().then(mod => mod.videoDownloadFallback({ url: urlDraft.trim(), options: downloadOptions, pushUiToast }))`; reset `isDownloading`, `downloadOptionsOpen`, `downloadOptions` on settle
    - `onCancel`: set `downloadOptionsOpen(false)`, reset `downloadOptions` to defaults
    - Pass `isDownloading` and `endpointConfigured` to panel
    - _Requirements: 3.3, 3.4, 3.5, 3.7, 8.1, 8.2, 9.1, 9.2_
  - [ ]* 11.4 Write unit tests for LaunchDropdown changes
    - Render with eligible URL draft → verify `Download_Local_Button` present with correct `aria-label` and `title`
    - Render with ineligible URL draft → verify no `Download_Local_Button`
    - Click `Download_Local_Button` once → verify `VideoDownloadOptionsPanel` rendered
    - Click `Download_Local_Button` twice → verify panel collapsed (toggle)
    - Click Cancel in panel → verify panel collapsed and options reset
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.4_

- [ ] 12. Create server endpoint adapter
  - [ ] 12.1 Create `cloudflare/pages/video-download.mjs` server endpoint adapter
    - Implement `sanitizeError(msg, max = 300)`: strip stack-frame patterns (`at <name> (<location>)`), internal file paths (`file://`, `*.js`, `*.ts`), collapse whitespace, truncate to 300 chars
    - Implement `validateRequest(body)`: validate `url` (non-empty, ≤ 2,048 chars); return validated fields or `{ ok: false, error }`
    - Export `onRequest(context)`: handle OPTIONS (204), reject non-POST (405), validate body (400 on failure), fail closed with `native_runtime_required` in runtimes without durable local filesystem support, and preserve geo/unavailable errors as 422 `errorCode: 'video_unavailable'`
    - All JSON responses use `{ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', CORS headers }`
    - _Requirements: 9.3, 9.4, 10.2, 11.1_

- [ ] 13. Final checkpoint — integration and cleanup
  - Ensure all tests pass, ask the user if questions arise.
  - Verify no hardcoded video URLs, credentials, or test fixtures exist anywhere in the new files (grep for known domains outside of `isVideoDownloadEligible.ts`)
  - Verify `VIDEO_DOWNLOAD_ELIGIBLE_DOMAINS` is defined in exactly one location
  - Verify `VITE_VIDEO_DOWNLOAD_ENDPOINT` appears in `config.env.ts` metaEnv record

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests use [fast-check](https://fast-check.io/) (≥ 100 iterations per property); run alongside Vitest
- `VITE_VIDEO_DOWNLOAD_ENDPOINT` is never hardcoded — set it in your `.env.local` (gitignored) for local dev
- Integration test URLs must come from environment variables, never from source; see Requirements 10.3
- The `videoDownloadFallback` follows the exact dynamic-import pattern already in `launchDropdownFallbacks.ts`
- Legacy/stale code: no duplicate type definitions, no duplicate domain sets; remove any if found during implementation
- Cloudflare Pages source (`video-download.mjs`) documents the endpoint contract and fails closed when the runtime cannot provide durable local file writes; Dev/Preview owns the native local file implementation.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "3.2", "3.3", "5.1"] },
    { "id": 3, "tasks": ["6.1"] },
    { "id": 4, "tasks": ["6.2", "6.3", "6.4", "6.5", "6.6", "8.1"] },
    { "id": 5, "tasks": ["8.2", "9.1", "10.1"] },
    { "id": 6, "tasks": ["10.2", "11.1", "12.1"] },
    { "id": 7, "tasks": ["11.2"] },
    { "id": 8, "tasks": ["11.3"] },
    { "id": 9, "tasks": ["11.4"] }
  ]
}
```
