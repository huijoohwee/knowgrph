# Prompt Guidelines

## Core Principles

**Metadata-First**: Include schema, domain, provenance in every prompt | auto-detect context | enable traceability

**GFM-Enhanced, CommonMark-Safe**: Design for visual richness (tables, task lists) | ensure graceful degradation | test without extensions

**Domain-Agnostic Templates**: Use `{{ placeholders }}` | avoid hardcoded entities | semantic-aware patterns | universal algorithms

---

## Structural Standards

### Hierarchy (Max 4 Levels)
````markdown
# Component (1 per doc)
## Section (3-7 per doc)
### Subsection (grouping)
#### Detail (sparingly)
````

### Information Architecture

| Element | GFM-First | CommonMark Fallback |
|:--------|:----------|:--------------------|
| **Structured data** | Tables with alignment | Nested lists |
| **Progress** | Task lists `- [ ]` | Status indicators âœ"/â§— |
| **Callouts** | `> â„¹ï¸ **Note**:` | `**Note**:` |
| **Deep-dive** | `<details><summary>` | Appendix sections |

### Code Patterns
````markdown
```pseudocode
FUNCTION {{ operation }}({{ input_type }}) â†' {{ output_type }}
  FOR EACH {{ entity }} WHERE {{ condition }}:
    {{ transformation }}
  RETURN {{ result }}
END
```
````

---

## Semantic Guidelines

### Detection â†' Template Flow

**Pattern**:
````markdown
## Detected: {{ entity_type }}

**Schema**:
- `{{ field }}`: {{ type }} ({{ role }})

**Suggested Operations**:
- [ ] {{ operation_1 }} via {{ algorithm }}
- [ ] {{ operation_2 }} with complexity O({{ complexity }})
````

### S-V-O Responsibility Pattern

**From [input] to [output]**: Component -> [verbs] [object] via [method] -> delivers [artifact] for [consumer]

### Transformation Templates

| Pattern | Template | Example |
|:--------|:---------|:--------|
| **Aggregation** | `{{ agg_fn }}({{ measure }}) GROUP BY {{ dimension }}` | `SUM(revenue) GROUP BY region` |
| **Filter** | `WHERE {{ attribute }} {{ op }} {{ threshold }}` | `WHERE confidence > 0.8` |
| **Join** | `{{ entity_a }} â‹ˆ {{ entity_b }} ON {{ key }}` | `orders â‹ˆ customers ON id` |

---

## Provenance & Validation

### Lineage Tracking
````markdown
| Stage | Operation | Input | Output | Validation |
|:------|:----------|:------|:-------|:-----------|
| 1 | {{ op_1 }} | {{ src }} | {{ int }} | âœ"/âŒ |
````

### Quality Gates
- Schema compliance: 100%
- Confidence: {{ metric }} > {{ baseline }} + 5%
- Latency: p99 < {{ threshold }}ms

---

## Anti-Patterns (Forbidden)

âŒ Hardcoded paths, names, thresholds  
âŒ Project-specific terminology  
âŒ Deep nesting (5+ levels)  
âŒ Tables with embedded components  
âŒ Missing CommonMark fallbacks

---

## Validation Checklist

**Pre-Generation**:
- [ ] All entities use `{{ placeholders }}`
- [ ] Algorithms are domain-agnostic
- [ ] GFM features have CommonMark alternatives
- [ ] Hierarchy ≤4 levels
- [ ] Schema-driven, not dataset-driven

**Post-Generation**:
- [ ] Renders correctly in GFM
- [ ] Degrades gracefully in CommonMark
- [ ] Zero hardcoded assumptions
- [ ] Provenance links present
- [ ] Metrics instrumentation defined