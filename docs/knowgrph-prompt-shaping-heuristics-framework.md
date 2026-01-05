# Enhanced Prompt-Shaping Heuristics Framework

## Core Design Principles

### 1. **Metadata-Driven Architecture**

**GFM-Enhanced Version:**
```markdown
---
type: {{ document_type }}
domain: {{ inferred_domain }}
schema: {{ detected_schema }}
source: {{ provenance_info }}
timestamp: {{ auto_generated }}
---

## Context
{{ auto_detected_context }}

---

## Content
{{ dynamic_content }}
```

**CommonMark Fallback:**
```markdown
**Metadata:**
- Type: {{ document_type }}
- Domain: {{ inferred_domain }}
- Schema: {{ detected_schema }}
- Source: {{ provenance_info }}

**Context:**
{{ auto_detected_context }}

**Content:**
{{ dynamic_content }}
```

### 2. **Detection Heuristics**

| Detection Layer | Method | Output Format |
|:----------------|:-------|:--------------|
| File Type | Extension analysis | `{{ file_type }}` |
| Content Structure | Pattern matching | `{{ structure_type }}` |
| Schema | Field inference | `{{ schema_object }}` |
| Domain | Terminology clustering | `{{ domain_category }}` |

<details>
<summary>CommonMark Alternative View</summary>

**Detection Layers:**
- **File Type**: Extension analysis → `{{ file_type }}`
- **Content Structure**: Pattern matching → `{{ structure_type }}`
- **Schema**: Field inference → `{{ schema_object }}`
- **Domain**: Terminology clustering → `{{ domain_category }}`
</details>

---

## Structural Conventions (Markdown Leverage) – Integrated

### Core Philosophy
Leverage **GitHub Flavored Markdown (GFM)** as the primary rendering target, prioritizing its extended features for richer previews while maintaining **CommonMark compatibility** as the safety baseline. This "GFM-first, CommonMark-fallback" approach ensures maximum expressiveness with universal accessibility.

### Implementation Guidelines

#### ✓ Progressive Enhancement Strategy
- **Primary**: Design for GFM's visual richness (tables, task lists, aligned content)
- **Fallback**: Ensure critical information remains clear in CommonMark
- **Test**: "Does this degrade gracefully without GFM extensions?"

---

### 3. **Semantic-Aware Processing**

#### Transformation Patterns

**❌ Over-Specialized (Avoid):**
```markdown
Parse column A from sales_data.csv
Calculate revenue where product_type = "premium"
```

**✓ Semantic-Aware (Use):**
```markdown
Extract {{ entity_type }} from {{ column_with_role:identifier }}
Calculate {{ metric }} where {{ attribute }} = {{ value_constraint }}
```

#### GFM-Enhanced Comparison Table

| Approach | Reusability | Maintainability | Portability |
|:---------|:------------|:----------------|:------------|
| Hardcoded | ❌ Low | ❌ Brittle | ❌ Project-locked |
| Semantic-Aware | ✅ High | ✅ Flexible | ✅ Universal |

---

### 4. **Schema-Aware Templates**

#### Hierarchical Structure (Max 4 Levels)

```markdown
# Analysis Template

## Input Schema (Auto-detected)

### Detected Fields
- **Primary Key**: `{{ field_with_role:identifier }}`
- **Measures**: `{{ fields_with_role:quantitative }}`
- **Dimensions**: `{{ fields_with_role:categorical }}`

### Relationships
- [ ] One-to-many detected
- [ ] Many-to-many detected
- [ ] Hierarchical structure detected

---

## Processing Logic

### Stage 1: Detection
For each {{ entity }} where {{ condition_type }}:
1. Validate {{ constraint_class }}
2. Apply {{ transformation_type }}

### Stage 2: Aggregation
Group by {{ dimension_field }} → Calculate {{ aggregation_function }}({{ measure_field }})

---

## Output Specification

**Structure**: `{{ output_schema }}`  
**Encoding**: `{{ detected_encoding }}`  
**Format**: `{{ inferred_format }}`
```

<details>
<summary>CommonMark Fallback Version</summary>

**Analysis Template**

**Input Schema (Auto-detected)**
- Detected Fields:
  - Primary Key: `{{ field_with_role:identifier }}`
  - Measures: `{{ fields_with_role:quantitative }}`
  - Dimensions: `{{ fields_with_role:categorical }}`

**Processing Logic**
- Stage 1: Detection
  - For each {{ entity }} where {{ condition_type }}, validate {{ constraint_class }}
