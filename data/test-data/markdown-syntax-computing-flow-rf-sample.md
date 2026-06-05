---
title: Computing Flows · computing-6 (Final App)
graphId: md:computing-6-reactflow
theme: dark
background: /bg-grid.svg
transition: slide-left
layout: cover
aspectRatio: 16/9
lang: en-US
authors:
  - xyflow team
date: "2026-03-19"

# ── source URLs ────────────────────────────────────────────────────────────
app_url: "https://example-apps.xyflow.com/react/learn/computing-6/index.html"
ref: "https://reactflow.dev/learn/advanced-use/computing-flows"

# ── example progression context ────────────────────────────────────────────
example_step: "6"
example_label: "computing-6"
example_note: "final complete app — all six source files assembled and running"

# ── frontmatter variables ──────────────────────────────────────────────────
subject: "computing flows"
goal: "pipe, transform, and branch live color data through a ReactFlow graph in the browser"
input_node: "NumberInput"
preview_node: "ColorPreview"
lightness_node: "Lightness"
log_node: "Log"
hook_data: "useNodesData"
hook_conn: "useNodeConnections"
update_fn: "updateNodeData"
formula: "0.2126 × R + 0.7152 × G + 0.0722 × B"
blend: "mix-blend-mode: difference"
null_convention: "null or undefined on a target handle = stop; node renders nothing"

# ── source file manifest (computing-6) ────────────────────────────────────
source_files:
  - App.jsx
  - NumberInput.jsx
  - ColorPreview.jsx
  - Lightness.jsx
  - Log.jsx
  - index.css

# ── mermaid: complete final-app graph ─────────────────────────────────────
mermaid: |
  %%{init: {"theme": "base", "themeVariables": {
    "primaryColor":"#0F172A","primaryTextColor":"#CBD5E1",
    "primaryBorderColor":"#334155","lineColor":"#64748B",
    "secondaryColor":"#1E293B","tertiaryColor":"#0F172A"
  }}}%%
  flowchart LR
    classDef input    fill:#0C4A6E,stroke:#38BDF8,color:#E0F2FE,stroke-width:2px
    classDef compute  fill:#14532D,stroke:#4ADE80,color:#DCFCE7,stroke-width:2px
    classDef branch   fill:#7C2D12,stroke:#F97316,color:#FEF3C7,stroke-width:2px
    classDef sink     fill:#4A1D96,stroke:#A78BFA,color:#EDE9FE,stroke-width:2px
    classDef hook     fill:#1E293B,stroke:#64748B,color:#94A3B8,stroke-width:1px,stroke-dasharray:4
    classDef file     fill:#0F172A,stroke:#475569,color:#64748B,stroke-width:1px,stroke-dasharray:2

    subgraph FILES["source files — {{example_label}}"]
      F1["NumberInput.jsx"]
      F2["ColorPreview.jsx"]
      F3["Lightness.jsx"]
      F4["Log.jsx"]
      F5["App.jsx"]
      F6["index.css"]
    end

    subgraph GRAPH["live ReactFlow graph"]
      N_R[/"1 · R — NumberInput\ndata.value 0–255"/]
      N_G[/"2 · G — NumberInput\ndata.value 0–255"/]
      N_B[/"3 · B — NumberInput\ndata.value 0–255"/]
      N_CP["4 · ColorPreview\nupdateNodeData → data.color\nmix-blend-mode:difference"]
      N_LT{{"5 · Lightness\n0.2126R+0.7152G+0.0722B\n≥128 → light / dark"}}
      N_LL[/"6 · Log (light path)\ndata.values.light"/]
      N_LD[/"7 · Log (dark path)\ndata.values.dark"/]
    end

    N_R -->|"e1-2\nvalue"| N_CP
    N_G -->|"e3-4\nvalue"| N_CP
    N_B -->|"e5-6\nvalue"| N_CP
    N_CP -->|"e7-8\ncolor {r,g,b}"| N_LT
    N_LT -->|"e9-10\nlight (null if dark)"| N_LL
    N_LT -->|"e11-12\ndark (null if light)"| N_LD

    F1 --> N_R
    F1 --> N_G
    F1 --> N_B
    F2 --> N_CP
    F3 --> N_LT
    F4 --> N_LL
    F4 --> N_LD

    class N_R,N_G,N_B input
    class N_CP compute
    class N_LT branch
    class N_LL,N_LD sink
    class F1,F2,F3,F4,F5,F6 file

    click N_R    "#numberinputjsx" "NumberInput.jsx"
    click N_G    "#numberinputjsx" "NumberInput.jsx"
    click N_B    "#numberinputjsx" "NumberInput.jsx"
    click N_CP   "#colorpreviewjsx--improved" "ColorPreview.jsx — CustomHandle refactor"
    click N_LT   "#lightnessjsx" "Lightness.jsx"
    click N_LL   "#logjsx" "Log.jsx"
    click N_LD   "#logjsx" "Log.jsx"

