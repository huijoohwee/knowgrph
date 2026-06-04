---
schema: kgc-computing-flow/v1
doc_id: knowgrph-yaml-mermaid-gitgraph-frontmatter-prd-tad
doc_type: prd-tad
version: 0.1.0
status: dev-source-implemented-no-deploy
updated: 2026-06-04
deploy_status: not_deployed
---

# Knowgrph YAML Mermaid GitGraph Frontmatter PRD/TAD

## Document Purpose

This document defines the implemented Dev-source contract for Toolbar -> Canvas View Mode -> **2D Renderer: GitGraph**. The feature lets a Markdown document land on a dedicated Mermaid GitGraph surface through YAML frontmatter while preserving the existing Flow frontmatter parser and renderer ownership boundaries.

The implementation is Dev-only. It does not claim a Prod mirror sync or Cloudflare deployment.

## Implemented Dev-Source Baseline

| Capability | Implemented owner | Proof |
|---|---|---|
| Mermaid diagram kind detection | `grph-shared/src/markdown/mermaidInput.ts` | `mmdNormalization.test.ts` covers `gitGraph`, `gitGraph:`, Mermaid config headers, and mixed diagram splitting. |
| Frontmatter ingestion | `canvas/src/lib/parsers/markdownJsonLd.impl.ts` | Frontmatter `mermaid: |` creates a `MermaidDiagram` with `properties.diagramKind = "gitgraph"`. |
| Flowchart parser isolation | `canvas/src/features/parsers/markdownJsonLdMermaidParser.ts` | GitGraph commands do not create Flowchart `MermaidNode` topology. |
| Frontmatter-flow metadata fallback | `canvas/src/lib/mermaid/mermaidFrontmatterCode.ts` | `frontmatter-flow` graphs can preserve and expose top-level `mermaid` metadata. |
| GitGraph code resolver | `canvas/src/lib/mermaid/mermaidGitGraph.ts` | Chooses the first GitGraph slice from Mermaid frontmatter candidates. |
| Renderer surface | `canvas/src/components/MermaidGitGraphCanvas.tsx` | Renders the resolved Mermaid GitGraph code through the shared Mermaid SVG cache and postprocessor. |
| Interactive viewport | `canvas/src/components/GraphCanvas/hooks/useSvgSurfaceZoomRuntime.ts` | Wraps the Mermaid SVG with the shared D3 Graph zoom controller, fit helpers, keyed zoom persistence, and neutral SVG element selection. |
| Inline GitGraph CRUD | `canvas/src/lib/mermaid/mermaidGitGraphEdit.ts`, `canvas/src/components/MermaidGitGraphCanvas.tsx` | Command create/update/delete transforms operate on the active Markdown `mermaid: |` source and reuse the shared inline text editor. |
| Document version GitGraph | `canvas/src/features/document-versioning/documentVersioning.ts`, `canvas/src/features/document-versioning/DocumentVersionGitGraphPanel.tsx`, `canvas/src/features/strybldr/StrybldrTimelineBottomPanel.tsx` | Editor Workspace `[ ] diff` opens the shared Timeline bottom panel in GitGraph view; the bottom panel exposes the GitGraph icon immediately to the right of the Timeline icon; MainPanel History does not own a duplicate document-version Docs surface. |
| Canvas mount | `canvas/src/components/CanvasViewport.tsx` | Mounts the GitGraph surface only when the active 2D surface is `gitGraph`. |
| Toolbar and registry | `canvas/src/lib/config.render.ts`, `canvas/src/components/toolbar/canvasViewMenu.ts`, `canvas/src/lib/config-copy/uiCopy.ts` | Registers canonical renderer id `gitGraph`, label `2D Renderer: GitGraph`, menu metadata, icon, and alias resolution. |

## Product Requirements

### PRD-GG-E01 - Frontmatter GitGraph Landing

As a Knowgrph author, I want a Markdown document to declare `kgCanvas2dRenderer: "gitGraph"` and `mermaid: |` GitGraph code so that Canvas opens directly to a Git history diagram.

Acceptance criteria:

- Given a Markdown file with `kgCanvasRenderMode: "2d"` and `kgCanvas2dRenderer: "gitGraph"`, when the document is parsed, then the renderer id resolves through the shared 2D renderer registry.
- Given `mermaid: |` with `gitGraph` or `gitGraph:`, when the document is parsed, then the parser creates a `MermaidDiagram` tagged with `diagramKind: "gitgraph"`.
- Given the active Canvas surface is GitGraph, when the renderer mounts, then it renders the Mermaid GitGraph code without mutating graph nodes, edges, layout caches, or frontmatter Flow state.

### PRD-GG-E02 - Parser Neutrality

As a graph author, I want GitGraph Mermaid syntax to stay diagram-native so that branch and commit commands are not misread as Flowchart topology.

Acceptance criteria:

- Given a GitGraph Mermaid block, when the Mermaid parser runs, then it must not emit Flowchart `MermaidNode` or `MermaidSubgraph` topology.
- Given a Flowchart Mermaid block, when the Mermaid parser runs, then the existing Flowchart topology path remains unchanged.
- Given a Mermaid config header before `gitGraph`, when diagram kind detection runs, then config keys such as `flowchart:` are ignored as declarations while the header remains attached to the rendered slice.

### PRD-GG-E03 - Flow Frontmatter Coexistence

As a power user, I want typed Flow frontmatter and GitGraph Mermaid frontmatter to coexist so that I can keep workflow metadata and render Git history from the same document.

Acceptance criteria:

- Given a document with both `flow:` and `mermaid: | gitGraph`, when it parses as `frontmatter-flow`, then `metadata.frontmatterMeta.mermaid` preserves the GitGraph code.
- Given that graph is rendered with `kgCanvas2dRenderer: "gitGraph"`, then the renderer reads the preserved Mermaid metadata instead of depending on Flowchart topology nodes.
- Given normalized `{key, type, value}` wrappers appear in Flow validation fixtures, then they remain fixture-only and do not become the canonical GitGraph authoring contract.

### PRD-GG-E04 - Interactive Dynamic Canvas

As a Canvas user, I want GitGraph to pan, zoom, fit, and expose selected SVG elements like other 2D surfaces so that Git history diagrams are inspectable without a scroll-only preview.

Acceptance criteria:

- Given a rendered GitGraph SVG, when the user pans, wheels, pinches, or uses toolbar zoom actions, then the surface reuses the shared D3 Graph viewport controller and keyed zoom store instead of a renderer-local event stack.
- Given the active renderer is GitGraph, when fit/auto-fit runs, then it fits the measured SVG visual bounds through a neutral synthetic bounds graph instead of GitGraph-specific topology backfill.
- Given a user clicks a visible GitGraph SVG element, then the surface marks that SVG element as selected with generic SVG metadata and does not mutate GraphData, Flow frontmatter, Mermaid code, or layout caches.
- Given the active document changes or the GitGraph SVG is re-rendered, then stale SVG listeners, RAF commits, gesture handlers, and selection metadata are cleaned up.

### PRD-GG-E05 - Inline Source CRUD

As a Canvas user, I want to edit GitGraph commands inline and add or remove common Git commands so that Git history can be maintained from the rendered surface without leaving the Markdown source as a stale parallel copy.

Acceptance criteria:

- Given the GitGraph renderer is active, when the user selects a rendered SVG label or a command row, then the command editor resolves the selected source command by Mermaid command text, branch target, commit `id`, or `tag` without project-specific labels.
- Given the user edits a selected command inline, then the renderer updates only the matching Mermaid command line in the active `mermaid: |` YAML frontmatter block and preserves unrelated frontmatter keys and Markdown body text.
- Given the user creates a command, then the renderer appends neutral Mermaid GitGraph source commands for commit, branch, merge, or cherry-pick using unique generated ids where needed.
- Given the user deletes a command, then the renderer removes only the selected GitGraph command line.
- Given any inline CRUD action succeeds, then the active Markdown document text, active Source Files entry, workspace file writeback, graph/document revisions, and history label are updated through shared owners.
- Given the renderer cannot create a merge or cherry-pick because the source has no eligible branch or commit, then it leaves the source unchanged instead of creating an invalid hardcoded fallback.

## Technical Architecture

### Pipeline

```text
Markdown Source
  -> YAML frontmatter parse
  -> Mermaid diagram kind detection
  -> MermaidDiagram preservation
  -> GitGraph renderer selection
  -> Mermaid SVG render cache
  -> postprocessed SVG surface
  -> shared D3 viewport adapter
  -> inline source CRUD transform
  -> active Markdown and Source Files writeback
```