- Stage 2: Aggregation
  - Group by {{ dimension_field }}, calculate {{ aggregation_function }}

**Output**: {{ output_schema }} in {{ detected_encoding }}
</details>

---

### 5. **Provenance-Aware Documentation**

#### GFM-First Implementation

```markdown
## Data Lineage

> ℹ️ **Provenance Tracking**: All transformations are logged for reproducibility

| Stage | Operation | Input | Output | Timestamp |
|:------|:----------|:------|:-------|:----------|
| 1 | {{ operation_1 }} | {{ source_1 }} | {{ intermediate_1 }} | {{ time_1 }} |
| 2 | {{ operation_2 }} | {{ intermediate_1 }} | {{ final_output }} | {{ time_2 }} |

### Validation Chain
- [x] Source integrity verified
- [x] Schema compatibility checked
- [ ] Domain constraints validated
```

#### CommonMark Fallback

```markdown
**Data Lineage**

**Note**: All transformations are logged for reproducibility

**Transformation Stages**:
1. **Stage 1**: {{ operation_1 }}
   - Input: {{ source_1 }}
   - Output: {{ intermediate_1 }}
   - Timestamp: {{ time_1 }}

2. **Stage 2**: {{ operation_2 }}
   - Input: {{ intermediate_1 }}
   - Output: {{ final_output }}
   - Timestamp: {{ time_2 }}

**Validation Status**:
- Source integrity: ✓ Verified
- Schema compatibility: ✓ Checked
- Domain constraints: ⧗ Pending
```

---

### 6. **Domain-Agnostic Patterns**

#### Pattern Library

| Pattern Category | Generic Template | Application Scope |
|:-----------------|:-----------------|:------------------|
| **Aggregation** | `GROUP BY {{ dimension }} → {{ aggregate_fn }}({{ measure }})` | Any tabular data |
| **Filtering** | `WHERE {{ attribute }} {{ operator }} {{ threshold }}` | Any entity collection |
| **Transformation** | `{{ output_field }} = {{ function }}({{ input_fields }})` | Any data pipeline |
| **Join** | `{{ entity_a }} ⋈ {{ entity_b }} ON {{ key_field }}` | Relational structures |

<details>
<summary>Detailed Pattern Examples</summary>

**Aggregation Pattern**:
```
Instead of: "Sum sales by region"
Use: "{{ aggregate_function }}({{ measure_field }}) GROUP BY {{ dimension_field }}"
```

**Filtering Pattern**:
```
Instead of: "Get orders over $100"
Use: "SELECT {{ entity }} WHERE {{ numeric_field }} > {{ threshold }}"
```

**Transformation Pattern**:
```
Instead of: "Calculate profit margin"
Use: "{{ derived_metric }} = ({{ field_1 }} - {{ field_2 }}) / {{ field_1 }}"
```
</details>

---

### 7. **Context-Aware Auto-Suggestions**

#### Detection → Suggestion Matrix

```markdown
## Intelligent Recommendations

### Temporal Data Detected
- **Detected**: `{{ temporal_field }}` with granularity `{{ time_unit }}`
- **Suggested Operations**:
  - [ ] Time-series analysis
  - [ ] Trend detection ({{ suggested_algorithm }})
  - [ ] Seasonality decomposition
  - [ ] Anomaly detection

---

### Categorical Data Detected
- **Detected**: `{{ categorical_fields }}` with cardinality `{{ unique_count }}`
- **Suggested Operations**:
  - [ ] Distribution analysis
  - [ ] Cross-tabulation with {{ related_field }}
  - [ ] Entropy calculation
  
---

### Hierarchical Structure Detected
- **Detected**: Parent-child relationship via `{{ parent_key }}` → `{{ child_key }}`
- **Suggested Operations**:
  - [ ] Tree traversal ({{ traversal_method }})
  - [ ] Rollup aggregations
  - [ ] Depth/breadth analysis
```

#### Algorithm Selection Heuristics

| Data Characteristic | Suggested Approach | Complexity |
|:--------------------|:-------------------|:-----------|
| High cardinality categorical | Hash-based grouping | O(n) |
| Ordered temporal | Window functions | O(n log n) |
| Sparse numeric | Compressed representation | O(k), k = non-zero |
| Nested JSON | Recursive flattening | O(d·n), d = depth |

---

## Expanded Structural Conventions

### 1. **Hierarchical Sectioning**

#### Best Practices
```markdown
# Level 1: Major Component (Max 1 per document)

## Level 2: Key Section (3-7 per document)

### Level 3: Subsection (When grouping required)

#### Level 4: Detail (Use sparingly)

---

**Horizontal Rules**: Use `---` (GFM) to separate major sections
```