# ── flow: interactive computing-6 graph (ReactFlow canvas) ────────────────
flow:
  direction: LR
  edgeType: smoothstep
  snapToGrid: true
  gridSize: 20
  computed: true

  nodes:

    # ── NUMBER INPUT nodes — NumberInput.jsx ─────────────────────────────
    # Hook pattern: local useState (UI) + updateNodeData (data object)
    # No compute: block — data flows out via updateNodeData in onChange handler

    - id: "1"
      type: input
      label: "`bg#7F1D1D:R — {{input_node}}`"
      position: { x: 0, y: 0 }
      handles:
        source: [value]
      data:
        label: R
        value: 0
        hook_pattern: "useState(0) + {{update_fn}}(id, { value })"
        clamp: "Math.round(Math.min(255, Math.max(0, evt.target.value)))"
        class: "nodrag"
        note: "`@flag:local state for UI; data object for downstream`"

    - id: "2"
      type: input
      label: "`bg#14532D:G — {{input_node}}`"
      position: { x: 0, y: 150 }
      handles:
        source: [value]
      data:
        label: G
        value: 0
        hook_pattern: "useState(0) + {{update_fn}}(id, { value })"
        clamp: "Math.round(Math.min(255, Math.max(0, evt.target.value)))"
        class: "nodrag"

    - id: "3"
      type: input
      label: "`bg#1E3A5F:B — {{input_node}}`"
      position: { x: 0, y: 300 }
      handles:
        source: [value]
      data:
        label: B
        value: 0
        hook_pattern: "useState(0) + {{update_fn}}(id, { value })"
        clamp: "Math.round(Math.min(255, Math.max(0, evt.target.value)))"
        class: "nodrag"

    # ── COLOR PREVIEW node — ColorPreview.jsx (improved / final) ─────────
    # Hook pattern: CustomHandle sub-component per handle
    #   each CustomHandle: useNodeConnections + useNodesData + useEffect → onChange
    #   ColorPreview: useState({r,g,b}) + updateNodeData(id, {color}) + source Handle
    # mix-blend-mode: difference makes text always readable over any rgb background

    - id: "4"
      type: default
      label: "{{preview_node}}"
      position: { x: 320, y: 120 }
      handles:
        target: [red, green, blue]
        source: [color]
      data:
        hook_pattern: "CustomHandle × 3 → {{hook_conn}} + {{hook_data}} + useEffect + onChange"
        style: "background: rgb(r, g, b)"
        text_style: "{{blend}}"
        writes: "{{update_fn}}(id, { color: { r, g, b } })"
        note: "`@flag:CustomHandle isolates per-handle connection state; no local state on passthrough`"

    # ── LIGHTNESS node — Lightness.jsx ────────────────────────────────────
    # Hook pattern: useNodeConnections(color) + useNodesData + useEffect
    #   → updateNodeData(id, { values: { light: c|null, dark: c|null } })
    # Two source handles; data keyed by handle ID: data.values.light / data.values.dark
    # null on inactive handle = stop for downstream Log nodes

    - id: "5"
      type: default
      label: "{{lightness_node}}"
      position: { x: 640, y: 120 }
      handles:
        target: [color]
        source: [light, dark]
      data:
        formula: "{{formula}}"
        threshold: 128
        hook_pattern: "{{hook_conn}}(color) + {{hook_data}} + useEffect → {{update_fn}}"
        writes: "data.values.light = color|null; data.values.dark = color|null"
        style: "flex-direction: column; align-items: end"
        null_stop: "{{null_convention}}"
        note: "`bg#7C2D12:null on inactive source handle = stop signal downstream`"

    # ── LOG nodes — Log.jsx ───────────────────────────────────────────────
    # Hook pattern: useNodeConnections(light|dark) + useNodesData → display data.values.*
    # Renders nothing (or placeholder) when received value is null

    - id: "6"
      type: output
      label: "`bg#78350F:{{log_node}} — light`"
      position: { x: 960, y: 20 }
      handles:
        target: [light]
      data:
        hook_pattern: "{{hook_conn}}(light) + {{hook_data}} → display data.values.light"
        reads: "data.values.light"
        null_behavior: "renders nothing when null"

    - id: "7"
      type: output
      label: "`bg#0F172A:{{log_node}} — dark`"
      position: { x: 960, y: 240 }
      handles:
        target: [dark]
      data:
        hook_pattern: "{{hook_conn}}(dark) + {{hook_data}} → display data.values.dark"
        reads: "data.values.dark"
        null_behavior: "renders nothing when null"

  edges:
    # NumberInput → ColorPreview (one edge per channel, named target handles)
    - { id: e1-2,  source: "1", sourceHandle: value, target: "4", targetHandle: red,   animated: true, label: "R 0–255" }
    - { id: e3-4,  source: "2", sourceHandle: value, target: "4", targetHandle: green, animated: true, label: "G 0–255" }
    - { id: e5-6,  source: "3", sourceHandle: value, target: "4", targetHandle: blue,  animated: true, label: "B 0–255" }
    # ColorPreview → Lightness (assembled color object)
    - { id: e7-8,  source: "4", sourceHandle: color, target: "5", targetHandle: color, animated: true, label: "{ r, g, b }" }
    # Lightness → Log (one active, one null at runtime)
    - { id: e9-10,  source: "5", sourceHandle: light, target: "6", targetHandle: light, animated: true, label: "light (null if dark)" }
    - { id: e11-12, source: "5", sourceHandle: dark,  target: "7", targetHandle: dark,  animated: true, label: "dark (null if light)" }
