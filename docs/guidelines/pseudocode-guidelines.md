# Pseudocode Guidelines

## Core Principles

**Specification-Driven**: Algorithm contracts via input/output signatures | staged transformations | provenance-preserving | schema-compliant

**Configuration-First**: Parameters from config | thresholds from metadata | behavior adaptation without code changes

**Validation-Embedded**: Preconditions → transformations → postconditions | assertions at boundaries

---

## Responsibility Mapping

### S-V-O Documentation Pattern

**One Function = One Responsibility = One Table Row**

Each pseudocode function maps to exactly one responsibility statement following Subject-Verb-Object structure:

```
Class.method() -> Subject verbs object via mechanism
```

**Required Components**:
- **Subject**: Class/Object performing action
- **Verb**: Single-responsibility operation (detects, transforms, validates, aggregates)
- **Object**: Data being operated on (entities, features, relationships)
- **Mechanism**: Configuration-driven approach (via schema, using metadata, through config)

### Mapping Template

```
FUNCTION ClassName.methodName({ input }) -> { output }
```

**Maps to**:

| Module | Class/Object | Function/Method | Responsibility (S-V-O) | Dependencies | Artifacts/Outputs |
|--------|--------------|-----------------|------------------------|--------------|-------------------|
| `path/module.ext` | `ClassName` | `methodName` | ClassName verbs object via mechanism | `config`, `schema` | `output_type` |

---

## Domain-Agnostic S-V-O Examples

### Pattern Detection

```
FUNCTION PatternDetector.extract_features({ entities, config }) -> { feature_vectors }
  features <- []
  FOR EACH entity IN entities:
    vector <- compute_embedding(entity, config.embedding_model)
    features.append({ entity_id: entity.id, vector: vector })
  RETURN features
END
```

**Responsibility Row**:

| Module | Class/Object | Function/Method | Responsibility (S-V-O) | Dependencies | Artifacts/Outputs |
|--------|--------------|-----------------|------------------------|--------------|-------------------|
| `detection/pattern.ext` | `PatternDetector` | `extract_features` | PatternDetector extracts feature vectors via embedding model | `config.embedding_model` | `feature_vectors[]` |

### Relationship Building

```
FUNCTION RelationshipBuilder.compute_similarity({ entity_pairs, config }) -> { scored_pairs }
  threshold <- config.similarity_threshold
  
  scored <- []
  FOR EACH pair IN entity_pairs:
    score <- similarity_function(pair.source, pair.target, config.metric)
    IF score >= threshold:
      scored.append({ pair: pair, score: score, provenance: build_provenance() })
  
  RETURN scored
END
```

**Responsibility Row**:

| Module | Class/Object | Function/Method | Responsibility (S-V-O) | Dependencies | Artifacts/Outputs |
|--------|--------------|-----------------|------------------------|--------------|-------------------|
| `graph/relationships.ext` | `RelationshipBuilder` | `compute_similarity` | RelationshipBuilder scores entity pairs via similarity metric | `config.metric`, `config.threshold` | `scored_pairs[]` |

### Validation

```
FUNCTION SchemaValidator.check_compliance({ data, schema }) -> { validation_result }
  errors <- []
  
  FOR EACH field IN schema.required_fields:
    IF field NOT IN data:
      errors.append({ field: field, error: "missing_required" })
  
  FOR EACH field IN data:
    IF NOT validate_type(data[field], schema.fields[field].type):
      errors.append({ field: field, error: "type_mismatch" })
  
  RETURN { valid: errors.is_empty(), errors: errors }
END
```

**Responsibility Row**:

| Module | Class/Object | Function/Method | Responsibility (S-V-O) | Dependencies | Artifacts/Outputs |
|--------|--------------|-----------------|------------------------|--------------|-------------------|
| `validation/schema.ext` | `SchemaValidator` | `check_compliance` | SchemaValidator validates data structure against schema definitions | `schema.required_fields`, `schema.fields` | `validation_result{}` |

---

## Multi-Stage Function Mapping

### Complex Pipeline

```
FUNCTION FeatureEngineer.transform_features({ raw_data, config }) -> { transformed_features }
  // Stage 1: Extract
  extracted <- extract_raw_features(raw_data, config.extractors)
  
  // Stage 2: Normalize
  normalized <- normalize_features(extracted, config.normalization)
  
  // Stage 3: Encode
  encoded <- encode_categorical(normalized, config.encoding_strategy)
  
  RETURN { features: encoded, provenance: track_pipeline() }
END
```

**Responsibility Decomposition** (One row per stage):

| Module | Class/Object | Function/Method | Responsibility (S-V-O) | Dependencies | Artifacts/Outputs |
|--------|--------------|-----------------|------------------------|--------------|-------------------|
| `features/engineer.ext` | `FeatureEngineer` | `extract_raw_features` | FeatureEngineer extracts raw features via configured extractors | `config.extractors` | `feature_vectors[]` |
| `features/engineer.ext` | `FeatureEngineer` | `normalize_features` | FeatureEngineer normalizes feature distributions using normalization strategy | `config.normalization` | `normalized_vectors[]` |
| `features/engineer.ext` | `FeatureEngineer` | `encode_categorical` | FeatureEngineer encodes categorical features through encoding strategy | `config.encoding_strategy` | `encoded_features[]` |

---

## Verb Vocabulary (Domain-Agnostic)

**Data Operations**: extracts, transforms, aggregates, filters, partitions, merges  
**Analysis Operations**: computes, calculates, scores, ranks, classifies  
**Validation Operations**: validates, verifies, checks, asserts, ensures  
**Graph Operations**: traverses, connects, clusters, indexes, retrieves  
**Metadata Operations**: tracks, annotates, tags, versions, links

---

## Anti-Patterns (Forbidden)

**Hardcoded Domain Logic**:
```
// WRONG: Domain-specific hardcoding
FUNCTION create_age_bins() -> bins
  RETURN [0-18, 18-35, 35-65, 65+]  // Hardcoded domain assumption
```

**Correct (Configuration-Driven)**:
```
FUNCTION create_bins({ values, config }) -> bins
  boundaries <- config.bin_boundaries  // From config
  RETURN discretize(values, boundaries)
```

---

## Validation Checklist

**Documentation Review**:
- [ ] Each function maps to one S-V-O row
- [ ] Verbs are domain-agnostic
- [ ] Dependencies reference config/schema only
- [ ] No hardcoded domain entities in responsibility statements
- [ ] Artifacts explicitly typed