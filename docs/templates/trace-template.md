# Trace Template: Universal Lineage Specification

## Trace Architecture

**Trace Flow**: [Origin] -> [Transformation] -> [Derivation] -> [Consumption] -> [Audit]

**Lineage Transformations**: [source_artifact] -> [intermediate_artifact] -> [derived_artifact]

**Design Principles**: Bidirectional traceability | immutable audit logs | causal chain preservation | temporal consistency

---

## Trace Specification Template

### Trace: [TraceName]

**From [source_entity] to [derived_entity]**: Trace -> [captures/records/links] [lineage_data] via [method] -> delivers [provenance_artifacts] for [downstream_audit].

**Trace Schema**:
```yaml
trace_identifier:
  source: [entity_id]
  target: [entity_id]
  relationship: [derived_from | generated_by | influenced_by]
  method: [extraction | transformation | aggregation | inference]
  confidence: 0.95
  timestamp: [ISO8601]
  metadata: {key: value}
  decay_factor: 0.8
  hops: [distance_from_source]
  impact: [15-word description]
```

**Trace Pattern**: [Lineage operation] -> input [source_metadata] -> output [trace_link] -> O(complexity)

---

## Lineage Flow Table

**Principles**:
- one-row-one-trace-link
- Source-Operation-Target maps to Origin—Transform—Destination (O–T–D) structure

| Trace ID | Source Entity | Operation | Target Entity | Method | Confidence | Hops | Timestamp | Metadata |
|----------|---------------|-----------|---------------|--------|------------|------|-----------|----------|
| TRC-[001] | `entity:id1` | derived_from | `entity:id2` | extraction | 0.95 | 1 | [ISO8601] | {type: direct} |
| TRC-[002] | `entity:id3` | generated_by | `process:p1` | transformation | 0.85 | 2 | [ISO8601] | {decay: 0.8} |

**Example Rows**:
| Trace ID | Source Entity | Operation | Target Entity | Method | Confidence | Hops | Timestamp | Metadata |
|----------|---------------|-----------|---------------|--------|------------|------|-----------|----------|
| TRC-042 | `doc:report.pdf` | derived_from | `data:raw.csv` | aggregation | 0.92 | 1 | 2025-01-05T10:23:45Z | {tool: analyzer} |
| TRC-043 | `model:v2.3` | generated_by | `pipeline:train` | inference | 0.78 | 3 | 2025-01-05T11:15:22Z | {decay: 0.512} |

---

## Provenance & Traceability Standards

**Source Tracking**:
- Entities track origin via `trace.metadata.sourcePath`
- Preserve location metadata (`lineStart`, `lineEnd`, `version`, `commit_hash`)
- Maintain bidirectional links for forward/backward traversal

**Confidence Propagation**:
- Compute scores via probabilistic chain rule: `P(target|source) = Π confidence_i`
- Apply threshold tuning: `confidence_threshold = 0.7`
- Decay for multi-hop relationships: `confidence_final = confidence_base × (decay_factor ^ hops)`
- Track confidence through transitive operations

**Method Tracking**:
- Label with `extraction_method` (automated | manual | AI-assisted | hybrid)
- Enable quality analysis by method type
- Support selective reprocessing by method confidence
- Flag low-confidence traces for human review

**Temporal Consistency**:
- Enforce causal ordering: `timestamp_target ≥ timestamp_source`
- Detect retroactive modifications via version control
- Maintain immutable audit trail
- Support temporal queries (state at time T)

---

## Quality Metrics Framework

**Accuracy Metrics**: trace_precision, trace_recall, link_validity, false_positive_rate

**Completeness Metrics**: coverage_ratio, orphan_entity_count, missing_link_rate

**Efficiency Metrics**: traversal_time, query_latency, graph_density, memory_footprint

**Triggers**: [metric < threshold] -> [recompute traces | validate manually | retrain linker]

---

## Anti-Patterns (Forbidden)

❌ Unidirectional traces (forward-only or backward-only)  
❌ Missing confidence scores for derived relationships  
❌ Hardcoded lineage assumptions in code  
❌ Temporal inconsistencies (effect precedes cause)  
❌ Orphaned entities without source attribution  
❌ Circular dependencies in lineage graph  
❌ Non-versioned trace schemas  

---

## Validation Checklist

**Structural Validation** (Required):
- [ ] All entities have unique identifiers
- [ ] Trace links bidirectional (source ↔ target)
- [ ] Confidence scores in range [0.0, 1.0]
- [ ] Timestamps in ISO8601 format

**Graph Validation** (Required):
- [ ] No circular dependencies detected
- [ ] No orphaned entities (all have sources or marked as root)
- [ ] Transitive relationships computed correctly
- [ ] Graph remains acyclic (DAG structure)