---

# Computing Flows · `{{example_label}}` (Final App)

> Live app: [{{app_url}}]({{app_url}})
> Guide: [{{ref}}]({{ref}})

`{{example_label}}` is the **{{example_note}}**.
It demonstrates `{{subject}}`: `{{goal}}`.

The naming convention `computing-N` tracks the guide's step progression.
`computing-6` = step 6 = everything assembled: all source files running together,
the full RGB → luminance → branching pipeline live in the browser.

---

## Source file manifest

`{{example_label}}` ships exactly six source files:

| File | Role |
|---|---|
| `App.jsx` | Root component; `initialNodes`, `initialEdges`, `nodeTypes` map, `<ReactFlow>` |
| `NumberInput.jsx` | Custom input node — `useState` + `{{update_fn}}` |
| `ColorPreview.jsx` | Custom transform node — `CustomHandle` refactor, `{{blend}}` |
| `Lightness.jsx` | Custom branch node — luminance formula, two source handles |
| `Log.jsx` | Custom debug sink node — displays `data.values.*` |
| `index.css` | Node styles: `.number-input`, `.node`, `.handle`, `.label` |

---

## What the app builds

An interactive flow graph with **7 nodes** (matching `initialNodes` in `App.jsx`):

| Node id | File | `type` | Role |
|---|---|---|---|
| `1` (`@node:1`) | `NumberInput.jsx` | `input` | R channel — integer 0–255 |
| `2` (`@node:2`) | `NumberInput.jsx` | `input` | G channel — integer 0–255 |
| `3` (`@node:3`) | `NumberInput.jsx` | `input` | B channel — integer 0–255 |
| `4` (`@node:4`) | `ColorPreview.jsx` | `default` | assembles `rgb()` background; exposes `color` source |
| `5` (`@node:5`) | `Lightness.jsx` | `default` | luminance gate; routes to `light` or `dark` source handle |
| `6` (`@node:6`) | `Log.jsx` | `output` | debug sink — light path |
| `7` (`@node:7`) | `Log.jsx` | `output` | debug sink — dark path |