### Ingestion

- Markdown and `.mmd` ingestion continue through the existing Markdown parser and shared Mermaid normalization helpers.
- YAML frontmatter `mermaid: |` is the canonical source for GitGraph content in Markdown documents.
- `readYamlFrontmatterMermaidCode` is a structured frontmatter read, not a filename or project-specific string scan.

### Parsing

- `readMermaidDiagramKind` recognizes `flowchart`, `graph`, `gitGraph`, and `gitGraph:` declarations.
- `splitMermaidDiagrams` keeps mixed Flowchart and GitGraph Mermaid blocks separate and preserves immediate Mermaid config headers with their diagram slice.
- `parseMermaidFrontmatter` remains Flowchart-only. GitGraph is preserved as diagram code and rendered by Mermaid itself.

### Rendering

- `gitGraph` is a canonical 2D renderer id and maps to the `gitGraph` surface.
- The surface is mounted from `CanvasViewport` only when active.
- The surface resolves GitGraph code from active Markdown frontmatter text first, then from parsed graph metadata as fallback, so inline source edits render immediately without waiting on a parser reapply.
- Mermaid rendering uses the existing cached SVG renderer and SVG postprocessor.
- Interaction uses `useSvgSurfaceZoomRuntime`, which adapts the rendered SVG to the shared D3 Graph viewport path (`createZoom`, toolbar `useZoomEffects`, `fitAllTransform`, `useAutoZoomModes2d`, and keyed zoom commits).
- The adapter creates a neutral one-node visual-bounds graph from the SVG `viewBox` or dimensions. This graph is only a fit/zoom measurement input and is not written back to source GraphData.
- SVG selection is generic and element-local. It exposes selected labels through surface data attributes for inspection without adding GitGraph semantic parsing, hardcoded labels, or file-specific behavior.

### Inline Editing

- `mermaidGitGraphEdit.ts` is the source-text helper for GitGraph command parsing, label lookup, line update, line delete, command append, and frontmatter `mermaid: |` replacement.
- The `GitGraphFloatingPanelView` reuses the shared FloatingPanel shell and `CardInlineTextEditor` for command editing; the SVG canvas stays render/selection-only and does not introduce prompt dialogs, renderer-local storage, or a second text model.
- Source commits call the existing Markdown document setter, patch the active Source Files row when present, and reuse the workspace source writeback helpers.
- The helper is intentionally tolerant and source-preserving. It does not become a full GitGraph grammar implementation and does not emit GraphData topology.

### Document Version Visualization

- Document version snapshots remain owned by `documentVersioning.ts`; entries may carry optional collaborator metadata without requiring a collaboration backend.
- Document-version GitGraph rendering is owned by `DocumentVersionGitGraphPanel`; BottomPanel placement is owned by `StrybldrTimelineBottomPanel`.
- Editor Workspace `[ ] diff` opens the shared Timeline bottom panel in GitGraph view immediately after `[ ] Markdown` and does not render an inline document notice.
- The bottom Timeline panel exposes GitGraph through the GitGraph icon immediately to the right of the Timeline icon.
- MainPanel History stays limited to Chat, History, and Log; it does not render a Docs tab, document-version list, Monaco diff review, or duplicate GitGraph timeline.
- Document version rendering is browser-local and Dev-source only. It does not write review state back to Prod, Cloudflare, GraphData topology, or Mermaid source.

## YAML Frontmatter Contract

Canonical authoring example:

```yaml
kgCanvasSurfaceMode: "2d"
kgCanvasRenderMode: "2d"
kgCanvas2dRenderer: "gitGraph"
kgDocumentSemanticMode: "document"
kgFrontmatterModeEnabled: true
mermaid: |
  ---
  config:
    theme: base
  ---
  gitGraph:
    commit id:"root" tag:"v1.0"
    branch feature
    checkout feature
    commit id:"feature-a" type:HIGHLIGHT
    checkout main
    merge feature tag:"merge"
```

Coexistence with typed Flow metadata:

```yaml
kgCanvas2dRenderer: "gitGraph"
kgFrontmatterModeEnabled: true
mermaid: |
  gitGraph
    commit id:"root"
    branch feature
    checkout feature
    commit id:"feature-a"
flow:
  direction: {key: direction, type: string, value: "LR"}
  nodes:
    - id: {key: id, type: string, value: "root"}
      type: {key: type, type: string, value: "commit"}
      label: {key: label, type: string, value: "Root"}
```

## Mermaid GitGraph Syntax Boundary

Knowgrph does not reimplement the GitGraph grammar. It detects the diagram kind and delegates rendering to Mermaid. The supported syntax surface therefore follows Mermaid's GitGraph documentation for declarations and commands such as:

- `gitGraph` or `gitGraph:`
- `commit`
- `branch`
- `checkout` / `switch`
- `merge`
- `cherry-pick`
- optional commit metadata such as `id`, `tag`, and `type`

Mermaid syntax reference: `https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/docs/syntax/gitgraph.md`.

## Out Of Scope

- No Prod mirror sync.
- No Cloudflare deployment.
- No GitGraph-to-GraphData topology expansion.
- No legacy renderer alias remap beyond the centralized canonical renderer alias table.
- No document-specific fixtures or repository-path heuristics.

## Validation

Focused validation completed:

```text
npm --prefix canvas run build:grph-shared
node --preserve-symlinks --preserve-symlinks-main ./node_modules/tsx/dist/cli.cjs -e "import * as t from './src/__tests__/mmdNormalization.test.ts'; t.testReadMermaidDiagramKindDetectsGitGraph(); t.testReadMermaidDiagramKindSkipsMermaidConfigHeader(); t.testSplitMermaidDiagramsKeepsGitGraphSlicesSeparate(); console.log('mmd normalization gitgraph ok')"
node --preserve-symlinks --preserve-symlinks-main ./node_modules/tsx/dist/cli.cjs -e "import * as t from './src/__tests__/mermaidFrontmatterRender.test.ts'; (async () => { await t.testMermaidFrontmatterGitGraphPreservesDiagramWithoutFlowchartTopology(); await t.testFrontmatterFlowGitGraphRendererCanReadMermaidMetadata(); console.log('mermaid frontmatter gitgraph ok') })()"
node --preserve-symlinks --preserve-symlinks-main ./node_modules/tsx/dist/cli.cjs -e "import * as t from './src/__tests__/rendererPipelineNeutrality.test.ts'; t.test2dRendererPipelineUsesSharedSurfaceHelpers(); console.log('renderer pipeline gitgraph ok')"
node --preserve-symlinks --preserve-symlinks-main ./node_modules/tsx/dist/cli.cjs -e "import * as t from './src/__tests__/mermaidGitGraphEdit.test.ts'; t.testMermaidGitGraphEditParsesCrudCommandsAndFindsSvgLabel(); t.testMermaidGitGraphEditUpdatesAddsAndDeletesCommands(); t.testMermaidGitGraphEditReplacesYamlMermaidFrontmatterOnly(); t.testMermaidGitGraphEditCreatesFrontmatterWhenMissing(); console.log('gitgraph edit helpers ok')"
node --preserve-symlinks --preserve-symlinks-main ./node_modules/tsx/dist/cli.cjs -e "import * as t from './src/__tests__/zoomViewKeySharedAcross2dRenderers.test.ts'; t.testZoomViewKeyIsIsolatedAcross2dRenderers(); console.log('gitgraph zoom key isolation ok')"
node --preserve-symlinks --preserve-symlinks-main ./node_modules/tsx/dist/cli.cjs -e "(async () => { await import('./src/components/MermaidGitGraphCanvas.tsx'); await import('./src/components/GraphCanvas/hooks/useSvgSurfaceZoomRuntime.ts'); console.log('gitgraph interactive imports ok') })()"
npm --prefix canvas run typecheck
```

## Handoff Notes

- Prod and Cloudflare remain intentionally untouched until explicitly instructed.
- A future publish pass should copy only after Dev validation and should not alter the GitGraph contract.
- Any future GitGraph semantic extraction must be added as a new source-owned parser feature with tests. It must not be layered into the Flowchart parser.
- Inline CRUD is source-text CRUD. It is not a Git repository operation, does not call local `git`, and does not infer history semantics beyond Mermaid command-line transforms.