**Temporal Validation** (Required):
- [ ] Causal ordering preserved (cause before effect)
- [ ] Version consistency maintained
- [ ] Retroactive changes flagged and audited
- [ ] Temporal queries return consistent results

**Quality Validation** (Required):
- [ ] Confidence decay applied for multi-hop paths
- [ ] Method tracking enabled for all traces
- [ ] Audit logs immutable and tamper-evident
- [ ] Low-confidence traces flagged for review

---

## Schema Evolution

**Versioning Strategy**: Semantic versioning + `trace_schema_version` metadata

**Compatibility Rules**:
- ✅ Optional metadata field additions allowed
- ❌ Required field additions forbidden without migration
- ✅ Backward-compatible confidence calculation changes
- ❌ Breaking changes to trace identifier format

**Migration**: Provide transformation scripts for schema upgrades with trace preservation

---

## Export & Integration Formats

**Graph Formats**: JSON-LD (semantic web) | GraphML (visualization) | RDF (triple store) | Cypher (Neo4j)

**Audit Formats**: CSV (tabular) | Parquet (analytics) | JSONL (streaming) | Proto (serialization)

---

## Trace Query Patterns

### Pattern: AncestorQuery

**From [target_entity] to [all_ancestors]**: Query -> traverses backward links via depth-first search -> collects source entities with confidence scores -> filters by threshold and hops -> delivers ancestry tree for [impact_analysis].

### Pattern: DescendantQuery

**From [source_entity] to [all_descendants]**: Query -> traverses forward links via breadth-first search -> aggregates derived entities with decay factors -> ranks by confidence -> delivers lineage tree for [dependency_analysis].

### Pattern: PathQuery

**From [entity_A] to [entity_B]**: Query -> computes all paths via graph traversal -> ranks by cumulative confidence -> identifies shortest/strongest paths -> delivers path set for [causality_analysis].

**Query Configuration**:
```yaml
query_parameters:
  max_hops: 5
  min_confidence: 0.7
  traversal_order: [dfs | bfs | dijkstra]
  include_metadata: true
  decay_propagation: true
  temporal_filter: {after: ISO8601, before: ISO8601}
```

---

## Confidence Computation Algorithms

**Direct Link Confidence**:
```python
confidence = extraction_score × validation_score × recency_weight
recency_weight = exp(-λ × age_in_days)  # λ = 0.01
```

**Multi-Hop Confidence**:
```python
path_confidence = Π(confidence_i × decay_factor^(i-1))
decay_factor = 0.8  # configurable per domain
```

**Aggregated Confidence** (multiple paths):
```python
aggregated = 1 - Π(1 - path_confidence_i)  # independent paths
```

---

## Trace Lifecycle Management

### Stage: TraceCapture

**From [execution_event] to [trace_record]**: Capture -> intercepts system event via instrumentation hooks -> extracts provenance metadata using context inspection -> validates structure against schema -> persists immutable record to trace store -> delivers trace link for [query_engine].

### Stage: TraceEnrichment

**From [raw_trace] to [enriched_trace]**: Enrichment -> retrieves additional context via metadata lookup -> computes derived attributes using analytical functions -> infers implicit relationships through heuristics -> updates confidence scores with new evidence -> delivers enhanced trace for [lineage_graph].

### Stage: TraceCompaction

**From [detailed_traces] to [summarized_lineage]**: Compaction -> identifies redundant traces via equivalence analysis -> merges duplicate links using consensus algorithms -> prunes low-confidence edges below threshold -> compresses metadata for storage efficiency -> delivers optimized graph for [production_use].

---

## Audit & Compliance Support

**Regulatory Requirements**:
- GDPR: Right to explanation (Article 22)
- HIPAA: Audit trail requirements
- SOX: Data lineage documentation
- FDA 21 CFR Part 11: Electronic records traceability

**Audit Pattern**:

**From [compliance_query] to [audit_report]**: Auditor -> selects entity scope via filters -> traces full lineage using bidirectional traversal -> validates completeness against requirements -> generates evidence report with timestamps -> delivers audit artifacts for [compliance_review].

**Compliance Schema**:
```yaml
audit_record:
  entity_id: [identifier]
  access_log: [{timestamp, user, action}]
  lineage_complete: true
  retention_period: [days]
  legal_hold: false
  attestation: {reviewer, date, signature}
```

---

## Performance Optimization

**Indexing Strategy**:
- B-tree index on `entity_id` for point queries
- Graph index on `source` + `target` for traversal
- Temporal index on `timestamp` for time-range queries
- Composite index on `confidence` + `method` for filtering

**Caching Strategy**:
- Cache frequently queried paths (TTL: 1 hour)
- Materialize ancestor/descendant trees for hot entities
- Pre-compute confidence scores for common hops
- Invalidate cache on trace updates

**Partitioning Strategy**:
- Time-based partitioning: traces by month
- Entity-based sharding: hash(`entity_id`)
- Method-based separation: automated vs. manual traces