**✓ Good Example:**
```markdown
# Template: Data Processing Pipeline

## Configuration
{{ config_block }}

---

## Execution Steps
{{ steps }}

---

## Validation
{{ validation_rules }}
```

**❌ Poor Example:**
```markdown
# Template
##### Detail Item 1  ← Skipped levels
### Another Section    ← Inconsistent hierarchy
```

---

### 2. **Tables for Structured Data**

#### When to Use Tables

**✓ Appropriate Use Cases:**
- Schema definitions
- Comparison matrices
- Specification lists
- Metadata catalogs

**❌ Avoid Tables For:**
- Narrative content
- Deeply nested data
- Content requiring frequent updates
- Embedded images/charts

#### GFM-First Table Design

```markdown
| Field Name | Type | Role | Constraint | Example |
|:-----------|:-----|:-----|:-----------|:--------|
| `{{ field_1 }}` | {{ type_1 }} | {{ role_1 }} | {{ constraint_1 }} | `{{ example_1 }}` |
| `{{ field_2 }}` | {{ type_2 }} | {{ role_2 }} | {{ constraint_2 }} | `{{ example_2 }}` |
```

#### CommonMark Alternative

```markdown
**Field Definitions**:

- **{{ field_1 }}**
  - Type: {{ type_1 }}
  - Role: {{ role_1 }}
  - Constraint: {{ constraint_1 }}
  - Example: `{{ example_1 }}`

- **{{ field_2 }}**
  - Type: {{ type_2 }}
  - Role: {{ role_2 }}
  - Constraint: {{ constraint_2 }}
  - Example: `{{ example_2 }}`
```

---

### 3. **Lists and Nesting**

#### Task Lists (GFM-First)

```markdown
## Processing Checklist

### Pre-processing
- [x] Schema detected: `{{ schema_format }}`
- [x] Encoding validated: `{{ encoding }}`
- [ ] Domain constraints applied

### Transformation
- [ ] {{ transformation_1 }} completed
- [ ] {{ transformation_2 }} completed
  - [ ] Sub-step A
  - [ ] Sub-step B

### Post-processing
- [ ] Output validation
- [ ] Metadata generation
```

#### CommonMark Equivalent

```markdown
**Processing Checklist**

**Pre-processing**:
- ✓ Schema detected: `{{ schema_format }}`
- ✓ Encoding validated: `{{ encoding }}`
- ⧗ Domain constraints applied

**Transformation**:
- ⧗ {{ transformation_1 }} completed
- ⧗ {{ transformation_2 }} completed
  - ⧗ Sub-step A
  - ⧗ Sub-step B

**Post-processing**:
- ⧗ Output validation
- ⧗ Metadata generation
```

---

### 4. **Code and Formatting**

#### Fenced Code Blocks

**GFM-First (With Syntax Highlighting):**
````markdown
```python
def process_{{ entity }}(data: {{ type }}):
    """Generic processing function."""
    return {{ transformation }}(data)
```
````

**Inline References:**
```markdown
The `{{ variable_name }}` parameter accepts values of type `{{ type_constraint }}`.
```

#### Language-Agnostic Pseudocode

````markdown
```pseudocode
FUNCTION detect_pattern(input: {{ input_type }}) → {{ output_type }}
  FOR EACH {{ element }} IN input:
    IF matches({{ element }}, {{ pattern }}):
      COLLECT {{ element }}
  RETURN collected_elements
END FUNCTION
```
````

---

### 5. **Blockquotes and Callouts**

#### GFM-Enhanced Callouts

```markdown
> ℹ️ **Note**: This operation is idempotent and can be safely retried.

> ⚠️ **Warning**: {{ constraint_violation_warning }}

> 💡 **Tip**: For optimal performance, use {{ recommended_approach }}.

> ❌ **Error**: {{ error_condition }} detected in {{ component }}.
```

#### CommonMark Alternative

```markdown
**Note**: This operation is idempotent and can be safely retried.

**Warning**: {{ constraint_violation_warning }}

**Tip**: For optimal performance, use {{ recommended_approach }}.

**Error**: {{ error_condition }} detected in {{ component }}.
```

---

### 6. **Collapsible Sections (GFM-First)**

#### Deep-Dive Content Pattern

