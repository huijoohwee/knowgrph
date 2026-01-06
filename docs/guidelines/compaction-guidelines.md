# Compaction Guidelines

## Core Objective

Reduce {{ content_type }} size while preserving {{ critical_attributes }} -> optimize {{ performance_metric }} -> maintain {{ quality_threshold }}

---

## Compaction Strategies

### 1. Schema-Driven Reduction

| Technique | Method | Compression Ratio | Trade-off |
|:----------|:-------|:------------------|:----------|
| **Field Elimination** | Remove {{ redundant_fields }} | 20-40% | Lossless |
| **Type Optimization** | {{ type_a }} to {{ type_b }} | 30-60% | Precision |
| **Encoding Change** | {{ encoding_from }} to {{ encoding_to }} | 40-70% | Compatibility |
| **Deduplication** | Hash-based {{ entity }} merging | 10-90% | Depends on duplication |

### 2. Structural Optimization

**Pattern**:
```pseudocode
FUNCTION compact({{ input_structure }}) -> {{ output_structure }}
  // Stage 1: Analyze
  redundancy <- detect_{{ redundancy_type }}(input)
  
  // Stage 2: Transform
  FOR EACH {{ element }} IN input:
    IF qualifies_{{ retention_criteria }}(element):
      compressed <- apply_{{ compression_algorithm }}(element)
      COLLECT compressed
  
  // Stage 3: Validate
  ASSERT integrity_check(compressed, {{ tolerance }})
  RETURN compressed
END
```

**Complexity**: Time O({{ time_complexity }}), Space O({{ space_complexity }})

---

## Decision Matrix

### When to Compact

| Condition | Action | Priority |
|:----------|:-------|:---------|
| {{ size_metric }} > {{ threshold_1 }} | Aggressive compaction | High |
| {{ frequency_metric }} > {{ threshold_2 }} | Incremental compaction | Medium |
| {{ access_pattern }} = {{ pattern_type }} | Selective compaction | Low |

### Preservation Rules

**Always Preserve**:
- {{ identifier_fields }}
- {{ relationship_keys }}
- {{ audit_metadata }}

**Candidates for Removal**:
- {{ derived_fields }} (recomputable)
- {{ temporal_fields }} (older than {{ retention_period }})
- {{ sparse_fields }} (null > {{ sparsity_threshold }}%)

---

## Implementation Patterns

### Lossless Compaction

```markdown
**Input Schema**: {{ original_schema }}

**Transformations**:
1. Normalize {{ redundant_structure }} -> {{ canonical_form }}
2. Deduplicate {{ entity_type }} via {{ key_field }}
3. Compress {{ text_field }} using {{ algorithm }}

**Output Schema**: {{ compacted_schema }}

**Validation**:
- Record count: {{ original_count }} = {{ compacted_count }}
- Data integrity: hash({{ original }}) = hash(decompress({{ compacted }}))
```

### Lossy Compaction

```markdown
**Tolerance**: {{ acceptable_loss }}% of {{ metric }}

**Transformations**:
1. Sample {{ entity }} at {{ sampling_rate }}
2. Quantize {{ numeric_field }} to {{ precision }} decimals
3. Truncate {{ text_field }} to {{ max_length }} chars

**Quality Check**:
- Similarity score: {{ computed_similarity }} >= {{ threshold }}
- Information retention: {{ retained_info }}% >= {{ minimum }}%
```

---

## Provenance Tracking

| Stage | Operation | Input Size | Output Size | Ratio |
|:------|:----------|:-----------|:------------|:------|
| 1 | {{ op_1 }} | {{ size_1 }} | {{ size_2 }} | {{ ratio_1 }} |
| 2 | {{ op_2 }} | {{ size_2 }} | {{ size_3 }} | {{ ratio_2 }} |

**Overall**: {{ original_size }} -> {{ final_size }} ({{ total_ratio }} reduction)

---

## Anti-Patterns

**Avoid**:
- Compacting without {{ backup_strategy }}
- Removing {{ critical_field }} without {{ impact_analysis }}
- Irreversible transformations on {{ production_data }}
- Compaction frequency > {{ data_change_rate }}

---

## Validation Checklist

**Pre-Compaction**:
- [ ] Backup strategy in place
- [ ] Critical fields identified
- [ ] Decompression tested
- [ ] Impact on {{ downstream_system }} assessed

**Post-Compaction**:
- [ ] Size reduction: {{ achieved }}% >= {{ target }}%
- [ ] Integrity verified via {{ validation_method }}
- [ ] Performance: {{ metric }} improved by {{ delta }}
- [ ] Reversibility confirmed for {{ scope }}

---

## Metrics

**Track**:
- Compression ratio: {{ output_size }} / {{ input_size }}
- Processing time: {{ duration }} per {{ unit }}
- Quality score: {{ metric }} in [{{ min }}, {{ max }}]
- Storage savings: {{ before }} - {{ after }} = {{ saved }}