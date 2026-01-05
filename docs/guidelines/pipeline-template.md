# Pipeline Documentation Template

## Architecture Overview

**Layer Flow**: Detection -> Schema Inference -> Ingestion -> Parsing -> Orchestration -> Rendering -> Agentic RAG

**Data Structures**: Raw documents -> Parsed nodes -> Unified graph -> Query results

## Pipeline Specification

### Stage Definition Template

**Stage Name**: [Detection | Schema Inference | Ingestion | Parsing | Orchestration | Rendering | Agentic RAG]

**From [input state] to [output state]**: Stage -> [processes/transforms/aggregates] -> delivers [artifacts] for [downstream stage].

**Configuration Schema**:
```yaml
parameter_name:
  from: [low_state]
  to: [high_state]
  action: [stage action based on parameter]
  controls: [aspect]
  affects: [quality dimension]
  default: value
  min: value
  max: value
  interval: step
  impact: [15-word description]
```

**Algorithm Pattern**: [Describe using universal operations] -> specify inputs/outputs -> document complexity.

## Responsibility Flow Table

**Principles**:
- one-row-one-responsibility
- Classes/Objects-Functions/Methods-Responsibility maps to Subject–Verb–Object (S‑V‑O) phrasing (e.g. `FeatureEngineer.create_domain_age_bins()` generates domain age risk bins)

| Pipeline Stage | Modules | Classes/Objects | Functions/Methods | Responsibility | Dependencies / Imports | Data Artifacts / Outputs | Line Range |
|----------------|---------|-----------------|-------------------|----------------|------------------------|--------------------------|------------|
| [Stage Name] | `path/to/module.py` | `ClassName` | `method_name` | [S-V-O description] | `package1`, `package2` | [output artifacts] | 10‑25 |
| [Stage Name] | `path/to/module.py` | — | `function_name` | [S-V-O description] | `package1` | [output artifacts] | 26‑40 |

**Example Rows**:
| Pipeline Stage | Modules | Classes/Objects | Functions/Methods | Responsibility | Dependencies / Imports | Data Artifacts / Outputs | Line Range |
|----------------|---------|-----------------|-------------------|----------------|------------------------|--------------------------|------------|
| Feature Engineering | `src/feature_engineering.py` | `FeatureEngineer` | `create_domain_age_bins` | generates domain age risk bins | `numpy`, `pandas` | Engineered DataFrame | 18‑24 |
| Preprocessing | `src/preprocessing.py` | `Preprocessor` | `fit_transform` | fits preprocessing and produces X, y arrays | `numpy`, `pandas` | X, y arrays | 70‑83 |

## Provenance Standards

- **Bidirectional linking**: Nodes track source via `metadata.documentPath`, line ranges (`lineStart`, `lineEnd`), structure_type annotation
- **Confidence propagation**: Score computation methods, threshold tuning, decay for inferred relationships (×0.8)
- **Extraction tracking**: Label with `extraction_method` (dependency_parsing, pattern_mining, user_curated)

## Quality Metrics

- **Extraction**: precision, recall, entity_coherence, mention_consistency
- **Unification**: merge_precision, duplicate_rate, conflict_resolution_rate
- **Query**: answer_relevance, citation_coverage, traversal_efficiency

## Validation Checklist

- Required fields present (structural only)
- Referential integrity maintained
- Zero hardcoded domain entities
- Configuration-only adaptation possible
- Processes 3+ domains without code changes