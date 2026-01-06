# Documentation Template: Universal System Specification

## System Architecture

**Processing Flow**: [Stage1] -> [Stage2] -> [Stage3] -> [Stage4] -> [StageN]

**Data Transformations**: [input_format] -> [intermediate_format] -> [output_format]

**Design Principles**: Configuration-driven orchestration | single-responsibility components | structure-semantics separation | provenance tracking

---

## Stage Specification Template

### Stage: [StageName]

**From [input_state] to [output_state]**: Stage -> [processes/transforms/aggregates] [data_type] via [method] -> delivers [artifacts] for [downstream_stage].

**Configuration Schema**:
```yaml
parameter_name:
  from: [low_state]
  to: [high_state]
  action: [stage behavior based on parameter]
  controls: [aspect]
  affects: [quality dimension]
  default: value
  min: value
  max: value
  interval: step
  impact: [15-word description]
```

**Processing Pattern**: [Universal operation] -> input [features] -> output [structure] -> O(complexity)

---

## Responsibility Flow Table

**Principles**:
- one-row-one-responsibility
- Classes/Objects-Functions/Methods-Responsibility maps to Subject–Verb–Object (S‑V‑O) phrasing

| Stage | Module | Class/Object | Function/Method | Responsibility (S-V-O) | Dependencies | Artifacts/Outputs | Lines |
|-------|--------|--------------|-----------------|------------------------|--------------|-------------------|-------|
| [Name] | `path/module.ext` | `ClassName` | `method_name` | [subject verbs object] | `pkg1`, `pkg2` | [output] | N‑M |
| [Name] | `path/module.ext` | — | `function_name` | [subject verbs object] | `pkg1` | [output] | N‑M |

**Example Rows**:
| Stage | Module | Class/Object | Function/Method | Responsibility (S-V-O) | Dependencies | Artifacts/Outputs | Lines |
|-------|--------|--------------|-----------------|------------------------|--------------|-------------------|-------|
| Transform | `src/transformer.py` | `DataTransformer` | `apply_operation` | applies transformation rules to input data | `numpy`, `pandas` | Transformed dataset | 45‑62 |
| Validation | `src/validator.py` | — | `check_schema` | validates structural integrity of data objects | `jsonschema` | Validation report | 18‑29 |

---

## Provenance & Traceability Standards

**Source Tracking**: 
- Entities track origin via `metadata.sourcePath`
- Preserve location metadata (`lineStart`, `lineEnd`, `structure_type`)
- Maintain bidirectional links for traversal

**Confidence Propagation**: 
- Compute scores via [method]
- Apply threshold tuning mechanisms
- Decay for inferred relationships (multiply by 0.8)
- Track confidence through multi-hop operations

**Method Tracking**: 
- Label with `extraction_method` or `processing_type`
- Enable quality analysis by method
- Support selective reprocessing

---

## Quality Metrics Framework

**Accuracy Metrics**: precision, recall, coherence, consistency

**Completeness Metrics**: coverage, duplicate_rate, conflict_resolution_rate

**Efficiency Metrics**: processing_time, resource_utilization, traversal_efficiency

**Triggers**: [metric < threshold] -> [reprocess | review | retrain]

---

## Anti-Patterns (Forbidden)

❌ Hardcoded domain-specific assumptions in code  
❌ Non-configurable static thresholds  
❌ Mixed structural and semantic validation  
❌ Unidirectional provenance links  
❌ Multiple responsibilities per component  

---

## Validation Checklist

**Structural Validation** (Required):
- [ ] Required fields present
- [ ] Referential integrity maintained
- [ ] Data types conform to schema
- [ ] Provenance links bidirectional

**Domain Blindness** (Required):
- [ ] Zero hardcoded domain entities
- [ ] Configurable thresholds externalized
- [ ] Processes 3+ domains without code changes
- [ ] Adaptation via configuration only

**Maintenance** (Required):
- [ ] Schema versioning (`MAJOR.MINOR.PATCH`)
- [ ] Audit logging (parameters, decisions, thresholds)
- [ ] Rollback procedures documented
- [ ] Reproducibility enabled via logs

---

## Schema Evolution

**Versioning Strategy**: Semantic versioning + `schema_version` metadata

**Compatibility Rules**:
- ✅ Optional field additions allowed
- ❌ Required field additions forbidden without migration
- ✅ Deprecation warnings for 2 versions

**Migration**: Provide transformation scripts for breaking changes

---

## Export & Integration Formats

[Format1]: [use_case] | [Format2]: [use_case] | [FormatN]: [use_case]