Six edges wire them left-to-right:
`e1-2`, `e3-4`, `e5-6` (channels → ColorPreview),
`e7-8` (ColorPreview → Lightness),
`e9-10`, `e11-12` (Lightness → Log×2).

---

## `NumberInput.jsx` — `@node:1`, `@node:2`, `@node:3`

The simplest node: a controlled `<input type="number">` clamped to 0–255.

**Critical: two-state pattern.** Local React state drives the input UI; `{{update_fn}}` writes to the node's `data` object for downstream consumption. Never bind the `data` object directly as the input value — there is a write delay that makes the cursor jump erratically.

```jsx
// NumberInput.jsx — {{example_label}} final
import { useCallback, useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';

function NumberInput({ id, data }) {
  const { updateNodeData } = useReactFlow();
  const [number, setNumber] = useState(data.value ?? 0);

  const onChange = useCallback((evt) => {
    const cappedNumber = Math.round(
      Math.min(255, Math.max(0, evt.target.value)),
    );
    setNumber(cappedNumber);
    updateNodeData(id, { value: cappedNumber });   // → data.value downstream
  }, [id, updateNodeData]);

  return (
    <div className="number-input">
      <div>{data.label}</div>
      <input
        id={`number-${id}`}
        name="number"
        type="number"
        min="0"
        max="255"
        onChange={onChange}
        className="nodrag"
        value={number}
      />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export default NumberInput;
```

Each instance exposes one unnamed source handle (right side).
`App.jsx` assigns `data: { label: 'R', value: 0 }` etc. in `initialNodes`.

Edges from `initialEdges`:

- `@edge:1:value→4:red` — R channel
- `@edge:2:value→4:green` — G channel
- `@edge:3:value→4:blue` — B channel

---

## `ColorPreview.jsx` — improved (`@node:4`)

The final version uses the **`CustomHandle`** refactor.
Earlier steps kept a local `useState` for color — in `{{example_label}}` that local state is removed
from the passthrough path and replaced by `{{update_fn}}` writing directly to `data.color`.

### `CustomHandle` sub-component

Each of the three target handles (`red`, `green`, `blue`) is wrapped in `CustomHandle`,
which isolates `{{hook_conn}}` + `{{hook_data}}` state per handle:

```jsx
// ColorPreview.jsx — CustomHandle sub-component
function CustomHandle({ id, label, onChange }) {
  const connections = useNodeConnections({
    handleType: 'target',
    handleId: id,
  });

  const nodeData = useNodesData(connections?.[0].source);

  useEffect(() => {
    onChange(nodeData?.data ? nodeData.data.value : 0);
  }, [nodeData]);

  return (
    <div>
      <Handle
        type="target"
        position={Position.Left}
        id={id}
        className="handle"
      />
      <label htmlFor={id} className="label">
        {label}
      </label>
    </div>
  );
}
```

### `ColorPreview` component (passthrough)

Local `useState` drives only the live background display.
`{{update_fn}}` writes the assembled color to `data.color` so `@node:5` can read it downstream.
`{{blend}}` makes the label text always readable regardless of background color.

```jsx
// ColorPreview.jsx — final passthrough component
function ColorPreview({ id }) {
  const { updateNodeData } = useReactFlow();
  const [color, setColor] = useState({ r: 0, g: 0, b: 0 });

  const handleChange = useCallback((channel, value) => {
    setColor((c) => {
      const next = { ...c, [channel]: value };
      updateNodeData(id, { color: next });   // → data.color downstream
      return next;
    });
  }, [id, updateNodeData]);

  return (
    <div
      className="node"
      style={{ background: `rgb(${color.r}, ${color.g}, ${color.b})` }}
    >
      <CustomHandle id="red"   label="R" onChange={(v) => handleChange('r', v)} />
      <CustomHandle id="green" label="G" onChange={(v) => handleChange('g', v)} />
      <CustomHandle id="blue"  label="B" onChange={(v) => handleChange('b', v)} />
      <Handle type="source" position={Position.Right} id="color" />
    </div>
  );
}
```

