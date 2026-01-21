# Knowgrph Markdown Processing

## Overview
The Markdown rendering engine in Knowgrph has been enhanced to support GitHub-style code blocks with semantic HTML structure and optimized token sharing architecture. This ensures high performance during rendering cycles and a consistent, accessible UI.

## Design Mantras

```
- [ ] Cleanup; prevent resource leaks; forbid dangling handlers
- [ ] Computation; eliminate redundancy; forbid recalculation
- [ ] Neutrality; preserve domain independence; forbid domain coupling
- [ ] Reusability; maximize component utility; forbid single-use implementations
- [ ] Validation; test across contexts; forbid single-context validation
```

## Universal Design Principles

| Context        | Intent                           | Directive                                                                           |
|----------------|----------------------------------|-------------------------------------------------------------------------------------|
| Computation    | Eliminate redundancy             | - [ ] Memoize outputs; eliminate recomputation; forbid recalculation               |
| Neutrality     | Preserve domain independence     | - [ ] Drive via schema/config; preserve neutrality; forbid domain coupling         |
| Cleanup        | Prevent resource leaks           | - [ ] Remove listeners/timers; prevent leaks; forbid dangling handlers             |
| Validation     | Enforce correctness              | - [ ] Validate ingest outputs; enforce correctness; forbid untested assumptions    |
| Reusability    | Maximize component utility       | - [ ] Share token pipelines; maximize reuse; forbid single-use logic               |

## Features

### GitHub-Style UI
Code blocks now feature a structured layout matching GitHub's design system:
- **Header Bar**: A distinct header (`<header>`) containing metadata and controls.
- **Language Label**: Clearly visible language identifier (e.g., YAML, TSX).
- **Copy Button**: Integrated clipboard copy functionality with visual feedback.
- **View Toggles**: "Beside" and "Inline" toggle buttons for annotation views:
  - **Inline**: Renders annotations above the code block.
  - **Beside**: Renders code on the left and annotations on the right (on desktop), or annotations above code (on mobile).
- **Hover Effects**: The entire code block (including annotations in Beside/Inline modes) is highlighted with a blue border on hover, ensuring clear visual grouping of the code and its associated notes.

### Semantic HTML
The implementation replaces generic `<div>` wrappers with semantic elements:
- `<figure>`: The main container for the code block.
- `<header>`: Container for the top bar controls.
- `<pre>` & `<code>`: Standard elements for code content.
- `<span>` & `<button>`: For labels and interactive elements.

### Syntax Highlighting
- Powered by `highlight.js`.
- Supports Light (GitHub-like) and Dark (GitHub Dark-like) themes.
- Theme tokens are centralized in `UI_THEME_TOKENS`.
- **Line Highlighting**: Supports highlighting specific lines using `{1-3,5}` syntax in the language info string (e.g., `ts {1-3}`).
- **Mermaid Support**: Standard `mermaid` and `mmd` blocks are rendered as interactive diagrams using the Mermaid library. `textmermaid` is treated as a standard code block.

## Architecture & Performance

### Token Sharing
To avoid redundant processing and ensure consistency across the application (e.g., between Canvas, Preview, and Slides):
- **Shared Lexing**: Markdown content is lexed once using `markdownPreviewLex.ts`.
- **Token Passing**: The resulting tokens (`TokenWithLines`) are passed directly to `MarkdownCodeBlock`.
- **No Re-lexing**: The component consumes the pre-computed token, avoiding expensive re-parsing during render cycles.

### Rendering Optimization
- **Memoization**: `MarkdownCodeBlock` is wrapped in `React.memo` to prevent unnecessary re-renders when parent components update.
- **Highlight Caching**: Syntax highlighting is memoized via `useMemo`, ensuring that `highlight.js` is only invoked when the code content or language changes.

