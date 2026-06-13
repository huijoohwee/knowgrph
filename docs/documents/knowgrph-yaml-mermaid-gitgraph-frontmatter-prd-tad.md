---
schema: kgc-computing-flow/v1
doc_id: knowgrph-yaml-mermaid-gitgraph-frontmatter-prd-tad
doc_type: prd-tad
version: 0.1.4
status: dev-source-implemented-no-deploy
updated: 2026-06-05
deploy_status: not_deployed
---

# Knowgrph YAML Mermaid GitGraph Frontmatter PRD/TAD

## Document Purpose

This document defines the implemented Dev-source contract for Toolbar -> Canvas View Mode -> **2D Renderer: GitGraph** and the shared BottomPanel/FloatingPanel Mermaid diagram surfaces for GitGraph and Gantt. The feature lets a Markdown document land on a dedicated Mermaid GitGraph surface through YAML frontmatter while preserving the existing Flow frontmatter parser and renderer ownership boundaries.

The implementation is Dev-only. It does not claim a Prod mirror sync or Cloudflare deployment.

## Implemented Dev-Source Baseline

| Capability | Implemented owner | Proof |
|---|---|---|
| Mermaid diagram kind detection | `grph-shared/src/markdown/mermaidInput.ts` | `mmdNormalization.test.ts` covers `gitGraph`, `gitGraph:`, `gantt`, Mermaid config headers, and mixed diagram splitting. |
| Frontmatter ingestion | `canvas/src/lib/parsers/markdownJsonLd.impl.ts` | Frontmatter `mermaid: |` creates a `MermaidDiagram` with `properties.diagramKind = "gitgraph"`. |
| Flowchart parser isolation | `canvas/src/features/parsers/markdownJsonLdMermaidParser.ts` | GitGraph commands do not create Flowchart `MermaidNode` topology. |
| Frontmatter-flow metadata fallback | `canvas/src/lib/mermaid/mermaidFrontmatterCode.ts` | `frontmatter-flow` graphs can preserve and expose top-level `mermaid` metadata. |
| Mermaid diagram code resolver | `canvas/src/lib/mermaid/mermaidDiagramCode.ts`, `canvas/src/lib/mermaid/mermaidGitGraph.ts` | Scans typed `{key,type,value}` frontmatter objects for `mermaid_flowchart` / `mermaid_gitgraph` / `mermaid_architecture` / `mermaid_eventmodeling` / `mermaid_gantt`, then falls back to top-level `mermaid: |` candidates. |
| Renderer surface | `canvas/src/components/MermaidGitGraphCanvas.tsx` | Renders the resolved Mermaid GitGraph code through the shared Mermaid SVG cache and postprocessor. |
| Interactive viewport | `canvas/src/lib/diagram/InteractiveMermaidDiagram.tsx`, `canvas/src/components/GraphCanvas/hooks/useSvgSurfaceZoomRuntime.ts` | BottomPanel Version Graph, GitGraph, and Gantt wrap cached Mermaid SVG output with the shared SVG zoom controller, content-bounds fitting, actual SVG viewport measurement, per-diagram keyed zoom persistence, neutral SVG element selection, and row-selection callbacks. |
| Inline GitGraph CRUD | `canvas/src/lib/mermaid/mermaidGitGraphEdit.ts`, `canvas/src/components/MermaidGitGraphCanvas.tsx` | Command create/update/delete transforms operate on the active Markdown `mermaid: |` source and reuse the shared inline text editor. |
| Document version graph | `canvas/src/features/document-versioning/documentVersioning.ts`, `canvas/src/features/document-versioning/DocumentVersionGitGraphPanel.tsx`, `canvas/src/features/strybldr/StrybldrTimelineBottomPanel.tsx` | Editor Workspace `[ ] diff` opens the shared Timeline bottom panel in Version Graph view; the bottom panel keeps Version Graph separate from Mermaid GitGraph; MainPanel History does not own a duplicate document-version Docs surface. |
| BottomPanel / FloatingPanel Mermaid panels | `canvas/src/features/gitgraph/MermaidDiagramPanelView.tsx`, typed diagram FloatingPanel views, and typed diagram BottomPanel views | BottomPanel owns Mermaid diagram previews and omits parsed row lists; FloatingPanel owns parsed rows and omits Mermaid diagram previews. Both surfaces share the same selected-row store and document-version graph row-selection helper; document-version history never appears as a GitGraph fallback. |
| Typed `flow_diagrams` frontmatter | `canvas/src/features/parsers/markdownFrontmatterFlowGraph.flowDiagrams.ts` | Routed `mermaid_flowchart`, `mermaid_gitgraph`, `mermaid_architecture`, and `mermaid_eventmodeling` entries render in FloatingPanel row-list and BottomPanel chart surfaces without filename checks, static backfill, or Rich Media Panel fallback. |
| Canvas mount | `canvas/src/components/CanvasViewport.tsx` | Mounts the GitGraph surface only when the active 2D surface is `gitGraph`. |
| Toolbar and registry | `canvas/src/lib/config.render.ts`, `canvas/src/components/toolbar/canvasViewMenu.ts`, `canvas/src/components/toolbar/canvasViewActions.ts`, `canvas/src/lib/config-copy/uiCopy.ts` | Registers canonical renderer id `gitGraph`, label `2D Renderer: GitGraph`, menu metadata, icon, normalized canonical-token resolution, and Canvas View Display Controls that open BottomPanel GitGraph/Gantt through the shared bottom-surface store. |
| Parser routing contract | opening frontmatter `kgParserRoutingContract` | Names parser logic, routing keys, diagram kinds, surfaces, edge policy, and fork policy for runtime-ready demos without renderer-local aliases, stale carryover, or body-side topology mirrors. |

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
- Given a runtime-ready demo declares `kgParserRoutingContract`, when Source Files routes the document, then routing keys, diagram kinds, surfaces, edges, and fork policy remain source-owned and do not require renderer-local fallback aliases.

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