`@edge:4:color→5:color` delivers `{ r, g, b }` to `{{lightness_node}}`.

---

## `Lightness.jsx` — `@node:5`

The branching node. One target handle (`color`); two source handles (`light`, `dark`).

### Relative luminance formula

`{{formula}}`

Anything ≥ 128 is treated as a light color; < 128 as dark.

### Data keyed by handle ID

Because `@node:5` has **multiple source handles**, `data` is structured with a `values` sub-object
keyed by handle name. This is the guide's recommended convention for multi-source nodes:

```js
data.values = {
  light: colorObject | null,
  dark:  colorObject | null,
}
```

`@node:6` reads `data.values.light`; `@node:7` reads `data.values.dark`.

### `{{null_convention}}`

The active branch receives the color object; the inactive branch receives `null`.
Downstream `{{log_node}}` nodes treat `null` as a stop and render nothing.

```jsx
// Lightness.jsx — final
import { useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { useNodeConnections, useNodesData } from '@xyflow/react';

function Lightness({ id }) {
  const { updateNodeData } = useReactFlow();
  const connections = useNodeConnections({ handleType: 'target', handleId: 'color' });
  const nodeData    = useNodesData(connections?.[0]?.source);

  useEffect(() => {
    const color = nodeData?.data?.color ?? { r: 0, g: 0, b: 0 };
    const luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
    const isLight   = luminance >= 128;

    updateNodeData(id, {
      values: {
        light: isLight ? color : null,
        dark:  isLight ? null  : color,
      },
    });
  }, [nodeData, id, updateNodeData]);

  return (
    <div
      className="node"
      style={{ flexDirection: 'column', alignItems: 'end' }}
    >
      <div>
        <Handle type="source" position={Position.Right} id="light" />
        <label className="label">light</label>
      </div>
      <Handle type="target" position={Position.Left} id="color" />
      <div>
        <Handle type="source" position={Position.Right} id="dark" />
        <label className="label">dark</label>
      </div>
    </div>
  );
}

export default Lightness;
```

CSS note: `flex-direction: column; align-items: end` repositions the handle labels so
`light` sits at top-right and `dark` at bottom-right of the node card.

Branching edges:

- `@edge:5:light→6:light` — active when luminance ≥ 128; carries `null` otherwise
- `@edge:5:dark→7:dark` — active when luminance < 128; carries `null` otherwise

---

## `Log.jsx` — `@node:6` (light) and `@node:7` (dark)

A minimal debug sink. Uses `{{hook_conn}}` + `{{hook_data}}` to read the upstream node's
`data.values.light` or `data.values.dark`, and renders it as formatted JSON.

```jsx
// Log.jsx — final
import { useNodeConnections, useNodesData } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';

function Log({ data }) {
  const connections = useNodeConnections({ handleType: 'target' });
  const nodeData    = useNodesData(connections?.[0]?.source);

  // Read from data.values keyed by the handle id we care about
  const handleId = data.handleId;   // 'light' or 'dark', set in initialNodes
  const value    = nodeData?.data?.values?.[handleId];

  return (
    <div className="node">
      <Handle type="target" position={Position.Left} id={handleId} />
      <pre>{value !== null && value !== undefined
        ? JSON.stringify(value, null, 2)
        : '—'
      }</pre>
    </div>
  );
}

export default Log;
```

`@node:6` and `@node:7` are identical except for `data.handleId` (`"light"` vs `"dark"`),
set in `App.jsx`'s `initialNodes`.

---

## `App.jsx` — wiring it all together

`App.jsx` defines `initialNodes`, `initialEdges`, and the `nodeTypes` map,
then renders `<ReactFlow>` with `fitView`.

