# Knowgrph UI CSS Catalog

https://tailwindcss.com/docs/installation/using-vite

## Tailwind + Vite Setup (Current)

This repo’s `canvas/` app uses Tailwind CSS via PostCSS (Tailwind v3), not the `@tailwindcss/vite` plugin shown in the Tailwind “Using Vite” guide.

| Area | Responsibility | Current Codebase Setup | Source |
| --- | --- | --- | --- |
| Tailwind directives | Pull in `base/components/utilities` layers | `canvas/src/index.css` includes `@tailwind base;`, `@tailwind components;`, `@tailwind utilities;` | `canvas/src/index.css:1-3` |
| CSS entry | Ensure Tailwind output CSS is bundled | `canvas/src/main.tsx` imports `./index.css` | `canvas/src/main.tsx:1-4` |
| PostCSS pipeline | Run Tailwind + Autoprefixer | `canvas/postcss.config.js` uses `{ tailwindcss: {}, autoprefixer: {} }` | `canvas/postcss.config.js:5-10` |
| Tailwind config | Content scanning + dark mode strategy | `canvas/tailwind.config.js` scans `./index.html` + `./src/**/*.{js,ts,jsx,tsx}`, `darkMode: "class"` | `canvas/tailwind.config.js:3-12` |
| Class merge helper | Safely merge conditional Tailwind classes | `cn()` wraps `clsx` + `tailwind-merge` | `canvas/src/lib/utils.ts:1-6` |

## `nav` Element (Navigation Surfaces)

Tailwind doesn’t style `nav` automatically; you style it by applying utility classes to the element. In this codebase, the primary “navigation-like” surface is the toolbar, but it is currently implemented as a `<div>` rather than a `<nav>`.

| Element / Surface | Responsibility | Tailwind / CSS Classes | Current Codebase Setup | Source |
| --- | --- | --- | --- | --- |
| `nav` (recommended for toolbar semantics) | Landmark for primary controls/navigation | Use the same classes as the toolbar container; add `aria-label` (example: `aria-label="Toolbar"`) | No `<nav>` in `canvas/src` today; toolbar renders a `<div>` | `canvas/src/components/Toolbar.tsx:81-83` |
| Toolbar container | “Navigation-like” control strip | `Island App-toolbar App-toolbar--compact w-fit` | Used as the outer wrapper for the toolbar | `canvas/src/components/Toolbar.tsx:81-83`, `canvas/src/index.css:88-111` |
| Toolbar buttons | Consistent hit-area + alignment for icon buttons | `App-toolbar__btn` plus Tailwind utilities (`text-gray-600`, `text-blue-600`, etc.) | Shared across toolbar and panel header actions | `canvas/src/components/Toolbar.tsx:83-226`, `canvas/src/index.css:112-120` |
| Toolbar divider | Visual separation between button groups | `App-toolbar__divider` | Used between related toolbar button groups | `canvas/src/components/Toolbar.tsx:161-162,199-200`, `canvas/src/index.css:80-87` |
| Panel header bar | Consistent header height + spacing | `HeaderBar` plus Tailwind utilities in children | Used by `TabHeader` as the header container class | `canvas/src/features/panels/ui/TabHeader.tsx:27-35`, `canvas/src/index.css:133-139` |

## Typography for Dense GraphRAG and Traversal Controls

GraphRAG workflow controls, Orchestrator traversal presets, and Graph Traversal floating‑panel rows use Tailwind’s `text-xs` (12px) typography for dense key/value layouts. This keeps multi-row traversal settings legible while matching the compact Orchestrator bottom-panel stack.

| Element / Surface | Responsibility | Tailwind / CSS Classes | Current Codebase Setup | Source |
| --- | --- | --- | --- | --- |
| GraphRAG workflow indexing/tracing rows | Dense dataset and tracing controls in Orchestrator bottom panel | `text-xs` plus existing spacing/border utilities | All GraphRAG workflow key/value rows now render at 12px for consistency with traversal controls | `canvas/src/features/panels/views/GraphRagWorkflowSection.tsx`, `canvas/src/features/panels/views/GraphRagWorkflowIndexingSection.tsx` |
| Orchestrator traversal presets + delay row | Shared traversal start/max depth/label filter and delay controls | `text-xs` on labels and helper text | Orchestrator traversal presets and `orchestratorTraversalDelayMs` controls use 12px text for compact playback tuning | `canvas/src/features/panels/views/OrchestratorTraversalPanels.tsx`, `canvas/src/features/panels/views/OrchestratorSettingsSection.tsx` |
| Graph Traversal floating-panel controls | Floating traversal delay and legend controls | `text-xs` for row labels and inline helpers | Floating Graph Traversal panel uses the same 12px control typography as Orchestrator so playback and legend settings feel consistent | `canvas/src/features/panels/views/OrchestratorTraversalStackSection.tsx`, `canvas/src/features/panels/utils/orchestratorTraversal.ts` |

