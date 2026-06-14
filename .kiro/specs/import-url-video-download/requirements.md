# Requirements Document

## Introduction

This feature extends the existing "Import URL" flow in the Toolbar → Launch dropdown with a "Download local" action. When a user provides a video URL, the Download_Action_Resolver contacts a runtime-configurable server-side endpoint that uses native in-repo extraction and bounded local file writes to return the downloaded file or a download artifact to the workspace. The default local output directory is configurable in MainPanel Settings and resolves to the sibling `huijoohwee/video` folder in Dev/Preview. No URL, credential, dependency binary, or test fixture is hardcoded in the repository. All integration points are decoupled through an unopinionated, headless adapter interface so the backing runtime (local dev server, Cloudflare Worker proxy, MCP tool) can be swapped without UI changes.

## Glossary

- **Download_Action_Resolver**: The client-side module that decides whether a URL is eligible for local video download and dispatches the download request to the configured endpoint.
- **Video_Download_Endpoint**: The runtime-configurable server-side URL (injected via environment variable at build/dev time) that accepts a video URL and optional download options, resolves direct media sources through native in-repo logic, and returns the result. Never hardcoded.
- **Download_Options**: A structured, serialisable value object containing user-selected format, media kind, quality, subtitle preference, and output path hint. All fields are optional with defined defaults.
- **Download_Result**: The server response describing the completed download — including the local file path, file name, MIME type, size in bytes, and status. On error it carries an error code and human-readable message.
- **ImportUrlPrompt**: The existing headless URL-input component (`canvas/src/features/toolbar/ImportUrlPrompt.tsx`) that handles text entry and confirm/cancel events.
- **LaunchDropdown**: The existing Toolbar Launch dropdown (`canvas/src/lib/toolbar/LaunchDropdown.impl.tsx`) that hosts the Import URL row and its inline controls.
- **Download_Local_Button**: The new action affordance rendered inside the existing `rightAddon` slot of ImportUrlPrompt when the entered URL is video-download-eligible.
- **Download_Options_Panel**: The lightweight, inline panel that expands below the ImportUrlPrompt to expose Download_Options controls before the user commits to a download.
- **Native_Downloader**: The in-repo server-side downloader inspired by mature video-downloader safety defaults but implemented without invoking or depending on external downloader binaries.
- **Workspace_FS**: The existing virtual workspace filesystem (`canvas/src/features/workspace-fs/`) used to register downloaded files as workspace entries.
- **Format_Id**: A stable, opaque string key identifying a video/audio format (e.g. `best`, `bestvideo+bestaudio`, `mp4`, `mp3`). Not a human label.
- **Eligibility_Detector**: A pure, side-effect-free function that accepts a URL string and returns a boolean indicating whether the native downloader should offer the Download_Local_Button for that URL.

---

## Requirements

### Requirement 1: Eligibility Detection

**User Story:** As a developer integrating the Import URL flow, I want a pure, side-effect-free function that detects whether a URL is video-download-eligible, so that UI affordances can be shown or hidden without network calls.

#### Acceptance Criteria

1. THE Eligibility_Detector SHALL accept a single URL string of at most 2,048 characters and return a boolean without throwing an exception for any input, including non-string, null, or undefined values.
2. WHEN the URL string's hostname (with subdomains stripped) matches one of the following closed set of eligible domains — `youtube.com`, `youtu.be`, `vimeo.com`, `dailymotion.com`, `twitch.tv` — THE Eligibility_Detector SHALL return `true`.
3. WHEN the URL string's hostname does not match any domain in the eligible set, THE Eligibility_Detector SHALL return `false`.
4. IF the URL string is empty, exceeds 2,048 characters, is not parseable by the runtime's built-in URL parser, or is not of type string, THEN THE Eligibility_Detector SHALL return `false` without throwing an exception.
5. THE Eligibility_Detector SHALL NOT perform any network request, file I/O, or global state mutation, regardless of whether the input URL is valid or invalid.
6. THE Eligibility_Detector SHALL return the same result for any given input value on every invocation, including invalid and non-string inputs (idempotence).

---

### Requirement 2: Download Local Button in Import URL Controls

**User Story:** As a user, I want to see a "Download local" button inside the Import URL controls when I enter a video URL, so that I can initiate a local download without leaving the toolbar flow.

#### Acceptance Criteria

