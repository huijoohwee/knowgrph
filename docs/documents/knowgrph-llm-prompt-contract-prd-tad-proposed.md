---
title: Knowgrph LLM Prompt Contract + Research Agent — PRD & TAD (Proposed)
id: knowgrph-llm-prompt-contract-prd-tad-proposed
schema: kgc-computing-flow/v1
doc_type: prd-tad
version: 0.2.0
status: Proposed
created: 2026-05-21
updated: 2026-05-22
author: "@airvio"
repo_dev: /Users/huijoohwee/Documents/GitHub/knowgrph
repo_prod: /Users/huijoohwee/Documents/GitHub/huijoohwee/content/knowgrph
deploy_url: airvio.co/knowgrph
stack_ref: kgc-computing-flow/v1
kgDocumentSemanticMode: document
kgFrontmatterModeEnabled: true
kgCanvasSurfaceMode: 2d
kgCanvas2dRenderer: flowEditor
related_docs:
  - prd-tad-guidelines.md
  - knowgrph-research-agent-prd-tad-proposed.md
  - markdown-syntax-guidelines.md
epics:
  - PRD-E1: Markdown Graph Document Contract
  - PRD-E2: Mermaid AST → GraphData Extractor
  - PRD-E3: Schema-Config LLM Editing Contract
  - PRD-E4: E2E Pipeline Integration (MainPanel → FloatingPanel → LLM → MD → Canvas)
  - EPIC-01: KGC Seeder
  - EPIC-02: KGC Reasoner
  - EPIC-03: KGC Skill Loop
  - EPIC-04: KGC Simulator
constraints:
  tco: zero platform cost; token cost only
  foss: all dependencies MIT/Apache-2.0/self-hosted
  solo_dev: single engineer; max 14 days total build
  no_external_agent_framework: all capabilities native in-repo Python/TypeScript
changelog:
  - version: 0.1.0
    date: 2026-05-21
    summary: Initial PRD/TAD for Markdown contract, Mermaid extractor, schema-config contract
  - version: 0.2.0
    date: 2026-05-22
    summary: Integrated KGC Research Agent (EPIC-01–04); added PRD-E4 E2E Pipeline Integration; added C-6 KGCtoMarkdownBridge and C-7 FloatingPanelChatOrchestrator; unified architecture diagram; updated all data flows, traceability matrix, and component inventory
---

# Knowgrph — LLM Prompt Contract + Research Agent PRD & TAD (Proposed)

> **Document ID**: `knowgrph-llm-prompt-contract-prd-tad-proposed` · **Version**: `0.2.0` · **Status**: Proposed  
> **Scope**: Seamless E2E pipeline — MainPanel Integrations → FloatingPanel Chat UI → LLM output → Markdown YAML Frontmatter → Canvas nodes / subgraphs / groups / clusters / edges  
> **Pipeline**: Dev (`repo_dev`) → Prod (`repo_prod`) → Cloudflare (`airvio.co/knowgrph`)

---

## Table of Contents