## 4‑Column Key/Slider/Input Rows (`keyIconSliderInput` Layout)

Traversal-related controls that need a key, an optional slider, and a numeric input share a 4‑column grid layout implemented by `KeyTypeValueRow` with `layout="keyIconSliderInput"`. The grid contract is:

- Columns: `0.49fr | 0.01fr | 0.245fr | 0.245fr` (`key | icon | slider | input`).
- The value column wrapper uses `flex` with `items-stretch` so its children match the row height.
- Tooltip anchors that wrap slider or number inputs set `className="w-full h-full"` to fill the 4th column.
- Slider and number inputs inside those anchors also set `className="w-full h-full"` (plus padding, borders, and alignment classes) so the visible control fully matches the width and height of the value span.

Examples of this 4‑column contract in the codebase:

- GraphRAG workflow traversal delay: `orchestratorTraversalDelayMs` row in [GraphRagWorkflowSection.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/panels/views/GraphRagWorkflowSection.tsx).
- GraphRAG workflow indexing sliders: `chunking.chunkSize` and `graphRagWorkflow.maxHops` rows in [GraphRagWorkflowIndexingSection.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/panels/views/GraphRagWorkflowIndexingSection.tsx).
- AiKG traversal delay tuning: “Traversal delay (ms)” row in [AiKgLayersSection.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/panels/views/AiKgLayersSection.tsx).

### Right-aligned value helpers for floating panels

FloatingPanel Graph Traversal and GraphRAG settings use a shared helper pair for right-aligned value cells in the 3‑column `keyIconValue` layout:

- `RightAlignedValueCell` wraps the value column and ensures the control is right-aligned within the 50% value track. It accepts an optional `className` to tweak spacing in specific rows.
- `RightAlignedTooltipInput` composes `RightAlignedValueCell` + `Tooltip` + `<input>` and standardizes the common “value tooltip + right-aligned text/number input” pattern. It also accepts an optional `containerClassName` to customize the outer value-cell wrapper without repeating flex utilities. Summary + input stacks (for example, AgenticRAG context and ignore‑codebase patterns) use `containerClassName="mt-0.5"` so the input row sits on a consistent vertical rhythm below the summary text.

Typical usage inside a `KeyTypeValueRow` with `layout="keyIconValue"`:

```tsx
<KeyTypeValueRow
  density="compact"
  layout="keyIconValue"
  keyNode={/* key + key-tooltip */}
  typeNode={null}
  valueNode={(
    <RightAlignedTooltipInput
      tooltip={valueTooltip}
      type="text"
      value={value}
      onChange={handleChange}
      placeholder="..."
      containerClassName="mt-0.5"
    />
  )}
/>
```

Examples in the codebase:

- Dataset paths in GraphRAG workflow indexing: `dataset.inputDir` and `dataset.outputDir` rows in [GraphRagWorkflowIndexingSection.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/panels/views/GraphRagWorkflowIndexingSection.tsx).
- Chunking configuration row: `chunking.method` workflow field rendered with a right-aligned splitter name input in [GraphRagWorkflowIndexingSection.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/panels/views/GraphRagWorkflowIndexingSection.tsx#L165-L207).
- Embedding configuration rows: `embeddingModel.provider` and `embeddingModel.modelName` in [GraphRagWorkflowIndexingSection.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/panels/views/GraphRagWorkflowIndexingSection.tsx).
- AgenticRAG context input row in [GraphRagWorkflowSection.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/panels/views/GraphRagWorkflowSection.tsx).
- Ignore-codebase patterns input row in [GraphRagWorkflowIndexingSection.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/panels/views/GraphRagWorkflowIndexingSection.tsx).
- FloatingPanel Graph Traversal query rows: “Start node id”, “Max depth”, and “Edge labels filter” use `keyIconValue` + `RightAlignedTooltipInput` in [RenderPresetSection.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/panels/views/RenderPresetSection.tsx#L383-L555) so traversal inputs line up with dataset and embedding rows.
- AiKG node sizing controls: “Node Size Formula” and “Edge Width Formula” rows in [AiKgLayersSection.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/panels/views/AiKgLayersSection.tsx).
