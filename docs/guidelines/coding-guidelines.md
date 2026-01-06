# Coding Guidelines

## Core Principles

**Implementation-Driven**: Pseudocode specification → production code | S-V-O responsibility mapping | configuration-first | provenance-embedded

**Neutrality-First**: Zero hardcoded domains | schema-driven interfaces | metadata-parameterized behavior | single-responsibility modules

---

## Responsibility-Based Implementation

### Mapping Code to S-V-O Table

**Pattern**: Each function implements exactly one responsibility row

```
FUNCTION PatternDetector.extract_features({ entities, config }) -> { feature_vectors }
  // PatternDetector extracts feature vectors via embedding model
  
  vectors <- []
  FOR EACH entity IN entities:
    vector <- compute_embedding(entity, config.embedding_model)
    vectors.append({
      entity_id: entity.id,
      vector: vector,
      provenance: build_provenance(entity, "extract_features")
    })
  
  RETURN vectors
END
```

**Table Row**:

| Module | Class/Object | Function/Method | Responsibility (S-V-O) | Dependencies | Artifacts/Outputs |
|--------|--------------|-----------------|------------------------|--------------|-------------------|
| `detection/pattern.ext` | `PatternDetector` | `extract_features` | PatternDetector extracts feature vectors via embedding model | `config.embedding_model` | `FeatureVector[]` |

---

## Configuration-Driven Implementation

### External Config Pattern

```
FUNCTION RelationshipBuilder.compute_similarity({ pairs, config }) -> { scored_pairs }
  // RelationshipBuilder scores entity pairs via similarity metric
  
  threshold <- config.similarity_threshold  // From config
  metric <- config.metrics[config.active_metric]  // From config
  
  scored <- []
  FOR EACH pair IN pairs:
    score <- metric.compute(pair.source, pair.target)
    
    IF score >= threshold:
      scored.append({
        pair: pair,
        score: score,
        provenance: { method: metric.name, timestamp: now() }
      })
  
  RETURN scored
END
```

**Table Row**:

| Module | Class/Object | Function/Method | Responsibility (S-V-O) | Dependencies | Artifacts/Outputs |
|--------|--------------|-----------------|------------------------|--------------|-------------------|
| `graph/relationships.ext` | `RelationshipBuilder` | `compute_similarity` | RelationshipBuilder scores entity pairs via similarity metric | `config.metrics`, `config.threshold` | `ScoredPair[]` |

### Anti-Pattern (FORBIDDEN)

```
FUNCTION RelationshipBuilder.compute_similarity({ pairs }) -> { scored_pairs }
  threshold <- 0.85  // WRONG: Hardcoded magic number
  
  IF pairs[0].type == "Person":  // WRONG: Domain-specific branch
    RETURN process_person_pairs(pairs)
  // ...
END
```

---

## Schema-Aligned Implementation

### Type Definitions from Schema

```
FUNCTION GraphBuilder.create_relationship({ source, target, config }) -> { relationship }
  // GraphBuilder constructs typed relationships via schema definitions
  
  // Preconditions
  ASSERT source IN config.schema.entity_types
  ASSERT target IN config.schema.entity_types
  
  rel_type <- config.schema.relationship_types[source.type][target.type]
  
  relationship <- {
    id: generate_id(),
    source: source.id,
    target: target.id,
    type: rel_type,  // Schema-driven
    confidence: compute_confidence(source, target, config),
    provenance: track_lineage(source, target)
  }
  
  // Postcondition
  ASSERT relationship.type IN config.schema.valid_types
  
  RETURN relationship
END
```

**Table Row**:

| Module | Class/Object | Function/Method | Responsibility (S-V-O) | Dependencies | Artifacts/Outputs |
|--------|--------------|-----------------|------------------------|--------------|-------------------|
| `graph/builder.ext` | `GraphBuilder` | `create_relationship` | GraphBuilder constructs typed relationships via schema definitions | `config.schema`, `EntityType` | `Relationship{}` |

---

## Provenance & Metrics Embedding

### Required Metadata Tracking

