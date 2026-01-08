# Knowgrph Codebase Semantics: AgenticRAG‑Aligned Contracts

## Scope and Intent

- The Knowgrph codebase treats all graphs as **AgenticRAG‑compatible knowledge graphs**.
- Semantics remain **domain‑agnostic, project‑agnostic, and dataset‑agnostic**, enforced via configuration and JSON‑LD schemas.
- Maintainability and neutrality follow:
  - `/docs/guidelines/codebase-maintainability-guidelines.md`
  - `/docs/guidelines/codebase-neutrality-guidelines.md`

This document describes the semantic contracts that connect:

- **Parser outputs** (JSON, JSON‑LD, Markdown, CSV)  
- **AgenticRAG / GraphRAG pipeline artifacts** (workflow JSON‑LD, index JSON‑LD)  
- **Canvas runtime models** (GraphData, schema config, settings config, renderer config)

All semantics are aligned with `/schema/AgenticRAG`:

- `graph-schema.jsonld`
- `node-schema.jsonld`
- `edge-schema.jsonld`
- `metadata.jsonld`
- `workflow.jsonld`
- `settings.jsonld`
- `panels.jsonld`

---

## Core Graph Semantics

### Graph

- **Context**:
  - `context: "graphrag"` or `"agenticrag"` on internal fixtures
  - JSON‑LD graphs expose `@context`, `@graph`, and `metadata`
- **Type**:
  - `type: "Graph"` for non‑JSON‑LD GraphData objects
  - `@type: "kg:Graph"` (or compatible) for JSON‑LD nodes
- **Guarantees**:
  - Node and edge IDs are globally unique within a graph.
  - All references in edges and metadata resolve to defined node IDs.
  - Graphs are **immutable snapshots** from the canvas perspective; mutations are expressed as new snapshots with history metadata.

### Node

- **Required fields** (GraphData):
  - `id: string` – stable identifier
  - `label: string` – human‑friendly label
  - `type: string` – semantic type; mapped to AgenticRAG `kg:NodeType`
  - `properties: Record<string, unknown>` – arbitrary key/value pairs
- **Required fields** (JSON‑LD):
  - `@id` – IRI or `kg:<localId>`
  - `@type` – one or more AgenticRAG node types (for example, `kg:Document`, `kg:Chunk`, `kg:Entity`, `kg:Community`)
- **Semantic constraints**:
  - Node types must come from `node-schema.jsonld` or compatible local extensions.
  - Properties that affect rendering (size, color, layer) must be declared in schema or settings config, not hardcoded inside renderers.
  - Provenance properties (for example, `source`, `path`, `lineStart`, `lineEnd`, `timestamp`) must be treated as **read‑only metadata** in the canvas, not overwritten by UI interactions.

### Edge

- **Required fields** (GraphData):
  - `id: string`
  - `source: string`
  - `target: string`
  - `label: string`
  - `properties: Record<string, unknown>`
- **Required fields** (JSON‑LD triple pattern):
  - Subject: `kg:subject` or `kg:source`
  - Predicate: `kg:predicate` or semantic edge label
  - Object: `kg:object` or `kg:target`
- **Semantic constraints**:
  - Edge labels map to `edge-schema.jsonld` (for example, `worksAt`, `mentions`, `hasItem`, `semanticRelation`).
  - Semantic similarity edges are configured via `schema.layers.semantic` and **never hardcoded** by dataset name.
  - Edge properties capture confidence, weight, timestamps, and traversal metadata but do not embed dataset‑specific business rules.

---

## Layered Semantics (Document → Chunk → Entity → Relation)

### Document Layer

- **Node types**:
  - `Document`, `Section`, `Paragraph`, `List`, `ListItem`, `CodeBlock`, `Table`
- **Responsibilities**:
  - Preserve the **original structure** of the source (headings, lists, code blocks, tables).
  - Maintain `path`, `uri`, and `graphId` properties consistent with `graph-schema.jsonld` and `metadata.jsonld`.
  - Emit `chunk_text` for inspection only; retrieval and ranking logic are defined in pipeline/workflow configs.

### Chunk Layer

- **Node type**:
  - `Chunk` (or equivalent semantic type in JSON‑LD)
- **Responsibilities**:
  - Represent token spans or paragraph fragments used for retrieval.
  - Track provenance:
    - `documentId`, `sectionId`, `paragraphIndex`, `characterOffsets`, `tokenOffsets`
  - Remain neutral:
    - No assumptions about language, topic, or project.
    - Chunking policies (size, boundaries) are configured via AgenticRAG/GraphRAG workflow JSON‑LD, not embedded in the canvas.

### Entity Layer

- **Node types**:
  - `Entity`, `Concept`, `Person`, `Organization`, or schema‑defined types
