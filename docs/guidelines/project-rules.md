# Project Rules

## Core Principles

**Domain Agnosticism**: Code remains neutral, project-agnostic, dataset-agnostic, metadata-driven | zero hardcoded domain entities | adaptation via configuration only

**Configuration-Driven**: Orchestration through external config | single-responsibility components | structure-semantics separation | provenance tracking

**Single Source of Truth**: Schema-aligned semantics | centralized constants | reusable primitives | performance-by-default

---

## Development Methodology

### Lean Startup Cycle

**Build -> Measure -> Learn**: MVP -> metrics collection -> hypothesis validation -> iterate

**From hypothesis to production**: Team -> defines minimal feature set via user stories -> implements configuration-driven core -> deploys instrumented version with telemetry -> collects metrics through analytics pipeline -> validates hypotheses via statistical analysis -> pivots or perseveres based on thresholds.

### MVP Standards

**Minimum Viable Product**: Smallest feature set validating core hypothesis | delivers user value | enables learning

**Required**:
- [X] Single critical user journey functional
- [X] Configuration-driven (no hardcoding)
- [X] Schema-compliant outputs
- [X] Provenance tracking enabled
- [X] Metrics instrumentation active

### OKR Framework

**Objective Pattern**: Strategic goal -> 3-5 measurable key results -> quarterly tracking -> retrospective analysis

**Key Result Structure**:
```yaml
metric: [quantifiable_measure]
baseline: [current_value]
target: [desired_value]
deadline: [timeframe]
measurement: [data_source]
threshold: 0.8
```

---

## Architecture Standards

### Model Context Protocol (MCP)

**From isolated tools to integrated ecosystem**: MCP -> standardizes interfaces via protocol spec -> enables context sharing through structured messaging -> orchestrates workflows using declarative pipelines -> maintains state with provenance.

**Required**:
- [X] Tools expose MCP-compliant interfaces
- [X] Context propagates with metadata
- [X] Errors cascade with traceability
- [X] Versioning follows semantic rules

### Agentic GraphRAG Pattern

**From queries to knowledge synthesis**: AgenticGraphRAG -> decomposes query via intent parsing -> retrieves subgraphs using traversal algorithms -> reasons over connections through multi-hop inference -> synthesizes response with citation chains -> delivers grounded output with provenance links.

**Components**:
- Query decomposer: parses intent into subqueries
- Graph traverser: retrieves relevant subgraphs via embeddings
- Reasoning engine: performs multi-hop inference with confidence decay
- Response synthesizer: generates output with provenance

### EDA -> LLM Ops Pipeline

**Feedback Loop Architecture**:
```
[Ingestion] -> [EDA] -> [Feature Engineering] -> [Training]
     ↑                                            ↓
[Monitor] <- [Deploy] <- [Evaluate] <- [Validate]
```

**From exploration to production**: Pipeline -> ingests data via schema validators -> profiles statistics through EDA -> engineers features using transformation DAGs -> trains models with hyperparameter tuning -> validates against quality gates -> deploys versioned artifacts -> monitors real-time performance -> feeds insights back to EDA.

**Quality Gates**:
- Data drift: KL divergence < 0.15
- Model performance: F1 > baseline + 5%
- Latency: p99 < 500ms
- Schema compliance: 100%

---

## Code Organization Standards

### Module Boundaries

**Size Limits**: <600 lines per file | <500kB chunks post-minification

**Scope**: Feature-scoped utilities | single-responsibility classes | configuration-driven behavior

**Pattern Template**:

**From [input_state] to [output_state]**: Module -> [processes/transforms/aggregates] [data_type] via [method] -> delivers [artifacts] for [downstream_component].

### Responsibility Flow (S-V-O)

| Stage | Module | Class/Object | Function/Method | Responsibility (S-V-O) | Dependencies | Artifacts/Outputs | Lines |
|-------|--------|--------------|-----------------|------------------------|--------------|-------------------|-------|
| [Name] | `path/module.ext` | `ClassName` | `method_name` | [subject verbs object] | `pkg1`, `pkg2` | [output] | N–M |

---

## Semantic Consistency Standards

**Schema Alignment**: Maintain consistency with `/schema/AgenticRAG` across API identifiers, catalogs, components, file names, handlers, hooks, LocalStorage keys (`LS_KEY_*`), settings, state fields, store selectors

**Copy Centralization**: Repeated phrases -> copy helpers (`COPY_*`) -> single source of truth -> error/empty states

---

## Performance & Quality Requirements

**Optimization**: Batching | caching | chunking | memoization | sharding | virtualization

**Metrics**: precision, recall, coverage, processing_time, resource_utilization

**Triggers**: [metric < threshold] -> [reprocess | review | retrain]

---

## Anti-Patterns (Forbidden)

- Hardcoded domain assumptions, project-specific presets, dataset paths  
- Duplicate/stale/unreferenced code, memory leaks, race conditions  
- Multiple responsibilities per component, unidirectional provenance  
- Files >600 lines, chunks >500kB, non-configurable thresholds

---

## Validation Checklist

**Pre-Deployment** (Required):
- [ ] Zero hardcoded domain entities
- [ ] MVP criteria satisfied, OKRs defined
- [ ] MCP interfaces implemented
- [ ] Provenance links bidirectional
- [ ] Feedback loops instrumented
- [ ] Lint + typecheck passed
- [ ] Schema compliance validated

**Post-Deployment** (Continuous):
- [ ] Monitor OKRs weekly
- [ ] Review pipeline metrics daily
- [ ] Iterate via Lean Startup cycle