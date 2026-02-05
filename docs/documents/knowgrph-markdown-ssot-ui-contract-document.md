# Knowgrph Markdown SSOT UI Contract

## Purpose
This document defines the Single Source of Truth (SSOT) contract for Markdown UI surfaces so Markdown Editor, Viewer, and Presentation share the same header, sidebar, TOC structure, typography, and shared utility behavior, and so secondary surfaces (Slides Gallery, Graph Data, Canvas) never drift from the active document’s text identity.

## Scope
- **In scope**: Bottom Panel Markdown header, Explorer sidebar (Source Files + Outline + Backlinks), typography ladder, shared markdown utilities used by UI and parsers.
- **Out of scope**: Canvas graph rendering, parser schema details (covered in the Markdown processing and schema documents).

## SSOT Rule (Non-Negotiable)
- There must be **one-and-only** Markdown section header implementation (used by Editor/Viewer/Presentation).
- There must be **one-and-only** Markdown sidebar/TOC structure implementation (used by Viewer/Presentation, and referenced by Editor flows).
- Shared markdown logic must live in `knowgrph/grph-shared` and be imported via `grph-shared/*` exports (no `grph-shared/src/*` runtime imports).

## Markdown Text SSOT (Editor / Viewer / Presentation)

- Editor, Viewer, and Presentation are three render modes over the **same markdown text source**.
- Host and extracted UI must keep `markdownDocumentText` hydrated so:
  - Viewer/Presentation showing content implies Editor must show the same content (no split-brain).
  - Switching modes never changes the active document selection.
- Explorer folder expansion/collapse must not clear or change the active document; only explicit file selection changes the active document.
- Source Files selection may carry a full relative path (e.g. `sandbox/docs/demo.md`) while stored document names may be basenames (e.g. `demo.md`). Loader logic must use **loose basename matching** to decide when to prefer imported/store text and avoid blank editors caused by failed `@fs` loads.

## Cross-Surface Sync (Slides / Graph Data / Canvas)

- Slides Gallery, Graph Data, and Canvas interactions are read-only projections over the same active markdown document identity; they must not maintain a separate markdown text source.
- Any memoized markdown token cache must be isolated by `activeDocumentPath` and must not return cached tokens when the stored document path differs (prevents cross-document bleed and “content disappears” on view switches).
- When the host supports Geospatial Mode, Markdown preview surfaces must receive `geoDatasetIntegration` so fenced GeoJSON blocks can render previews and register datasets into the geospatial layer.

### Active Graph Render View (SSOT)

- Graph Data Table, Graph Fields, Props Panel/Node Editor, Canvas (D3/Flow/3D), Canvas Preview, and Geospatial overlays must render from the same derived `GraphData` view (no per-surface re-derivation).
- Canonical derivation API: `useActiveGraphRenderData()` in `knowgrph/canvas/src/hooks/useActiveGraphData.ts`.
- Derivation rules (in order): keyword semantic mode may derive a keyword base graph → optional frontmatter Mermaid filter (document mode only) → optional group collapse (`collapsedGroupIds`).
- SSOT consumers include `PreviewPanelView`, `DatasetInspectorSection`, and `GraphTableWorkspace` (host), plus extracted table/stats surfaces.
- Bounded verification: `canvas/src/__tests__/rxdbGraphTableDb.test.ts` (`testGraphTableDbSyncsCollapsedView`) asserts table rows match the collapsed render view.

### Shared Surface Vocabulary + Events (SSOT)

- Cross-repo surfaces must share a stable surface vocabulary defined in `grph-shared/ssot/types` (`SsotSurface`).
- Hosts emit SSOT focus/change events using `grph-shared/ssot/events` so extracted UI surfaces can subscribe without reaching into host implementation details.
- The host must bridge the canonical store to these events once (e.g. `canvas/src/features/ssot/SsotEventBridge.tsx`) so Table/Markdown/Slides/Canvas/Map can stay selection-synchronized even as module ownership is split across repos.

### TOC Focus Contract (Table → Explorer)

- Non-markdown projections (e.g. Graph Data Table / Graph Table) may request TOC focus.
- The contract is event-driven and DOM-agnostic:
  - Emit: `window.dispatchEvent(new CustomEvent('kg:tocFocus', { detail: { id } }))`
  - Receive: the Explorer TOC scrolls the corresponding heading row into view and highlights it as active.
- `id` must be a stable heading identifier derived from the SSOT markdown pipeline (e.g. `anchorId`, `anchor`, or shared `slugify` output); do not invent per-surface ids.

## Canonical UI Surfaces

### Markdown Section Header (SSOT)
**Contract**: The Markdown section header is the canonical place for cross-document actions (Source Files ingest/export/save/apply) and editor workflow actions (Apply/Save).

- **Canonical implementation**: `curagrph/src/components/BottomPanel/BottomPanelMarkdownViewerHeader.tsx` (`ViewerHeaderRow`).
- **Required behavior**:
  - Same header structure across Editor/Viewer/Presentation; only state changes (enabled/disabled) are allowed.
  - `Apply changes`, `Save`, `Save As...` are always present but disabled when not in editing mode.
  - `Source files` actions (`Open folder`, `Refresh files`, `New folder`, `New source file`) render **in the header**, immediately left of `Apply changes`.
  - The Explorer sidebar may also surface icon-only Source Files actions for VS Code-like parity, but must reuse the same underlying integrations (no duplicated logic paths).

