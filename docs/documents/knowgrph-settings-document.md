# Knowgrph Settings Architecture

## Design Mantras

```
- [ ] Configuration; externalize behavior; forbid hardcoded settings
- [ ] Automation; derive settings schema; forbid manual sync
- [ ] Validation; enforce bounds; forbid invalid values
- [ ] Documentation; explain all settings; forbid undocumented options
- [ ] Performance; optimize schema generation; forbid slow builds
```

---

## Settings Architecture

**Settings Stack**: Source Markdown → Schema Extraction → JSON Schema → TypeScript Types → Runtime Validation

**Data Flow**: Responsibility Flow Doc → Build Script → Settings Schema → Canvas Store → UI Controls → User Preferences

**Design Principles**: Single Source of Truth | Build-Time Generation | Runtime Type Safety | Bounded Value Ranges

---

## Import Settings: PDF

**Scope**: MainPanel → Settings → `Import: PDF`

**Intent**: Let users tune PDF→Markdown conversion performance/fidelity without changing environment variables.

**Keys**

- `pdfImportIncludeImages`, `pdfImportEmbedImages`
- `pdfImportMaxExtractedImagesPerPage`, `pdfImportMaxEmbeddedImagesPerPage`
- `pdfImportMaxEmbeddedTotalBytes`, `pdfImportMaxEmbeddedAssetBytes`
- `pdfImportReconstructTables`, `pdfImportTableMinColumns`, `pdfImportTableMinRows`, `pdfImportTableMaxRows`
- `pdfImportProvider`, `pdfImportDoclingEndpoint`, `pdfImportProviderFallbackToNative`
- `pdfImportOcrEnabled`, `pdfImportOcrMode`

---

## Import Settings: Webpage

**Scope**: Source Files / Markdown Workspace → Import URL; MainPanel → Settings

**Intent**: Keep webpage parsing generic while letting users choose Markdown/JSON/HTML view modes without mutating graph/layout/zoom.

**Keys**

- `webpageImportIncludeImages`
- `webpageImportView` (`markdown` | `json` | `html`)
  - Mode contract: (1) `markdown` default SSOT, (2) `html` view-only iframe, (3) `json` view-only iframe.
  - `markdown`: editor/viewer use Markdown (graph parsing remains aligned to Markdown)
  - `html`: editor stays editable Markdown SSOT; viewer/presentation/slides render sandboxed HTML via iframe `srcdoc`
  - `json`: editor shows conversion JSON (read-only override); viewer/presentation/slides render sandboxed JSON via iframe `srcdoc`
- `webpageViewerScriptPolicy` (`strip` | `allow`)
  - Baseline script policy for the HTML Viewer. Effective per-page behavior remains auto by default: shared rich-media + iframe heuristics decide when scripts are needed for DOM export versus when they should be stripped. Most work should leave this at its safe default.
- `webpageArtifactFidelityMaxLevel` (1..4)
  - Caps the generated Webpage Markdown Artifact detail level so imports remain bounded and readable.

---

## Import Settings: Website

**Scope**: Markdown Workspace → Import website (sitemap); MainPanel → Settings

**Intent**: Crawl and import a whole website into the workspace as one Markdown file per page, while persisting conversion artifacts (markdown, JSON, HTML) for fast view switching.

**Keys**

- `websiteImportDiscoverSitemap`
- `websiteImportMaxPages`
- `websiteImportConcurrency`
- `websiteImportOutputDirRel`
- `websiteImportGenerateWebpageArtifactDocs`
  - Default `false` to avoid UI freezes on large imports.
  - When enabled, import may write server-generated `page.md` artifacts from stored `raw.html` for faster view switching.

**Derived rules**
- Website import uses `webpageImportIncludeImages` for conversion and `webpageImportView` as the default per-page view (stored in each stub’s `kgWebpageView`).
- In the active-row dropdown, Viewer/Presentation/Slides render HTML in a sandboxed iframe when `kgWebpageView ∈ {json, html}`.
- When `kgWebsiteImportId/kgWebsiteNodeId` exist, Viewer prefers rendering from stored `raw.html` artifacts (in-repo) instead of proxying live HTML.
- Workspace artifacts are stored under `.knowgrph-workspace/` (in this repo resolved via symlink to `sandbox/.knowgrph-workspace/`).
- If `kgWebsiteOutputDirRel` is present, it overrides the artifact root directory for resolving `raw.html/page.md/conversion.json`.

---

## Import Settings: Geospatial

**Scope**: Import JSON/GeoJSON; MainPanel → Settings

**Intent**: Auto-open the map overlay after geo-capable imports while keeping graph zoom/layout stable.

**Keys**

- `autoEnableGeospatialOnGeoImport`
  - When enabled, successful imports that yield nodes with `properties.geo.{lat,lng}` will automatically enable Geospatial Mode.
  - Intended for geo datasets (GeoJSON or record-style JSON) and should not require absolute local paths.

---

## Markdown Settings: Viewer / Presentation

**Scope**: Markdown Workspace → Viewer/Presentation; MainPanel → Settings

**Intent**: Keep Markdown rendering defaults configurable and consistent across Viewer, Presentation, and Slides Gallery.

**Keys**

- `markdownWordWrap`
- `markdownTextHighlight`

## Chat Settings: Endpoint, Model, Context

- `chatProvider` defaults to BytePlus ModelArk (`ap-southeast-1`) with OpenAI as the secondary official profile; preserve canonical official endpoint URLs in Settings even though requests route through the same-origin proxy.
- `chatAuthMode` selects `serverManaged` (default) vs `byok`.
  - `serverManaged`: no user key is required; the server-side proxy injects a provider key from environment.
  - `byok`: the user provides an API key for the current session only (store-only; never localStorage).
