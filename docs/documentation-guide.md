## Documentation Philosophy: From Intent to Execution

- **From principles to practice**: Documentation captures semantic orchestration architecture → explains component responsibilities without hardcoding examples → provides configuration schemas with intent-directive annotations → enables implementers to adapt pipeline to any domain → maintains separation between structure and semantics.

## Required Documentation Sections

- **Architecture overview**: Define layer flow (Detection → Schema Inference → Ingestion → Parsing → Orchestration → Rendering → Agentic RAG) → specify component names and single responsibilities → document data structures flowing between layers → avoid coupling to specific datasets or project names.

- **Component specifications**: For each module, provide intent-directive (From X to Y: Component → actions → outcome) → list subject-verb-object directives → define input/output schemas → specify configuration parameters with key-value semantics (Default, Min, Max, Interval, impact description) → document algorithm patterns without domain assumptions.

- **Configuration reference**: Document all adaptive thresholds with impact explanations → specify tuning sensitivity ranges → explain feedback loop triggers → provide default values derived from statistical principles, not project-specific tuning → enable reproducibility through parameter logging.

- **Validation guidelines**: Provide structural validation checklists (required fields, referential integrity) → explicitly state non-validated semantic aspects → include zero-hardcoding audit questions → document domain-agnostic validation patterns.

## Component Documentation Template

- **From [input state] to [output state]**: Component name → detects/extracts/computes/merges/infers [specific actions using statistical or NLP methods] → [transformation steps] → delivers [output artifacts with provenance] for [downstream use case].

- **Subject-verb-object directives**: List atomic operations (component verbs input_type, component computes metric_via_method, component validates constraint) → avoid compound actions → maintain single responsibility per directive.

- **Configuration schema**: Parameter name → From [low state] to [high state]: Component → [action based on parameter] → [controls aspect] → [affects downstream quality dimension]. Default: value; Min: value; Max: value; Interval: step; [Impact description in 15 words].

-**Algorithm pattern**: Describe computation using universal operations (clustering, similarity computation, path finding) → specify input features and output structures → avoid referencing specific entity types or domains → document complexity and scalability characteristics.

## Provenance Documentation Standards

- **Bidirectional linking**: Document how nodes track source documents via metadata.documentPath → explain line range preservation (lineStart, lineEnd) → specify structure_type annotation (Paragraph, List, CodeBlock, Section, Table) → clarify that parsers extract semantics while metadata preserves formatting context.

- **Confidence propagation**: Document confidence score computation methods (syntactic path length, embedding coherence) → explain threshold tuning mechanisms → specify confidence decay for inferred relationships (transitive edges multiply parent confidences by 0.8) → track confidence through multi-hop reasoning.

- **Extraction method tracking**: Label each node/edge with extraction_method (dependency_parsing, pattern_mining, user_curated) → enable quality analysis by method → support selective re-extraction when algorithms improve.

## Quality Metrics Documentation

- **Extraction metrics**: Define precision (correct extractions / total extractions), recall (correct extractions / gold standard), entity coherence (1 - intra-cluster variance), mention consistency (successful coreferences / total pronouns) → specify computation methods → document feedback loop triggers.

- **Unification metrics**: Define merge precision, duplicate rate, conflict resolution rate, cross-document coverage → explain aggregation across corpus → specify quality thresholds for reprocessing triggers.

- **Query metrics**: Define answer relevance, citation coverage, traversal efficiency, follow-up relevance → explain LLM-based evaluation where applicable → document A/B testing frameworks for threshold optimization.

## Anti-Pattern Documentation

- **Forbidden patterns**: Explicitly list violations (hardcoded project names, domain-specific entity types in code, static thresholds without configuration, validation of property semantics in schema) → provide refactoring guidance → include before/after examples showing abstract feature replacement.

- **Testing requirements**: Document domain blindness test (can component process medical, legal, financial content without code changes) → specify minimum corpus diversity for validation (3+ domains) → require configuration-only adaptation demonstration.

## Schema and API Documentation

- **JSON-LD contract**: Document required fields (@id, labels, source, target) → specify optional fields (properties, chunk_text, embedding, geo, metadata) → explain @context usage and vocabulary mapping → provide structural validation rules without semantic constraints.

- **Query interface**: Document intent classification mapping (FACTOID → single-node lookup, CAUSALITY → directed path search) → specify traversal strategy selection logic → explain adaptive depth adjustment algorithm → provide query result structure with provenance.

- **Export formats**: Document transformation from internal GraphData to JSON-LD, DuckDB, Neo4j Cypher, GraphML → specify field mappings → explain metadata preservation across formats → provide format selection criteria based on downstream tools.

## Maintenance Documentation

- **Feedback loop monitoring**: Document metric collection intervals → specify parameter adjustment magnitudes → explain convergence detection → provide rollback procedures for degraded performance → log all tuning iterations for reproducibility.

- **Schema evolution**: Document versioning strategy (semantic versioning for schemas, metadata.schema_version in graphs) → specify backward compatibility requirements (optional field additions allowed, required field additions forbidden) → provide migration scripts for breaking changes.

- **Audit trail requirements**: Document what to log (extraction parameters, confidence thresholds, entity merge decisions, conflict resolutions) → specify retention periods → explain privacy considerations for source document metadata → enable reproducible pipeline execution from logs.