```jsx
// App.jsx — {{example_label}}
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './index.css';

import NumberInput   from './NumberInput';
import ColorPreview  from './ColorPreview';
import Lightness     from './Lightness';
import Log           from './Log';

const nodeTypes = {
  numberInput:  NumberInput,
  colorPreview: ColorPreview,
  lightness:    Lightness,
  log:          Log,
};

const initialNodes = [
  { id: '1', type: 'numberInput', position: { x:   0, y:   0 }, data: { label: 'R', value: 0 } },
  { id: '2', type: 'numberInput', position: { x:   0, y: 150 }, data: { label: 'G', value: 0 } },
  { id: '3', type: 'numberInput', position: { x:   0, y: 300 }, data: { label: 'B', value: 0 } },
  { id: '4', type: 'colorPreview',position: { x: 320, y: 120 }, data: {} },
  { id: '5', type: 'lightness',   position: { x: 640, y: 120 }, data: { values: { light: null, dark: null } } },
  { id: '6', type: 'log',         position: { x: 960, y:  20 }, data: { label: 'Log (light)', handleId: 'light' } },
  { id: '7', type: 'log',         position: { x: 960, y: 240 }, data: { label: 'Log (dark)',  handleId: 'dark'  } },
];

const initialEdges = [
  { id: 'e1-2',  source: '1', target: '4', targetHandle: 'red',   animated: true },
  { id: 'e3-4',  source: '2', target: '4', targetHandle: 'green', animated: true },
  { id: 'e5-6',  source: '3', target: '4', targetHandle: 'blue',  animated: true },
  { id: 'e7-8',  source: '4', sourceHandle: 'color', target: '5', targetHandle: 'color', animated: true },
  { id: 'e9-10', source: '5', sourceHandle: 'light', target: '6', targetHandle: 'light', animated: true },
  { id: 'e11-12',source: '5', sourceHandle: 'dark',  target: '7', targetHandle: 'dark',  animated: true },
];

export default function App() {
  return (
    <ReactFlow
      nodeTypes={nodeTypes}
      defaultNodes={initialNodes}
      defaultEdges={initialEdges}
      fitView
    >
      <Background />
      <Controls />
    </ReactFlow>
  );
}
```

---

## Hook pattern — per node type

| Node | Hook(s) used | Writes to `data` via | Reads from `data` via |
|---|---|---|---|
| `{{input_node}}` | `useState` (UI only) | `{{update_fn}}(id, { value })` | — |
| `{{preview_node}}` (via `CustomHandle`) | `{{hook_conn}}` + `{{hook_data}}` | `{{update_fn}}(id, { color })` | upstream `data.value` |
| `{{lightness_node}}` | `{{hook_conn}}` + `{{hook_data}}` | `{{update_fn}}(id, { values })` | upstream `data.color` |
| `{{log_node}}` | `{{hook_conn}}` + `{{hook_data}}` | — (sink) | upstream `data.values.*` |

---

## `index.css` — node styling conventions

```css
/* index.css — {{example_label}} */
.number-input {
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px;
}

.node {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 4px;
  min-width: 80px;
  min-height: 80px;
}

/* mix-blend-mode: difference makes label text readable over any rgb() background */
.node > span {
  mix-blend-mode: difference;
  color: white;
}

.handle { width: 10px; height: 10px; }
.label  { margin-left: 6px; font-size: 12px; }
```

`{{blend}}` is declared on the text overlay inside `{{preview_node}}`.
It inverts the text color relative to the background, guaranteeing legibility
over any `rgb()` value including pure white and pure black.

---

## Computing-N step progression

| Step | Added in that step |
|---|---|
| `computing-1` | `{{input_node}}` (×3) with raw `useState` only; no `{{update_fn}}` yet |
| `computing-2` | `{{update_fn}}` added; data written to `data.value`; `{{preview_node}}` basic target handles |
| `computing-3` | `{{hook_conn}}` + `{{hook_data}}` on `{{preview_node}}`; live color background |
| `computing-4` | `CustomHandle` refactor on `{{preview_node}}`; source handle added |
| `computing-5` | `{{lightness_node}}` added; luminance formula; `light`/`dark` handle branching |
| **`computing-6`** | **`{{log_node}}` added; `data.values.*` keying; full pipeline running** |

