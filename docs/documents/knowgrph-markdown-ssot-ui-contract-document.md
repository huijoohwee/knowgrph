# Knowgrph Markdown SSOT UI Contract

## Purpose
This document defines the Single Source of Truth (SSOT) contract for Markdown UI surfaces so Markdown Editor, Viewer, and Presentation share the same header, sidebar, TOC structure, typography, and shared utility behavior.

## Scope
- **In scope**: Bottom Panel Markdown header, Contents sidebar (TOC + Source files + Backlinks), typography ladder, shared markdown utilities used by UI and parsers.
- **Out of scope**: Canvas graph rendering, parser schema details (covered in the Markdown processing and schema documents).

## SSOT Rule (Non-Negotiable)
- There must be **one-and-only** Markdown section header implementation (used by Editor/Viewer/Presentation).
- There must be **one-and-only** Markdown sidebar/TOC structure implementation (used by Viewer/Presentation, and referenced by Editor flows).
- Shared markdown logic must live in `knowgrph/grph-shared` and be imported via `grph-shared/*` exports (no `grph-shared/src/*` runtime imports).

## Canonical UI Surfaces

### Markdown Section Header (SSOT)
**Contract**: The Markdown section header is the only place that may host cross-document actions (e.g., Source Files actions) and editor workflow actions (Apply/Save).

- **Canonical implementation**: `curagrph/src/components/BottomPanel/BottomPanelMarkdownViewerHeader.tsx` (`ViewerHeaderRow`).
- **Required behavior**:
  - Same header structure across Editor/Viewer/Presentation; only state changes (enabled/disabled) are allowed.
  - `Apply changes`, `Save`, `Save As...` are always present but disabled when not in editing mode.
  - `Source files` actions (`Open folder`, `Refresh files`, `New folder`, `New source file`) render **in the header**, immediately left of `Apply changes`.

### Contents Sidebar / TOC (SSOT)
**Contract**: The Contents sidebar uses a stable, semantic DOM with SSOT typography and must not duplicate action menus.

- **Canonical container**: `curagrph/src/features/markdown/ui/MarkdownPanelLayout.tsx`.
- **Canonical frame**: `curagrph/src/features/markdown/ui/MarkdownSidebarFrame.tsx`.
  - Renders the sidebar `<aside>` and the top `Contents` header.
- **Canonical section wrapper**: `curagrph/src/features/markdown/ui/MarkdownSidebarSection.tsx`.
  - Renders section title (`h3`) and section body.
  - **Rule**: section headers are typography-only (no `menu` actions).
- **Canonical sections**:
  - Contents: `curagrph/src/features/markdown/ui/MarkdownTableOfContents.tsx`
  - Source files: `curagrph/src/features/markdown/ui/MarkdownSourceFilesPanel.tsx`
  - Backlinks: `curagrph/src/features/markdown/ui/MarkdownBacklinksPanel.tsx`

## Typography Contract
- Sidebar labels use `uiPanelMicroLabelTextSizeClass` (default `text-[10px]`) and the shared builder:
  - `curagrph/src/features/markdown/ui/markdownSidebarText.ts`
- Viewer and Presentation must pass the same micro label sizing into `MarkdownPanelLayout`.

## Shared Utilities (SSOT)
Shared markdown logic is contractually owned by `knowgrph/grph-shared`.

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
- If a legacy action menu or duplicate title styling appears in the sidebar, it is a contract violation and must be deleted (not conditionally hidden).

## Verification (Bounded)
- `npm --prefix curagrph run typecheck`
- `npm --prefix knowgrph/canvas run typecheck`