1. WHEN the URL draft in ImportUrlPrompt is eligible according to the Eligibility_Detector, THE LaunchDropdown SHALL render the Download_Local_Button inside the existing `rightAddon` slot.
2. WHEN the URL draft in ImportUrlPrompt is ineligible according to the Eligibility_Detector, THE LaunchDropdown SHALL NOT render the Download_Local_Button.
3. THE Download_Local_Button SHALL have an `aria-label` attribute set to `"Download local video"` and a `title` attribute set to `"Download local video"`.
4. WHEN the Download_Local_Button is clicked and the Download_Options_Panel is not expanded, THE LaunchDropdown SHALL expand the Download_Options_Panel below the ImportUrlPrompt.
5. WHEN the Download_Options_Panel is already expanded and the Download_Local_Button is clicked, THE LaunchDropdown SHALL collapse the Download_Options_Panel.
6. IF expanding the Download_Options_Panel fails due to a technical issue or state conflict, THEN the panel SHALL remain collapsed and no error message SHALL be displayed to the user.
7. WHILE a download is in progress, THE Download_Local_Button SHALL remain visible and interactive.

---

### Requirement 3: Download Options Panel

**User Story:** As a user, I want to configure format and quality before downloading, so that I receive the file type that fits my workflow.

#### Acceptance Criteria

1. THE Download_Options_Panel SHALL expose a Format_Id selector with exactly the following options: `best` (default), `mp4`, `mp3`, `bestvideo+bestaudio`, and a freeform text entry for custom Format_Id values.
2. THE Download_Options_Panel SHALL expose an optional subtitle-language text field defaulting to an empty string (no subtitles), accepting at most 35 characters.
3. WHEN the Confirm Download button is activated, THE Download_Options_Panel SHALL submit the selected Format_Id and subtitle-language value to the configured Video_Download_Endpoint.
4. WHEN the Cancel button is activated, THE Download_Options_Panel SHALL collapse without initiating a download and SHALL reset all selections to their default values.
5. WHILE the Download_Options_Panel is open, THE LaunchDropdown SHALL keep the Import URL row expanded.
6. THE Download_Options_Panel SHALL NOT pre-fill any URL, credential, or test fixture value from source code.
7. IF the `VITE_VIDEO_DOWNLOAD_ENDPOINT` environment variable is not set or is empty, THEN THE Download_Options_Panel SHALL display a notice that no download endpoint is configured and the Confirm Download button SHALL be disabled.

---

### Requirement 4: Download_Action_Resolver — Endpoint Configuration

**User Story:** As a developer, I want the download endpoint to be injected via an environment variable, so that no URL or credential is hardcoded and any runtime backend can be substituted.

#### Acceptance Criteria

1. THE Download_Action_Resolver SHALL read the target endpoint URL exclusively from the `VITE_VIDEO_DOWNLOAD_ENDPOINT` environment variable at build/dev time; the value is valid only if it is a non-empty string starting with `http://` or `https://`.
2. IF `VITE_VIDEO_DOWNLOAD_ENDPOINT` is not set, is empty, or is not a valid absolute URL, THEN THE Download_Action_Resolver SHALL return `{ ok: false, errorCode: 'not_configured' }` without making any network request.
3. WHEN THE Download_Action_Resolver returns `not_configured`, THE LaunchDropdown SHALL display the panel notice defined in Requirement 3 AC 7 and push a warning `UiToast` within the same render cycle.
4. THE Download_Action_Resolver SHALL NOT contain any hardcoded URL, hostname, path, credential, or test fixture string.
5. THE Download_Action_Resolver SHALL accept a `fetchImpl` parameter (defaulting to the global `fetch`) so that tests can inject a mock transport without mutating globals.

---

### Requirement 5: Download_Action_Resolver — Request Contract

**User Story:** As a developer building the server-side endpoint, I want a stable, documented request schema, so that the server and client remain decoupled.

#### Acceptance Criteria