1. [Problem Discovery (Phase 0)](#1-problem-discovery-phase-0)
2. [PRD — Markdown Contract Epics (PRD-E1 to PRD-E4)](#2-prd--markdown-contract-epics)
3. [PRD — Research Agent Epics (EPIC-01 to EPIC-04)](#3-prd--research-agent-epics)
4. [TAD — Technical Architecture (Phase 2)](#4-tad--technical-architecture)
5. [Alignment & Traceability (Phase 3)](#5-alignment--traceability)
6. [Open Questions](#6-open-questions)
7. [Build Sequence and TCO](#7-build-sequence-and-tco)

---

## 1. Problem Discovery (Phase 0)

### 1.1 Unified Problem Hypothesis

> A solo developer building knowledge graphs with Knowgrph faces two compounding gaps. First, the canvas has no standard LLM output contract — every LLM run produces unstructured text that the canvas cannot consume directly, requiring manual reformatting before any nodes appear. Second, even with a structured output contract in place, the pipeline from external knowledge (web sources, documents) through to interactive canvas nodes is disconnected: KGC Research Agent outputs (`@node/@edge/@cluster` JSONB) have no bridge to the Mermaid + YAML frontmatter format the canvas ingests. If a unified E2E pipeline connects FloatingPanel Chat UI → LLM output → Markdown YAML frontmatter → canvas nodes/subgraphs/clusters/edges — with the Research Agent (Seeder, Reasoner, Skill Loop, Simulator) feeding into that same pipeline — then graph population time will drop by ≥60%, canvas session depth will increase by ≥2×, and every LLM-generated artefact will become a live, interactive graph element without manual intervention.

### 1.2 Personas

| ID | Persona | Role | Job-to-be-done | Primary Pain |
|----|---------|------|----------------|--------------|
| P1 | Solo Founder | airvio operator; primary builder and user | Populate and maintain knowledge graphs for product intelligence without a research team | Manual web → node translation hours per graph; LLM output not directly consumable by canvas |
| P2 | Knowledge Worker | External Knowgrph user (future) | Build and explore knowledge graphs for domain research | Cold-start friction; no AI-assisted enrichment; no format standard for LLM output |
| P3 | AI Analyst | Uses KGC for scenario planning | Model how domain changes propagate through a knowledge graph | No simulation layer; static graph; no E2E path from LLM to canvas |

### 1.3 Pipeline Friction Map (Current State)

| Stage | Current State | Friction | Opportunity |
|---|---|---|---|
| Prompt | Developer types in FloatingPanel Chat with no format contract | LLM returns prose or bare Mermaid; canvas ignores it | C-1 Markdown Graph Document Contract |
| Seed | Developer runs `kgc_seed.py`; JSONB output in `data/seeds/` | JSONB is not Markdown; canvas cannot ingest directly | C-6 KGCtoMarkdownBridge |
| Frontmatter | No `kgFrontmatterModeEnabled` in output | Frontmatter Mode never activates | Contract enforces four required keys |
| Mermaid lift | Mermaid block renders as SVG image | `graphDataSlice` receives no GraphNode/GraphEdge objects | C-3 `parseMermaidToGraphData()` |
| Clusters | `@cluster` in JSONB has no canvas equivalent at import | No subgraph/group/cluster layer rendered | `@cluster` → Mermaid `subgraph` → graph layer mapping |
| Reasoner | Sidebar suggestions are ghost overlays only | Accept path writes to D1 but does not update `graphDataSlice` for FlowEditor | C-2 + C-4 accept-path integration |
| Schema | `schema-config-template.jsonld` hand-edited per corpus | No LLM guardrails; high breakage rate | C-5 Schema-Config Editing Contract |

### 1.4 Scope

**In scope**: Markdown Graph Document Contract (C-1); Mermaid AST extractor (C-3); Schema-Config Contract (C-5); KGCtoMarkdownBridge (C-6); FloatingPanelChatOrchestrator (C-7); KGC Seeder / Reasoner / Skill Loop / Simulator (TAD-C01 to TAD-C04); KGCGraphStore (TAD-C05); full E2E pipeline traceability.

**Out of scope**: External agent frameworks (DeerFlow, LangGraph, CrewAI); paid search APIs; GPU inference; multi-tenant auth; live streaming of seed progress to canvas (Phase 2+); export from GraphData back to Mermaid syntax; BYOK changes.

### 1.5 Problem Metrics (Baseline → Target)

| Metric | Baseline | Target | Epic |
|---|---|---|---|
| LLM output passes canvas ingest on first attempt | 0 % | ≥ 90 % | PRD-E1 |
| Mermaid nodes appear as interactive canvas elements after import | 0 % | 100 % | PRD-E2 |
| JSONB seed output reachable in canvas without manual reformat | 0 % | 100 % | PRD-E4 / C-6 |
| Time to 30-node domain graph | 4–6 hours | ≤ 45 minutes | EPIC-01 |
| Nodes added per 30-minute canvas session | 5–8 | ≥ 15 | EPIC-02 |
| Re-research rate across sessions (same domain) | ~70 % | ≤ 20 % | EPIC-03 |
| Time to scenario diff on 50-node graph | N/A | ≤ 3 minutes | EPIC-04 |

### 1.6 Gate: Problem Validated

Pipeline audit (2026-05-21), `todo.md` entries (2026-01-20, 2026-01-22), and Research Agent PRD (2026-05-22) confirm all friction points are open P0 items. Scope accepted. Proceed to PRD authoring.

---

## 2. PRD — Markdown Contract Epics

### Epic Structure

```
PRD-E1  LLM Markdown Graph Document Contract
PRD-E2  Mermaid AST → GraphData Extractor
PRD-E3  Schema-Config LLM Editing Contract (pass 2)
PRD-E4  E2E Pipeline Integration (MainPanel → FloatingPanel → LLM → MD → Canvas)
```

---

### Epic PRD-E1 — LLM Markdown Graph Document Contract

#### Problem Statement

There is no standard format that constrains LLM output to a document the Knowgrph canvas ingests without modification. Every FloatingPanel Chat session produces prose or bare Mermaid blocks that the canvas ignores, requiring the solo founder to manually add frontmatter keys and reformat content before the graph activates. The opportunity is a prompt contract that makes the required output format explicit, so the canvas activates Frontmatter Mode automatically on every LLM run.

#### Personas

**P1 (Graph Author)**: Uses FloatingPanel Chat to explore a domain; wants the graph to appear on canvas immediately without reformatting.  
**P2 (Agentic Workflow)**: Needs a verifiable `/goal` condition proving graph nodes exist on canvas after each agent turn.

#### User Journey — P1: Generate a Domain Graph via FloatingPanel Chat

| Stage | Action | Touchpoint | Pain Point | Opportunity |
|---|---|---|---|---|
| Trigger | Opens Knowgrph; types domain prompt in FloatingPanel Chat | FloatingPanel Chat UI | No format guidance; canvas stays empty | C-7 orchestrator pre-loads C-1 contract as system prompt |
| Discover | LLM returns Markdown with frontmatter + Mermaid | Markdown pane | Missing keys; canvas does not respond | Contract enforces all four required keys |
| Engage | Document auto-imported into Editor Workspace | Editor Workspace | Manual import step | Auto-import on frontmatter detection (C-2) |
| Complete | Canvas renders interactive nodes and edges | FlowEditor | Mermaid rendered as static SVG only | C-3 AST extractor lifts nodes/edges to canvas |
| Return | Refines graph via Chat; re-imports | FloatingPanel Chat → Canvas | Round-trip drops node positions | Export/import fidelity (future epic) |

#### User Stories

**PRD-E1-S1**: As a graph author, I want the LLM to return a Markdown document with correct Knowgrph frontmatter keys so that the canvas activates Frontmatter Mode without manual configuration.

**PRD-E1-S2**: As a graph author, I want the LLM Mermaid block to use `kg:`-prefixed node IDs and generic labels so that the graph is domain-agnostic and reusable across corpora.

**PRD-E1-S3**: As an agentic workflow, I want a verifiable completion condition that confirms the document contains required frontmatter keys and a valid Mermaid block so that the agent loop self-verifies output without human review.

#### Acceptance Criteria

**PRD-E1-S1-AC1**  
Given a system prompt containing the Markdown Graph Document Contract,  
when the LLM generates output,  
then the output MUST begin with a YAML frontmatter block containing all four required keys: `kgFrontmatterModeEnabled: true`, `kgDocumentSemanticMode: document`, `kgCanvasSurfaceMode: 2d`, `kgCanvas2dRenderer: flowEditor`.

> **`/goal` translation**: `grep kgFrontmatterModeEnabled output.md exits 0; grep kgDocumentSemanticMode exits 0; grep kgCanvasSurfaceMode exits 0; grep kgCanvas2dRenderer exits 0; no other file modified`

**PRD-E1-S1-AC2**  
Given the frontmatter block is present,  
when the document is imported into Knowgrph,  
then `kgFrontmatterModeEnabled` resolves to `true` in the Zustand store and the canvas surface switches to `2d` FlowEditor mode.

> **`/goal` translation**: `npm run superagent:test exits 0; test log confirms kgFrontmatterModeEnabled=true and canvasRenderMode=2d in store state after import`

**PRD-E1-S2-AC1**  
Given the contract is active,  
when the LLM generates a Mermaid block,  
then every node ID MUST match `kg:[a-z0-9_]+` and every label MUST be domain-agnostic with no proper nouns or hardcoded business terms.

> **`/goal` translation**: `grep -E "kg:[a-z0-9_]+" output.md returns ≥1 match per node line; grep for forbidden terms returns 0`

**PRD-E1-S3-AC1**  
Given an agentic workflow has run the contract,  
when the output file is evaluated,  
then the file is a single valid Markdown document, the frontmatter parses without error, and the Mermaid block contains ≥2 nodes and ≥1 edge.

> **`/goal` translation**: `python frontmatter_check.py output.md exits 0 with PASS parse, PASS keys, PASS mermaid_present (node_count ≥2, edge_count ≥1)`

#### MoSCoW Priority

**Must**: four required frontmatter keys; `kg:`-prefixed node IDs; single-document output; no secrets or paths.  
**Should**: `subgraph` blocks for cluster representation; optional `title`, `id`, `date` frontmatter fields; `@cluster` annotation in Mermaid comments.  
**Could**: inline node `properties` hints in Mermaid comments; multi-language label support.  
**Won't** (v0.1): streaming partial output; multi-document graph assembly.

#### Success Metrics

| Metric | Baseline | Target | Timeline |
|---|---|---|---|
| LLM output passes frontmatter validation first attempt | 0 % | ≥ 90 % | Week 1 post-deploy |
| Canvas activates Frontmatter Mode on import without manual step | 0 % | 100 % | Week 1 post-deploy |
| Agent loop confirms validity without human review | 0 % | 100 % | Week 1 post-deploy |

#### Dependencies

No code changes to Knowgrph. Frontmatter keys and Mermaid rendering already exist. Contract is a prompt artefact stored at `llm-chat-config/md-graph-document-contract.md`.

---

### Epic PRD-E2 — Mermaid AST → GraphData Extractor

#### Problem Statement

Mermaid blocks in Knowgrph documents render as static SVG images. The `graphDataSlice` Zustand store receives no `GraphNode` or `GraphEdge` objects. Nodes are not clickable, draggable, or editable. `subgraph` blocks are invisible to the canvas. This blocks the entire E2E pipeline: even when the LLM correctly produces a Mermaid block, the canvas cannot make it interactive.

#### Personas

**P1 (Graph Author)**: Wants to click, drag, and inspect LLM-generated nodes immediately after import.  
**P2 (Agentic Workflow)**: Needs a `/goal` condition verifying interactive nodes are in `graphDataSlice`, not merely that a diagram was rendered.

#### User Journey — P1: Make LLM-Generated Nodes Interactive

| Stage | Action | Touchpoint | Pain Point | Opportunity |
|---|---|---|---|---|
| Trigger | Markdown document with Mermaid block is imported | Editor Workspace | Nodes visible as image only; not selectable | Extractor fires on Mermaid fence detection |
| Discover | Developer clicks a node in the diagram | Markdown Viewer | Click does nothing; SVG path, not graph element | FlowEditor shows live node with port handles |
| Engage | Developer drags, renames, or connects a node | FlowEditor Canvas | Cannot interact; must re-create manually | Full GraphNode CRUD available |
| Complete | Subgraph clusters are visible as canvas layers | FlowEditor Canvas | Subgraphs invisible; flat list only | `subgraph` → graph layer / cluster mapping |
| Return | Developer exports and re-prompts | Markdown pane | Round-trip drops positions and types | Export fidelity epic (future) |

#### User Stories

**PRD-E2-S1**: As a graph author, I want Mermaid nodes and edges to appear as interactive `GraphNode` and `GraphEdge` objects in the FlowEditor so that I can click, drag, and edit them without re-importing from a separate source.

**PRD-E2-S2**: As a graph author, I want Mermaid `subgraph` blocks mapped to Knowgrph graph layers (clusters) so that logical groupings are preserved on the canvas.

**PRD-E2-S3**: As an agentic workflow, I want a `/goal` condition that verifies `graphDataSlice` contains the expected node, edge, and cluster count after import so that the agent can confirm graph materialisation without visual inspection.

#### Acceptance Criteria

**PRD-E2-S1-AC1**  
Given a Markdown document containing a `mermaid` fenced block with N nodes and M edges,  
when the document is imported,  
then `graphDataSlice.nodes` contains exactly N `GraphNode` objects and `graphDataSlice.edges` contains exactly M `GraphEdge` objects, each with `id`, `label`, and `type` populated.

> **`/goal` translation**: `npm test -- --grep parseMermaidToGraphData exits 0; stdout confirms graphDataSlice.nodes.length === N and edges.length === M`

**PRD-E2-S1-AC2**  
Given the extractor has run,  
when the FlowEditor canvas is rendered,  
then each `GraphNode` is a draggable, selectable widget with label visible and typed port handles for each connected edge.

> **`/goal` translation**: `flowEditorRichMediaPanelOpenWidgetExclusionRegression passes; workspaceImportVideoDemoRendererIsolation passes; npm run superagent:test exits 0`

**PRD-E2-S2-AC1**  
Given a Mermaid block with ≥1 `subgraph` … `end` declarations,  
when the extractor runs,  
then each `subgraph` is a graph layer (cluster) in `graphDataSlice` containing the declared member nodes, with cluster label matching the subgraph name.

> **`/goal` translation**: `graphDataSlice.layers.length === subgraphCount; each layer.nodeIds array contains correct node IDs; npm test exits 0`

**PRD-E2-S3-AC1**  
Given any Mermaid document imported by an agent,  
when the `/goal` condition is evaluated,  
then the agent states node\_count, edge\_count, and cluster\_count as integers surfaced from test output.

> **`/goal` translation**: `npm test -- --grep parseMermaidToGraphData exits 0; stdout includes node_count=N edge_count=M cluster_count=K`

#### MoSCoW Priority

**Must**: `GraphNode` / `GraphEdge` creation from `graph LR` / `flowchart TD`; `id`, `label`, `type` populated; zero regression to existing tests.  
**Should**: `subgraph` → cluster layer mapping; edge label extraction; node `type` inferred from Mermaid shape (`[`, `(`, `{`).  
**Could**: node position hints from Mermaid layout direction; edge `properties` from comment annotations.  
**Won't** (v0.1): `sequenceDiagram` / `erDiagram` → GraphData; real-time streaming parse.

#### Success Metrics

| Metric | Baseline | Target | Timeline |
|---|---|---|---|
| Mermaid nodes in `graphDataSlice` after import | 0 % | 100 % of valid Mermaid documents | Week 2 post-build |
| Subgraph blocks mapped to graph layers | 0 % | 100 % of docs with subgraph | Week 2 post-build |
| Zero regressions to existing test suite | N/A | 0 failing tests | Week 2 post-build |
| Implementation size | N/A | ≤ 200 lines TypeScript | Week 2 post-build |

#### Dependencies

`mermaid.js` (already in `canvas/package.json`); `grph-shared` types (workspace dep). No new packages.

---

### Epic PRD-E3 — Schema-Config LLM Editing Contract (Pass 2)

#### Problem Statement

The existing `knowgrph-llm-prompt-contract.md` (v0.1) constrains an LLM to safely edit `schema-config-template.jsonld`, preserving the AgenticRAG semantic layer. However it has no `/goal` conditions, no traceability to the E2E pipeline, and no `@graph` vocabulary seeding from live canvas node types. As pass 2 of the two-pass workflow, its value is contingent on graph data being live (PRD-E2) so that node type vocabulary in `@graph` reflects what the extractor actually produced.

#### User Stories

**PRD-E3-S1**: As a schema curator, I want the LLM to return a single valid JSON-LD schema-config document that preserves all required structural keys so that I can drop it into the AgenticRAG pipeline without validation errors.

**PRD-E3-S2**: As a schema curator, I want the LLM to choose `corpusSizePreset` values consistent with my corpus size so that `topKEdgesPerNode` and `minSimilarity` thresholds are calibrated automatically.

**PRD-E3-S3**: As an agentic workflow, I want a `/goal` condition that verifies the output JSON-LD parses cleanly and retains all required top-level keys.

#### Acceptance Criteria

**PRD-E3-S1-AC1**  
Given the Schema-Config Editing Contract is active and a template is provided,  
when the LLM returns output,  
then the output is a single valid JSON object with `@context`, `@graph`, and `metadata` at the top level; `metadata.layers`, `metadata.corpusSizePresets` (`small`, `medium`, `large`), and `metadata.agenticRagSchema` present and structurally intact.

> **`/goal` translation**: `python scripts/validate_schema_config.py output.jsonld exits 0 with PASS parse, PASS keys`

**PRD-E3-S2-AC1**  
Given the LLM selects `corpusSizePreset`,  
when `metadata.layers.semantic.topKEdgesPerNode` and `minSimilarity` are checked,  
then they match the values declared for the selected preset in `metadata.corpusSizePresets`.

> **`/goal` translation**: `python scripts/validate_schema_config.py output.jsonld exits 0 with PASS preset_consistency`

**PRD-E3-S3-AC1**  
Given any schema-config output from an agent,  
when evaluated, the agent surfaces: JSON parse (pass/fail), key presence (pass/fail), preset consistency (pass/fail) as three distinct stdout lines.

> **`/goal` translation**: `python scripts/validate_schema_config.py output.jsonld exits 0; exactly three PASS lines in stdout`

#### MoSCoW Priority

**Must**: structural preservation; `corpusSizePresets` intact; valid JSON; no secrets or paths.  
**Should**: preset-consistent numeric values; `@graph` vocabulary seeded from `GraphNode.type` values produced by PRD-E2.  
**Could**: `communityDetection.algorithm` recommendation based on graph density.  
**Won't** (v0.1): multi-schema merging; schema versioning logic.

#### Dependencies

PRD-E3 depends on PRD-E2 (live graph nodes provide `GraphNode.type` vocabulary for `@graph`). Deployable independently but lower value without live graph data.

---

### Epic PRD-E4 — E2E Pipeline Integration

#### Problem Statement

The four preceding epics (PRD-E1 to PRD-E3, EPIC-01 to EPIC-04) address individual pipeline stages but do not define the seamless E2E data path from **MainPanel Integrations → FloatingPanel Chat UI → LLM output → Markdown YAML Frontmatter → Canvas nodes / subgraphs / groups / clusters / edges**. Specifically: KGC Research Agent JSONB output (`@node`, `@edge`, `@cluster`) has no defined bridge to the Mermaid + frontmatter format the canvas ingests; the FloatingPanel Chat UI has no orchestration layer selecting which contract to invoke based on user intent; and the `@cluster` primitive from JSONB has no end-to-end mapping to a canvas subgraph/cluster layer. This epic defines and builds those three missing connective tissues.

#### Personas

**P1 (Solo Founder)**: Opens Knowgrph, types a research intent into FloatingPanel Chat, and expects the canvas to show a live, interactive, clustered knowledge graph — with no format translation required.

#### User Journey — P1: Full E2E Graph Materialisation

| Stage | Action | Touchpoint | Pain Point | Opportunity |
|---|---|---|---|---|
| Trigger | Opens Knowgrph; sees empty canvas | MainPanel Integrations surface | Blank canvas; no path to first node | MainPanel shows "Research a domain" affordance |
| Discover | Types "map the SEA AI regulation landscape" into FloatingPanel Chat | FloatingPanel Chat UI | No contract guidance; unclear what format LLM should use | C-7 orchestrator detects intent and selects C-1 contract |
| Research | C-7 routes to KGC Seeder if deep research intent detected | Seeder CLI (via C-7) | JSONB output not consumable by canvas | C-6 bridge converts JSONB → MD frontmatter + Mermaid |
| Ingest | Bridge output auto-imported as Markdown document | Markdown pane | Manual import step | C-7 triggers import on bridge output |
| Parse | Frontmatter keys activate Frontmatter Mode | C-2 Frontmatter parser | Mode not activating | Keys guaranteed by C-1 contract + C-6 bridge |
| Lift | Mermaid AST extracted to GraphNode/GraphEdge/Cluster | C-3 `parseMermaidToGraphData()` | Mermaid rendered as static SVG | Extractor fires on every Mermaid fence detection |
| Cluster | `@cluster` JSONB → Mermaid `subgraph` → canvas graph layer | C-6 cluster mapping | No cluster rendering on canvas | `@cluster` → `subgraph` → `graphDataSlice.layers` |
| Display | FlowEditor renders interactive nodes, edges, cluster layers | FlowEditor / D3 | Empty canvas | Full `GraphNode` / `GraphEdge` / layer set live |
| Enrich | Developer selects node; opens Reasoner sidebar | EPIC-02 KGCReasoner | Context switch to browser | Ghost overlay suggestions, one-click accept |
| Persist | Accepted suggestions written to D1 + `graphDataSlice` | TAD-C05 + C-4 | Accepted nodes in D1 but not in FlowEditor | Accept path updates both D1 and `graphDataSlice` |
| Return | Skill Loop captures session; next run faster | EPIC-03 Skill Loop | Re-research same domain | Skill injection into Seeder planning |

#### User Stories

**PRD-E4-S1**: As a solo founder, I want FloatingPanel Chat to detect whether I am requesting a quick graph generation (→ C-1 contract) or a deep domain research run (→ EPIC-01 Seeder), so that the correct pipeline activates without me selecting a mode manually.

**PRD-E4-S2**: As a solo founder, I want KGC Seeder JSONB output (`@node`, `@edge`, `@cluster`) to be automatically converted into a Knowgrph-compatible Markdown document with YAML frontmatter and a Mermaid block, so that seed results appear on the canvas as interactive nodes and cluster layers without manual reformatting.

**PRD-E4-S3**: As a solo founder, I want `@cluster` entries in JSONB to become `subgraph` blocks in the Mermaid output and graph layers on the canvas, so that domain clusters are visually and structurally represented.

**PRD-E4-S4**: As a solo founder, I want Reasoner-accepted ghost primitives to update both the PocketBase/D1 store and the canvas `graphDataSlice` simultaneously, so that the FlowEditor reflects accepted nodes immediately without requiring a reimport.

**PRD-E4-S5**: As an agentic workflow, I want a single `/goal` condition that verifies the full E2E path — from LLM output to interactive canvas nodes — so that the agent can confirm pipeline success without visual inspection at any intermediate stage.

#### Acceptance Criteria

**PRD-E4-S1-AC1**  
Given a user message in FloatingPanel Chat,  
when C-7 FloatingPanelChatOrchestrator processes the message,  
then if the message contains research intent keywords (configurable list) the Seeder is invoked; otherwise the C-1 Markdown contract is applied to the LLM call; and the chosen routing path is logged to `data/sessions/{session_id}_trace.json`.

> **`/goal` translation**: `grep route_decision data/sessions/{session_id}_trace.json returns seeder or markdown_contract; npm run superagent:test exits 0`

**PRD-E4-S2-AC1**  
Given a completed `data/seeds/{domain}.jsonb` output from KGCSeedPipeline,  
when C-6 KGCtoMarkdownBridge runs,  
then it produces `data/seeds/{domain}.md` containing (a) a YAML frontmatter block with all four `kgFrontmatterModeEnabled` / `kgDocumentSemanticMode` / `kgCanvasSurfaceMode` / `kgCanvas2dRenderer` keys, (b) a `mermaid` fenced block where every `@node` maps to a Mermaid node with `kg:`-prefixed ID, and (c) one `subgraph` block per `@cluster` entry.

> **`/goal` translation**: `python scripts/validate_md_bridge_output.py data/seeds/{domain}.md exits 0 with PASS frontmatter, PASS node_mapping, PASS cluster_mapping`

**PRD-E4-S3-AC1**  
Given `data/seeds/{domain}.md` produced by C-6,  
when imported into Knowgrph and processed by C-3,  
then `graphDataSlice.layers` contains one cluster layer per `@cluster` in the source JSONB, each with the correct `nodeIds` array.

> **`/goal` translation**: `graphDataSlice.layers.length === @cluster_count_in_jsonb; each layer.nodeIds equals the member nodes declared in that cluster; npm test exits 0`

**PRD-E4-S4-AC1**  
Given an accepted Reasoner ghost overlay primitive,  
when the accept action is processed by the Reasoner Worker,  
then the record is written to D1 (verified by record count +1) AND `graphDataSlice` is updated in the canvas Zustand store (verified by node count +1 in store), within 2 seconds.

> **`/goal` translation**: `python scripts/validate_kgc_schema.py --single-record {node_id} exits 0; npm test -- --grep "reasoner accept graphDataSlice" exits 0; both checks complete within 2 seconds`

**PRD-E4-S5-AC1**  
Given a full E2E run (FloatingPanel Chat → [Seeder OR Markdown contract] → C-6 bridge → C-2 frontmatter parse → C-3 Mermaid extract → graphDataSlice),  
when the pipeline completes,  
then `graphDataSlice.nodes.length >= 10`, `graphDataSlice.edges.length >= 5`, `graphDataSlice.layers.length >= 1`, and no intermediate error is recorded in the session trace.

> **`/goal` translation**: `npm run superagent:e2e-test exits 0; stdout confirms nodes≥10 edges≥5 layers≥1; grep "pipeline_error" data/sessions/{session_id}_trace.json returns 0 matches`

#### MoSCoW Priority

**Must**: C-6 KGCtoMarkdownBridge (`@node/@edge/@cluster` → MD frontmatter + Mermaid); C-7 routing (Seeder vs Markdown contract); `@cluster` → `subgraph` → graph layer full path; Reasoner accept path updates `graphDataSlice`.  
**Should**: C-7 intent detection via keyword list (configurable, no ML); bridge output validation script (`validate_md_bridge_output.py`); E2E superagent test (`superagent:e2e-test`).  
**Could**: C-7 natural language intent classification via LLM call; canvas "Research this domain" affordance in MainPanel.  
**Won't** (v0.1): streaming bridge output to canvas during seed run; multi-domain graph merge.

#### Success Metrics

| Metric | Baseline | Target | Timeline |
|---|---|---|---|
| E2E pipeline success rate (Chat → canvas nodes) | 0 % | ≥ 85 % first run | Week 2 post-build |
| JSONB `@cluster` entries rendered as canvas layers | 0 % | 100 % | Week 2 post-build |
| Reasoner accept path updates FlowEditor without reimport | 0 % | 100 % | Week 3 post-build |
| E2E pipeline latency (Chat input → first canvas node visible) | N/A | ≤ 90 seconds (Seeder path) / ≤ 5 seconds (Markdown contract path) | Week 3 post-build |

#### Dependencies

PRD-E4 depends on: PRD-E1 (contract text), PRD-E2 (extractor), EPIC-01 (Seeder CLI), TAD-C02 (Reasoner Worker), TAD-C05 (GraphStore). C-6 is the integration linchpin — without it the Research Agent and the canvas pipeline remain disconnected.

---

## 3. PRD — Research Agent Epics

> **Note**: EPIC-01 through EPIC-04 are reproduced here from `knowgrph-research-agent-prd-tad-proposed.md` (v0.1.0) for single-document traceability. All acceptance criteria, MoSCoW priorities, and success metrics are unchanged. Integration with the Markdown pipeline is captured in PRD-E4 above and the TAD section below.

---

### EPIC-01 — KGC Seeder: Graph Enrichment Pipeline

**Problem Statement**: Solo founders cannot efficiently translate external domain knowledge into `kgc-computing-flow/v1` graph schema. The gap from "I want to map this domain" to "the graph has 30 well-linked nodes" costs 4–6 hours of manual research per domain. The Seeder closes this with a plan-fetch-extract-validate pipeline that emits `@node/@edge/@cluster` JSONB directly into `data/seeds/` — and, via C-6 KGCtoMarkdownBridge (PRD-E4), into the canvas.

**User Stories**: EPIC-01-S01 through EPIC-01-S04 (see research agent doc; unchanged).

**Key Acceptance Criteria**:
- S01-AC01: `data/seeds/{domain}.jsonb` contains ≥10 `@node`, ≥5 `@edge`, ≥1 `@cluster`; `validate_kgc_schema.py` exits 0.
- S04-AC01: `data/seeds/{domain}_meta.md` generated with YAML frontmatter; `grep -c "^---"` returns 2.

**E2E Integration note**: C-6 KGCtoMarkdownBridge consumes `data/seeds/{domain}.jsonb` after EPIC-01-S01-AC01 passes and produces `data/seeds/{domain}.md` for canvas ingest (PRD-E4-S2-AC1).

**MoSCoW**: Must — planning step, schema validation, K=5 context window, flat-file JSONB output. Should — parallel source fetching, SearXNG. Could — canvas UI trigger. Won't — fine-tuned extraction model.

---

### EPIC-02 — KGC Reasoner: Canvas Deep Research

**Problem Statement**: No in-canvas mechanism exists to expand a node with deep research. The user must context-switch to a browser, manually research, and translate findings back into the graph schema. The Reasoner sidebar closes this with a structured multi-step Claude tool-use loop, ghost overlay suggestions, and one-click accept/reject.

**User Stories**: EPIC-02-S01 through EPIC-02-S04 (see research agent doc; unchanged).

**Key Acceptance Criteria**:
- S01-AC01: Sidebar loads `@node` context within 500ms of activation.
- S03-AC01: Accepted primitive written to D1 within 2 seconds (extended in PRD-E4-S4-AC1 to also update `graphDataSlice`).
- S04-AC01: `[tool_call]` and `[result]` markers present in sidebar streaming log.

**E2E Integration note**: PRD-E4-S4-AC1 extends the accept path: `KGCReasoner Worker` must also call `graphDataSlice.addNode()` / `addEdge()` after D1 write succeeds, so the FlowEditor reflects the accepted node without reimport.

**MoSCoW**: Must — node context auto-load, streaming chain-of-thought, ghost overlay accept/reject, kgc-computing-flow/v1 formatting. Should — mid-loop variable injection, parallel sub-agents.

---

### EPIC-03 — KGC Skill Loop: Self-Improving Session Memory

**Problem Statement**: Every Seeder and Reasoner run generates implicit knowledge about which sources, queries, and extraction patterns work for a domain. This knowledge is lost at session end. The Skill Loop captures trajectories post-run, distils them into skill documents, and injects them into future planning steps — compounding quality over successive runs.

**User Stories**: EPIC-03-S01 through EPIC-03-S04 (see research agent doc; unchanged).

**Key Acceptance Criteria**:
- S01-AC01: `data/skills/{domain}.md` created/appended within 60 seconds of run completion; `grep -c "run_id"` returns ≥1.
- S04-AC01: `git diff` shows 0 deletions to existing skill lines (zero-deletion principle).

**MoSCoW**: Must — post-run hook, additive-only writes, YAML frontmatter, skill injection into Seeder. Should — SQLite FTS5 index.

---

### EPIC-04 — KGC Simulator: Scenario Swarm on Graph Topology

**Problem Statement**: The static graph cannot answer "what if" questions. The Simulator selects canvas nodes as domain agents, fires parallel Claude Haiku calls with a scenario prompt, synthesises responses into a confidence-scored diff overlay, and presents findings as `kgc-computing-flow/v1` primitives for one-click graph commit.

**User Stories**: EPIC-04-S01 through EPIC-04-S04 (see research agent doc; unchanged).

**Key Acceptance Criteria**:
- S01-AC01: N parallel API calls start within 2s; all responses within 3 minutes; canvas ghost overlay visible.
- S02-AC01: `data-confidence` attribute in [0,1] on ghost elements; ≥1 `@edge` in simulation JSONB.

**MoSCoW**: Must — auto-derived node-agent prompts, parallel Haiku calls, ghost overlay with confidence scores. Should — confidence score from linguistic markers. Won't — many-agent simulation (>10 nodes) v0.1.

---

## 4. TAD — Technical Architecture (Phase 2)

### 4.1 Overview

**From FloatingPanel Chat to interactive canvas**: User types in FloatingPanel Chat → C-7 Orchestrator routes to either (a) C-1 Markdown contract → LLM generates `.md` directly, or (b) EPIC-01 KGC Seeder → produces JSONB → C-6 KGCtoMarkdownBridge → `.md` with frontmatter + Mermaid → in both cases: C-2 Frontmatter parser activates canvas mode → C-3 `parseMermaidToGraphData()` extracts nodes/edges/clusters → C-4 `graphDataSlice` + FlowEditor renders interactive graph → EPIC-02 Reasoner enriches selected nodes → EPIC-03 Skill Loop captures session → EPIC-04 Simulator runs scenario diffs → C-5 Schema-Config Contract tunes AgenticRAG similarity layer over live graph data.

### 4.2 Journey → System Mapping

| Journey Stage | Workflow | Data Flow | Component |
|---|---|---|---|
| Chat UI prompt entry | WF-0 Orchestrator routing | Chat message → intent detection → route | C-7 FloatingPanelChatOrchestrator |
| Markdown contract path | WF-1 LLM Document Generation | Prompt → C-1 → `.md` | C-1 + C-7 |
| Research path | WF-2 KGC Seed Pipeline | Web → Seeder → JSONB | TAD-C01 KGCSeedPipeline |
| JSONB → Markdown bridge | WF-3 Bridge Conversion | JSONB → frontmatter + Mermaid | C-6 KGCtoMarkdownBridge |
| Markdown import + frontmatter | WF-4 Markdown Import | `.md` → YAML parse → Zustand | C-2 Frontmatter parser |
| Mermaid lift | WF-5 Mermaid Extraction | Mermaid fence → AST → GraphData | C-3 `parseMermaidToGraphData()` |
| Canvas render | WF-6 Canvas Render | GraphData → D3/FlowEditor | C-4 `graphDataSlice` + FlowEditor |
| Node enrichment | WF-7 Reasoner Research | Node JSONB → Reasoner API → ghost overlay | TAD-C02 KGCReasoner |
| Session memory | WF-8 Skill Loop | Run log → Distiller → skills/ | TAD-C03 KGCSkillLoop |
| Scenario simulation | WF-9 Simulator | Node JSONB × N → Parallel agents → diff overlay | TAD-C04 KGCSimulator |
| Schema tuning (pass 2) | WF-10 Schema-Config Edit | Template JSON-LD → C-5 → validated JSON-LD | C-5 Schema-Config Contract |

---

### 4.3 Unified Architecture Diagram

```mermaid
flowchart TB
  subgraph UI["MainPanel + FloatingPanel Chat"]
    MP[MainPanel Integrations]
    FP[FloatingPanel Chat UI]
    MD_PANE[Markdown Pane\nEditor Workspace]
    FE[FlowEditor\nCanvas 2D]
    GHOST[Ghost Overlay\nRenderer]
    SB[Reasoner Sidebar]
    SIM_UI[Simulator Panel]
  end

  subgraph Contracts["LLM Prompt Contracts\nllm-chat-config/"]
    C1[C-1 Markdown\nGraph Document\nContract]
    C5[C-5 Schema-Config\nEditing Contract]
  end

  subgraph PipelineCanvas["Canvas Pipeline\ncanvas/src/"]
    C7[C-7 FloatingPanel\nChatOrchestrator]
    C6[C-6 KGCtoMarkdown\nBridge]
    C2[C-2 Frontmatter\nParser]
    C3[C-3 parseMermaid\nToGraphData]
    C4[C-4 graphDataSlice\n+ FlowEditor]
    VALIDATE_MD[validate_md_bridge\n_output.py]
  end

  subgraph Scripts["scripts/ — Native Python"]
    SEED[TAD-C01\nKGCSeedPipeline\nkgc_seed.py]
    SKILL_D[TAD-C03\nKGCSkillLoop\nkgc_skill_distil.py]
    SKILL_I[kgc_skill_inject.py]
    VALIDATE[validate_kgc\n_schema.py]
  end

  subgraph Workers["cloudflare/workers/"]
    REASONER_W[TAD-C02\nKGCReasoner\nkgc-reasoner.ts]
    SIM_W[TAD-C04\nKGCSimulator\nkgc-simulator.ts]
    STORE_W[TAD-C05\nKGCGraphStore\nkgc-store.ts]
  end

  subgraph Data["data/ — Git-tracked flat files"]
    SEEDS[seeds/\n.jsonb + _meta.md]
    SKILLS[skills/\n{domain}.md]
    SIMS[simulations/\n{scenario_id}.md]
    SESSIONS[sessions/\n{session_id}_trace.json]
  end

  subgraph Store["Cloudflare D1 + R2"]
    D1[(D1 Graph Store)]
  end

  subgraph AgenticRAG["AgenticRAG Layer"]
    SC[schema-config-template.jsonld]
  end

  subgraph LLM["Claude API"]
    SONNET[Sonnet 4.6\nPlan · Research · Reason]
    HAIKU[Haiku 4.5\nDistil · Simulate · Validate]
  end

  MP --> FP
  FP --> C7
  C7 -->|markdown_contract route| C1
  C7 -->|seeder route| SEED
  C1 --> SONNET
  SONNET -->|.md with frontmatter + Mermaid| MD_PANE
  SEED --> SONNET
  SEED --> SEEDS
  SEED --> VALIDATE
  SEEDS --> C6
  C6 --> VALIDATE_MD
  C6 -->|.md with frontmatter + Mermaid| MD_PANE
  MD_PANE --> C2
  C2 -->|kgFrontmatterModeEnabled=true| C4
  C2 -->|Mermaid fenced block| C3
  C3 -->|GraphNode[] + GraphEdge[] + layers[]| C4
  C4 --> FE

  FE -->|select nodes| SB
  SB --> REASONER_W
  REASONER_W --> SONNET
  REASONER_W -->|SSE ghost primitives| GHOST
  GHOST -->|accept| STORE_W
  STORE_W --> D1
  STORE_W -->|accepted record| C4

  FE -->|select nodes + scenario| SIM_UI
  SIM_UI --> SIM_W
  SIM_W --> HAIKU
  SIM_W -->|diff overlay| GHOST
  SIM_W --> SIMS

  SEEDS --> SKILL_D
  SKILL_D --> HAIKU
  SKILL_D --> SKILLS
  SKILLS --> SKILL_I
  SKILL_I --> SEED

  C4 -->|GraphNode.type vocabulary| C5
  C5 --> HAIKU
  C5 -->|validated JSON-LD| SC

  C7 --> SESSIONS
  REASONER_W --> SESSIONS
```

---

### 4.4 Component Specifications

#### C-1 — Markdown Graph Document Contract

**Responsibility**: Constrains LLM output to a single Markdown document that Knowgrph ingests without modification.

**File**: `llm-chat-config/md-graph-document-contract.md`

**Required frontmatter keys**:
```yaml
kgFrontmatterModeEnabled: true
kgDocumentSemanticMode: document
kgCanvasSurfaceMode: 2d
kgCanvas2dRenderer: flowEditor
```

**Mermaid block rules**: `graph LR` / `flowchart TD` only; node IDs pattern `kg:[a-z][a-z0-9_]*`; domain-agnostic labels; `subgraph ClusterName / end` for clusters; max 30 nodes (warn), 100 nodes (refuse); no HTML; no secrets or paths.

**`/goal` Conditions**: PRD-E1-S1-AC1 through PRD-E1-S3-AC1 (see §2).

**Status**: New.

---

#### C-2 — Frontmatter Parser (existing, verify)

**Responsibility**: Parses YAML frontmatter from Markdown documents; writes `kgFrontmatterModeEnabled`, `kgDocumentSemanticMode`, `kgCanvasSurfaceMode`, `kgCanvas2dRenderer` into Zustand state slices.

**File**: `canvas/src/hooks/store/uiSliceInitialState.ts`

**`/goal` Conditions**: PRD-E1-S1-AC2.

**Status**: Existing — verify behaviour with C-1 and C-6 output; no modification expected.

---

#### C-3 — `parseMermaidToGraphData()` (new build)

**Responsibility**: Accepts a Mermaid `graph`/`flowchart` source string, invokes `mermaid.parse()`, maps AST nodes to `GraphNode`, AST edges to `GraphEdge`, and `subgraph` blocks to graph layers in `GraphData`.

**File**: `canvas/src/utils/parseMermaidToGraphData.ts`  
**Test**: `canvas/src/__tests__/parseMermaidToGraphData.test.ts`

**Signature**: `parseMermaidToGraphData(src: string): GraphData`

**Mapping rules**:

| Mermaid AST element | GraphData target | Notes |
|---|---|---|
| `node.id` | `GraphNode.id` | Preserve `kg:` prefix |
| `node.label` / `node.text` | `GraphNode.label` | Strip surrounding brackets |
| Node shape `[`, `(`, `{` | `GraphNode.type` | `rect` / `rounded` / `diamond` |
| `edge.source` | `GraphEdge.source` | Node ID reference |
| `edge.target` | `GraphEdge.target` | Node ID reference |
| `edge.label` | `GraphEdge.label` | Empty string if absent |
| `subgraph.title` | Graph layer `label` | Layer contains member `nodeIds` |

**Error handling**: throws `MermaidParseError` on invalid syntax; caller catches and logs to `trace.jsonl`.

**Size constraint**: ≤ 200 lines TypeScript.

**`/goal` Conditions**: PRD-E2-S1-AC1, PRD-E2-S2-AC1, PRD-E2-S3-AC1.

**Status**: New.

---

#### C-4 — `graphDataSlice` + FlowEditor (existing, extend call sites)

**Responsibility**: Maintains global `GraphData` state (nodes, edges, layers) and drives all canvas renderer instances. Two call-site additions required:

1. **Mermaid fence detection** (from C-3):
```typescript
const mermaidSrc = extractMermaidFence(markdownContent);
if (mermaidSrc) {
  const graphData = parseMermaidToGraphData(mermaidSrc);
  graphDataSlice.setState(prev => mergeLlmGraphData(prev, graphData));
}
```

2. **Reasoner accept path** (from TAD-C02):
```typescript
// In the accept handler called by Reasoner Worker
graphDataSlice.setState(prev => mergeAcceptedPrimitive(prev, acceptedRecord));
```

**Files**: `canvas/src/hooks/store/graphDataSliceUtils.ts` (< 10 lines added per call site).

**`/goal` Conditions**: PRD-E2-S1-AC2, PRD-E4-S4-AC1.

**Status**: Existing — two call-site additions only.

---

#### C-5 — Schema-Config Editing Contract (formalise existing)

**Responsibility**: Constrains LLM output to a valid JSON-LD schema-config document with all required structural keys and preset-consistent numeric values.

**File**: `llm-chat-config/schema-config-editing-contract.md` (rename + extend from uploaded v0.1).

**Additions to v0.1 contract**:
- Sequencing note: run as pass 2 after PRD-E2 produces live graph data.
- `@graph` seeding rule: if caller provides `GraphNode.type` list, use `kg:class:[type]` as `@id` entries.
- Validation script reference: `python scripts/validate_schema_config.py output.jsonld`.

**`/goal` Conditions**: PRD-E3-S1-AC1 through PRD-E3-S3-AC1.

**Status**: Existing — extend.

---

#### C-6 — KGCtoMarkdownBridge (new build) ★ Integration linchpin

**Responsibility**: `KGCtoMarkdownBridge` reads `data/seeds/{domain}.jsonb` (newline-delimited `@node/@edge/@cluster` JSONB in `kgc-computing-flow/v1` format), produces `data/seeds/{domain}.md` containing a valid YAML frontmatter block (all four canvas keys), a `mermaid` fenced block where every `@node` maps to a Mermaid node and every `@cluster` maps to a Mermaid `subgraph`, and every `@edge` maps to a Mermaid edge. This is the single component that makes Research Agent JSONB output consumable by the canvas pipeline.

**File**: `scripts/kgc_to_markdown_bridge.py` (Python, ≤ 150 lines)

**Signature**: `kgc_to_markdown_bridge(jsonb_path: str, output_path: str) -> None`

**JSONB → Mermaid mapping rules**:

| JSONB field | Mermaid target | Notes |
|---|---|---|
| `@node.id` | Node ID | Convert to `kg:` prefix if absent (`kg:{id}`) |
| `@node.label` | Node label | Truncate at 40 chars; strip non-ASCII |
| `@node.cluster` | `subgraph` membership | Group node inside matching `subgraph` block |
| `@edge.source` | Edge source node | Must match a `@node.id` in the document |
| `@edge.target` | Edge target node | Must match a `@node.id` in the document |
| `@edge.label` | Edge label (`-- label -->`) | Optional; omit if empty |
| `@cluster.id` | `subgraph ClusterID` | One `subgraph` block per cluster |
| `@cluster.label` | `subgraph` display name | Shown as cluster header in canvas |

**Output YAML frontmatter** (injected at top of output `.md`):
```yaml
kgFrontmatterModeEnabled: true
kgDocumentSemanticMode: document
kgCanvasSurfaceMode: 2d
kgCanvas2dRenderer: flowEditor
kgSourceDomain: {domain}
kgSourceRunId: {run_id from _meta.md}
kgGeneratedBy: kgc_to_markdown_bridge
```

**Validation**: calls `python scripts/validate_md_bridge_output.py {output_path}` on completion; exits non-zero if any of three checks fail (frontmatter keys, node\_mapping, cluster\_mapping).

**Error handling**: `@node` with no matching `@cluster` → placed in a default `subgraph Unclustered` block. `@edge` referencing non-existent node ID → logged as warning; edge skipped. Node count > 100 → bridge exits with error before writing output.

**Invocation** (CLI or C-7 orchestrator):
```
python scripts/kgc_to_markdown_bridge.py \
  --input data/seeds/{domain}.jsonb \
  --output data/seeds/{domain}.md
```

**`/goal` Conditions**:
- `python scripts/validate_md_bridge_output.py data/seeds/{domain}.md exits 0 with PASS frontmatter, PASS node_mapping, PASS cluster_mapping` (PRD-E4-S2-AC1)
- `graphDataSlice.layers.length === @cluster_count` after C-3 processes bridge output (PRD-E4-S3-AC1)

**Dependencies**: `data/seeds/{domain}.jsonb` (TAD-C01 output); `scripts/validate_md_bridge_output.py` (new validation script, ~40 lines Python).

**Status**: New.

---

#### C-7 — FloatingPanelChatOrchestrator (new build)

**Responsibility**: `FloatingPanelChatOrchestrator` intercepts messages from the FloatingPanel Chat UI, detects user intent (quick graph generation vs deep domain research), routes to either the C-1 Markdown contract (direct LLM call) or the EPIC-01 KGC Seeder (via CLI invocation or Cloudflare Worker call), and chains the subsequent pipeline steps (C-6 bridge if Seeder route; C-2 / C-3 / C-4 for both routes).

**File**: `canvas/src/hooks/useChatOrchestrator.ts` (TypeScript hook, ≤ 100 lines)

**Intent detection** (keyword-based, v0.1; no ML):
```typescript
const RESEARCH_INTENT_KEYWORDS = [
  'research', 'seed', 'map the', 'explore the', 'analyze the',
  'landscape', 'gather sources', 'find nodes', 'populate'
];

const intent = RESEARCH_INTENT_KEYWORDS.some(kw =>
  message.toLowerCase().includes(kw)
) ? 'seeder' : 'markdown_contract';
```

**Routing logic**:
- `seeder` route: invokes `kgc_seed.py` → on completion, invokes `kgc_to_markdown_bridge.py` → auto-imports output `.md` into Markdown pane → triggers C-2 / C-3 / C-4.
- `markdown_contract` route: appends C-1 system prompt to LLM call → receives `.md` output → imports into Markdown pane → triggers C-2 / C-3 / C-4.

**Session logging**: writes `{ session_id, route_decision, timestamp, input_message }` to `data/sessions/{session_id}_trace.json`.

**`/goal` Conditions**:
- `grep route_decision data/sessions/{session_id}_trace.json returns seeder or markdown_contract` (PRD-E4-S1-AC1)
- Full E2E: `npm run superagent:e2e-test exits 0; stdout confirms nodes≥10 edges≥5 layers≥1` (PRD-E4-S5-AC1)

**Dependencies**: C-1 contract text (prompt prepend); C-6 bridge CLI; C-2/C-3/C-4 import pipeline (existing); `data/sessions/` directory (new).

**Status**: New.

---

#### TAD-C01 — KGCSeedPipeline (from research agent doc, unchanged)

**Responsibility**: Accepts domain query, executes plan-fetch-extract-validate loop, writes `kgc-computing-flow/v1` JSONB to `data/seeds/`.

**File**: `scripts/kgc_seed.py`

**E2E integration**: after successful run, C-7 invokes C-6 bridge on the output JSONB → `.md` → canvas pipeline.

**`/goal` Conditions**: EPIC-01-S01-AC01 through EPIC-01-S04-AC01 (see research agent doc).

**Status**: Proposed.

---

#### TAD-C02 — KGCReasoner (from research agent doc, extended)

**Responsibility**: Receives selected canvas node context, runs streamed multi-step tool-use loop, emits candidate `kgc-computing-flow/v1` primitives as ghost overlays.

**Files**: `canvas/src/components/Reasoner.tsx` + `cloudflare/workers/kgc-reasoner.ts`

**E2E integration (added in v0.2)**: accept path must call `graphDataSlice.addNode()` / `addEdge()` immediately after `KGCGraphStore POST /api/graph/ingest` returns 200, so the FlowEditor reflects the accepted primitive without reimport.

```typescript
// In kgc-reasoner.ts accept handler (addition to v0.1 spec)
const storeResult = await kgcGraphStore.ingest(acceptedPrimitive);
if (storeResult.ok) {
  // Broadcast to canvas via existing SSE channel
  sendToCanvas({ type: 'graph_data_update', payload: acceptedPrimitive });
}
```

**`/goal` Conditions**: EPIC-02-S01-AC01 through EPIC-02-S04-AC01 + PRD-E4-S4-AC1.

**Status**: Proposed — add accept-path `graphDataSlice` update.

---

#### TAD-C03 — KGCSkillLoop (from research agent doc, unchanged)

**Responsibility**: Captures session trajectories post-run, distils into skill documents via Haiku 4.5, injects relevant skills into future Seeder planning steps.

**Files**: `.githooks/post-session` + `scripts/kgc_skill_distil.py` + `scripts/kgc_skill_inject.py`

**Status**: Proposed.

---

#### TAD-C04 — KGCSimulator (from research agent doc, unchanged)

**Responsibility**: Constructs node-agent prompts from canvas node JSONB, fires N parallel Haiku 4.5 calls, synthesises confidence-scored diff overlay, persists simulation artifacts.

**Files**: `canvas/src/components/Simulator.tsx` + `cloudflare/workers/kgc-simulator.ts`

**Status**: Proposed.

---

#### TAD-C05 — KGCGraphStore (from research agent doc, unchanged)

**Responsibility**: Validates, stores, and serves `kgc-computing-flow/v1` JSONB records; provides write API consumed by Seeder, Reasoner, and Simulator.

**Files**: `cloudflare/workers/kgc-store.ts` + `scripts/validate_kgc_schema.py`

**Status**: Proposed.

---

### 4.5 Data Flows

#### DF-0 — FloatingPanel Chat → Orchestrated Route

| Stage | Component | Input Format | Output Format | Persistence | Error Handling |
|---|---|---|---|---|---|
| Ingest | C-7 FloatingPanelChatOrchestrator | Chat message string | Route decision + session trace | `data/sessions/{id}_trace.json` | Invalid message → default to `markdown_contract` route |
| Transform (route A) | C-1 contract + Claude API | Domain prompt | UTF-8 Markdown with frontmatter + Mermaid | None | Re-prompt if frontmatter check fails |
| Transform (route B) | TAD-C01 KGCSeedPipeline | Domain query | `data/seeds/{domain}.jsonb` | `data/seeds/` | Exit non-zero → log; surface error in Chat UI |
| Bridge (route B only) | C-6 KGCtoMarkdownBridge | JSONB | UTF-8 Markdown with frontmatter + Mermaid | `data/seeds/{domain}.md` | Validation fail → do not import; surface error |

#### DF-1 — Markdown File → Frontmatter → Zustand

| Stage | Component | Input Format | Output Format | Persistence | Error Handling |
|---|---|---|---|---|---|
| Ingest | C-2 Frontmatter parser | UTF-8 Markdown | YAML object | None | Missing keys → log warning; fallback to Document Mode |
| Transform | `uiSliceInitialState` | YAML object | Zustand state mutations | In-memory Zustand | Invalid value → use default; log to console |
| Store | Zustand | State mutations | Live store state | Session / RxDB | Hydration error → reset to defaults |

#### DF-2 — Mermaid Fenced Block → GraphData → Canvas

| Stage | Component | Input Format | Output Format | Persistence | Error Handling |
|---|---|---|---|---|---|
| Ingest | Fence extractor | UTF-8 Markdown | Mermaid source string | None | No fence found → no-op |
| Transform | C-3 `parseMermaidToGraphData()` | Mermaid source | `GraphData` (`GraphNode[]`, `GraphEdge[]`, layers[]) | None | `MermaidParseError` → log to `trace.jsonl`; skip update |
| Store | C-4 `graphDataSlice` | `GraphData` | Zustand `graphDataSlice` state | Session / RxDB | Merge conflict → `mergeLlmGraphData()` deduplicates by `id` |
| Serve | FlowEditor / D3 | `graphDataSlice` state | Canvas nodes, edges, cluster layers | Viewport | Render error → fallback; show error banner |

#### DF-3 — KGC JSONB → Markdown Bridge → Canvas

| Stage | Component | Input Format | Output Format | Persistence | Error Handling |
|---|---|---|---|---|---|
| Ingest | C-6 KGCtoMarkdownBridge | `kgc-computing-flow/v1` JSONB (newline-delimited) | — | None | JSONB parse error → abort; do not write output |
| Transform | C-6 node/edge/cluster mapper | JSONB records | Mermaid source string per cluster | None | Unknown node type → `rect` default |
| Store | C-6 writer | Mermaid + frontmatter string | `data/seeds/{domain}.md` | Local file | Write error → surface to C-7 |
| Validate | `validate_md_bridge_output.py` | `.md` file path | PASS/FAIL per check | None | Any FAIL → do not import; log |
| Serve (→ DF-1 + DF-2) | C-7 auto-import trigger | `.md` file path | Markdown pane load | Session | Import error → surface in FloatingPanel Chat |

#### DF-4 — Reasoner Accept → D1 + graphDataSlice

| Stage | Component | Input Format | Output Format | Persistence | Error Handling |
|---|---|---|---|---|---|
| Ingest | TAD-C02 accept handler | `{accepted_primitive: KGCRecord, session_id}` | — | None | Schema validation fail → reject; surface in sidebar |
| Validate | TAD-C05 `validate_kgc_schema.py` | Single KGCRecord | PASS / FAIL | None | FAIL → do not write to D1; log |
| Store | TAD-C05 KGCGraphStore | KGCRecord | D1 row | Cloudflare D1 | D1 write error → retry 2×; surface error in sidebar |
| Broadcast | TAD-C02 → C-4 (addition v0.2) | `{type: graph_data_update, payload}` | `graphDataSlice` mutation | In-memory Zustand | Broadcast failure → canvas unchanged; user re-imports |

#### DF-5 — Schema-Config Edit (Pass 2)

| Stage | Component | Input Format | Output Format | Persistence | Error Handling |
|---|---|---|---|---|---|
| Ingest | C-5 contract + template | JSON-LD template + `GraphNode.type` list + corpus hint | — | None | Template parse error → abort |
| Transform | LLM inference | JSON-LD template | JSON-LD candidate output | None | Re-prompt if validation exits non-zero |
| Validate | `validate_schema_config.py` | JSON-LD file | PASS/FAIL × 3 | None | Any FAIL → reject; do not overwrite template |
| Store | `schema-config/` directory | JSON string | `.jsonld` file | Local file | Invalid JSON → reject; do not overwrite |

---

### 4.6 Workflows

#### WF-0 — Orchestrator Routing

**Trigger**: User sends message in FloatingPanel Chat.

**Actors**: P1 (Solo Founder), C-7 FloatingPanelChatOrchestrator.

**Happy Path**:
1. C-7 receives message → keyword check determines intent.
2. `seeder` route: C-7 invokes `kgc_seed.py` → on exit 0, invokes `kgc_to_markdown_bridge.py` → imports `.md` into Markdown pane → triggers C-2/C-3/C-4 pipeline.
3. `markdown_contract` route: C-7 prepends C-1 system prompt to LLM call → LLM returns `.md` → imports into Markdown pane → triggers C-2/C-3/C-4 pipeline.

**Alternate Paths**:
- Ambiguous intent → default to `markdown_contract` route; log `route_decision: markdown_contract_default`.
- Seeder run exceeds 5 minutes → C-7 surfaces timeout to Chat UI; partial JSONB written; bridge skipped.

**Error Paths**:
- C-6 bridge validation fails → C-7 surfaces `FAIL bridge_validation` in Chat UI; canvas unchanged.
- LLM call fails → retry once; surface error to user.

**Postconditions**: `data/sessions/{session_id}_trace.json` contains `route_decision` entry; canvas pipeline initiated for correct route.

---

#### WF-3 — JSONB → Markdown Bridge

**Trigger**: `data/seeds/{domain}.jsonb` exists and `validate_kgc_schema.py` exits 0 for that file.

**Actors**: C-6 KGCtoMarkdownBridge, C-7 (trigger), `validate_md_bridge_output.py`.

**Happy Path**:
1. C-7 invokes C-6 with `--input data/seeds/{domain}.jsonb`.
2. C-6 reads JSONB; builds frontmatter block with four canvas keys.
3. C-6 groups `@node` records by `@cluster`; emits one `subgraph` block per cluster.
4. C-6 emits `@edge` records as Mermaid edges.
5. C-6 writes `data/seeds/{domain}.md`.
6. `validate_md_bridge_output.py` runs; returns three PASS lines.
7. C-7 triggers Markdown pane import → DF-1 + DF-2 execute.

**Alternate Paths**:
- `@node` has no cluster assignment → placed in `subgraph Unclustered / end`.
- `@edge` references non-existent node → skipped; logged as warning; bridge does not abort.

**Error Paths**:
- `@cluster` count > 30 → bridge emits warning; continues but suggests splitting domain.
- Node count > 100 → bridge exits with error before writing output; C-7 surfaces error.

**Postconditions**: `data/seeds/{domain}.md` passes all three `validate_md_bridge_output.py` checks; Markdown pane import triggered; `graphDataSlice` updated with nodes/edges/layers.

---

#### WF-7 — Reasoner Research + graphDataSlice Accept (updated v0.2)

**Trigger**: User selects canvas node(s) and activates Reasoner sidebar.

**Actors**: P1, TAD-C02 KGCReasoner Worker, TAD-C05 KGCGraphStore, C-4 `graphDataSlice`.

**Happy Path** (same as research agent doc except step 4 is new):
1. Sidebar loads node context → Worker starts Sonnet tool-use loop → SSE stream to sidebar.
2. Worker emits ghost overlay primitives → user reviews.
3. User clicks Accept → Worker validates record → `POST /api/graph/ingest` to TAD-C05 → D1 write.
4. *(new v0.2)* Worker broadcasts `graph_data_update` to canvas via SSE → C-4 calls `mergeAcceptedPrimitive()` → FlowEditor re-renders with new solid node, no reimport required.

**Postconditions**: Accepted node in D1 AND in `graphDataSlice.nodes`; FlowEditor shows solid node; sidebar shows accept confirmation.

---

### 4.7 Integration Contracts

| Interface | Protocol | Format | Auth | Error Handling |
|---|---|---|---|---|
| C-7 → Claude API (markdown_contract route) | HTTPS/REST | JSON (messages API) | Bearer `ANTHROPIC_API_KEY` | Retry 2× on 429; surface to Chat UI |
| C-7 → `kgc_seed.py` | subprocess | CLI args + exit code | None (local) | Non-zero exit → surface error; do not invoke C-6 |
| C-7 → C-6 bridge | subprocess | CLI args + exit code | None (local) | Non-zero exit → do not import; surface error |
| C-6 → Markdown pane import | In-process call | `.md` file path | None | File not found → surface error |
| TAD-C02 → TAD-C05 (ingest) | HTTPS/REST | JSON (kgc-computing-flow/v1) | Cloudflare Worker auth | Validate before POST; reject 400 on schema error |
| TAD-C02 → C-4 (broadcast) | SSE (existing channel) | `{type: graph_data_update, payload: KGCRecord}` | Session context | Broadcast failure → no canvas update; user reimports manually |
| TAD-C01 → Claude API | HTTPS/REST | JSON (tool-use) | Bearer `ANTHROPIC_API_KEY` | Retry 3× on 429; fail-fast on 4xx |
| TAD-C02 → Claude API | HTTPS/SSE | JSON streaming | Bearer `ANTHROPIC_API_KEY` | Reconnect on disconnect; surface in sidebar |
| TAD-C04 → Claude API | HTTPS/REST parallel | JSON (short prompts) | Bearer `ANTHROPIC_API_KEY` | 30s per-agent timeout; return partial if ≥50% respond |
| Any → SearXNG | HTTPS/REST | JSON (OpenSearch) | None (self-hosted) | Fallback to Jina Reader on timeout >5s |
| Any → KGCGraphStore | HTTPS/REST | JSON (kgc-computing-flow/v1) | Cloudflare Worker auth | Schema validate before POST; 400 on error |

---

### 4.8 Architectural Decisions

#### ADR-1: `mermaid.parse()` AST over regex (v0.1, unchanged)
**Status**: Proposed. Use `mermaid.parse()` exclusively; already bundled; zero new dependencies.

#### ADR-2: Prompt contracts as Markdown files in `llm-chat-config/` (v0.1, unchanged)
**Status**: Proposed. Markdown is native to Knowgrph; diffable; no tooling required.

#### ADR-3: Schema-config validation script is deterministic and side-effect-free (v0.1, unchanged)
**Status**: Proposed. Three PASS/FAIL lines; exits 0 on all pass; no network calls.

#### ADR-4: No External Agent Framework Dependency (from research agent doc)
**Status**: Accepted · 2026-05-22. All four KGC capabilities implemented as native Python scripts and TypeScript Cloudflare Workers. Patterns adopted from DeerFlow/MiroFlow/MiroThinker each implemented in <200 lines of native code.

#### ADR-5: SearXNG Over Serper for Search (from research agent doc)
**Status**: Accepted · 2026-05-22. Self-hosted SearXNG (Cloudflare Workers or Oracle Always Free Docker). Jina Reader as fallback. $0 search cost.

#### ADR-6: KGCtoMarkdownBridge as a standalone Python script (new)
**Status**: Proposed · 2026-05-22.

**Context**: The JSONB → Markdown conversion could be embedded in the Seeder, the canvas TypeScript pipeline, or a standalone script.

**Decision**: Standalone Python script `scripts/kgc_to_markdown_bridge.py` invoked by C-7 after Seeder completes.

**Alternatives Considered**:
1. Embed in `kgc_seed.py`: Pros — one invocation. Cons — violates SRP; makes Seeder dependent on canvas frontmatter schema; harder to test in isolation.
2. TypeScript canvas utility: Pros — runs in-browser. Cons — requires JSONB to be served to the canvas before bridge runs; adds network round-trip; JSONB files are Python-pipeline-native.

**Rationale**: SRP — Seeder is responsible for JSONB extraction; Bridge is responsible for format conversion; Canvas is responsible for import. Standalone script is testable, composable, and fits the existing `scripts/` pattern.

**Consequences**: Positive — clean SRP; independently testable. Negative — subprocess invocation from C-7 adds a small latency (~100ms). Neutral — no new dependency beyond Python stdlib + existing `kgc-computing-flow/v1` schema reference.

#### ADR-7: Keyword-based intent detection in C-7 (v0.1; no ML)
**Status**: Proposed · 2026-05-22.

**Context**: C-7 must determine whether to route to Seeder or Markdown contract without a full NLP classifier.

**Decision**: Static keyword list in `useChatOrchestrator.ts`; configurable via `llm-chat-config/orchestrator-config.json`.

**Rationale**: Zero latency; zero cost; adequate for solo dev; keyword list is user-inspectable and user-editable. ML intent classification can replace this in v0.2 when usage volume justifies it.

**Consequences**: Positive — instant; free; transparent. Negative — false positives on domain names containing research keywords. Neutral — fallback to `markdown_contract` on ambiguity is safe.

---

### 4.9 Quality Attributes

| Attribute | Scenario | Pattern | Validation |
|---|---|---|---|
| Performance | Mermaid block with 30 nodes → extract completes before canvas render | Synchronous AST walk; no I/O | C-3 test with 30-node fixture must complete < 50ms |
| Performance | C-6 bridge converts 30-node JSONB → MD → < 1s | Pure Python string manipulation; no network | Bridge benchmark test exits 0 within 1s on 30-node fixture |
| Performance | E2E (Chat → canvas nodes, markdown\_contract path) | Direct LLM call + in-process pipeline | ≤ 5 seconds wall-clock; measured in `superagent:e2e-test` |
| Performance | E2E (Chat → canvas nodes, seeder path) | Async Seeder + bridge + import | ≤ 90 seconds wall-clock; surfaced as progress in Chat UI |
| Scalability | 100-node graph import (max allowed) | Node limit enforced at C-3 + C-6 | 101-node fixture → `MermaidParseError` / bridge exit error; canvas unchanged |
| Security | LLM injects credential in Mermaid label | Contract guardrail + label sanitiser in C-3 | Node label `contains /etc/passwd` → sanitised or rejected in test |
| Security | C-6 bridge writes outside `data/seeds/` | Output path restricted to `data/seeds/` in script | Path traversal attempt → `ValueError` in bridge test |
| Observability | Agent loop confirms pipeline | `trace.jsonl` records `mermaid_extract` event; `trace.json` records `route_decision` | Fixture tests confirm event format for both trace files |
| Observability | E2E pipeline failure visible | Any error surface in FloatingPanel Chat UI | E2E test asserts no silent failures; all errors appear in Chat or trace |

---

### 4.10 Deployment Strategy

All new components are prompt artefacts, Python scripts, or small TypeScript utilities. No infrastructure change required beyond existing stack.

- **C-1, C-5 contracts**: merged to `main` as `.md` files; available immediately.
- **C-3 extractor**: merged behind `KNOWGRPH_MERMAID_EXTRACT=true` flag for week 1; flag removed after regression-clean test pass.
- **C-6 bridge**: merged to `main` in `scripts/`; invoked by C-7; no flag required (new functionality).
- **C-7 orchestrator**: merged to `main` in `canvas/src/hooks/`; behind `KNOWGRPH_CHAT_ORCHESTRATOR=true` flag for week 1.
- **TAD-C01 to TAD-C04**: sequenced as per Build Sequence (§7); each epic behind its own feature flag.
- **`validate_md_bridge_output.py`, `validate_schema_config.py`**: added to `scripts/`; run in CI via `npm run lint` pre-commit hook.
- **Rollback**: contracts are files (`git revert`); extractors have no DB writes (flag disable); bridge has no side effects beyond writing to `data/seeds/`.

---

### 4.11 Component Inventory

| Layer | Component | File / Module | Status | Epic/Story |
|---|---|---|---|---|
| Prompt | Markdown Graph Document Contract | `llm-chat-config/md-graph-document-contract.md` | New | PRD-E1 |
| Prompt | Schema-Config Editing Contract | `llm-chat-config/schema-config-editing-contract.md` | Extend | PRD-E3 |
| Canvas hook | FloatingPanelChatOrchestrator | `canvas/src/hooks/useChatOrchestrator.ts` | New | PRD-E4 |
| Canvas utility | `parseMermaidToGraphData()` | `canvas/src/utils/parseMermaidToGraphData.ts` | New | PRD-E2 |
| Canvas test | Extractor test suite | `canvas/src/__tests__/parseMermaidToGraphData.test.ts` | New | PRD-E2 |
| Canvas store | `graphDataSlice` call sites (×2) | `canvas/src/hooks/store/graphDataSliceUtils.ts` | Extend (< 20 lines) | PRD-E2, PRD-E4 |
| Canvas store | Frontmatter parser | `canvas/src/hooks/store/uiSliceInitialState.ts` | Existing (verify) | PRD-E1 |
| Canvas component | FlowEditor | `canvas/src/components/FlowEditor/` | Existing (no change) | PRD-E2 |
| Canvas component | Reasoner sidebar | `canvas/src/components/Reasoner.tsx` | New | EPIC-02 |
| Canvas component | Ghost Overlay Renderer | `canvas/src/components/GhostOverlay.tsx` | New | EPIC-02, EPIC-04 |
| Canvas component | Simulator Panel | `canvas/src/components/Simulator.tsx` | New | EPIC-04 |
| Script | KGCtoMarkdownBridge | `scripts/kgc_to_markdown_bridge.py` | New | PRD-E4 |
| Script | Bridge output validator | `scripts/validate_md_bridge_output.py` | New | PRD-E4 |
| Script | Schema-config validator | `scripts/validate_schema_config.py` | New | PRD-E3 |
| Script | KGCSeedPipeline | `scripts/kgc_seed.py` | New | EPIC-01 |
| Script | KGCSchemaValidator | `scripts/validate_kgc_schema.py` | New | EPIC-01 (shared) |
| Script | KGCSkillDistiller | `scripts/kgc_skill_distil.py` | New | EPIC-03 |
| Script | KGCSkillInjector | `scripts/kgc_skill_inject.py` | New | EPIC-03 |
| Script | KGCAgentPromptInspector | `scripts/inspect_agent_prompt.py` | New | EPIC-04 |
| Script | E2E pipeline test | `scripts/superagent_e2e_test.py` | New | PRD-E4 |
| Hook | PostSessionHook | `.githooks/post-session` | New | EPIC-03 |
| Worker | KGCReasoner Worker | `cloudflare/workers/kgc-reasoner.ts` | New | EPIC-02 |
| Worker | KGCSimulator Worker | `cloudflare/workers/kgc-simulator.ts` | New | EPIC-04 |
| Worker | KGCGraphStore Worker | `cloudflare/workers/kgc-store.ts` | New | EPIC-01–04 |
| Config | Orchestrator config | `llm-chat-config/orchestrator-config.json` | New | PRD-E4 |
| Config | Schema-config template | `schema-config/knowgrph-schema-config-template.jsonld` | Existing (no change) | PRD-E3 |
| Data | SeedStore | `data/seeds/` | New | EPIC-01 |
| Data | SkillStore | `data/skills/` | New | EPIC-03 |
| Data | SimulationStore | `data/simulations/` | New | EPIC-04 |
| Data | SessionStore | `data/sessions/` | New | PRD-E4 |
| Data | SkillIndex | `data/skills.db` (SQLite FTS5) | New | EPIC-03 |

---

## 5. Alignment & Traceability (Phase 3)

### 5.1 Full Traceability Matrix

| PRD Ref | Story | Acceptance Criterion | TAD Component | Interface | `/goal` Condition |
|---|---|---|---|---|---|
| PRD-E1 | S1 | AC1 | C-1 | Contract text | `grep four keys in output.md exits 0` |
| PRD-E1 | S1 | AC2 | C-2 | Zustand store mutation | `npm run superagent:test; kgFrontmatterModeEnabled=true` |
| PRD-E1 | S2 | AC1 | C-1 | Contract guardrails | `grep kg: pattern ≥1; grep forbidden terms = 0` |
| PRD-E1 | S3 | AC1 | C-1 | `frontmatter_check.py` | `exits 0 with PASS parse, PASS keys, PASS mermaid_present` |
| PRD-E2 | S1 | AC1 | C-3 | `parseMermaidToGraphData()` | `npm test; node_count=N edge_count=M` |
| PRD-E2 | S1 | AC2 | C-4 | FlowEditor render | `workspaceImportVideoDemoRendererIsolation passes` |
| PRD-E2 | S2 | AC1 | C-3 | Subgraph → layer mapping | `layers.length === subgraphCount; npm test exits 0` |
| PRD-E2 | S3 | AC1 | C-3, C-4 | Test stdout | `stdout includes node_count edge_count cluster_count` |
| PRD-E3 | S1 | AC1 | C-5 | `validate_schema_config.py` | `exits 0; PASS parse, PASS keys` |
| PRD-E3 | S2 | AC1 | C-5 | Preset consistency | `PASS preset_consistency` |
| PRD-E3 | S3 | AC1 | C-5 | Validator stdout | `exactly 3 PASS lines` |
| PRD-E4 | S1 | AC1 | C-7 | Session trace | `grep route_decision exits 0` |
| PRD-E4 | S2 | AC1 | C-6 | `validate_md_bridge_output.py` | `exits 0; PASS frontmatter, PASS node_mapping, PASS cluster_mapping` |
| PRD-E4 | S3 | AC1 | C-3, C-6 | `graphDataSlice.layers` | `layers.length === @cluster_count; npm test exits 0` |
| PRD-E4 | S4 | AC1 | TAD-C02, C-4 | D1 + `graphDataSlice` | `validate_kgc_schema exits 0; npm test reasoner accept exits 0` |
| PRD-E4 | S5 | AC1 | C-7, full pipeline | `superagent:e2e-test` | `exits 0; nodes≥10 edges≥5 layers≥1; pipeline_error count=0` |
| EPIC-01 | S01 | AC01 | TAD-C01 | `kgc_seed.py` output | `validate_kgc_schema.py exits 0; grep -c @node ≥10` |
| EPIC-01 | S02 | AC01 | TAD-C01 plan | `_plan.json` | exists with required fields before first fetch log entry |
| EPIC-01 | S03 | AC01 | TAD-C01 context_mgr | run.log | `grep context_trim run.log ≥1; exit 0` |
| EPIC-01 | S04 | AC01 | TAD-C01, TAD-C05 | `data/seeds/` write | `validate_kgc_schema exits 0; meta.md has 2 frontmatter fences` |
| EPIC-02 | S01 | AC01 | TAD-C02 context_load | Reasoner Worker POST | `console.log context load ≤500ms; sidebar renders node_context` |
| EPIC-02 | S02 | AC01 | TAD-C02 injection | Reasoner Worker PATCH | `grep injection_event trace exits 0` |
| EPIC-02 | S03 | AC01 | TAD-C02 commit, TAD-C05 | KGCGraphStore POST | `validate_kgc_schema --single-record exits 0; D1 count +1` |
| EPIC-02 | S04 | AC01 | TAD-C02 stream | SSE stream | `[tool_call] and [result] markers in sidebar DOM` |
| EPIC-03 | S01 | AC01 | TAD-C03 hook | `.githooks/post-session` | `grep -c run_id skills/{domain}.md ≥1 within 60s` |
| EPIC-03 | S02 | AC01 | TAD-C03 distil | `validate_kgc_schema --skill` | `exits 0; valid: true` |
| EPIC-03 | S03 | AC01 | TAD-C03 inject | `kgc_skill_inject.py` | `grep skill_injection run.log ≥1; query count ≤50% baseline` |
| EPIC-03 | S04 | AC01 | TAD-C03 append_guard | Git diff | `git diff shows 0 deletions to existing skill lines` |
| EPIC-04 | S01 | AC01 | TAD-C04 parallel_exec | KGCSimulator Worker | `N starts within 2s; all responses within 3 min; ghost overlay in DOM` |
| EPIC-04 | S02 | AC01 | TAD-C04 diff_overlay | Canvas ghost overlay | `data-confidence in [0,1] on all ghost elements; ≥1 @edge in JSONB` |
| EPIC-04 | S03 | AC01 | TAD-C04 prompt_builder | `inspect_agent_prompt.py` | `exits 0; output has id, type, cluster, label, edges` |
| EPIC-04 | S04 | AC01 | TAD-C04 persist, TAD-C05 | `data/simulations/` | `validate_kgc_schema --simulation exits 0; 5 frontmatter fields present` |

### 5.2 Separation Verification

- PRD describes WHAT and WHY: user value, business logic, journey friction, success metrics. No TypeScript, no file paths, no API method names.
- TAD describes HOW: component specifications, data flows, integration contracts, ADRs. No domain names, no business logic, no hardcoded similarity thresholds.
- Boundary: PRD stops at Given-When-Then criteria; TAD starts at component specification.

### 5.3 Validation Checklist

**Pre-Implementation**:
- [x] User journeys mapped before stories; every story anchored to a journey stage
- [x] Workflows WF-0 through WF-9 defined with trigger, happy path, alternate paths, error paths, postconditions
- [x] Data flows DF-0 through DF-5 typed at every stage boundary with persistence and error handling
- [x] User stories follow "As a… I want… So that" format
- [x] Acceptance criteria use Given-When-Then with observable outcomes
- [x] Every acceptance criterion translated to a `/goal` condition (one measurable end state + stated check + constraint)
- [x] Features prioritized via MoSCoW with rationale
- [x] Components have single responsibility (SRP enforced per spec)
- [x] Architectural decisions documented (ADR-1 through ADR-7)
- [x] Architecture diagram uses Mermaid `flowchart TB` with subgraphs; no ASCII art
- [x] Component inventory table accompanies architecture diagram
- [x] PRD-to-TAD traceability established via §5.1 matrix
- [x] `/goal` conditions recorded in TAD component specs and traced to source criteria
- [x] No implementation detail in PRD; no business logic in TAD

---

## 6. Open Questions

| ID | Question | Impact | Resolution Approach | Status |
|---|---|---|---|---|
| OQ-01 | SearXNG on Cloudflare Workers vs Oracle Always Free Docker? | EPIC-01 latency + infra | Benchmark both; prefer CF Workers if p95 ≤3s | Open |
| OQ-02 | Max acceptable synchronous seed run time? | EPIC-01 UX | User test: 3-min sync threshold; webhook above | Open |
| OQ-03 | Auto-ingest vs confirmation for seed output? | EPIC-01 data safety | Conservative default: require confirmation in v0.1 | Open |
| OQ-04 | Extended thinking for KGCReasoner? | EPIC-02 quality vs cost | Benchmark on 5 test domains; gate on >10% improvement | Open |
| OQ-05 | Max concurrent Reasoner tool calls in sidebar UX? | EPIC-02 UX | 2 concurrent; validate in prototype | Open |
| OQ-06 | Ghost overlay expiry policy? | EPIC-02 + EPIC-04 | Expire after session; persist as "pending" within 24h | Open |
| OQ-07 | Skill distillation model: Haiku 4.5 vs Sonnet 4.6? | EPIC-03 quality vs cost | Haiku default; Sonnet opt-in for high-value domains | Open |
| OQ-08 | Max skill document size before injection burden? | EPIC-03 context efficiency | 2000 token cap enforced at distillation | Open |
| OQ-09 | Confidence score: linguistic markers vs second Claude call? | EPIC-04 quality vs cost | Linguistic markers in v0.1; second-call in v0.2 | Open |
| OQ-10 | Max per-simulation cost? | EPIC-04 TCO | Confirm Haiku 4.5 pricing; display estimate before trigger | Open |
| OQ-11 | Is `mermaid.parse()` async in the bundled canvas version? | PRD-E2 / C-3 | Check `canvas/package.json` mermaid version; test `await` vs sync | Open |
| OQ-12 | `mergeLlmGraphData()`: overwrite or skip existing nodes by `id`? | PRD-E2 / C-4 | Default skip (preserve user edits); overwrite option in import settings | Open |
| OQ-13 | Should C-7 system prompt pre-load be opt-in or always-on? | PRD-E1 / C-7 | Opt-in via `llm-chat-config/orchestrator-config.json` setting | Open |
| OQ-14 | `@cluster` with >30 member nodes: single subgraph or auto-split? | PRD-E4 / C-6 | Warn user; emit single subgraph; recommend domain split | Open |
| OQ-15 | E2E superagent test fixture domain: use existing `data/seeds/` example or create new? | PRD-E4 / C-7 | Create dedicated `test_domain` fixture in `scripts/fixtures/`; no real web requests | Open |

---

## 7. Build Sequence and TCO

### 7.1 Build Sequence (Solo Dev, 14 Days)

| Week | Epics | Key Deliverables | Unblocks |
|---|---|---|---|
| Week 1 | PRD-E1 · PRD-E3 | C-1 contract deployed; C-5 contract extended; `validate_schema_config.py` written | Immediate: LLM output ingests into canvas via frontmatter |
| Week 1–2 | PRD-E2 · PRD-E4 (C-6 + C-7) | C-3 extractor built and tested; C-6 bridge built; C-7 orchestrator built; `validate_md_bridge_output.py` written | Full E2E path: Chat → Seeder → Bridge → Canvas nodes/clusters/edges |
| Week 2–3 | EPIC-01 · EPIC-03 | `kgc_seed.py`, `validate_kgc_schema.py`, `kgc_skill_distil.py`, post-session hook | Seeder feeds Bridge; Skill Loop starts compounding |
| Week 3–4 | EPIC-02 · PRD-E4 (Reasoner accept path) | `Reasoner.tsx`, `kgc-reasoner.ts`; accept path → `graphDataSlice` update | In-canvas enrichment; ghost overlay → live node |
| Week 4+ | EPIC-04 | `Simulator.tsx`, `kgc-simulator.ts` | Scenario simulation on populated graph |

**Critical path**: C-6 KGCtoMarkdownBridge is the integration linchpin. PRD-E2 (C-3 extractor) and EPIC-01 (Seeder) are both prerequisites. Build order: C-3 → C-6 → C-7 → EPIC-01 integration test.

### 7.2 TCO at Early Solo-Founder Usage

| Cost Item | Rate | Est. Daily Cost |
|---|---|---|
| Claude Sonnet 4.6 (C-7 markdown\_contract route + EPIC-01 + EPIC-02) | $3/$15 per MTok | ~$0.20–1.00 |
| Claude Haiku 4.5 (C-7 schema validation + EPIC-03 + EPIC-04) | ~$0.25/$1.25 per MTok | ~$0.05–0.20 |
| SearXNG self-hosted | $0 (CF Workers or Oracle Free) | $0 |
| Cloudflare Workers | Free tier 100k req/day | $0 |
| Cloudflare D1 + R2 | Free tier sufficient | $0 |
| PocketBase (Oracle Always Free) | $0 | $0 |
| **Total marginal daily TCO** | | **~$0.25–1.20/day** |

All platform costs are $0. All non-Claude dependencies are MIT/Apache-2.0/AGPL-3.0 (self-hosted). The solo dev constraint (14 days build, zero platform cost) is met.

---

*Document ID: `knowgrph-llm-prompt-contract-prd-tad-proposed` · Version: `0.2.0` · Updated: 2026-05-22*  
*Next review: resolve OQ-11 through OQ-15 (new); OQ-01 through OQ-10 (research agent); Phase 3 gate before implementation begins*