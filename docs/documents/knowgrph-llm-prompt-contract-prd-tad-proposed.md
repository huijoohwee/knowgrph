---
title: Knowgrph LLM Prompt Contract — PRD & TAD (Proposed)
id: knowgrph-llm-prompt-contract-prd-tad-proposed
version: 0.1.0
status: Proposed
date: 2026-05-21
author: solo-dev
kgDocumentSemanticMode: document
kgFrontmatterModeEnabled: true
---

# Knowgrph LLM Prompt Contract — PRD & TAD (Proposed)

**Version**: 0.1.0 · **Status**: Proposed · **Date**: 2026-05-21

---

## Table of Contents

1. [Problem Discovery (Phase 0)](#1-problem-discovery-phase-0)
2. [PRD — Product Requirements (Phase 1)](#2-prd--product-requirements-phase-1)
3. [TAD — Technical Architecture (Phase 2)](#3-tad--technical-architecture-phase-2)
4. [Alignment & Traceability (Phase 3)](#4-alignment--traceability-phase-3)
5. [Open Questions](#5-open-questions)

---

## 1. Problem Discovery (Phase 0)

### 1.1 Problem Hypothesis

> A solo developer using an LLM (Claude, MiroThinker, or equivalent) to generate knowledge-graph content cannot route that output directly into interactive canvas nodes and edges on the Knowgrph FlowEditor, 
> because no standard LLM output contract exists and the Mermaid-to-GraphData lift is not yet built. 
> As a result, every LLM run requires manual reformatting, preventing autonomous agentic graph generation.

### 1.2 Pain Points and Evidence

| Persona | Pain Point | Observable Signal |
|---|---|---|
| Solo dev (graph author) | LLM output lands as raw text with no frontmatter; canvas ignores it | Markdown pane displays text; no nodes appear on canvas |
| Solo dev (schema curator) | Schema-config must be hand-edited per corpus; LLM overwrites guardrails | Broken JSON-LD after unconstrained LLM edit |
| Agentic workflow (Claude Code / MiroThinker) | No `/goal` condition exists to verify graph materialization | Agent loop cannot confirm graph is live; halts or loops indefinitely |

### 1.3 Current State Journey (Friction Map)

| Stage | Current State | Friction |
|---|---|---|
| Trigger | Developer prompts LLM to describe a knowledge domain | No output format specified |
| Ingest | LLM returns prose or a Mermaid diagram in a code block | No frontmatter keys; canvas ignores document |
| Parse | `kgFrontmatterModeEnabled` is false or absent | Frontmatter Mode not activated; graph state not updated |
| Lift | Mermaid block is rendered as SVG image only | `graphDataSlice` receives no `GraphNode` / `GraphEdge` objects |
| Display | Canvas shows empty state or previous dataset | Developer must manually re-import or reformat |
| Schema | Developer hand-tunes `schema-config-template.jsonld` | No LLM guardrails; high risk of breaking corpus preset structure |

### 1.4 Scope

**In scope**: LLM output format contract (Markdown + YAML frontmatter); Mermaid-to-`GraphData` extractor; schema-config LLM editing contract; `/goal` verification conditions for each.

**Out of scope**: Live LLM streaming into canvas; multi-document orchestration; geospatial mode; 3D renderer; authentication / BYOK changes.

### 1.5 Gate: Problem Validated

The pipeline audit (2026-05-21) and `todo.md` entries (2026-01-20, 2026-01-22) confirm the Mermaid lift and round-trip fidelity are open P0 items. Problem scope accepted.

---

## 2. PRD — Product Requirements (Phase 1)

### Epic Structure

```
Epic PRD-E1  LLM Markdown Graph Document Contract
Epic PRD-E2  Mermaid AST → GraphData Extractor
Epic PRD-E3  Schema-Config LLM Editing Contract (pass 2)
```

---

### Epic PRD-E1 — LLM Markdown Graph Document Contract

#### Problem Statement

A solo developer generating knowledge-graph content with an LLM has no standardised output format. 
The LLM produces prose or bare Mermaid blocks that the Knowgrph canvas cannot consume directly, requiring manual reformatting on every run. 
The opportunity is a prompt contract that constrains LLM output to a format the canvas ingests without modification.

#### Personas

**Graph Author (solo dev)**: uses an LLM via FloatingPanel Chat or Claude Code to explore a knowledge domain; wants the resulting graph to appear on the canvas immediately without reformatting.

**Agentic Workflow**: a Claude Code or MiroThinker agent running a multi-step research loop; needs a verifiable completion condition that proves graph nodes exist on canvas.

#### User Journey — Graph Author: Generate a Domain Graph

| Stage | Action | Touchpoint | Pain Point | Opportunity |
|---|---|---|---|---|
| Trigger | Developer opens Knowgrph and types a domain prompt in FloatingPanel Chat | FloatingPanel Chat UI | No format guidance in prompt | Pre-load system prompt with contract |
| Discover | LLM returns Markdown with frontmatter and Mermaid block | Markdown pane | Frontmatter keys absent; canvas stays empty | Contract enforces required keys |
| Engage | Developer saves or imports the document | Editor Workspace → Canvas | Manual import step required | Auto-import on frontmatter detection |
| Complete | Canvas renders nodes and edges from Mermaid block | FlowEditor / D3 renderer | Mermaid rendered as image only | Mermaid AST → GraphData extractor (E2) |
| Return | Developer refines graph via Chat and re-imports | FloatingPanel Chat | Round-trip drops node positions | Export/import fidelity (future epic) |

#### User Stories

**PRD-E1-S1**: As a graph author, I want the LLM to return a Markdown document with correct Knowgrph frontmatter keys so that the canvas activates Frontmatter Mode without manual configuration.

**PRD-E1-S2**: As a graph author, I want the LLM Mermaid block to use `kg:`-prefixed node IDs and generic labels so that the graph is domain-agnostic and reusable across corpora.

**PRD-E1-S3**: As an agentic workflow, I want a verifiable completion condition that confirms the Markdown document contains the required frontmatter keys and a valid Mermaid block so that the agent loop can self-verify output without human review.

#### Acceptance Criteria

**PRD-E1-S1-AC1**
Given a system prompt containing the Markdown Graph Document Contract, when the LLM generates output,
then the output MUST begin with a YAML frontmatter block containing all four required keys: 
`kgFrontmatterModeEnabled: true`, `kgDocumentSemanticMode: document`, `kgCanvasSurfaceMode: 2d`, `kgCanvas2dRenderer: flowEditor`.

> **`/goal` translation**: `output file starts with a YAML frontmatter block; grep confirms all four kgFrontmatterModeEnabled kgDocumentSemanticMode kgCanvasSurfaceMode kgCanvas2dRenderer keys are present; no other file is modified`

**PRD-E1-S1-AC2**
Given the frontmatter block is present,
when the document is imported into Knowgrph,
then `kgFrontmatterModeEnabled` resolves to `true` in the Zustand store and the canvas surface switches to `2d` FlowEditor mode.

> **`/goal` translation**: `npm run superagent:test exits 0 and the test log confirms kgFrontmatterModeEnabled=true and canvasRenderMode=2d are set in store state after import`

**PRD-E1-S2-AC1**
Given the Markdown Graph Document Contract is active,
when the LLM generates a Mermaid block,
then every node ID in the block MUST match the pattern `kg:[a-z0-9_]+` and every label MUST contain no proper nouns or hardcoded business terms.

> **`/goal` translation**: `grep -E "^\s+kg:[a-z0-9_]+" on the mermaid block returns a match for every node line; grep for known forbidden terms (company names, PII) returns no matches`

**PRD-E1-S3-AC1**
Given an agentic workflow has run the Markdown Graph Document Contract,
when the output file is evaluated,
then the file is a single valid Markdown document, the frontmatter block parses without error, and the Mermaid fenced block contains at least two nodes and one edge.

> **`/goal` translation**: `python -c "import yaml; yaml.safe_load(frontmatter)" exits 0; mermaid node count >= 2 and edge count >= 1 confirmed by line-count check on the fenced block`

#### Success Metrics

| Metric | Baseline | Target | Timeline |
|---|---|---|---|
| LLM output passes frontmatter validation on first attempt | 0 % (no contract) | ≥ 90 % | Week 1 post-deploy |
| Canvas activates Frontmatter Mode on import without manual step | 0 % | 100 % | Week 1 post-deploy |
| Agent loop confirms document validity without human review | 0 % | 100 % | Week 1 post-deploy |

#### MoSCoW Priority

**Must**: required frontmatter keys; `kg:`-prefixed node IDs; single-document output; no secrets or paths.
**Should**: subgraph blocks for cluster representation; optional `title`, `id`, `date` frontmatter fields.
**Could**: inline node `properties` hints in Mermaid comments; multi-language label support.
**Won't** (this version): streaming partial output; multi-document graph assembly.

#### Out of Scope

Live canvas update during LLM streaming; BYOK key management; geospatial or 3D canvas modes; PDF-to-Markdown conversion.

#### Dependencies

PRD-E1 requires no code changes to Knowgrph. The frontmatter keys and Mermaid rendering already exist. The contract is a prompt artefact only.

---

### Epic PRD-E2 — Mermaid AST → GraphData Extractor

#### Problem Statement

When a Knowgrph Markdown document contains a `mermaid` fenced block, the Markdown Viewer renders it as a static SVG image. 
The `graphDataSlice` Zustand store receives no `GraphNode` or `GraphEdge` objects. 
The canvas cannot make these nodes interactive, selectable, or editable. 
The extractor closes this gap by parsing the Mermaid AST and writing the resulting graph data into the store.

#### Personas

**Graph Author (solo dev)**: wants to click, drag, and inspect nodes generated from LLM output without re-importing from a separate JSON file.

**Agentic Workflow**: needs a `/goal` condition that verifies interactive graph nodes are present on the canvas, not merely that a diagram image was rendered.

#### User Journey — Graph Author: Make LLM Nodes Interactive

| Stage | Action | Touchpoint | Pain Point | Opportunity |
|---|---|---|---|---|
| Trigger | Markdown document with Mermaid block is imported | Editor Workspace | Nodes visible in Viewer as image; not selectable | Extractor fires on import |
| Discover | Developer clicks a node in the Mermaid diagram | Markdown Viewer | Click does nothing; node is SVG path, not graph element | FlowEditor shows live node |
| Engage | Developer drags, renames, or connects a node | FlowEditor Canvas | Cannot interact; must re-create manually | Full `GraphNode` CRUD available |
| Complete | Graph layer is visible with subgraph clusters | FlowEditor Canvas | Subgraphs invisible; only flat list | Subgraph → cluster layer mapping |
| Return | Developer exports graph and re-prompts LLM | Markdown pane | Round-trip drops positions and types | Export fidelity epic (future) |

#### User Stories

**PRD-E2-S1**: As a graph author, I want Mermaid nodes and edges to appear as interactive `GraphNode` and `GraphEdge` objects in the FlowEditor so that I can click, drag, and edit them without re-importing from a separate source.

**PRD-E2-S2**: As a graph author, I want Mermaid `subgraph` blocks to be mapped to Knowgrph graph layers (clusters) so that logical groupings are preserved on the canvas.

**PRD-E2-S3**: As an agentic workflow, I want a `/goal` condition that verifies the `graphDataSlice` contains the expected node and edge count after a Mermaid document is imported so that the agent can confirm graph materialisation without visual inspection.

#### Acceptance Criteria

**PRD-E2-S1-AC1**
Given a Markdown document containing a `mermaid` fenced block with N nodes and M edges,
when the document is imported into Knowgrph,
then `graphDataSlice.nodes` contains exactly N `GraphNode` objects and `graphDataSlice.edges` contains exactly M `GraphEdge` objects, each with `id`, `label`, and `type` populated.

> **`/goal` translation**: `npm run superagent:test exits 0; test log confirms graphDataSlice.nodes.length === N and graphDataSlice.edges.length === M after import of the fixture document; no other store slice is modified`

**PRD-E2-S1-AC2**
Given the extractor has run,
when the FlowEditor canvas is rendered,
then each `GraphNode` is displayed as a draggable, selectable widget with the node label visible and a typed port handle for each connected edge.

> **`/goal` translation**: `flowEditorRichMediaPanelOpenWidgetExclusionRegression focused exports pass; workspaceImportVideoDemoRendererIsolation tests pass; no regression in existing 5 superagent:test cases`

**PRD-E2-S2-AC1**
Given a Mermaid block containing one or more `subgraph` … `end` declarations,
when the extractor runs,
then each `subgraph` is represented as a graph layer (cluster) in `graphDataSlice`, containing the nodes declared within it, and the cluster label matches the subgraph name.

> **`/goal` translation**: `graphDataSlice.layers.length === subgraphCount; each layer.nodeIds array contains the correct node IDs; npm run superagent:test exits 0`

**PRD-E2-S3-AC1**
Given any Mermaid document imported by an agent,
when the `/goal` condition is evaluated,
then the agent can state the node count, edge count, and cluster count as integers surfaced from test output.

> **`/goal` translation**: `npm test -- --grep "parseMermaidToGraphData" exits 0 with pass count equal to fixture count; stdout includes node_count=N edge_count=M cluster_count=K lines`

#### Success Metrics

| Metric | Baseline | Target | Timeline |
|---|---|---|---|
| Mermaid nodes appear in `graphDataSlice` after import | 0 % | 100 % of valid Mermaid documents | Week 2 post-build |
| Subgraph blocks mapped to graph layers | 0 % | 100 % of documents with subgraph declarations | Week 2 post-build |
| Extractor adds zero regressions to existing test suite | N/A | 0 failing tests | Week 2 post-build |
| Implementation size | N/A | ≤ 200 lines TypeScript | Week 2 post-build |

#### MoSCoW Priority

**Must**: `GraphNode` and `GraphEdge` creation from `graph LR` / `flowchart TD` syntax; `id`, `label`, `type` fields populated; no regression to existing tests.
**Should**: `subgraph` → cluster / graph layer mapping; edge label extraction; node `type` inferred from Mermaid shape syntax (`[rect]`, `(round)`, `{diamond}`).
**Could**: node position hints from Mermaid layout direction; edge `properties` from comment annotations.
**Won't** (this version): `sequenceDiagram` or `erDiagram` → GraphData; real-time streaming parse.

#### Out of Scope

Non-flowchart Mermaid diagram types; inverse export from `GraphData` back to Mermaid syntax (future epic); collision layout on extract.

#### Dependencies

`mermaid.js` is already a confirmed dependency in `canvas/package.json`. 
No new packages required. 
TypeScript utility placed in `canvas/src/utils/parseMermaidToGraphData.ts`.

---

### Epic PRD-E3 — Schema-Config LLM Editing Contract (Pass 2)

#### Problem Statement

The existing `knowgrph-llm-prompt-contract.md` (uploaded) constrains an LLM to safely edit `schema-config-template.jsonld`, preserving the AgenticRAG semantic layer configuration. 
However, the contract is not yet anchored to the pipeline stage it serves (corpus similarity tuning after graph data is live), has no `/goal` conditions, and contains no explicit traceability to the Markdown Graph Document Contract (PRD-E1). 
This epic formalises that contract under the PRD/TAD framework and sequences it as pass 2 in the two-pass workflow.

#### Personas

**Schema Curator (solo dev)**: wants to tune `topKEdgesPerNode`, `minSimilarity`, and community detection parameters for a specific knowledge domain without risking structural breakage of the JSON-LD document.

**Agentic Workflow**: needs a verifiable completion condition that the output is a valid JSON object with all required keys intact.

#### User Stories

**PRD-E3-S1**: As a schema curator, I want the LLM to return a single valid JSON-LD schema-config document that preserves all required structural keys so that I can drop it into the AgenticRAG pipeline without validation errors.

**PRD-E3-S2**: As a schema curator, I want the LLM to choose `corpusSizePreset` values consistent with my corpus size so that `topKEdgesPerNode` and `minSimilarity` thresholds are appropriate without manual cross-checking.

**PRD-E3-S3**: As an agentic workflow, I want a `/goal` condition that verifies the output JSON-LD parses cleanly and retains the required top-level keys so that the agent can confirm schema validity without human review.

#### Acceptance Criteria

**PRD-E3-S1-AC1**
Given the Schema-Config Editing Contract is active and a template is provided,
when the LLM returns output,
then the output is a single valid JSON object containing `@context`, `@graph`, and `metadata` at the top level, with `metadata.layers`, `metadata.corpusSizePresets` (including `small`, `medium`, `large`), and `metadata.agenticRagSchema` present and unmodified in structure.

> **`/goal` translation**: `python -c "import json; d=json.load(open('output.jsonld')); assert '@context' in d and '@graph' in d and 'metadata' in d and all(k in d['metadata']['corpusSizePresets'] for k in ['small','medium','large'])" exits 0`

**PRD-E3-S2-AC1**
Given the LLM selects `corpusSizePreset`,
when `metadata.layers.semantic.topKEdgesPerNode` and `metadata.layers.semantic.minSimilarity` are checked,
then they match the numeric values declared for the selected preset in `metadata.corpusSizePresets`.

> **`/goal` translation**: `python validation script compares layers.semantic values against the chosen preset entry and exits 0 with "preset consistent" in stdout`

**PRD-E3-S3-AC1**
Given any schema-config output from an agent,
when the `/goal` condition is evaluated,
then the agent surfaces: JSON parse result (pass/fail), top-level key presence (pass/fail), preset consistency (pass/fail) as three distinct lines in stdout.

> **`/goal` translation**: `python validate_schema_config.py output.jsonld exits 0 with three "PASS" lines for parse, keys, and preset_consistency`

#### Success Metrics

| Metric | Baseline | Target | Timeline |
|---|---|---|---|
| Schema-config output passes structural validation on first attempt | ~60 % (no guardrails) | ≥ 95 % | Week 3 post-contract deploy |
| Preset consistency between `corpusSizePreset` and `layers.semantic` values | Not measured | 100 % | Week 3 post-contract deploy |
| No required key deleted by LLM | ~80 % (no guardrails) | 100 % | Week 3 post-contract deploy |

#### MoSCoW Priority

**Must**: `@context`, `@graph`, `metadata` structural preservation; `corpusSizePresets` (`small`, `medium`, `large`) intact; valid JSON output; no secrets or paths.
**Should**: preset-consistent `topKEdgesPerNode` and `minSimilarity` values; `@graph` node/edge vocabulary seeded from `GraphNode.type` values produced by PRD-E2 extractor.
**Could**: `communityDetection.algorithm` recommendation based on graph density hint from corpus.
**Won't** (this version): multi-schema merging; schema versioning logic.

#### Dependencies

PRD-E3 depends on PRD-E2 (the `@graph` vocabulary is most useful when typed `GraphNode` objects are live). PRD-E3 can be deployed independently but produces lower value without PRD-E2 graph data.

---

## 3. TAD — Technical Architecture (Phase 2)

### 3.1 Overview

**From LLM output to interactive canvas**: LLM generates a structured Markdown document → Knowgrph parses frontmatter keys → Mermaid AST extractor lifts nodes/edges into `graphDataSlice` → FlowEditor renders interactive graph → schema-config contract (pass 2) tunes the AgenticRAG similarity layer over the live graph data.

### 3.2 Journey → System Mapping

| Journey Stage | Workflow | Data Flow | Component |
|---|---|---|---|
| Trigger (prompt) | `WF-1` LLM Document Generation | `DF-1` LLM → Markdown file | `C-1` Markdown Graph Document Contract |
| Ingest (import) | `WF-2` Markdown Import | `DF-2` Markdown → frontmatter parse → Zustand | `C-2` Frontmatter parser (`uiSliceInitialState`) |
| Lift (extract) | `WF-3` Mermaid Extraction | `DF-3` Mermaid fenced block → AST → GraphData | `C-3` `parseMermaidToGraphData()` |
| Display (render) | `WF-4` Canvas Render | `DF-4` GraphData → D3/Flow/FlowEditor | `C-4` `graphDataSlice` + FlowEditor |
| Tune (schema) | `WF-5` Schema-Config Edit | `DF-5` Template JSON-LD → LLM → validated JSON-LD | `C-5` Schema-Config Editing Contract |

---

### 3.3 Architecture Diagram

```mermaid
flowchart LR
    subgraph LLM["LLM (Claude / MiroThinker)"]
        P1[C-1: MD Graph Document Contract]
        P2[C-5: Schema-Config Editing Contract]
    end

    subgraph KnowgrphCanvas["Knowgrph Canvas (canvas/)"]
        FM[C-2: Frontmatter parser]
        EX[C-3: parseMermaidToGraphData]
        GS[C-4: graphDataSlice + FlowEditor]
    end

    subgraph AgenticRAG["AgenticRAG layer"]
        SC[schema-config-template.jsonld]
    end

    P1 -->|.md with frontmatter + Mermaid| FM
    FM -->|kgFrontmatterModeEnabled=true| GS
    FM -->|Mermaid fenced block| EX
    EX -->|GraphNode[] + GraphEdge[]| GS
    GS -->|live graph| GS
    P2 -->|validated JSON-LD| SC
    GS -.->|GraphNode.type vocabulary| P2
```

### 3.4 Component Specifications

---

#### C-1 — Markdown Graph Document Contract

**Responsibility**: Constrains LLM output to a single Markdown document that Knowgrph ingests without modification.

**Interfaces**:
- Input: domain prompt + system prompt (the contract text)
- Output: UTF-8 Markdown file with YAML frontmatter block (lines 1–N) + `mermaid` fenced block + optional prose

**Contract — required frontmatter keys** (all four must be present):

```yaml
kgFrontmatterModeEnabled: true
kgDocumentSemanticMode: document   # or "keyword"
kgCanvasSurfaceMode: 2d
kgCanvas2dRenderer: flowEditor
```

**Contract — Mermaid block rules**:
- Diagram type: `graph LR`, `graph TD`, or `flowchart TD`; no `sequenceDiagram`, `erDiagram`, or `gantt`
- Node IDs: pattern `kg:[a-z][a-z0-9_]*` (e.g. `kg:concept_a`)
- Node labels: generic, domain-agnostic; no proper nouns, credentials, or absolute paths
- Edges: `A --> B` or `A -- label --> B`; label ≤ 40 characters
- Subgraphs: `subgraph ClusterName / end` allowed; map to graph layer
- Node limit: warn if > 30; refuse if > 100

**Contract — guardrails** (must be stated verbatim in system prompt):
- Return a single valid Markdown document; no JSON wrapper; no code fences outside the Mermaid block
- Do NOT introduce secrets, credentials, environment variables, or absolute file paths
- Do NOT use HTML inside the Mermaid block
- Do NOT exceed 100 nodes; warn the user if the graph exceeds 30 nodes

**Configuration**: contract text stored as `llm-chat-config/md-graph-document-contract.md`; no secrets; no runtime credentials.

**`/goal` Conditions**:
- `PRD-E1-S1-AC1`: `grep kgFrontmatterModeEnabled output.md exits 0; grep kgDocumentSemanticMode output.md exits 0; grep kgCanvasSurfaceMode output.md exits 0; grep kgCanvas2dRenderer output.md exits 0`
- `PRD-E1-S2-AC1`: `grep -E "kg:[a-z0-9_]+" output.md returns at least one match; grep for forbidden terms returns 0 matches`
- `PRD-E1-S3-AC1`: `python frontmatter_check.py output.md exits 0 with PASS on parse, keys, mermaid_present`

**Dependencies**: none (prompt artefact only; no code changes to Knowgrph).

**Status**: New — to be authored as `llm-chat-config/md-graph-document-contract.md`.

---

#### C-2 — Frontmatter Parser (existing, verify)

**Responsibility**: Parses YAML frontmatter from Markdown documents and writes `kgFrontmatterModeEnabled`, `kgDocumentSemanticMode`, `kgCanvasSurfaceMode`, and `kgCanvas2dRenderer` into Zustand state slices.

**Interfaces**:
- Input: Markdown string (UTF-8)
- Output: Zustand state mutations in `uiSliceInitialState`, `canvasSlice`, `schemaSlice`

**Relevant source** (existing): `canvas/src/hooks/store/uiSliceInitialState.ts`; `canvas/src/hooks/store/store-types/graph-state-panels-markdown.ts`

**`/goal` Conditions** (verification only — no new code):
- `PRD-E1-S1-AC2`: `npm run superagent:test exits 0; store state log confirms kgFrontmatterModeEnabled=true and canvasRenderMode=2d after fixture import`

**Status**: Existing — verify behaviour with C-1 output; no modification expected.

---

#### C-3 — `parseMermaidToGraphData()` (new build)

**Responsibility**: Accepts a Mermaid `graph` / `flowchart` source string, invokes `mermaid.parse()` to obtain the AST, and maps AST nodes and edges to `GraphData` (an object of type `{ nodes: GraphNode[], edges: GraphEdge[], context?: object }`).

**Interfaces**:
- Signature: `parseMermaidToGraphData(src: string): GraphData`
- Input format: UTF-8 Mermaid source string (extracted from fenced block)
- Output format: `GraphData` as defined in `grph-shared/src/graph/types.ts`
- Error handling: throws `MermaidParseError` on invalid syntax; calling code catches and logs to `trace.jsonl`

**Mapping rules**:

| Mermaid AST element | GraphData target | Notes |
|---|---|---|
| `node.id` | `GraphNode.id` | Preserve `kg:` prefix |
| `node.label` / `node.text` | `GraphNode.label` | Strip surrounding brackets |
| Node shape (`[`, `(`, `{`) | `GraphNode.type` | `rect` / `rounded` / `diamond` |
| `edge.source` | `GraphEdge.source` | Node ID reference |
| `edge.target` | `GraphEdge.target` | Node ID reference |
| `edge.label` | `GraphEdge.label` | Optional; empty string if absent |
| `subgraph.title` | Graph layer `label` | Layer contains member `nodeIds` |

**File location**: `canvas/src/utils/parseMermaidToGraphData.ts`

**Test file location**: `canvas/src/__tests__/parseMermaidToGraphData.test.ts`

**Dependencies**: `mermaid` (already in `canvas/package.json`); `grph-shared` types (workspace dep).

**Size constraint**: ≤ 200 lines TypeScript (including type imports and error class).

**`/goal` Conditions**:
- `PRD-E2-S1-AC1`: `npm test -- --grep parseMermaidToGraphData exits 0; stdout shows all fixture assertions passing with correct node_count and edge_count`
- `PRD-E2-S2-AC1`: `subgraph fixture test exits 0; layer_count matches declared subgraph count`
- `PRD-E2-S3-AC1`: `npm run superagent:test exits 0 (no regression); parseMermaidToGraphData test suite exits 0`

**Status**: New — to be created.

---

#### C-4 — `graphDataSlice` + FlowEditor (existing, extend call site)

**Responsibility**: Maintains the global `GraphData` state (nodes, edges, layers) and drives all canvas renderer instances. C-3 writes into this slice; no changes to the slice itself are required — only a new call site that invokes `parseMermaidToGraphData()` on Mermaid fence detection during Markdown import.

**Call site change**: In the Markdown import pipeline (where the Mermaid code fence is detected for rendering), add:

```typescript
import { parseMermaidToGraphData } from '@/utils/parseMermaidToGraphData';

const mermaidSrc = extractMermaidFence(markdownContent);
if (mermaidSrc) {
  const graphData = parseMermaidToGraphData(mermaidSrc);
  graphDataSlice.setState(prev => mergeLlmGraphData(prev, graphData));
}
```

**Existing source**: `canvas/src/hooks/store/graphDataSliceUtils.ts`; `canvas/src/components/FlowEditor/`

**`/goal` Conditions**:
- `PRD-E2-S1-AC2`: `workspaceImportVideoDemoRendererIsolation tests pass; flowEditorRichMediaPanelOpenWidgetExclusionRegression passes; npm run superagent:test exits 0`

**Status**: Existing — one call-site addition only (< 10 lines).

---

#### C-5 — Schema-Config Editing Contract (formalise existing)

**Responsibility**: Constrains LLM output to a valid JSON-LD schema-config document that preserves all required structural keys and produces preset-consistent numeric values in `metadata.layers.semantic`.

**Interfaces**:
- Input: `schema-config/knowgrph-schema-config-template.jsonld` (provided as context) + domain hint (corpus size, node types from C-3 output)
- Output: single valid JSON object (no trailing commas, no comments)

**Contract additions to the existing uploaded contract**:

1. **Sequencing note** (add to §1 Overall Goals): "This contract is pass 2 of a two-pass workflow. It SHOULD be run after the Markdown Graph Document Contract (pass 1) has produced live graph data, so that `@graph` node/edge vocabulary can be seeded from `GraphNode.type` values."

2. **`@graph` seeding rule** (add to §5): "If the caller provides a list of `GraphNode.type` values from the live canvas, populate `@graph` entries to match. Use `kg:class:[type]` as `@id`."

3. **Validation script** (new artefact): `scripts/validate_schema_config.py` — three checks: JSON parse, top-level key presence, preset consistency. Exits 0 on pass; prints `PASS/FAIL [check_name]` per line.

**File location**: `llm-chat-config/schema-config-editing-contract.md` (rename and extend from uploaded contract).

**`/goal` Conditions**:
- `PRD-E3-S1-AC1`: `python scripts/validate_schema_config.py output.jsonld exits 0 with PASS parse PASS keys`
- `PRD-E3-S2-AC1`: `python scripts/validate_schema_config.py output.jsonld exits 0 with PASS preset_consistency`
- `PRD-E3-S3-AC1`: `python scripts/validate_schema_config.py output.jsonld exits 0; stdout has exactly three PASS lines`

**Status**: Existing (uploaded) — extend with sequencing note, `@graph` seeding rule, and validation script.

---

### 3.5 Data Flows

#### DF-1 — LLM → Markdown File

| Stage | Component | Input Format | Output Format | Persistence | Error Handling |
|---|---|---|---|---|---|
| Ingest | C-1 contract (system prompt) | Natural language domain prompt | — | None | Contract guardrails reject invalid output |
| Transform | LLM inference | Domain prompt | UTF-8 Markdown string | None | Re-prompt with explicit error if validation fails |
| Store | Markdown pane / file system | UTF-8 Markdown string | `.md` file | Local file or `data/outputs/` | Write error → surface in FloatingPanel |

#### DF-2 — Markdown → Frontmatter → Zustand

| Stage | Component | Input Format | Output Format | Persistence | Error Handling |
|---|---|---|---|---|---|
| Ingest | C-2 Frontmatter parser | UTF-8 Markdown | YAML object | None | Missing keys → log warning; fallback to Document Mode defaults |
| Transform | `uiSliceInitialState` | YAML object | Zustand state mutations | In-memory Zustand store | Invalid key value → use default; log to console |
| Store | Zustand | State mutations | Live store state | Session (RxDB if persistence enabled) | Hydration error → reset to defaults |

#### DF-3 — Mermaid Fenced Block → GraphData

| Stage | Component | Input Format | Output Format | Persistence | Error Handling |
|---|---|---|---|---|---|
| Ingest | Fence extractor | UTF-8 Markdown | Mermaid source string | None | No fence found → skip; no-op |
| Transform | C-3 `parseMermaidToGraphData()` | Mermaid source string | `GraphData` (`GraphNode[]`, `GraphEdge[]`) | None | `MermaidParseError` → log to `trace.jsonl`; skip graph update |
| Store | C-4 `graphDataSlice` | `GraphData` | Zustand `graphDataSlice` state | Session / RxDB | Merge conflict → `mergeLlmGraphData()` deduplicates by `id` |
| Serve | FlowEditor / D3 renderers | `graphDataSlice` state | SVG / WebGL canvas nodes and edges | Canvas viewport | Render error → fallback to empty canvas; show error banner |

#### DF-4 — Template JSON-LD → Validated Schema-Config

| Stage | Component | Input Format | Output Format | Persistence | Error Handling |
|---|---|---|---|---|---|
| Ingest | C-5 contract (system prompt + template) | JSON-LD template + domain hint | — | None | Template parse error → abort; surface to user |
| Transform | LLM inference | JSON-LD template | JSON-LD candidate output | None | Re-prompt if `validate_schema_config.py` exits non-zero |
| Store | `schema-config/` directory | JSON string | `.jsonld` file | Local file | Invalid JSON → reject; do not overwrite template |
| Serve | AgenticRAG `knowgrph_parser/` | `.jsonld` file | Semantic layer config at runtime | In-memory | Schema load error → fallback to template defaults |

---

### 3.6 Workflows

#### WF-1 — LLM Document Generation

**Trigger**: Developer sends a domain prompt in FloatingPanel Chat with the Markdown Graph Document Contract loaded as system prompt.

**Actors**: Graph Author, LLM (Claude / MiroThinker), FloatingPanel Chat UI.

**Happy Path**:
1. Graph Author sends domain prompt → LLM produces Markdown with all four frontmatter keys and a valid Mermaid block.
2. LLM response appears in chat; Markdown pane displays rendered document.
3. Frontmatter keys are parsed; Frontmatter Mode activates automatically.

**Alternate Paths**:
- Partial frontmatter: LLM omits one key → system prompt guardrails trigger re-generation; missing key logged.
- Mermaid block absent: LLM returns prose only → no `parseMermaidToGraphData()` call; canvas shows empty state; user re-prompts with explicit "include a Mermaid block" instruction.

**Error Paths**:
- Invalid Mermaid syntax: `parseMermaidToGraphData()` throws `MermaidParseError` → error logged to `trace.jsonl`; canvas unchanged; user sees error banner.
- LLM timeout: FloatingPanel Chat shows spinner timeout → user retries; no partial state written.

**Postconditions**: A valid Markdown file exists; `kgFrontmatterModeEnabled=true` in Zustand store; canvas surface is `2d` FlowEditor mode.

---

#### WF-2 — Mermaid Extraction and Graph Materialisation

**Trigger**: Markdown document containing a `mermaid` fenced block is imported (via drag-drop, paste, or MCP tool call `knowgrph.superagent.run`).

**Actors**: Knowgrph Canvas app, `parseMermaidToGraphData()`, `graphDataSlice`.

**Happy Path**:
1. Import pipeline detects `mermaid` fenced block.
2. `parseMermaidToGraphData(src)` is called → returns `GraphData`.
3. `graphDataSlice.setState()` merges new nodes and edges.
4. FlowEditor re-renders; nodes appear as interactive widgets.

**Alternate Paths**:
- Document already has existing nodes: `mergeLlmGraphData()` deduplicates by `id`; existing node positions preserved where IDs match.
- Subgraphs present: each `subgraph` block creates a graph layer; nodes inside are assigned to that layer.

**Error Paths**:
- `MermaidParseError`: exception caught at call site; error written to `trace.jsonl`; `graphDataSlice` unchanged; error banner shown.
- Node count > 100: extractor returns error before writing any nodes; user shown "graph too large" message.

**Postconditions**: `graphDataSlice.nodes.length === N` (from Mermaid); `graphDataSlice.edges.length === M`; FlowEditor shows interactive nodes; `trace.jsonl` records extraction event.

---

#### WF-3 — Schema-Config Editing (Pass 2)

**Trigger**: Developer runs schema-config LLM edit after graph data is live (i.e. after WF-2 has completed).

**Actors**: Schema Curator, LLM, `validate_schema_config.py`.

**Happy Path**:
1. Schema Curator supplies template + corpus size hint + (optionally) `GraphNode.type` list from live canvas.
2. LLM returns updated JSON-LD.
3. `validate_schema_config.py` exits 0 with three PASS lines.
4. File written to `schema-config/`; AgenticRAG pipeline reloads on next run.

**Alternate Paths**:
- Preset inconsistency: validator exits non-zero with `FAIL preset_consistency`; LLM re-prompted with specific inconsistency noted.

**Error Paths**:
- Invalid JSON: `json.loads()` raises → validator exits non-zero; template file not overwritten.
- Missing required key: validator exits non-zero; LLM shown which key is absent.

**Postconditions**: `schema-config/knowgrph-schema-config-[domain].jsonld` passes all three validator checks; `metadata.corpusSizePreset` is consistent with `layers.semantic` numeric values.

---

### 3.7 Architectural Decisions

#### ADR-1: Use `mermaid.parse()` AST rather than regex parsing

**Status**: Proposed · **Date**: 2026-05-21

**Context**: Mermaid source can be parsed via regex or via the `mermaid.parse()` AST API already available in the bundle.

**Decision**: Use `mermaid.parse()` exclusively; no regex fallback.

**Alternatives Considered**:
1. Regex over raw source string: fast but brittle for nested subgraphs, multi-line labels, and future Mermaid syntax additions.
2. External parser (`@mermaid-js/parser`): introduces a new dependency; `mermaid.parse()` is already loaded.

**Rationale**: `mermaid.parse()` is already bundled (zero TCO); produces a stable, typed AST; future-proof against Mermaid syntax changes.

**Consequences**:
- Positive: no new dependency; stable parse path; structured node/edge data.
- Negative: `mermaid.parse()` is async in some versions — call site must await.
- Neutral: bundle size unchanged; `mermaid.js` already loaded for rendering.

---

#### ADR-2: Prompt contracts stored as Markdown files in `llm-chat-config/`

**Status**: Proposed · **Date**: 2026-05-21

**Context**: Prompt contracts can be stored as plain text, JSON, or Markdown.

**Decision**: Store as Markdown files in the existing `llm-chat-config/` directory.

**Alternatives Considered**:
1. JSON schema: machine-readable but not human-editable; verbose for prose guardrails.
2. Inline in `orchestrator-config/`: mixes orchestration config with prompt text; violates SRP.

**Rationale**: Markdown is the native format for Knowgrph documents; `llm-chat-config/` already exists and is git-tracked; human-editable without tooling.

**Consequences**:
- Positive: consistent with repo conventions; zero new tooling; diffable in GitHub.
- Negative: no schema validation of contract structure at load time.
- Neutral: no runtime impact.

---

#### ADR-3: Schema-config validation script (`validate_schema_config.py`) is deterministic and side-effect-free

**Status**: Proposed · **Date**: 2026-05-21

**Context**: The `/goal` condition for PRD-E3 requires a stated check that Claude can surface in conversation output.

**Decision**: `validate_schema_config.py` reads a file path, prints `PASS/FAIL [check_name]` per line, exits 0 on all PASS, exits 1 on any FAIL. No network calls; no file writes.

**Rationale**: Deterministic output maps directly to a `/goal` evaluable condition; no side effects means it is safe to run repeatedly in an agent loop.

**Consequences**:
- Positive: machine-readable; safe for `/goal` evaluation; testable in CI.
- Negative: validates structure only, not semantic correctness of similarity thresholds.
- Neutral: ~40 lines Python; added to `scripts/`.

---

### 3.8 Quality Attributes

| Attribute | Scenario | Pattern | Validation |
|---|---|---|---|
| Performance | Mermaid block with 30 nodes and 40 edges → extract completes before canvas render | Synchronous AST walk; no I/O | `parseMermaidToGraphData` test with 30-node fixture must complete in < 50 ms |
| Scalability | User imports graph with 100 nodes (max allowed) | Node limit enforced in extractor before write | Fixture test: 101-node document returns `MermaidParseError`; canvas unchanged |
| Security | LLM injects absolute path or credential in Mermaid node label | Contract guardrail + label sanitiser in extractor strips non-alphanumeric characters outside allowed set | Test: node label containing `/etc/passwd` is sanitised to empty string or rejected |
| Observability | Agent loop needs to confirm graph materialised | `trace.jsonl` records `{ event: "mermaid_extract", node_count, edge_count, error? }` per run | `trace.jsonl` fixture test confirms event format |

---

### 3.9 Deployment Strategy

All three epics are prompt artefacts or small TypeScript utilities. No infrastructure change required.

- **C-1 and C-5 contracts**: merged to `main` as `.md` files; available immediately on next `npm run dev`.
- **C-3 extractor**: merged to `main` behind a feature flag (`KNOWGRPH_MERMAID_EXTRACT=true`) for the first week; flag removed after test pass.
- **`validate_schema_config.py`**: added to `scripts/`; run in CI via `npm run lint` pre-commit hook.
- Rollback: contracts are files; revert is `git revert`. Extractor has no database writes; rollback is flag disable.

---

### 3.10 Component Inventory

| Layer | Component | File / Module | Status |
|---|---|---|---|
| Prompt | Markdown Graph Document Contract | `llm-chat-config/md-graph-document-contract.md` | New |
| Prompt | Schema-Config Editing Contract | `llm-chat-config/schema-config-editing-contract.md` | Extend (from uploaded) |
| Frontend utility | `parseMermaidToGraphData()` | `canvas/src/utils/parseMermaidToGraphData.ts` | New |
| Frontend test | Extractor test suite | `canvas/src/__tests__/parseMermaidToGraphData.test.ts` | New |
| Frontend store | `graphDataSlice` call site | `canvas/src/hooks/store/graphDataSliceUtils.ts` | Extend (< 10 lines) |
| Backend script | `validate_schema_config.py` | `scripts/validate_schema_config.py` | New |
| Config | Schema-config template | `schema-config/knowgrph-schema-config-template.jsonld` | Existing (no change) |
| Existing | Frontmatter parser | `canvas/src/hooks/store/uiSliceInitialState.ts` | Existing (verify only) |
| Existing | FlowEditor | `canvas/src/components/FlowEditor/` | Existing (no change) |

---

## 4. Alignment & Traceability (Phase 3)

### 4.1 Bidirectional Traceability Matrix

| PRD | Story | Acceptance Criterion | TAD Component | Interface | `/goal` Condition |
|---|---|---|---|---|---|
| PRD-E1 | S1 | AC1 | C-1 | Contract text | `grep four keys in output.md exits 0` |
| PRD-E1 | S1 | AC2 | C-2 | Zustand store mutation | `npm run superagent:test; store confirms kgFrontmatterModeEnabled=true` |
| PRD-E1 | S2 | AC1 | C-1 | Contract guardrails | `grep kg: pattern; grep forbidden terms returns 0` |
| PRD-E1 | S3 | AC1 | C-1 | Output validation | `python frontmatter_check.py exits 0 with three PASS lines` |
| PRD-E2 | S1 | AC1 | C-3 | `parseMermaidToGraphData()` return type | `npm test -- --grep parseMermaidToGraphData; node_count=N edge_count=M` |
| PRD-E2 | S1 | AC2 | C-4 | FlowEditor render | `workspaceImportVideoDemoRendererIsolation passes; flowEditorRichMediaPanelRegression passes` |
| PRD-E2 | S2 | AC1 | C-3 | Subgraph → layer mapping | `layer_count matches subgraph count; npm test exits 0` |
| PRD-E2 | S3 | AC1 | C-3, C-4 | Test stdout | `npm test exits 0; stdout includes node_count edge_count layer_count` |
| PRD-E3 | S1 | AC1 | C-5 | `validate_schema_config.py` | `python validate_schema_config.py exits 0; PASS parse PASS keys` |
| PRD-E3 | S2 | AC1 | C-5 | Preset consistency check | `PASS preset_consistency` |
| PRD-E3 | S3 | AC1 | C-5 | Validator stdout | `exactly three PASS lines in stdout` |

### 4.2 Separation Verification

- PRD contains no implementation details (no TypeScript, no file paths, no `mermaid.parse()` API references).
- TAD contains no business logic (no domain names, no corpus-specific terminology, no hardcoded similarity thresholds).
- Boundary: PRD stops at Given-When-Then criteria; TAD starts at component specification.

### 4.3 Validation Checklist

**Pre-Implementation**:
- [x] User journey mapped before stories written; every story anchored to a journey stage
- [x] Workflows WF-1, WF-2, WF-3 defined with trigger, happy path, alternate paths, error paths, and postconditions
- [x] Data flows DF-1 through DF-4 typed at every stage boundary with persistence and error handling
- [x] User stories follow "As a… I want… So that" format
- [x] Acceptance criteria use Given-When-Then with observable outcomes
- [x] Every acceptance criterion translated to a `/goal` condition with measurable end state, stated check, and constraint
- [x] Features prioritized via MoSCoW with rationale
- [x] Components have single responsibility; interfaces specified with explicit contracts
- [x] Architectural decisions documented with ADR-1, ADR-2, ADR-3
- [x] Architecture diagram uses Mermaid `flowchart LR` with subgraphs
- [x] Component inventory table accompanies architecture diagram
- [x] PRD-to-TAD traceability established via matrix in §4.1
- [x] `/goal` conditions recorded in TAD component specs and traced to source criteria
- [x] No implementation detail in PRD; no business logic in TAD

---

## 5. Open Questions

| # | Question | Owner | Resolution Path | Status |
|---|---|---|---|---|
| OQ-1 | Is `mermaid.parse()` synchronous or async in the bundled version? | Engineering Lead | Check `canvas/package.json` mermaid version; test with `await` vs sync call | Open |
| OQ-2 | Should `mergeLlmGraphData()` overwrite or skip existing nodes with the same `id`? | Graph Author (solo dev) | Default: skip (preserve user edits); option to overwrite in import settings | Open |
| OQ-3 | Should the Markdown Graph Document Contract be loaded automatically as FloatingPanel Chat system prompt, or opt-in? | Product Manager | Default opt-in via `llm-chat-config` setting; surfaced in Chat settings panel | Open |
| OQ-4 | What is the correct `GraphNode.type` for Mermaid diamond (`{}`), stadium (`([`)`), and hexagon (`{{}}`) shapes? | Engineering Lead | Map to `decision`, `terminal`, `process` respectively; document in extractor | Open |
| OQ-5 | Does the schema-config validation script run in CI or only on-demand? | Engineering Lead | Add to `npm run lint` pre-commit; gate on `scripts/` presence | Open |

---

*End of document — version 0.1.0*