```markdown
## Core Algorithm

{{ brief_explanation }}

<details>
<summary><strong>Mathematical Foundation (Click to expand)</strong></summary>

### Derivation

Given {{ variable_set }}, we define:

```math
{{ formula }} = {{ expression }}
```

Where:
- {{ var_1 }}: {{ description_1 }}
- {{ var_2 }}: {{ description_2 }}

### Complexity Analysis
- Time: O({{ time_complexity }})
- Space: O({{ space_complexity }})

</details>
```

#### CommonMark Strategy

```markdown
## Core Algorithm

{{ brief_explanation }}

---

**For detailed mathematical foundation, see Appendix A below.**

---

### Appendix A: Mathematical Foundation

Given {{ variable_set }}, we define {{ formula }} = {{ expression }}

**Variables**:
- {{ var_1 }}: {{ description_1 }}
- {{ var_2 }}: {{ description_2 }}

**Complexity**: Time O({{ time_complexity }}), Space O({{ space_complexity }})
```

---

### 7. **Emphasis and Styling**

#### Usage Guidelines

| Style | Syntax | Use Case | Example |
|:------|:-------|:---------|:--------|
| **Bold** | `**text**` | Key terms, strong emphasis | `**{{ critical_parameter }}**` |
| *Italic* | `*text*` | Subtle emphasis, variables | `*{{ optional_field }}*` |
| `Code` | `` `text` `` | Literals, identifiers | `` `{{ function_name }}` `` |
| ~~Strike~~ (GFM) | `~~text~~` | Deprecated items | `~~{{ obsolete_field }}~~` |

**CommonMark Deprecation Alternative:**
```markdown
{{ field_name }} (deprecated: use {{ replacement }} instead)
```

---

### 8. **Links and References**

#### Reference Patterns

**Explicit Links (Both GFM and CommonMark):**
```markdown
See [{{ resource_type }}]({{ dynamic_url }}) for details on {{ topic }}.

Documentation: [{{ doc_title }}]({{ doc_url }})
```

**GFM Autolink (Use Sparingly):**
```markdown
Raw URL: https://example.com/{{ endpoint }}
```

**Footnote-Style References (GFM-First):**
```markdown
This approach follows {{ methodology }}[^1].

[^1]: {{ citation_details }}
```

---

## Complete Implementation Example

### GFM-Enhanced Template

```markdown
# {{ Operation_Name }}

> ℹ️ **Auto-generated** from {{ source_type }} on {{ timestamp }}

---

## Metadata

| Property | Value | Confidence |
|:---------|:------|:-----------|
| **Type** | {{ auto_detected_type }} | {{ confidence_score }}% |
| **Complexity** | {{ heuristic_complexity_score }} | Computed |
| **Domains** | {{ inferred_domains }} | {{ domain_match_count }} matches |

---

## Input Requirements

### Schema (Auto-Inferred)

<details>
<summary><strong>Field Definitions</strong></summary>

| Field | Type | Role | Constraints |
|:------|:-----|:-----|:------------|
| `{{ field_1 }}` | {{ type_1 }} | {{ role_1 }} | {{ constraints_1 }} |
| `{{ field_2 }}` | {{ type_2 }} | {{ role_2 }} | {{ constraints_2 }} |

</details>

### Detection Results
- [x] Structure validated
- [x] Schema inferred
- [ ] Domain constraints applied

---

## Processing Logic

### Algorithm (General, Dataset-Agnostic)

```pseudocode
FUNCTION process(input: {{ input_schema }}) → {{ output_schema }}
  // Stage 1: Pattern Detection
  patterns ← detect_{{ pattern_type }}(input)
  
  // Stage 2: Transformation
  FOR EACH item IN patterns:
    transformed ← apply_{{ transformation_class }}(item)
    WHERE meets_{{ condition_type }}(transformed)
  
  // Stage 3: Aggregation
  result ← aggregate_{{ aggregation_method }}(transformed)
  
  // Stage 4: Validation
  ASSERT validate_{{ constraint_type }}(result)
  
  RETURN result
END FUNCTION
```

**Complexity**:
- Time: O({{ time_complexity }})
- Space: O({{ space_complexity }})

---

## Output Specification

| Aspect | Details |
|:-------|:--------|
| **Structure** | {{ output_schema }} |
| **Format** | {{ detected_format }} |
| **Encoding** | {{ inferred_encoding }} |

---

## Provenance Chain

```mermaid
graph LR
    A[{{ source_1 }}] -->|{{ operation_1 }}| B[{{ intermediate }}]
    B -->|{{ operation_2 }}| C[{{ output }}]