- `readMermaidDiagramKind` recognizes `flowchart`, `graph`, `gitGraph`, `gitGraph:`, and `gantt` declarations.
- `splitMermaidDiagrams` keeps mixed Flowchart, GitGraph, and Gantt Mermaid blocks separate and preserves immediate Mermaid config headers with their diagram slice.
- `parseMermaidFrontmatter` remains Flowchart-only. GitGraph and Gantt are preserved as diagram code and rendered by Mermaid itself.

### Rendering

- `gitGraph` is a canonical 2D renderer id and maps to the `gitGraph` surface.
- The surface is mounted from `CanvasViewport` only when active.
- The surface resolves GitGraph code from active Markdown frontmatter text first, then from parsed graph metadata as fallback, so inline source edits render immediately without waiting on a parser reapply.
- Mermaid rendering uses the existing cached SVG renderer and SVG postprocessor.
- Interaction uses `useSvgSurfaceZoomRuntime`, which adapts the rendered SVG to the shared D3 Graph viewport path (`createZoom`, toolbar `useZoomEffects`, `fitAllTransform`, `useAutoZoomModes2d`, and keyed zoom commits).
- The adapter creates a neutral one-node visual-bounds graph from the wrapped SVG content bounds, with the root `viewBox` or dimensions as fallback. This graph is only a fit/zoom measurement input and is not written back to source GraphData.
- SVG selection is generic and element-local. It exposes selected labels through surface data attributes for inspection without adding GitGraph semantic parsing, hardcoded labels, or file-specific behavior.

### Inline Editing

- `mermaidGitGraphEdit.ts` is the source-text helper for GitGraph command parsing, label lookup, line update, line delete, command append, and frontmatter `mermaid: |` replacement.
- The `GitGraphFloatingPanelView` reuses the shared FloatingPanel shell and `CardInlineTextEditor` for command editing; the SVG canvas stays render/selection-only and does not introduce prompt dialogs, renderer-local storage, or a second text model.
- Source commits call the existing Markdown document setter, patch the active Source Files row when present, and reuse the workspace source writeback helpers.
- The helper is intentionally tolerant and source-preserving. It does not become a full GitGraph grammar implementation and does not emit GraphData topology.