```
FUNCTION FeatureEngineer.transform_features({ raw_data, config }) -> { transformed }
  // FeatureEngineer transforms raw data through configured pipeline
  
  start_time <- current_time()
  
  // Stage 1: Extract
  extracted <- extract_raw_features(raw_data, config.extractors)
  metrics.increment("features.extracted", count(extracted))
  
  // Stage 2: Normalize
  normalized <- normalize_features(extracted, config.normalization)
  
  // Stage 3: Encode
  encoded <- encode_categorical(normalized, config.encoding_strategy)
  
  duration <- current_time() - start_time
  metrics.histogram("features.transform.duration_ms", duration)
  
  RETURN {
    features: encoded,
    provenance: {
      source_count: count(raw_data),
      pipeline: ["extract", "normalize", "encode"],
      duration_ms: duration,
      config_version: config.version,
      timestamp: iso_timestamp()
    }
  }
END
```

**Table Rows** (Multi-Stage):

| Module | Class/Object | Function/Method | Responsibility (S-V-O) | Dependencies | Artifacts/Outputs |
|--------|--------------|-----------------|------------------------|--------------|-------------------|
| `features/engineer.ext` | `FeatureEngineer` | `extract_raw_features` | FeatureEngineer extracts raw features via configured extractors | `config.extractors` | `RawFeature[]` |
| `features/engineer.ext` | `FeatureEngineer` | `normalize_features` | FeatureEngineer normalizes distributions using normalization strategy | `config.normalization` | `NormalizedFeature[]` |
| `features/engineer.ext` | `FeatureEngineer` | `encode_categorical` | FeatureEngineer encodes categorical values through encoding strategy | `config.encodingStrategy` | `EncodedFeature[]` |

---

## Validation Patterns

### Precondition/Postcondition Guards

```
FUNCTION SchemaValidator.check_compliance({ data, schema }) -> { validation_result }
  // SchemaValidator validates data structure against schema definitions
  
  // Preconditions
  ASSERT data IS NOT NULL
  ASSERT schema.required_fields EXISTS
  
  errors <- []
  
  // Validate required fields
  FOR EACH field IN schema.required_fields:
    IF field NOT IN data:
      errors.append({ field: field, error: "missing_required" })
  
  // Validate types
  FOR EACH field IN data.keys():
    expected_type <- schema.fields[field].type
    IF NOT validate_type(data[field], expected_type):
      errors.append({ field: field, error: "type_mismatch" })
  
  result <- { valid: is_empty(errors), errors: errors }
  
  // Postcondition
  ASSERT result.valid == is_empty(errors)
  
  RETURN result
END
```

**Table Row**:

| Module | Class/Object | Function/Method | Responsibility (S-V-O) | Dependencies | Artifacts/Outputs |
|--------|--------------|-----------------|------------------------|--------------|-------------------|
| `validation/schema.ext` | `SchemaValidator` | `check_compliance` | SchemaValidator validates data structure against schema definitions | `schema.required_fields`, `schema.fields` | `ValidationResult{}` |

---

## Anti-Patterns (BLOCKERS)

**Hardcoded Domain Logic**:
```
// FORBIDDEN
IF entity.domain == "healthcare":
  special_processing()

categories <- ["A", "B", "C"]  // Domain assumption
```

**Missing Configuration**:
```
// FORBIDDEN
threshold <- 0.8  // Should be config.threshold
api_url <- "https://api.example.com"  // Should be config.api_base_url
```

**No Provenance**:
```
// FORBIDDEN
RETURN { result: processed }  // Missing provenance metadata
```

---

## Implementation Checklist

**Per Function**:
- [ ] Maps to one S-V-O responsibility row
- [ ] Parameters from config, not hardcoded
- [ ] Types align with schema definitions
- [ ] Provenance metadata tracked
- [ ] Metrics instrumented at boundaries
- [ ] Preconditions/postconditions validated
- [ ] Single-responsibility (clear S-V-O)

**Per Module**:
- [ ] <600 lines total
- [ ] Single feature scope
- [ ] Zero domain-specific branches
- [ ] Config-driven behavior only
- [ ] Schema-compliant outputs
- [ ] All functions map to responsibility table