- `chatEndpointUrl` and `chatApiKey` configure an OpenAI-compatible chat endpoint; official BytePlus/OpenAI calls use Bearer auth through the proxy and may attach `X-Client-Request-Id` for request tracing.
- `chatModel` accepts custom provider model ids via text input with shared suggestions; Settings can refresh `/v1/models` from the configured endpoint without forcing a static option list.
- `chatContextScope` selects selection-only, workspace-wide (default), or hybrid context; hybrid adds workspace-wide file context to selection-derived graph and markdown snippets while keeping behavior bounded and schema-neutral.
- `chatStorageTarget` selects primary persistence target: `chatKnowgrph` (default) or `chatHistory`.
- `chatLocalStorageRootPath` defaults to `/Users/huijoohwee/Documents/GitHub/sandbox/chat-log` and is used as the root folder for auto-created local markdown files.
- `chatKnowgrphStorageMode` + `chatKnowgrphWorkspacePath` + `chatKnowgrphCloudUrl` configure Knowledge Graph Canvas storage (`kgc_yyyymmddhhmmss.md`, local/cloud).
- In Chat UI with `chatStorageTarget=chatKnowgrph`, `New Chat` creates a fresh `kgc_yyyymmddhhmmss.md`, opens it in Workspace Editor (markdown pane), clears the active chat thread, and routes the next request/response into that new file.
- `chatHistoryStorageMode` + `chatHistoryWorkspacePath` + `chatHistoryCloudUrl` configure Chat History storage (`chh_yyyymmddhhmmss.md`, local/cloud).
- FloatingPanel Chat injects a strict Markdown response contract system prompt; standard chat responses may include one `response:` YAML metadata block when non-trivial, while `chatKnowgrph` persists only the structured KGC contract. The Chat UI shows one final assistant message: concise bullets (≤50 words) plus a workspace link to the current `kgc_yyyymmddhhmmss.md`.
- For `chatKnowgrph`, the saved `kgc_*.md` must keep its leading block as a standalone parseable KGC document that opens directly in Canvas, Workspace Editor, Multi-dimensional Table, and Kanban. Same-session history is appended in a trailing section, while validation requires ordered sections, non-empty `subject/action/goal/solution/request_md/solution_md`, and at least 2 nodes + 1 edge before accepting model output.
- `chatHistoryWorkspacePath` optionally pins a workspace Markdown file path to append chat exchanges; when empty, the first successful chat will create `chh_yyyymmddhhmmss.md` under `chatLocalStorageRootPath` and continue appending there so the history is viewable and editable in the Workspace Editor.
- `chatHistoryStorageMode` selects `local` (default, workspace file) vs `cloud` (reserved; does not write anywhere yet).
- `chatHistoryCloudUrl` reserves a future sync target (e.g. GitHub URL) and is inert until a backend exists.
- Chat history setup actions in Settings should reuse Toolbar Launch import pipelines: local mode reuses `Import local files` and cloud URL mode reuses `Import URL`, with bridge-first execution and Launch fallbacks.
- `integrationConfigsJson` remains the SSOT for AI chat enable/open-tab routing and simulation command defaults; MainPanel Integrations should show live Chat status, expose format/enable-disable helpers, and open a `chat` Settings search with matching groups expanded so `chatProvider`, `chatContextScope`, and `integrationConfigsJson` stay visible together.

---

## Settings UI Tooltip Semantics

**Scope**: MainPanel → Settings → key/value rows (hover tooltips)

**Key tooltip (max 50 words)**
- Format: `Role → Actions → Outcome`
- Semantics: one atomic role, 1–2 atomic actions, one concrete outcome

**Value tooltip (max 15 words)**
- Format: `Default: …; Min: …; Max: …; Interval: …; Impact: …`
- Semantics: include default; include min/max/interval when applicable; describe impact succinctly

**Implementation anchors**
- Tooltip builders: `canvas/src/lib/config-copy/tooltips.ts` (`buildRoleActionOutcomeTooltip`, `buildNumericTooltip`)
- Settings UI surface: `canvas/src/features/panels/views/SettingsView.tsx`

**Interaction**
- Hover key label → show key tooltip
- Hover value control → show value tooltip (no separate icon affordance)

**Expanded details row (click to expand)**
- Render only: `Modules | Classes/Objects | Functions/Methods`

---

## Settings Row Layout Consistency (Key / Type / Value)

**Scope**: MainPanel → Settings rows (shared key/value layout utilities)

**Layout rules**
- One setting row renders as one row: Key / Type / Value do not stack into multiple rows at narrow widths.
- Value controls are right-edge aligned within the Value column (text inputs, selects, checkboxes, pill buttons).
- Height is consistent: value controls, preview chips, and pill actions use the same baseline height (`h-6`) to keep rows visually stable.
- Composite value controls (preview + input) must be shrink-safe: wrappers use `w-full min-w-0` and inputs use `min-w-0` so the right border stays aligned.
- Clean interactions: clicking inside a value control does not toggle expand/collapse; only row click toggles.

**Implementation anchors**
- Key/Type/Value row grid: `canvas/src/features/panels/ui/KeyTypeValueRow.tsx`
- Settings surface + status/action pills: `canvas/src/features/panels/views/SettingsView.tsx`
- Settings input renderer (composite controls + alignment/height): `canvas/src/features/settings/ui.tsx` (`renderSettingInput`)

---


---

## Continuation

See continuation in `knowgrph-settings-document-schema-and-specs.md` for component matrix, schema extraction flow, core setting specifications, testing gates, and anti-pattern constraints.