### Document Version Visualization

- Document version snapshots remain owned by `documentVersioning.ts`; entries may carry optional collaborator metadata without requiring a collaboration backend.
- Document-version graph rendering is owned by `DocumentVersionGitGraphPanel`; BottomPanel placement is owned by `StrybldrTimelineBottomPanel`.
- Document-version Version Graph reuses the same `InteractiveMermaidDiagram` SVG row-key selection path as Mermaid GitGraph and Gantt: version ids are row keys, rendered commit dots/labels are chart targets, unmatched SVG parts dim through the shared SVG runtime, and no proxy version-node overlay is rendered.
- Editor Workspace `[ ] diff` opens the shared Timeline bottom panel in Version Graph view immediately after `[ ] Markdown` and does not render an inline document notice.
- The bottom Timeline panel exposes Timeline, Version Graph, Flowchart, GitGraph, Architecture, EventModeling, and Gantt as separate controls. The GitGraph control is reserved for typed `mermaid_gitgraph` diagram source.
- MainPanel History stays limited to Chat, History, and Log; it does not render a Docs tab, document-version list, Monaco diff review, or duplicate GitGraph timeline.
- Document version rendering is browser-local and Dev-source only. It does not write review state back to Prod, Cloudflare, GraphData topology, or Mermaid source.

### Typed Mermaid Diagram Panel Rendering

- `mermaidDiagramCode.ts` is the neutral resolver for typed Mermaid diagram source. It scans any parsed frontmatter object for `type: mermaid_flowchart`, `type: mermaid_gitgraph`, `type: mermaid_architecture`, `type: mermaid_eventmodeling`, or `type: mermaid_gantt` with a string `value`, so authoring is not tied to a specific document name, fixture path, or `flow_diagrams` nesting.
- The resolver preserves source precedence: active Markdown frontmatter text is read before parsed graph metadata, and typed entries are read before the legacy top-level `mermaid: |` fallback.
- `MermaidDiagramPanelView` is the shared BottomPanel/FloatingPanel split shell. `renderMode="diagram"` mounts `InteractiveMermaidDiagram`, which renders through the cached Mermaid SVG renderer and then hands the SVG to `useSvgSurfaceZoomRuntime` with a diagram-kind surface key. `renderMode="list"` mounts parsed command/task rows only.
- BottomPanel diagram views annotate the rendered Mermaid SVG with parsed row keys and select rows from direct SVG targets such as commit dots, commit-label backgrounds, branch labels, branch lanes, task bars, task labels, section bands, section/title text, architecture nodes, event-modeling items, and flowchart nodes/edges. The hit-test may tolerate a small near-miss around an annotated SVG target, but it does not add visible proxy row-marker controls or select rows by canvas x-position.
- FloatingPanel diagram views keep parsed rows and any kind-specific row editing without mounting a Mermaid diagram preview.
- BottomPanel and FloatingPanel stay in sync through `mermaidDiagramSelectedRowKeyByKind`; row clicks in FloatingPanel update BottomPanel diagram selection, and direct SVG element clicks in BottomPanel update the FloatingPanel selected row.
- BottomPanel diagram views render their typed frontmatter only. GitGraph does not import, mount, or fallback to the document-version graph panel, and Gantt does not reuse document-version state.
- Canvas View -> Display Controls exposes Flowchart, GitGraph, Architecture, EventModeling, and Gantt beside Timeline. These controls route to `bottomSurfaceTab` / `bottomSurfaceCollapsed`; they must not switch the 2D renderer, mutate layout state, or duplicate panel rendering logic.
- `bottomSurfaceTab: "gitGraph"` is Mermaid-only. Document version control uses `bottomSurfaceTab: "documentVersionGraph"` and is labeled Version Graph in the bottom panel.
- The shared panel path must not backfill static diagrams, regenerate stale templates, or branch on demo filenames.

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

Combined `flow_diagrams` block for Flow Editor / Storyboard diagram surfaces:

```yaml
flow_diagrams:
  key: flow_diagrams
  type: object
  value:
    gitgraph:
      key: gitgraph
      type: mermaid_gitgraph
      floatingPanelView: "gitGraph"
      floatingPanelOpen: true
      bottomPanelTab: "gitGraph"
      bottomPanelOpen: true
      render_on: [flow_editor, storyboard]
      value: |-
        gitGraph
          commit id:"source_input"
          branch research
          checkout research
          commit id:"parallel_review"
          checkout main
          merge research
    gantt:
      key: gantt
      type: mermaid_gantt
      floatingPanelView: "gantt"
      floatingPanelOpen: true
      bottomPanelTab: "gantt"
      bottomPanelOpen: true
      render_on: [flow_editor, storyboard, document_view, timeline_view]
      value: |-
        gantt
          title computing flow
          dateFormat YYYY-MM-DD
          section Critical path
          Source input :done, source_input, 2026-06-05, 1d
          Parallel review :crit, parallel_review, after source_input, 2d
```

The parser treats each entry as source data. When an entry declares both
`floatingPanelView` and `bottomPanelTab`, the parser skips derived
`FlowDiagramSource -> TextGeneration compute -> RichMediaPanel` fallback nodes
for that entry. The FloatingPanel row list and BottomPanel chart read directly
from the typed frontmatter source. Rich Media Panel nodes remain available for
ordinary generated outputs, not for routed diagram records.

## Mermaid GitGraph Syntax Boundary

Knowgrph does not reimplement the GitGraph grammar. It detects the diagram kind and delegates rendering to Mermaid. The supported syntax surface therefore follows Mermaid's GitGraph documentation for declarations and commands such as:

- `gitGraph` or `gitGraph:`
- `commit`
- `branch`
- `checkout` / `switch`
- `merge`
- `cherry-pick`
- optional commit metadata such as `id`, `tag`, and `type`

Mermaid syntax references:

- GitGraph: `https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/docs/syntax/gitgraph.md`
- Gantt: `https://github.com/mermaid-js/mermaid/blob/develop/docs/syntax/gantt.md`

## Out Of Scope

- No Prod mirror sync.
- No Cloudflare deployment.
- No GitGraph-to-GraphData topology expansion.
- No legacy renderer alias remap; renderer frontmatter uses centralized canonical renderer-token resolution.
- No document-specific fixtures or repository-path heuristics.

## Validation

Focused validation completed:

```text
npm --prefix canvas run build:grph-shared
node --preserve-symlinks --preserve-symlinks-main ./node_modules/tsx/dist/cli.cjs -e "import * as t from './src/__tests__/mmdNormalization.test.ts'; t.testReadMermaidDiagramKindDetectsGitGraph(); t.testReadMermaidDiagramKindSkipsMermaidConfigHeader(); t.testSplitMermaidDiagramsKeepsGitGraphSlicesSeparate(); console.log('mmd normalization gitgraph ok')"
node --preserve-symlinks --preserve-symlinks-main ./node_modules/tsx/dist/cli.cjs -e "import * as t from './src/__tests__/mmdNormalization.test.ts'; t.testReadMermaidDiagramKindDetectsGantt(); t.testSplitMermaidDiagramsKeepsGanttSlicesSeparate(); console.log('mmd normalization gantt ok')"
node --preserve-symlinks --preserve-symlinks-main ./node_modules/tsx/dist/cli.cjs -e "import * as t from './src/__tests__/mermaidGanttPanelRouting.test.ts'; t.testTypedMermaidDiagramResolverReadsGitGraphAndGanttFrontmatter(); t.testTypedMermaidDiagramResolverReadsParsedGraphMetadata(); t.testGanttPanelRoutingUsesSharedGitGraphMermaidUtilities(); console.log('mermaid gitgraph gantt panel routing ok')"
node --preserve-symlinks --preserve-symlinks-main ./node_modules/tsx/dist/cli.cjs -e "import * as t from './src/__tests__/canvas3dMode.test.ts'; t.testCanvasViewTimelineToggleUsesSharedViewModeOption(); console.log('canvas view diagram bottom-panel controls ok')"
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
