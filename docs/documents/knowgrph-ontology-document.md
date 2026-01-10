## Multi-ontology JSON-LD in Knowgrph

This document describes how Knowgrph integrates multiple ontologies in a single neutral JSON-LD dataset and how that dataset flows end-to-end through the canvas pipeline, including the markdown-to-graph path that maps architecture documents into JSON-LD graphs.

## Dataset: multi-ontology assessment graph

- Path: `docs/assets/multi-ontology-kg.jsonld`.
- Shape: a compact, domain-agnostic assessment graph that combines:
  - PROV-O (`prov:`) for agents, entities, and activities.
  - MEX (`mex:`) for experiments, executions, and performance records.
  - P-Plan (`pplan:`) for pipeline steps and dependencies.
  - ML Schema (`mls:`) for datasets and models.
  - GeoSPARQL (`geo:`) for competency and performance regions.
  - RO-Crate (`ro:`) for packaging the overall research object.

Key patterns:

- Provenance chain:
  - `prov:Agent` (candidate) → `prov:Entity` (submission) via `prov:wasAttributedTo`.
  - `prov:Activity` nodes for EDA, preprocessing, training, and evaluation linked via `pplan:isPrecededBy`.
  - `prov:wasGeneratedBy` connects training activity to `mls:Model` nodes.
- Experiment tracking:
  - One `mex:Experiment` with three `mex:Execution` nodes (logistic, XGBoost, KNN).
  - Each execution links to a `mex:Performance` node capturing ROC AUC, recall, and FPR as neutral numeric properties.
- Multi-dimensional clustering:
  - `geo:Polygon` nodes describe competency, model performance, and assessment regions using `geo:asWKT`.
  - A separate `geo:Geometry` node represents the candidate’s competency profile and is linked from a neutral annotation entity using `geo:hasGeometry`.
- Research object packaging:
  - A `CreativeWork` node (`ex:ro-crate-root`) lists core artefacts (dataset, experiment, performance nodes) via `hasPart` and declares `ro:conformsTo` with the RO-Crate specification.

All identifiers use the neutral `ex:` prefix (`http://example.org/assessment#`) for local terms and avoid any programme-specific codes.

## Schema-config and graph-data templates

- Schema-config template:
  - Path: `schema-config/knowgrph-schema-config-template.jsonld`.
  - Purpose: neutral starting point for schema-configs that style and layer graphs aligned with `/schema/AgenticRAG`.
- Graph-data template:
  - Path: `schema-config/knowgrph-graph-data-template.jsonld`.
  - Purpose: neutral, multi-ontology JSON-LD graph stub that LLMs and tools can use as a reference when generating Knowgrph-compatible graph data with populated `metadata.ontologies` and `metadata.graphLayers` arrays (with `metadata.polygonLayers` treated as a deprecated alias when present).
- Multi-ontology schema-config:
  - Path: `schema-config/knowgrph-interviewer-schema-config.jsonld`.
  - Purpose: acts as the schema-config for the multi-ontology dataset and remains fully domain-neutral.

Highlights:

- Node styling:
  - `prov:Agent`, `prov:Entity`, and `prov:Activity` receive distinct colors so provenance chains are visually separable.
  - `mex:Experiment`, `mex:Execution`, and `mex:Performance` encode experiment structure and metrics.
  - `mls:Dataset` and `mls:Model` distinguish data from trained models.
  - `pplan:Step` highlights operational pipeline stages.
  - `geo:Polygon` and `geo:Geometry` emphasize spatial regions and candidate profiles.
  - `CreativeWork` marks the RO-Crate root entity.
- Layer behavior:
  - `layers.mode` is set to `"semantic"` so the semantic view is the default.
  - `layers.semantic.hiddenNodeTypes` includes `["geo:Polygon"]` so graph-layer clusters are hidden in semantic mode but remain available in other layers.
  - Similarity configuration (`similarityMetric`, `similarityEdgeLabel`, `minSimilarity`, `topKEdgesPerNode`) uses the same neutral presets as other schema-config examples.

This schema-config does not encode any brand-specific or programme-specific identifiers; it only styles ontology terms.

## Canvas integration and presets

The multi-ontology dataset is wired into the canvas parser workflow using the existing JSON-LD pipeline:

### Preset summary

