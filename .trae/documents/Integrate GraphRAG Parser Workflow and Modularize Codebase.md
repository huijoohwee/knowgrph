## Goals
- Add end-to-end GraphRAG support: ingestion → parsing → embeddings representation → graph construction.
- Use Python scripts for pipeline orchestration; JSON/YAML for schema and parser configs.
- Modularize feature code to keep files ≤600 lines while preserving public API, enforce SRP.
- Remove stale/duplicate/hardcoded logic; improve caching/memoization and fix re-render/infinite-loop risks.

## Architecture Changes
- Introduce a GraphRAG data lane alongside existing CSV/JSON/JSON-LD/n8n adapters.
- Define a canonical mapping from GraphRAG outputs (chunks, entities, relationships, embeddings) into existing `GraphData` schema.
- Keep embedding generation out of frontend; only ingest and visualize embeddings metadata produced by the pipeline.

## Python Pipeline
- Create `scripts/graphrag_pipeline.py` to:
  - Initialize and run GraphRAG on a dataset using a YAML config.
  - Emit canonical outputs under `data/graphrag/`:
    - `graph.json` (nodes/edges with types and properties)
    - `embeddings.json` (per-chunk vectors + model metadata)
    - `a0.csv` and `a0.jsonld` (converted for existing exporters)
  - Reuse/extend `scripts/pipeline.py` to normalize GraphRAG JSON into A0 CSV and JSON-LD.
  - Convert JSON-LD → RDF/Turtle via `scripts/jsonld_to_rdf.py`.
- Add YAML config examples:
  - `configs/graphrag/config.yaml` (dataset paths, chunking, embedding model, graph construction strategy, costs cautions)
  - `configs/graphrag/prompts.yaml` (prompt tuning hooks per GraphRAG guidance)
- CLI usage:
  - `python scripts/graphrag_pipeline.py --config configs/graphrag/config.yaml --input data/raw/` 
  - Note: indexing can be expensive; start small and iterate.

## Frontend Parser Integration
- Add a new adapter in `canvas/src/lib/graph/io/adapter.ts` to detect and route `GraphRAG` JSON bundles.
- Implement `GraphRagParser` in `canvas/src/features/parsers/default.ts` (or `features/parsers/graphrag/index.ts`) to:
  - Read `graph.json` and `embeddings.json` produced by the pipeline.
  - Map GraphRAG entities/relationships/chunks to `GraphData` nodes/edges.
  - Attach embedding metadata on nodes (model, dim, vector id); vectors remain pipeline-side.
- Extend transform DSL (`features/parsers/transform.ts`) with helpers for GraphRAG structures:
  - Path helpers for `entities[*].mentions[*]`, `relationships[*]`, `chunks[*]`.
  - Aggregations to roll up chunk-level signals (e.g., confidence, source doc ids).
- Update worker `canvas/src/workers/graphParser.worker.ts` to include GraphRAG parsing off-main-thread.

## Schema & Configs
- Define parser config schema JSON at `canvas/public/parser-dsl.schema.json` to validate custom GraphRAG mappings.
- Extend `canvas/src/lib/graph/schema.ts` with typed categories for GraphRAG nodes/edges (Entity, Relationship, Chunk, EmbeddingMeta) and default styles.
- Provide example config bundle for users:
  - `canvas/public/examples/graphrag-demo/graph.json`
  - `canvas/public/examples/graphrag-demo/embeddings.json`
  - `canvas/public/examples/graphrag-demo/config.yaml`

## Refactoring & Modularization
- Split large feature files to keep ≤600 lines without changing external API:
  - `GraphCanvas.tsx` → `canvas`, `zoom`, `drag`, `simulation`, `fit` already exist; further extract render segments and effect hooks into `GraphCanvas/render.tsx` and `GraphCanvas/effects.ts`.
  - `schema.ts` → extract `schema/styles.ts`, `schema/layout.ts`, `schema/validation.ts` keeping a re-export facade.
  - `parsers/transform.ts` → split into `resolver.ts`, `aggregations.ts`, `mapping.ts`.
  - `parsers/registry.ts` → move persistence and cache into `persistence.ts` and `cache.ts` with a thin registry.
- Feature-scoped modules structure:
  - `features/parsers/graphrag/*`
  - `lib/graph/schema/*`
  - Maintain barrel files to preserve import paths.

## Performance & Caching
- Parsing cache:
  - Use content hash + parser id + config hash keys.
  - Replace simple object cache with LRU (cap by entries and memory); prefer `Map` + size accounting and `WeakRef` for large payloads.
- Memoization:
  - Memoize transform resolutions; invalidation on input or schema changes.
  - Ensure worker results cached per message to avoid redundant parse.
- Render performance:
  - Audit Zustand slices to prevent update storms; batch setState and guard selectors to avoid unnecessary re-renders.
  - Ensure D3 simulation controls are idempotent; stop sim on unmount to avoid leaks.
- Resource safety:
  - Terminate workers on route/slice disposal; debounce expensive operations.
  - Add guards for potential infinite loops in derived selectors and effects.

## Testing & Verification
- Unit tests:
  - Adapter detection for GraphRAG bundles.
  - GraphRagParser mapping correctness (entities, relationships, chunks, embedding metadata).
  - Transform helpers for GraphRAG paths and aggregations.
- Integration tests:
  - End-to-end: sample raw documents → pipeline → `graph.json` → frontend ingestion → rendered graph; verify node/edge counts and key properties.
  - Ensure n8n ingestion remains unchanged.
- Performance tests:
  - Cache hit/miss scenarios; measure parse latency and memory footprint under typical datasets.
- RDF verification:
  - Validate JSON-LD and produced Turtle with `rdflib` checks.

## Documentation & Migration
- Update `README.md` with GraphRAG setup, pipeline steps, and cost cautions.
- Add a migration note: run `graphrag init --root <path> --force` on minor version bumps; back up configs/prompts.
- Provide examples and troubleshooting for common pipeline issues.

## Risks & Rollback
- Indexing cost: advise sampling and staged runs; provide small demo dataset.
- Format drift: pin GraphRAG output versions; add schema validation gates.
- Rollback plan: retain current parsers/adapters and feature flag GraphRAG lane; easy disable if issues arise.

## Next Steps
- Implement Python pipeline and YAML configs.
- Add GraphRAG adapter and parser with transform helpers.
- Modularize large files with re-export facades to preserve API.
- Ship tests and docs; verify end-to-end on a demo dataset.