1. WHEN a download is initiated, THE Download_Action_Resolver SHALL POST a JSON body to the Video_Download_Endpoint with the following fields: `url` (non-empty string, 1–2,048 characters, required), `format` (Format_Id string, 1–64 characters, optional), `subtitleLang` (string, 1–35 characters, optional).
2. THE Download_Action_Resolver SHALL set the `Content-Type: application/json` request header.
3. THE Download_Action_Resolver SHALL include an `Accept: application/json` request header.
4. THE Download_Action_Resolver SHALL apply a configurable timeout in the range 1,000–600,000 ms (default 300,000 ms) and abort the request via `AbortController` if the timeout elapses.
5. IF the server responds with HTTP 2xx and the response body is parseable JSON containing a non-null `result` object conforming to the Download_Result schema, THEN THE Download_Action_Resolver SHALL return `{ ok: true, result: Download_Result }`.
6. IF the server responds with HTTP 2xx but the response body is absent, unparseable, or does not conform to the Download_Result schema, THEN THE Download_Action_Resolver SHALL return `{ ok: false, error: 'invalid_response' }`.
7. IF the server responds with HTTP 4xx or 5xx, THEN THE Download_Action_Resolver SHALL return `{ ok: false, error: string }` using the response body `error` field as the primary source and the HTTP status string as the fallback.
8. IF the request is aborted due to timeout, THEN THE Download_Action_Resolver SHALL return `{ ok: false, error: 'download_timeout' }`.
9. IF a network-level error occurs, THEN THE Download_Action_Resolver SHALL return `{ ok: false, error: string }` with the thrown error message truncated to 256 characters.

---

### Requirement 6: Download_Result Schema

**User Story:** As a developer, I want a clearly typed response object from the download endpoint, so that the client can register the file in the workspace and show useful status to the user.

#### Acceptance Criteria

1. THE Video_Download_Endpoint SHALL respond with a JSON object containing: `ok` (boolean), `filePath` (non-empty string — server-local absolute path), `fileName` (non-empty string), `mimeType` (non-empty string in `type/subtype` format), `sizeBytes` (non-negative integer), `sourceUrl` (non-empty string).
2. IF `ok` is `false`, THEN the response SHALL also contain `error` (string) and MAY contain `errorCode` (string).
3. THE Download_Action_Resolver SHALL validate that `ok` (boolean present), `fileName` (non-empty string), `filePath` (non-empty string), and `sourceUrl` (non-empty string) are all present and valid before treating a 2xx response as success; `sizeBytes` must be a non-negative integer.
4. WHEN validation of a 2xx response body fails, THE Download_Action_Resolver SHALL return a descriptive `{ ok: false, error: string }` identifying which fields were missing or invalid.

---

### Requirement 7: Workspace Integration After Download

**User Story:** As a user, I want a successfully downloaded video to appear as a workspace entry, so that I can use it in downstream workflows.

#### Acceptance Criteria

1. WHEN a download completes with `ok: true`, THE Download_Action_Resolver SHALL emit a workspace-registration event carrying `{ fileName, filePath, mimeType, sizeBytes, sourceUrl }`.
2. WHEN the workspace-registration event is received, THE Workspace_FS SHALL upsert a file entry (create if absent, overwrite if exists) for the downloaded file, persisting all five fields: `fileName`, `filePath`, `mimeType`, `sizeBytes`, and `sourceUrl`.
3. WHEN workspace registration succeeds, THE LaunchDropdown SHALL push a success `UiToast` with the file name and source URL.
4. WHEN workspace registration fails, THE LaunchDropdown SHALL push a warning `UiToast` with the error message returned by the failed upsert operation.
5. IF a download ends with `ok: false`, THEN THE workspace-registration event SHALL NOT be emitted.

---

### Requirement 8: Progress and Status Feedback

**User Story:** As a user, I want to see download progress or status while the video is downloading, so that I know the operation is in progress and when it completes.

#### Acceptance Criteria

1. WHEN a download is initiated, THE LaunchDropdown SHALL push an informational `UiToast` indicating the download has started, including the resolved file name or URL, and the toast SHALL persist until the download settles (succeeds, fails, or times out).
2. WHILE a download request is in flight, THE Download_Options_Panel Confirm Download button SHALL be disabled and SHALL display a spinner alongside the label "Downloading…".
3. WHEN a download completes successfully, THE LaunchDropdown SHALL dismiss the in-progress toast from Criterion 1 and push a success `UiToast` that auto-dismisses after 5 seconds.
4. WHEN a download fails, THE LaunchDropdown SHALL push an error `UiToast` containing the error message returned by THE Download_Action_Resolver, auto-dismissing after 8 seconds.
5. IF a download request for the same URL and Format_Id is already in flight, THEN THE Download_Action_Resolver SHALL return the existing promise without making a second network request and without pushing an additional toast.

---

### Requirement 9: Error Handling and Resilience

**User Story:** As a user, I want clear error messages when a download fails, so that I can diagnose the problem without inspecting network logs.

#### Acceptance Criteria