### Media Proxy Handling
- **Background Sources**: Slide `background` URLs are normalized via [markdownSlideVisuals.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/markdown/ui/markdownSlideVisuals.ts#L1-L200) before render.
- **Proxy Routing**: Cross-origin URLs are routed through `/__fetch_remote` by [applyMediaProxySrc](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/lib/url.ts#L1-L200).
- **Domain Neutrality**: No special-case domain rewrites; all remote backgrounds follow the same proxy path.

### Markdown → Graph → Canvas flow

**Processing Flow**: Markdown input → Markdown parser → GraphData store → layer derivation → Canvas scene

- **Import & Parse**: Markdown is ingested via [markdownImportAction.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/toolbar/markdownImportAction.ts), which calls [loadGraphDataFromTextViaParser](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/parsers/loader.ts#L159-L193). The markdown parser builds JSON‑LD (`buildMarkdownJsonLd`) and converts it into GraphData ([default.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/parsers/default.ts#L39-L87)).
- **YouTube Import**: Workspace Actions → Source Files → YouTube fetches transcripts/subtitles (manual or generated) via `/__youtube_transcript` and converts them into Markdown + a JSON source payload. Markdown is loaded into the Markdown Editor/Preview/Slides, while the JSON payload is stored as `jsonSourceDocumentText` for the Bottom Panel JSON Editor.
- **GraphData Commit**: Parsed GraphData is stored via the graph store (`setGraphData`), which triggers minimap and layout autosuggest side effects without blocking the UI ([graphDataSlice.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/hooks/store/graphDataSlice.ts#L224-L249)).
- **Layer Derivation**: The renderer derives a view‑specific graph (document/schema/semantic) with [deriveGraphDataForLayers](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/lib/graph/layerDerivation.ts#L324-L538) and optional frontmatter filtering; this stage clones nodes/edges so D3 can mutate render-only objects without polluting the store.
- **Canvas Rendering**: [GraphCanvas](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas.tsx#L142-L405) builds the scene via [setupGraphScene](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/scene.ts#L63-L418), producing SVG layers for nodes, edges, labels, and graph layers.

## Component Responsibility Matrix

| Layer/Subsystem | Path/Module | Component | Interface/Method | Responsibility (S-V-O) | Dependencies | Contracts | LOC |
|-----------------|-------------|-----------|------------------|------------------------|--------------|-----------|-----|
| Ingestion | `features/toolbar` | `markdownImportAction` | `import` | Toolbar triggers file read → invokes parser → updates store | `parsers/loader` | File IO | ~50 |
| Ingestion | `features/toolbar` | `youtubeImportAction` | `performYouTubeImport` | Toolbar reads YouTube URL/ID → fetches transcript JSON → converts to Markdown → updates store and opens Markdown view | `/__youtube_transcript` | Markdown+JSON ingest | ~140 |
| Parser | `features/parsers` | `markdownJsonLdParser` | `buildMarkdownJsonLd` | Parser transforms text → JSON-LD structure → GraphData | `remark`, `rehype` | Schema | ~300 |
| Store | `hooks/store` | `graphDataSlice` | `setGraphData` | Store commits data → notifies listeners → triggers side-effects | `zustand` | Immutable | ~400 |
| Renderer | `components/GraphCanvas` | `GraphCanvas` | `render` | React coordinates lifecycle → derives scene → mounts D3 | `d3`, `layerDerivation` | Visual | ~400 |
| Layout | `components/GraphCanvas` | `scene` | `setupGraphScene` | D3 simulates physics → positions nodes → updates DOM | `d3-force` | SVG | ~400 |

## Usage

```markdown
```yaml
name: Example Workflow
on: push
jobs:
  build:
    runs-on: ubuntu-latest
```
```

The above markdown will be rendered with the enhanced code block UI automatically.

## Annotation & Stable Identifiers
To support robust annotations even when code block content or position changes, the system supports stable identifiers in the code block info string:

```markdown
```js {id:my-stable-block-id}
console.log('hello')
```
```

The parsed `id` is used as the key for looking up annotations, falling back to line-based keys only when no ID is present. This ensures annotations persist through refactors.
