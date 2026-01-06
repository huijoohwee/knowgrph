# Prompt Guidelines

## Core Principles

**Metadata-First**: Auto-detect schema/domain/context -> embed in YAML frontmatter or header -> enable traceability

**GFM-Enhanced, CommonMark-Safe**: Design for visual richness (tables, task lists, collapsibles) -> ensure graceful degradation -> test without extensions

**Domain-Agnostic Templates**: Use `{{ semantic_placeholders }}` -> zero hardcoding -> universal algorithms -> schema-driven detection

---

## Quick Reference

### Hierarchy (Max 4 Levels)
```markdown
# Component (1/doc)
## Section (3-7/doc)  
### Subsection (group related)
#### Detail (minimize)
```

### Element Matrix

| Content Type | GFM-First | CommonMark Fallback | When to Use |
|:-------------|:----------|:--------------------|:------------|
| **Structured data** | Aligned tables | Nested lists | Schemas, comparisons |
| **Progress/status** | `- [ ]` / `- [x]` | ✓/○ indicators | Checklists, validation |
| **Callouts** | `> ℹ️ **Note**:` | `**Note**:` | Warnings, tips |
| **Deep content** | `<details>` | Appendix sections | Optional depth |
| **Separation** | `---` (HR) | `---` | Major sections |

### Code Pattern
````markdown
```pseudocode
FUNCTION {{ operation }}({{ input_schema }}) -> {{ output_schema }}
  FOR EACH {{ entity }} WHERE {{ condition }}:
    {{ transformation }}
  RETURN {{ result_set }}
END
```
````

---

## Detection -> Template Flow

**Pattern**:
```markdown
## {{ Auto_Detected_Type }}

**Schema** (Inferred):
- `{{ field_name }}`: {{ type }} | {{ role }} | {{ constraint }}

**Suggested Operations**:
- [ ] {{ op_1 }} via {{ algorithm }} [O({{ complexity }})]
- [ ] {{ op_2 }} with {{ approach }}
```

### Transformation Patterns

| Type | Template | Example |
|:-----|:---------|:--------|
| **Aggregate** | `{{ fn }}({{ measure }}) GROUP BY {{ dim }}` | `AVG(score) GROUP BY category` |
| **Filter** | `WHERE {{ attr }} {{ op }} {{ val }}` | `WHERE confidence > 0.85` |
| **Join** | `{{ entity_a }} ⋈ {{ entity_b }} ON {{ key }}` | `orders ⋈ users ON user_id` |
| **Transform** | `{{ out }} = {{ fn }}({{ in_1 }}, {{ in_2 }})` | `profit = revenue - cost` |

---

## Provenance Tracking

```markdown
| Stage | Operation | Input | Output | Status |
|:------|:----------|:------|:-------|:-------|
| 1 | {{ transform_1 }} | {{ src }} | {{ mid }} | ✓ |
| 2 | {{ transform_2 }} | {{ mid }} | {{ out }} | ✓ |
```

**Quality Gates**:
- Schema compliance: 100%
- Confidence: {{ metric }} ≥ {{ baseline }} + 5%
- Latency: p99 < {{ threshold }}ms

---

## Anti-Patterns (Forbidden)

- Hardcoded: paths, names, thresholds, field values  
- Project-specific: company names, internal jargon  
- Structure: >4 nesting levels, tables with components  
- Brittleness: missing fallbacks, dataset dependencies

---

## Validation Checklist

**Structure**:
- [ ] Hierarchy ≤4 levels with clear headers
- [ ] GFM features have CommonMark alternatives
- [ ] Horizontal rules separate major sections

**Content**:
- [ ] All entities use `{{ template_syntax }}`
- [ ] Algorithms are domain-agnostic
- [ ] Schema-driven (not dataset-driven)
- [ ] Zero hardcoded assumptions

**Quality**:
- [ ] Provenance chain documented
- [ ] Metrics/validation defined
- [ ] Renders in GFM ✓ CommonMark ✓

---

## S-V-O Responsibility Pattern

**Component** -> [action verbs] [objects] via [method] -> delivers [artifacts] for [consumer role]

**Example**: `DataProcessor -> transforms raw_events via streaming_pipeline -> delivers normalized_records for AnalyticsEngine`