```

> 📝 **Lineage**: All transformations logged for reproducibility

---

## Context-Aware Suggestions

### Based on Detected Patterns

- **Temporal data** detected → Suggest: Time-series analysis
- **Hierarchical structure** detected → Suggest: Tree traversal
- **High cardinality** detected → Suggest: Hash-based grouping

<details>
<summary><strong>Detailed Recommendations</strong></summary>

If {{ condition_a }}:
- Try {{ approach_a }} with parameters {{ params_a }}

If {{ condition_b }}:
- Consider {{ approach_b }} for better {{ metric }}

</details>
```

---

### CommonMark Fallback Version

```markdown
# {{ Operation_Name }}

**Auto-generated** from {{ source_type }} on {{ timestamp }}

---

**Metadata**:
- **Type**: {{ auto_detected_type }} ({{ confidence_score }}% confidence)
- **Complexity**: {{ heuristic_complexity_score }}
- **Domains**: {{ inferred_domains }} ({{ domain_match_count }} matches)

---

**Input Requirements**

**Schema (Auto-Inferred)**:

Field Definitions:
- **{{ field_1 }}** ({{ type_1 }}): {{ role_1 }} | Constraints: {{ constraints_1 }}
- **{{ field_2 }}** ({{ type_2 }}): {{ role_2 }} | Constraints: {{ constraints_2 }}

Detection Status:
- ✓ Structure validated
- ✓ Schema inferred
- ⧗ Domain constraints pending

---

**Processing Logic**

Algorithm (General, Dataset-Agnostic):

1. **Pattern Detection**: detect_{{ pattern_type }}(input)
2. **Transformation**: apply_{{ transformation_class }} where meets_{{ condition_type }}
3. **Aggregation**: aggregate_{{ aggregation_method }}(transformed)
4. **Validation**: validate_{{ constraint_type }}(result)

Complexity: Time O({{ time_complexity }}), Space O({{ space_complexity }})

---

**Output Specification**:
- Structure: {{ output_schema }}
- Format: {{ detected_format }}
- Encoding: {{ inferred_encoding }}

---

**Provenance Chain**:
{{ source_1 }} → [{{ operation_1 }}] → {{ intermediate }} → [{{ operation_2 }}] → {{ output }}

**Note**: All transformations logged for reproducibility

---

**Context-Aware Suggestions**:

Based on detected patterns:
- Temporal data → Time-series analysis recommended
- Hierarchical structure → Tree traversal recommended
- High cardinality → Hash-based grouping recommended

Detailed recommendations available on request.
```

---

## Key Anti-Patterns to Avoid

### Structure Violations

| Anti-Pattern | Why Problematic | Correct Approach |
|:-------------|:----------------|:-----------------|
| Deep nesting (5+ levels) | Cognitive overload | Max 4 levels, use sections |
| Tables with render components | Breaks in parsers | Use figures outside tables |
| Hardcoded paths/names | Not reusable | Use `{{ placeholders }}` |
| Project-specific logic | Over-specialized | Domain-agnostic patterns |
| Missing fallbacks | Breaks in CommonMark | Always provide alternative |

---

## Validation Checklist

### GFM-First Design
- [ ] Tables use alignment syntax (`:---`, `:---:`, `---:`)
- [ ] Task lists used for actionable items
- [ ] Collapsible sections for deep-dive content
- [ ] Emoji callouts for visual scanning
- [ ] Horizontal rules separate major sections

### CommonMark Compatibility
- [ ] Critical content readable without GFM extensions
- [ ] Alternative formats provided for tables
- [ ] Status indicators replace task checkboxes
- [ ] Callouts work with bold labels
- [ ] Degradation tested mentally

### Domain-Agnostic Compliance
- [ ] No hardcoded paths or filenames
- [ ] No project-specific terminology
- [ ] All algorithms are general
- [ ] Placeholders use `{{ template_syntax }}`
- [ ] Schema-driven, not dataset-driven

---

## Best Practices Summary

### Scannability
- **Headers first**: Clear hierarchy (max 4 levels)
- **Information density**: Tables for structured data, lists for sequences
- **Visual breaks**: Horizontal rules between major sections
- **Above the fold**: Most critical information in first 2 sections

### Resilience
- **Dual-mode design**: GFM-enhanced with CommonMark fallback
- **Test degradation**: "Does this work without tables/task lists?"
- **Semantic markup**: Meaning over syntax
- **Graceful simplification**: Enhanced → Basic without information loss

### Portability
- **Zero hardcoding**: Everything templated
- **Schema-aware**: Infer, don't assume
- **Context-driven**: Suggestions based on detection
- **Universal algorithms**: No dataset dependencies