- **Responsibilities**:
  - Represent semantic entities extracted by pipelines (for example, markdown parser, GraphRAG pipeline).
  - Track confidence, source spans, and canonical IDs but not embed model‑specific assumptions.
  - Maintain **many‑to‑many** linkage with chunks and documents via edges such as `mentions` and `mentionOf`.

### Relation Layer

- **Edge labels**:
  - Structural: `contains`, `hasItem`, `hasMention`
  - Semantic: `relatedTo`, similarity edges, graph‑specific predicates
  - Provenance: edges used to track source ↔ target document relationships
- **Responsibilities**:
  - Maintain separation between:
    - **Structural edges** (document layout)
    - **Semantic edges** (meaning, similarity)
    - **Traversal edges** (GraphRAG / AgenticRAG pipeline steps)
  - Ensure relations are **schema‑driven** and **configuration‑driven**, not hardcoded per dataset.

---

## Maintainability Semantics

The codebase applies `https://huijoohwee.github.io/guidelines/codebase-maintainability-guidelines.md` as semantic constraints:

- **Single responsibility**:
  - Parser modules focus on extraction and normalization.
  - Canvas modules focus on presentation, selection, and tooling.
  - Configuration modules focus on mapping JSON‑LD schemas into UI and traversal controls.
- **File size and cohesion**:
  - New modules are kept under 600 LOC with one clear reason to change.
  - Large legacy modules are listed in docs and refactor plans and are treated as exceptions with clear owners.
- **Copy and constants**:
  - User‑facing strings live in centralized copy helpers (`config-copy/uiCopy.ts`, `COPY_*` constants).
  - LocalStorage keys use shared `LS_KEYS` enums and align with schema/AgenticRAG panel and settings identifiers.
- **Schema alignment**:
  - Graph, node, edge, and settings semantics must map to `/schema/AgenticRAG` types and properties.
  - New fields are added via schema and configuration, not by ad‑hoc props in components.

---

## Neutrality Semantics

The codebase applies `https://huijoohwee.github.io/guidelines/codebase-neutrality-guidelines.md` to keep all semantics neutral:

- **Domain‑agnostic**:
  - Algorithms avoid mentioning specific products, industries, or datasets.
  - Any example‑specific content (for example, demo graphs, unicorn investor fixtures) is isolated in test data, CLI helpers, or demo catalogs.
- **Project‑agnostic**:
  - Canvas logic never inspects repository names or file system roots directly; it works on abstracted `DatasetPath` and `SchemaConfigPath` types.
  - Transport logic for loading examples uses `import.meta.glob` and configuration keys instead of absolute paths.
- **Dataset‑agnostic**:
  - Similarity thresholds, top‑K limits, and edge labels are configured via settings and schema layers, not hardcoded per dataset.
  - Fallback example graphs are treated as neutral fixtures; they may have human‑friendly names but do not affect algorithm design.
- **Metadata‑driven**:
  - All heuristics that depend on document or graph structure derive their behavior from metadata fields (for example, `layers`, `properties`, `tags`), not from dataset names.

---

## Role → Actions → Outcome (RAO) Mapping

The following RAO roles apply to codebase semantics:

- **Role: Parser Developer**  
  → Actions: implements schema‑aligned Graph/Node/Edge emitters, preserves provenance, keeps modules single‑responsibility, reuses AgenticRAG types  
  → Outcome: delivers neutral, maintainable parser outputs that plug into any AgenticRAG pipeline.

- **Role: Canvas Developer**  
  → Actions: renders graphs using schema‑driven settings, centralizes copy, respects selection and history models, avoids domain‑specific branches  
  → Outcome: produces reusable, neutral canvas behaviors that work across datasets and workflows.

- **Role: Configuration Architect**  
  → Actions: defines schema config, settings config, and workflow JSON‑LD so algorithms remain general‑purpose and parameters are externalized  
  → Outcome: enables adaptation to new repositories and corpora without changing code.

- **Role: Maintainer**  
  → Actions: verifies semantic alignment with `/schema/AgenticRAG`, enforces maintainability and neutrality checklists, refactors legacy modules toward SRP and size limits  
  → Outcome: keeps Knowgrph semantics stable, testable, and reusable across domains.

---

## Validation Checklist (Semantics)

- [ ] Graph, node, and edge shapes match `/schema/AgenticRAG` JSON‑LD definitions.
- [ ] No algorithm depends on a specific dataset, project, or repository name.
- [ ] All user‑facing semantics (labels, tooltips, RAO copy) follow SRP and SVO patterns.
- [ ] New modules declare responsibilities in RAO terms and remain ≤600 LOC.
- [ ] Parser and canvas behaviors can be reused across at least 3+ distinct domains without code changes, only configuration updates.