1. IF the Eligibility_Detector returns `false` for the current URL draft, THEN THE Download_Action_Resolver SHALL NOT be invoked and THE LaunchDropdown SHALL display a `UiToast` indicating the URL is not eligible for download.
2. IF `VITE_VIDEO_DOWNLOAD_ENDPOINT` is not configured, THEN THE LaunchDropdown SHALL push a warning `UiToast` indicating the endpoint must be configured before downloading and SHALL NOT initiate a download request.
3. IF the requested format requires unsupported native processing such as muxing or transcoding, THEN THE Video_Download_Endpoint SHALL return `{ ok: false, errorCode: 'native_merge_required', error: string }` where `error` is at most 300 characters and contains no stack traces or internal server paths.
4. IF the requested video is geo-restricted or otherwise unavailable, THEN THE Video_Download_Endpoint SHALL return `{ ok: false, errorCode: 'video_unavailable', error: string }` where `error` is at most 300 characters and contains no stack traces or internal server paths.
5. WHEN THE Download_Action_Resolver receives any `ok: false` response, THE LaunchDropdown SHALL surface the `error` string in a `UiToast` without exposing raw stack traces or internal server paths.
6. IF a download request has been in flight for 30 seconds without a response, THEN THE Download_Action_Resolver SHALL cancel the request via `AbortController` and THE LaunchDropdown SHALL push an error `UiToast` indicating the download timed out.

---

### Requirement 10: No Hardcoded URLs, Credentials, or Test Fixtures

**User Story:** As a maintainer, I want the repository to be free of hardcoded video URLs, credentials, or test fixture values, so that the codebase remains neutral and portable.

#### Acceptance Criteria

1. THE Download_Action_Resolver SHALL NOT contain any string literal matching a video-hosting domain as a target URL; eligibility-matching patterns (used exclusively within the Eligibility_Detector, including subdomains) are exempt from this rule.
2. THE Video_Download_Endpoint server module SHALL NOT contain any inline literal that is a video URL, API key, cookie, or authentication token outside of a named constant in a dedicated configuration section.
3. WHEN integration or end-to-end tests require a real video URL, THE test harness SHALL read the URL exclusively from a runtime environment variable or a test-runner configuration file that is listed in `.gitignore` and excluded from CI artifact uploads.
4. THE Eligibility_Detector pattern list SHALL be defined in exactly one location in the codebase with no duplicate inline occurrences in any other module.

---

### Requirement 11: Headless, Unopinionated Adapter Interface

**User Story:** As a developer, I want the download integration to be runtime-agnostic, so that the backing transport (local dev server, Cloudflare Worker, MCP tool) can be swapped by changing only the endpoint environment variable.

#### Acceptance Criteria

1. THE Download_Action_Resolver SHALL communicate with the Video_Download_Endpoint exclusively via HTTP POST using the contract defined in Requirement 5, with the endpoint URL sourced from the `VITE_VIDEO_DOWNLOAD_ENDPOINT` environment variable.
2. THE Download_Action_Resolver SHALL NOT import or reference any Cloudflare-specific, Node.js-specific, or MCP-specific runtime module.
3. THE Video_Download_Endpoint interface SHALL be defined in a shared types file that is the single authoritative source; neither the client module nor any server implementation may contain the type definition itself.
4. WHERE `workspaceActionBridge.downloadVideo` exists and is of type `function`, THE Download_Action_Resolver SHALL delegate to it instead of making an HTTP POST.
5. IF `workspaceActionBridge.downloadVideo` is absent, null, undefined, or not of type `function`, THEN THE Download_Action_Resolver SHALL fall back to HTTP POST without treating the absence as an error.

---

### Requirement 12: Parser Round-Trip for Download_Result

**User Story:** As a developer, I want the Download_Result and Download_Options types to be serialisable and parseable without data loss, so that results can be logged, cached, and replayed reliably.

#### Acceptance Criteria

1. WHEN THE Download_Result_Parser is given a JSON string, THE Download_Result_Parser SHALL return a `Download_Result` value or a structured parse error.
2. WHEN THE Download_Result_Printer is given a `Download_Result` value, THE Download_Result_Printer SHALL return a valid JSON string.
3. WHEN the JSON string produced by THE Download_Result_Printer is passed to THE Download_Result_Parser, THE Download_Result_Parser SHALL return a `Download_Result` with field values equal to the original, including null fields and empty collections.
4. IF THE Download_Result_Parser receives a string that is not valid JSON, THEN THE Download_Result_Parser SHALL return a structured parse error containing the character offset and a human-readable reason, without throwing an exception.
5. IF THE Download_Result_Parser receives well-formed JSON that is missing one or more required `Download_Result` fields, THEN THE Download_Result_Parser SHALL return a structured parse error identifying each missing field by name, without modifying any shared state.
