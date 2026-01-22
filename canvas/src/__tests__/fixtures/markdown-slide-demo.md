---
title: Markdown Slide Demo
graphId: md:markdown-slide-demo
theme: academic
background: /cover.jpg
class: text-center
transition: slide-left
layout: cover
aspectRatio: 16/9
lang: en-US
authors:
  - A. Author 1
  - B. Author 2
meeting: "Example Meeting"
date: "2026-01-12"
venue: "Example City"
institution: "Example Research Group"
url: "https://example.invalid"
mermaid: |
  graph TB
    subgraph S1["Phase 1: Input"]
      S1_A[Source A]
      S1_B[Source B]
      S1_Port[Aggregator]
      S1_A --> S1_Port
      S1_B --> S1_Port
    end
    subgraph S2["Phase 2A: Processing"]
      S2_In[Ingest A]
      S2_Proc[Work A]
      S2_Out[Result A]
      S2_In --> S2_Proc --> S2_Out
    end
    subgraph S3["Phase 2B: Analysis"]
      S3_In[Ingest B]
      S3_Proc[Work B]
      S3_Out[Result B]
      S3_In --> S3_Proc --> S3_Out
    end
    subgraph S4["Phase 3: Output"]
      S4_In[Finalize]
      S4_D1[Dest 1]
      S4_D2[Dest 2]
      S4_In --> S4_D1
      S4_In --> S4_D2
    end
    S1_Port --> S2_In
    S1_Port --> S3_In
    S2_Out --> S4_In
    S3_Out --> S4_In
---

# Markdown Slide Styling Guidelines

Universal syntax guide for presentation frameworks

> Status: This document distinguishes between **fully supported semantics** in the Knowgrph canvas markdown viewer and **structurally accepted only** features that are rendered as plain content without special behavior.

---

## Frontmatter Configuration (fully supported in Knowgrph viewer)

```yaml
---
theme: default
background: /cover.jpg
class: text-center
transition: slide-left
layout: cover
aspectRatio: '16/9'
lang: en-US
mermaid: |
  graph LR
    A[Start] --> B[End]
---
```

**Purpose**: Configures presentation-wide settings via YAML metadata block

**Common keys**: `theme`, `background`, `class`, `transition`, `layout`, `aspectRatio`, `lang`

**Academic / Metadata keys (fully supported):**
- `authors`: List of authors (string or array)
- `meeting`: Conference or meeting name
- `date`: Presentation date
- `venue`: Presentation venue
- `institution`: Institution or organization name (displays in footer)
- `url`: Link to paper or project
- `theme`: Theme style (e.g., `default`, `academic`)
- `mermaid`: Global mermaid diagram definition (string)

### Mermaid Render Ordering (schema-driven)

Mermaid syntax does not specify z-order rules beyond draw order. For deterministic layering in the Canvas Mermaid layout, configure renderer ordering in the graph schema (not inside the Mermaid diagram text).

```json
{
  "layout": {
    "mode": "mermaid",
    "mermaid": {
      "renderOrder": {
        "MermaidSubgraph": -10,
        "MermaidNode": 0,
        "edge": 10
      }
    }
  }
}
```

**Effect**: When these keys are present, a persistent footer is rendered on slides (except `cover` and `intro` layouts).
- **Default Theme**: Meeting/Venue/Institution/Date (Left), Authors/URL (Right), Page Numbers (Right).
- **Academic Theme** (`theme: academic`): Meeting + Authors (Left), Institution/Venue + Page X / Y (Right). (`neversink` is accepted as a legacy alias.)

---

## Click-Based Progressive Disclosure (fully supported in Knowgrph viewer)

**Group animation:**
```html
<v-clicks>

- Appears on click 1
- Appears on click 2
- Appears on click 3

</v-clicks>
```

**Individual control (step-based reveal):**
```html
<v-click>Block appears on click</v-click>

<v-click at="2">Appears at step 2</v-click>
```

**Knowgrph semantics:**
- `<v-click>` blocks are treated as slide fragments.
- `at="N"` sets the explicit fragment index for ordering.
- When presentation mode is enabled and fragments are configured, fragments appear as the presenter advances steps.