### Explorer Sidebar (SSOT)
**Contract**: The Explorer sidebar uses a stable, semantic DOM with SSOT typography; it owns the only Source Files tree and the only Outline (TOC) renderer.

- **Canonical container**: `curagrph/src/features/markdown/ui/MarkdownPanelLayout.tsx`.
- **Canonical frame**: `curagrph/src/features/markdown/ui/MarkdownSidebarFrame.tsx`.
  - Renders the sidebar `<aside>` and the top `Explorer` header.
- **Canonical section wrapper**: `curagrph/src/features/markdown/ui/MarkdownSidebarSection.tsx`.
  - Renders section title (`h3`) and section body.
  - **Rule**: section headers are typography-only except Source Files (may include an action menu for Explorer parity).
- **Canonical sections**:
  - Source files: `curagrph/src/features/markdown/ui/MarkdownSourceFilesPanel.tsx`
  - Outline (TOC): `curagrph/src/features/markdown/ui/MarkdownTableOfContents.tsx`
  - Backlinks: `curagrph/src/features/markdown/ui/MarkdownBacklinksPanel.tsx`

### Explorer Persistence (SSOT)
- **Shared state hook**: `curagrph/src/features/markdown/ui/useMarkdownExplorerControls.ts`
  - Centralizes sidebar-open + collapsed-heading persistence across Viewer and BottomPanel (no duplicated local fallbacks).
- **LocalStorage (UI state)**: keys are SSOT in `knowgrph/canvas/src/lib/config.ls.ts`.
  - Sidebar: `LS_KEYS.markdownSidebarOpen`, `LS_KEYS.markdownSidebarWidthPx`
  - Explorer sections: `LS_KEYS.markdownExplorerSourceFilesCollapsed`, `LS_KEYS.markdownExplorerOutlineCollapsed`, `LS_KEYS.markdownExplorerBacklinksCollapsed`
  - Source Files tree: `LS_KEYS.markdownExplorerSourceFilesExpandedPaths`
- **Dexie (workspace + cached sources)**: `knowgrph/canvas/src/features/source-files/sourceFilesDb.ts`
  - DB name: `kg:source-files`
  - Persists ordered Source Files payloads plus minimal workspace metadata (folder name, access mode, selected folder path).

## Typography Contract
- Sidebar labels use `uiPanelMicroLabelTextSizeClass` (default `text-[10px]`) and the shared builder:
  - `curagrph/src/features/markdown/ui/markdownSidebarText.ts`
- Viewer and Presentation must pass the same micro label sizing into `MarkdownPanelLayout`.
- Floating panel (Inspector / Props / Tool Menu) is the baseline typography ladder for non-markdown panels.
  - Host must apply `uiPanelTextFontClass` + `uiPanelKeyValueTextSizeClass` at the floating panel content root.
  - Inspector implementations must not hardcode `text-*` or `font-*`; they must inherit and only apply semantic emphasis (e.g. `font-semibold`).
  - Record Inspector key labels must use the same key/value text size as inputs (no micro-label sizing on `dt`).
  - Shared selector: `knowgrph/canvas/src/lib/ui/panelTypography.ts`.
  - Cross-repo panels rendered inside Floating Panel (e.g. `gympgrph` geospatial panel) must receive the same ladder via an explicit `panelTypography` prop (typed by `grph-shared/ui/panelTypography`).
  - MainPanel / Editor workspace / Graph Data Table surfaces must also use the same ladder (`usePanelTypography`) and avoid hardcoded `text-*` / `font-*`.
  - Portal content (dropdowns/popovers) must explicitly apply `microLabelClass` when it cannot inherit from a panel root.

## Shared Utilities (SSOT)
Shared markdown logic is contractually owned by `knowgrph/grph-shared`.

- **Panel typography contract**: `grph-shared/ui/panelTypography`
- **Tailwind text size mapping (px)**: `grph-shared/ui/tailwindTextSize`

- **Wikilinks**: `grph-shared/markdown/wikiLinks`
  - Parse + normalize wiki link targets and build safe in-app hrefs.
- **Backlinks**: `grph-shared/markdown/backlinks`
  - Compute linked backlinks + heuristic unlinked mentions from Source Files.
- **Slugify**: `grph-shared/markdown/slugify`
  - Deterministic heading ids shared by preview rendering and parsers.
- **TOC transforms**: `grph-shared/markdown/toc`
- **Formatting transforms**: `grph-shared/markdown/formatting`

## Removal Policy (Legacy Cleanup)
- Remove or block any Viewer-only or Presentation-only header/sidebar variants.
- If a duplicate TOC renderer appears (e.g., nested inside Source Files rows), it is a contract violation and must be deleted (not conditionally hidden).

## Verification (Bounded)
- `npm --prefix curagrph run typecheck`
- `npm --prefix knowgrph/canvas run typecheck`
