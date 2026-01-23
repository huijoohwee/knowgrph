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
  flowchart TB
    %% Multi-shape node demo (Mermaid Flowchart syntax)
    %% Circle: (( )), Rect: [ ], Diamond: { }, Hex: {{ }}
    subgraph S1["Phase 1: Input (multi-shape)"]
      S1_A([Source A])
      S1_B([Source B])
      S1_Port[(Aggregator DB)]
      S1_A --> S1_Port
      S1_B --> S1_Port
    end
    subgraph S2["Phase 2: Transform (diamond + hex)"]
      S2_Decide{Validate?}
      S2_Model{{Feature Extract}}
      S2_Join[Join]
      S2_Decide -->|yes| S2_Model --> S2_Join
      S2_Decide -->|no| S2_Join
    end
    subgraph S3["Phase 3: Report (circle)"]
      S3_Start((Start))
      S3_Render[Render 2D/3D]
      S3_End((END))
      S3_Start --> S3_Render --> S3_End
    end
    subgraph S4["Phase 4: Output (mix)"]
      S4_Pub[/Publish/]
      S4_Store[(Store)]
      S4_Alert{{Alert}}
      S4_Pub --> S4_Store
      S4_Store --> S4_Alert
    end
    S1_Port --> S2_Decide
    S2_Join --> S3_Render
    S3_End --> S4_Pub
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

### Node Shapes Demo (Mermaid + Canvas)

The diagram in this file intentionally uses Mermaid flowchart shape syntax (diamond `{}` and hexagon `{{}}`) to exercise the Canvas node-shape pipeline in both 2D and 3D renderers.

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
