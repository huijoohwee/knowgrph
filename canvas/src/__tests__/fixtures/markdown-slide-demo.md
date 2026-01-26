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
---

# Markdown Slide Styling Guidelines · Markdown 幻灯片样式指南

Universal syntax guide for presentation frameworks · 针对演示框架的通用语法参考

Hover over this term: <abbr title="Knowgrph Canvas Viewer">Canvas Viewer</abbr>

<span class="text-emerald-400 font-semibold">Tailwind‑style span with custom color</span>

> Status: This document distinguishes between **fully supported semantics** in the Knowgrph canvas markdown viewer and **structurally accepted only** features that are rendered as plain content without special behavior.

---

## Frontmatter Configuration (fully supported in Knowgrph viewer)
## Frontmatter 配置（Knowgrph 视图完全支持）

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
**用途**：通过 YAML 元数据块配置整份演示的全局属性

**Common keys**: `theme`, `background`, `class`, `transition`, `layout`, `aspectRatio`, `lang`  
**常用键**：`theme`、`background`、`class`、`transition`、`layout`、`aspectRatio`、`lang`

**Academic / Metadata keys (fully supported):**  
**学术 / 元数据键（完全支持）：**
- `authors`: List of authors (string or array)
- `meeting`: Conference or meeting name
- `date`: Presentation date
- `venue`: Presentation venue
- `institution`: Institution or organization name (displays in footer)
- `url`: Link to paper or project
- `theme`: Theme style (e.g., `default`, `academic`)
- `mermaid`: Global mermaid diagram definition (string)

### Mermaid Render Ordering (schema-driven)
### Mermaid 渲染顺序（由 schema 驱动）

Mermaid syntax does not specify z-order rules beyond draw order. For deterministic layering in the Canvas Mermaid layout, configure renderer ordering in the graph schema (not inside the Mermaid diagram text).  
Mermaid 语法本身除了绘制顺序外并不定义 z 轴层级；要在 Canvas 的 Mermaid 布局中获得可预测的分层效果，应当在图 schema 中配置渲染顺序，而不是在 Mermaid 文本里硬编码。

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
**效果**：当 schema 中存在上述配置时，除 `cover` 与 `intro` 布局外，其余幻灯片都会渲染持久页脚。

- **Default Theme**: Meeting/Venue/Institution/Date (Left), Authors/URL (Right), Page Numbers (Right).  
  **默认主题**：左侧显示会议 / 场地 / 机构 / 日期，右侧显示作者 / URL 与页码。
- **Academic Theme** (`theme: academic`): Meeting + Authors (Left), Institution/Venue + Page X / Y (Right). (`neversink` is accepted as a legacy alias.)  
  **学术主题**（`theme: academic`）：左侧显示会议名 + 作者，右侧显示机构 / 场地 + 第 X / Y 页。（`neversink` 作为历史别名仍然被接受。）

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