| Preset ID           | Example ID             | Dataset path                         | Schema-config path                                       | Primary use case                             |
|---------------------|------------------------|--------------------------------------|----------------------------------------------------------|----------------------------------------------|
| `multi-ontology-kg` | `multiOntologyWorkflow`| `docs/assets/multi-ontology-kg.jsonld` | `schema-config/knowgrph-interviewer-schema-config.jsonld` | Multi-ontology assessment knowledge graph    |

- Examples catalog entry:
  - Defined in `canvas/src/features/parsers/examplesCatalog.ts` as `multiOntologyWorkflow`.
  - Dataset path: `docs/assets/multi-ontology-kg.jsonld`.
  - Schema-config path: `schema-config/knowgrph-interviewer-schema-config.jsonld`.
- Workflow preset:
  - Defined in `canvas/src/features/parsers/workflowPresets.ts` with id `multi-ontology-kg`.
  - Uses the JSON-LD parser (`parseJsonLd`) and the above example entry for dataset and schema.
  - Optional `threeOverrides` keep the 3D settings neutral; behavior is entirely driven by the schema-config.

End-to-end flow in canvas:

1. The user selects the “Demo: Multi-ontology Assessment Knowledge Graph” preset.
2. Canvas loads `multi-ontology-kg.jsonld`, parses it with the universal JSON-LD parser, and constructs `GraphData`.
3. The same preset loads `knowgrph-interviewer-schema-config.jsonld` as the active schema-config.
4. The graph renders with:
   - Provenance chains highlighted via `prov:*` types.
   - Experiment executions and performance nodes styled by `mex:*` and `mls:*`.
   - Pipeline stages wired using `pplan:isPrecededBy`.
   - Spatial regions available as `geo:Polygon` nodes that can be toggled via layer configuration.
   - Research-object packaging visible on the `CreativeWork` root node.

This preserves the full multi-ontology structure while keeping the implementation neutral and configuration-driven.

## Schema summary UI for ontologies and graph layers

When a loaded `GraphData` instance exposes `metadata.ontologies` and `metadata.graphLayers` arrays (either populated directly in JSON-LD or derived from markdown frontmatter), the canvas Schema Summary panel surfaces a compact chip:

- Label: `Ontologies: N · Graph layers: M` (only the non-zero side is shown).
- Source of truth:
  - Markdown ingestion: frontmatter keys `ontologies` (array of `{prefix, iri}` objects) and `graphLayers` (string array) flow into `graph_jsonld.metadata.ontologies` and `graph_jsonld.metadata.graphLayers`.
  - JSON-LD ingestion: pre-populated `metadata.ontologies` and `metadata.graphLayers` arrays are used as-is.
- Hover behavior:
  - A tooltip explains that the counts come from markdown frontmatter or JSON-LD `GraphData.metadata` and that the chip links to additional Help copy on multi-ontology graphs and graph layers.
- Click behavior:
  - Clicking the chip opens the main panel Help tab so users can jump into the Help sections that describe semantic/document-structure/property layers and graph-layer behavior for multi-ontology graphs.

This keeps ontology and graph-layer provenance visible at a glance while preserving the configuration-driven contract: counts are derived from `GraphData.metadata` rather than any hardcoded ontology list.

## Markdown architecture documents → multi-ontology graphs

Knowgrph’s markdown pipeline can be used to parse an ontology-integration architecture document into a JSON-LD graph that is compatible with the multi-ontology dataset and schema-config:

- The markdown CLI entrypoint `python -m knowgrph_parser markdown` reads a source `.md` file, builds a structural+semantic JSON-LD graph via `parse_markdown_to_graph_jsonld`, derives a schema-config JSON-LD via `build_schema_config_jsonld`, and emits an orchestrator YAML workflow.
- When the input markdown document describes an ontology integration architecture (for example, a narrative that explains how PROV-O, MEX, P-Plan, ML Schema, GeoSPARQL, and RO-Crate interact), the resulting JSON-LD graph:
  - Uses neutral `Entity`, `Section`, and `Paragraph` nodes plus semantic entities extracted by `semantic_processor`, with no ontology-specific logic embedded in the parser.
  - Records layer hints in `graph_jsonld.metadata.layers` so canvas can project semantic, document-structure, and property views consistently with other datasets.
  - Aligns with `/schema/AgenticRAG` via `graph_jsonld.metadata.agenticRagSchema` and `graph_jsonld.metadata.agenticRagContext`, making it compatible with the same schema-config family used by `multi-ontology-kg.jsonld`.