`{{example_label}}` at [{{app_url}}]({{app_url}}) is the terminal step —
the complete, runnable final app.

---

## Summary — three rules from the guide

**Rule 1 — two-hook data pipeline (per receiving node)**

```
updateNodeData(id, partialData)           // write: merges into data by default
useNodeConnections({ handleType, handleId }) // discover connected upstream nodes
useNodesData(connections?.[0]?.source)    // read upstream data object
```

**Rule 2 — `null` = stop**

```
{{null_convention}}
```

Write `null` to the inactive source handle. Downstream nodes that receive `null`
skip rendering (or show a placeholder). This is the branching primitive.

**Rule 3 — consistent data structure**

If you key `data` by handle ID on one node (e.g. `data.values.light`),
do it on all nodes — including single-handle nodes. Uniform shape means
every consuming hook can make the same read assumptions with no special-casing.

---

## Node and handle reference

| Node id | `type` | Target handles | Source handles | File |
|---|---|---|---|---|
| `1` | `input` | — | _(unnamed)_ | `NumberInput.jsx` |
| `2` | `input` | — | _(unnamed)_ | `NumberInput.jsx` |
| `3` | `input` | — | _(unnamed)_ | `NumberInput.jsx` |
| `4` | `default` | `red, green, blue` | `color` | `ColorPreview.jsx` |
| `5` | `default` | `color` | `light, dark` | `Lightness.jsx` |
| `6` | `output` | `light` | — | `Log.jsx` |
| `7` | `output` | `dark` | — | `Log.jsx` |

---

## Edge reference

| Edge id | `@edge` sigil | Data carried | Animated |
|---|---|---|---|
| `e1-2` | `@edge:1:→4:red` | R 0–255 | true |
| `e3-4` | `@edge:2:→4:green` | G 0–255 | true |
| `e5-6` | `@edge:3:→4:blue` | B 0–255 | true |
| `e7-8` | `@edge:4:color→5:color` | `{ r, g, b }` | true |
| `e9-10` | `@edge:5:light→6:light` | color object or `null` | true |
| `e11-12` | `@edge:5:dark→7:dark` | color object or `null` | true |

---

## Variable reference

| Reference | Resolved |
|---|---|
| `{{app_url}}` | {{app_url}} |
| `{{ref}}` | {{ref}} |
| `{{example_label}}` | {{example_label}} |
| `{{example_note}}` | {{example_note}} |
| `{{input_node}}` | {{input_node}} |
| `{{preview_node}}` | {{preview_node}} |
| `{{lightness_node}}` | {{lightness_node}} |
| `{{log_node}}` | {{log_node}} |
| `{{hook_conn}}` | {{hook_conn}} |
| `{{hook_data}}` | {{hook_data}} |
| `{{update_fn}}` | {{update_fn}} |
| `{{formula}}` | {{formula}} |
| `{{blend}}` | {{blend}} |
| `{{null_convention}}` | {{null_convention}} |

---

## Annotation sigil reference

| Raw sigil | Rendered meaning |
|---|---|
| `` `bg#7F1D1D:R — NumberInput` `` | node 1 — red channel input |
| `` `bg#14532D:G — NumberInput` `` | node 2 — green channel input |
| `` `bg#1E3A5F:B — NumberInput` `` | node 3 — blue channel input |
| `` `bg#78350F:Log — light` `` | node 6 — amber light-path sink |
| `` `bg#0F172A:Log — dark` `` | node 7 — near-black dark-path sink |
| `` `bg#7C2D12:null on inactive source handle = stop signal downstream` `` | Lightness node branching warning |
| `` `@flag:CustomHandle isolates per-handle connection state; no local state on passthrough` `` | advisory flag on ColorPreview |
| `` `@flag:local state for UI; data object for downstream` `` | advisory flag on NumberInput nodes |