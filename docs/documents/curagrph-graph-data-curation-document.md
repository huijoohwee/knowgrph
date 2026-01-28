# curagrph Graph Data Curation (UI Surfaces)

## Overview

`curagrph` owns the Graph Data curation and presentation UI surfaces (tables, editors, viewers), while host apps (e.g. `knowgrph`) own pipeline orchestration and state.

**Goal**: enforce single-source-of-truth ownership for Graph Data UI surfaces while keeping host-visible UI behavior unchanged.

---

## Scope (owned by curagrph)

- BottomPanel curation/presentation submodules (curator + markdown + stats + JSON views)
- Graph Data Table (filter/sort/group + frozen areas + virtualized rows)
- Markdown viewer/editor/presentation/gallery surfaces + Source Files List
- Preview-panel UI primitives used by markdown/presentation (gallery + overlays + zoom/pan)
- JSON editor used by curation and inspectors

---

## Integration Contract

The canonical host integration pattern for extracted UI surfaces is:

- **Resolution target**: hosts resolve extracted modules from the installed package source at `node_modules/curagrph/src` (never from sibling `../../curagrph/src` paths).
- **Host aliases**: hosts map stable import prefixes (e.g. `@/features/markdown/*`) to `./node_modules/curagrph/src/...` in both bundler config (Vite) and TypeScript `paths`.
- **Symlink stability**: hosts preserve symlink paths in both bundler and TypeScript resolution so `node_modules/curagrph/src/...` stays the canonical resolved location.
- **Styling parity**: hosts include `node_modules/curagrph/src/**/*.{js,ts,jsx,tsx}` in Tailwind content scanning so extracted classes remain stable.
- **Dependency stability**: hosts dedupe shared deps across linked packages (notably `react` and `highlight.js`) and pre-optimize `highlight.js` so markdown rendering does not hit ESM/CJS default-export hazards.
- **Coupling guardrail**: `curagrph` must not import host code via hardcoded sibling paths; any host coupling must occur only through stable host-provided module prefixes (e.g. `@/hooks/*`, `@/lib/*`) so the host controls the contract surface.

This contract is the default pattern for future UI extractions so module ownership stays neutral and maintainable without reintroducing duplicate/competing implementations in host repos.

---

## Source Files Contract

- **Host-owned ingest**: host UI surfaces (e.g. FloatingPanel Workspace Actions) ingest local/URL text and append to `useGraphStore.sourceFiles` using `addSourceFile`.
- **Curation UI visibility**: `curagrph` markdown surfaces render an optional Source Files list inside the Markdown sidebar "Contents" area.
- **Selection behavior**: selecting a source file updates the active markdown document via `setMarkdownDocument(name, text)` and updates the active marker by comparing `markdownDocumentName`.
- **Text SSOT**: selecting a Markdown source file must update the editor’s underlying markdown text source (not only Viewer/Presentation state) so Editor/Viewer/Presentation always render the same text.

### Local Markdown Folder (CRUD) Contract

- **Open folder (browser-consistent)**:
  - If supported, use the File System Access API directory picker with write access.
  - Otherwise, use a file-input directory pick as read-only; if OPFS is available, prefer creating a writable OPFS copy.
- **Create folder/file (write-gated)**: “New folder” and “New source file” are user-visible actions; if a writable local folder handle is not available, prompt the folder-open flow first and surface read-only constraints via UI toasts.
- **Delete file (write-only)**: delete is available only when a writable local folder handle exists.
- **ui-path-0 (canonical happy path)**:
  - BottomPanel → Markdown → Contents → Source files → Open folder → select a `.md` file → view in Viewer/Presentation → switch to Editor → Editor shows the same text content.

---

## Markdown Interaction Contract (Editor / Viewer / Presentation)

- **Text selection**: Viewer/Presentation preserve native browser selection (single click caret anchor; double click selects a word; triple click selects a paragraph/line). No implicit navigation on double-click.
- **Right click**: Opens the Selection Toolbar (“Show on/in …”) at the exact pointer position. Monaco’s built-in context menu is disabled so right click always produces the same app-level toolbar.
- **Cmd/Ctrl+Enter**: In the Markdown section Editor/Viewer layout modes, Cmd/Ctrl+Enter toggles Editor↔Viewer. When in Editor, it applies and then switches to Viewer.
- **Reorder grip + gutter**: Block controls (Add line + reorder grip) live in a reserved left gutter so they never overlap content; drag reorder is enabled only from the grip.
- **Nested blocks**: Tokens rendered inside list items and blockquotes do not render block gutters/controls to avoid compounding indentation and to preserve marker/border alignment.
- **Mode synchronization**: Editor/Viewer/Presentation are different render modes over the same markdown text source; switching modes must not desynchronize content (no “Viewer has content while Editor is blank”).