- In dev mode, Vite exposes a markdown pipeline hook:
  - Canvas constructs a `CODEBASE_INDEX_PIPELINE_COMMAND` that runs the markdown CLI with repo-relative input and output paths.
  - A dev-only endpoint `/__run_markdown_pipeline` executes this command and writes graph, schema, and orchestrator artifacts into `VITE_MARKDOWN_PIPELINE_OUTPUT_DIR`.
  - `runMarkdownPipelineAndLoadArtifacts` then loads these artifacts into the graph store, schema panel, and workflow panel so the architecture narrative can be explored as a graph alongside the multi-ontology JSON-LD dataset.

This keeps the ontology-integration architecture path fully configuration-driven (markdown source path + output directory + AgenticRAG schema URL) and reuses the same neutral semantic and rendering contracts that power the multi-ontology JSON-LD example.

## Extending the pattern for another ontology bundle

To add a new multi-ontology bundle (for example, combining healthcare ontologies) while keeping the implementation neutral and configuration-driven, follow the same pattern used here:

1. Define a new JSON-LD dataset
   - Create a new file under `docs/assets`, for example `docs/assets/healthcare-multi-ontology-kg.jsonld`.
   - Reuse the neutral `ex:` prefix for local terms and connect them to external vocabularies via `@context` (for example, SNOMED CT, FHIR, domain-specific PROV extensions).
   - Keep local IRIs domain-agnostic and stable so downstream tools can rely on them as keys.

2. Create a schema-config for styling and layers
   - Copy `schema-config/knowgrph-interviewer-schema-config.jsonld` into a new file such as `schema-config/knowgrph-healthcare-schema-config.jsonld`.
   - Update:
     - Node type selectors to match the new ontology bundle (for example, patient, encounter, observation types).
     - Colors and shapes to make provenance, clinical events, and spatial regions easy to distinguish.
     - `metadata.layers` so:
       - `layers.mode` defaults to `"semantic"` unless you have a better default for the dataset.
       - `layers.semantic.hiddenNodeTypes` hides purely structural types in semantic mode.
       - `layers.documentStructure` and `layers.property` remain neutral and aligned with the graph.

3. Register the example in the canvas examples catalog
   - Edit `canvas/src/features/parsers/examplesCatalog.ts` and add a new example entry:
     - `id`: a new `ExampleId`, for example `healthcareMultiOntologyWorkflow`.
     - `datasetPath`: `docs/assets/healthcare-multi-ontology-kg.jsonld`.
     - `schemaPath`: `schema-config/knowgrph-healthcare-schema-config.jsonld`.
   - Ensure the new `ExampleId` is added to the `ExampleId` union type so it is available in the UI.

4. Add a workflow preset
   - Edit `canvas/src/features/parsers/workflowPresets.ts` and append a new `WORKFLOW_PRESETS` entry:
     - `id`: a new preset ID, for example `healthcare-multi-ontology-kg`.
     - `label`: short human-readable description for the UI.
     - `parserId`: `toParserId("jsonld")` if the dataset is JSON-LD.
     - `datasetFileName` and `schemaFileName`: use the new example’s `datasetPath` and `schemaPath`.
     - Optionally set `threeOverrides` for dataset-specific 3D defaults while keeping schema-config the primary source of truth.

5. Wire the example to the preset
   - Update `PRESET_ID_BY_EXAMPLE_ID` in `canvas/src/features/parsers/useParserWorkflowState.ts`:
     - Map the new `ExampleId` (for example, `healthcareMultiOntologyWorkflow`) to the new preset ID (for example, `healthcare-multi-ontology-kg`).
   - This keeps the “Apply example” UX aligned with the preset catalog and ensures the correct dataset and schema-config are loaded together.

6. Validate end-to-end
   - Run `npm run lint`, `npm run check`, and `npm run test` from the repo root to verify that:
     - TypeScript types remain consistent for example IDs and presets.
     - Workflow preset tests (including self-consistency checks) pass.
   - Open the canvas, select the new preset, and confirm:
     - The graph loads without parser warnings.
     - Semantic/document-structure/property layers behave as expected.
     - Styling reflects the ontology types rather than any domain-specific brand.

By following these steps, each new ontology bundle remains configuration-driven (JSON-LD dataset + schema-config) and plugs into the existing canvas pipeline without code changes to parsing, layout, or export logic.
