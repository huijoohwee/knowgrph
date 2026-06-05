---
# ── DOCUMENT IDENTITY ────────────────────────────────────────────────────────
doc:
  id: "doc:sample:computing-flow"
  title: "Computing flows — knowledge graph canvas sample"
  type: sample
  version: "1.0.0"
  created: "2026-04-09"

# ── VARIABLES (type `@` to open CRUD toolbar) ────────────────────────────────
subject:  "hackathon winners"
action:   "durable distribution beyond the weekend"
goal:     "a single page to browse winning demos"
solution: "publish a project gallery with winner-marked submissions and links to demos/repos"

demo_url:  "https://treehacks-2026.devpost.com/project-gallery"
threshold: 0.75
score_formula: "demos.length * 0.4 + (winner ? 0.6 : 0)"

# ── NODES ────────────────────────────────────────────────────────────────────
# @node:id sigil wires body prose to the flow: block.
nodes:
  - @node:n-winners:  { label: "{{subject}}",      type: input   }
  - @node:n-config:   { label: "config",            type: input   }
  - @node:n-scrape:   { label: "scrape demo URLs",  type: default }
  - @node:n-filter:   { label: "filter by conf.",   type: default }
  - @node:n-score:    { label: "score demos",       type: default }
  - @node:n-route:    { label: "route by score",    type: default }
  - @node:n-gallery:  { label: "{{solution}}",      type: output  }
  - @node:n-flagged:  { label: "flagged for review", type: output  }
  - @node:n-gauge:    { label: "score gauge",       type: custom  }

# ── EDGES ────────────────────────────────────────────────────────────────────
edges:
  - @edge:n-winners:signal      → n-scrape:signal
  - @edge:n-config:vars         → n-scrape:vars
  - @edge:n-config:vars         → n-filter:vars
  - @edge:n-config:vars         → n-score:vars
  - @edge:n-scrape:raw_demos    → n-filter:raw_demos
  - @edge:n-filter:clean_demos  → n-score:clean_demos
  - @edge:n-score:scored_demos  → n-route:scored_demos
  - @edge:n-score:scored_demos  → n-gauge:scored_demos
  - @edge:n-route:winners       → n-gallery:winners
  - @edge:n-route:review        → n-flagged:review

# ── FLOW EDITOR (interactive + computable) ───────────────────────────────────
#
# Computing flows contract:
#   input   nodes → static authored data; no upstream; source handles only
#   default nodes → pure compute: (inputs) => outputs; target + source handles
#   output  nodes → terminal sinks; target handles only; no downstream
#   custom  nodes → any handle config; optional compute:
#
# Propagation: when an input node's data: changes (via `@` toolbar edit),
# the canvas re-evaluates every downstream compute: function in topological
# order and pushes results to connected target handles.
#
# Handle names use snake_case matching PostgreSQL column names directly.
#
# compute: functions are pure — no fetch, no mutation, no side effects.
# TBD inputs are treated as null; node renders `@flag:waiting` badge.
flow:
  direction:  LR
  edgeType:   smoothstep
  snapToGrid: true
  gridSize:   20
  computed:   true

  nodes:

    # ────────────────────────────────────────────────────────────────────────
    # INPUT NODES
    # authored data; no upstream; source handles only
    # edit via `@` toolbar → triggers downstream recompute
    # ────────────────────────────────────────────────────────────────────────

    - id:    n-winners
      type:  input
      label: "{{subject}}"
      position: { x: 0, y: 60 }
      handles:
        source: [signal]
      data:
        pain:    "need {{action}}"
        goal:    "{{goal}}"
        active:  true
      annotation: "`bg#E1F5EE:input`"
      # editing data.active via `@` toolbar toggles the entire pipeline on/off

    - id:    n-config
      type:  input
      label: "config"
      position: { x: 0, y: 220 }
      handles:
        source: [vars]
      data:
        demo_url:      "{{demo_url}}"
        threshold:     "{{threshold}}"
        score_formula: "{{score_formula}}"
        min_confidence: "high"
      annotation: "`bg#E1F5EE:input`"
      # all downstream compute: nodes read from inputs.vars
      # change threshold here → score gate and route update automatically

    # ────────────────────────────────────────────────────────────────────────
    # DEFAULT NODES
    # pure compute: (inputs) => outputs; re-evaluated on upstream change
    # target + source handles; middle of the pipeline
    # ────────────────────────────────────────────────────────────────────────

    - id:    n-scrape
      type:  default
      label: "scrape demo URLs"
      position: { x: 280, y: 60 }
      handles:
        target: [signal, vars]
        source: [raw_demos]
      compute: |
        (inputs) => {
          if (!inputs.signal?.active) return { raw_demos: [] };
          const urls = [inputs.vars.demo_url];
          return {
            raw_demos: urls.map(url => ({
              id:         url,
              url:        url,
              winner:     false,
              confidence: null,
              scraped_at: new Date().toISOString()
            }))
          };
        }
      data: {}
      # raw_demos: { id, url, winner, confidence, scraped_at }[]
      # returns [] when signal.active is false — propagates silence downstream

    - id:    n-filter
      type:  default
      label: "filter by confidence"
      position: { x: 560, y: 0 }
      handles:
        target: [raw_demos, vars]
        source: [clean_demos, dropped]
      compute: |
        (inputs) => {
          const min = inputs.vars.min_confidence ?? 'high';
          const rank = { high: 2, medium: 1, low: 0 };
          const pass = (inputs.raw_demos ?? [])
            .filter(d => (rank[d.confidence] ?? 0) >= (rank[min] ?? 0));
          const drop = (inputs.raw_demos ?? [])
            .filter(d => (rank[d.confidence] ?? 0) < (rank[min] ?? 0));
          return { clean_demos: pass, dropped: drop };
        }
      data: {}
      # clean_demos: passed threshold
      # dropped:     below threshold (not wired further in this sample)

    - id:    n-score
      type:  default
      label: "score demos"
      position: { x: 560, y: 180 }
      handles:
        target: [clean_demos, vars]
        source: [scored_demos]
      compute: |
        (inputs) => {
          const formula = inputs.vars.score_formula;
          const scored = (inputs.clean_demos ?? []).map(d => {
            const score = (d.demos_count ?? 1) * 0.4 + (d.winner ? 0.6 : 0);
            return { ...d, score: Math.min(Math.max(score, 0), 1) };
          });
          return { scored_demos: scored };
        }
      data:
        formula: "{{score_formula}}"
      # score = demos.length * 0.4 + (winner ? 0.6 : 0); clamped [0, 1]
      # scored_demos: { ...clean_demo, score: float }[]

    - id:    n-route
      type:  default
      label: "route by score"
      position: { x: 840, y: 100 }
      handles:
        target: [scored_demos, vars]
        source: [winners, review]
      compute: |
        (inputs) => {
          const t = Number(inputs.vars.threshold ?? 0.75);
          const all = inputs.scored_demos ?? [];
          return {
            winners: all.filter(d => d.score >= t),
            review:  all.filter(d => d.score < t)
          };
        }
      data:
        threshold: "{{threshold}}"
      # winners → n-gallery output (score >= threshold)
      # review  → n-flagged output (score < threshold)

    # ────────────────────────────────────────────────────────────────────────
    # OUTPUT NODES
    # terminal sinks; target handles only; no downstream
    # data: holds the final resolved payload
    # ────────────────────────────────────────────────────────────────────────

    - id:    n-gallery
      type:  output
      label: "{{solution}}"
      position: { x: 1120, y: 0 }
      handles:
        target: [winners]
      data:
        subject:      "{{subject}}"
        goal:         "{{goal}}"
        winner_badge: true
        demo_url:     "{{demo_url}}"
        repo_url:     TBD
      annotation: "`bg#EAF3DE:output`"
      # winners handle receives scored_demos where score >= threshold
      # rendered as the published project gallery page on canvas

    - id:    n-flagged
      type:  output
      label: "flagged for review"
      position: { x: 1120, y: 200 }
      handles:
        target: [review]
      data:
        note: "`@flag:score below {{threshold}}; verify before publish`"
      annotation: "`bg#FCEBEB:output`"
      # review handle receives scored_demos where score < threshold
      # rendered as a review queue card on canvas

    # ────────────────────────────────────────────────────────────────────────
    # CUSTOM NODES
    # any handle config; optional compute:; used for widgets + readouts
    # ────────────────────────────────────────────────────────────────────────

    - id:    n-gauge
      type:  custom
      label: "score gauge"
      position: { x: 840, y: 300 }
      handles:
        target: [scored_demos]
      compute: |
        (inputs) => {
          const demos = inputs.scored_demos ?? [];
          const avg   = demos.length
            ? demos.reduce((s, d) => s + d.score, 0) / demos.length
            : 0;
          return { avg_score: Math.round(avg * 100) / 100 };
        }
      data:
        display:   gauge
        min:       0
        max:       1
        threshold: "{{threshold}}"
      annotation: "`#185FA5|bg#E6F1FB:custom`"
      # renders a live gauge widget; does NOT feed downstream nodes
      # avg_score output is display-only; not wired to any edge

  edges:

    # input → default
    - id: fe-01
      source:       n-winners
      sourceHandle: signal
      target:       n-scrape
      targetHandle: signal
      label:        "{{subject}} active?"
      animated:     true

    - id: fe-02
      source:       n-config
      sourceHandle: vars
      target:       n-scrape
      targetHandle: vars
      label:        config vars
      animated:     false

    - id: fe-03
      source:       n-config
      sourceHandle: vars
      target:       n-filter
      targetHandle: vars
      animated:     false

    - id: fe-04
      source:       n-config
      sourceHandle: vars
      target:       n-score
      targetHandle: vars
      animated:     false

    # default → default
    - id: fe-05
      source:       n-scrape
      sourceHandle: raw_demos
      target:       n-filter
      targetHandle: raw_demos
      label:        raw demos
      animated:     true

    - id: fe-06
      source:       n-filter
      sourceHandle: clean_demos
      target:       n-score
      targetHandle: clean_demos
      label:        confidence ≥ {{n-config.data.min_confidence}}
      animated:     true

    - id: fe-07
      source:       n-score
      sourceHandle: scored_demos
      target:       n-route
      targetHandle: scored_demos
      label:        scored
      animated:     true

    - id: fe-08
      source:       n-score
      sourceHandle: scored_demos
      target:       n-gauge
      targetHandle: scored_demos
      animated:     true

    - id: fe-09
      source:       n-config
      sourceHandle: vars
      target:       n-route
      targetHandle: vars
      animated:     false

    # default → output
    - id: fe-10
      source:       n-route
      sourceHandle: winners
      target:       n-gallery
      targetHandle: winners
      label:        score ≥ {{threshold}}
      animated:     true

    - id: fe-11
      source:       n-route
      sourceHandle: review
      target:       n-flagged
      targetHandle: review
      label:        score < {{threshold}}
      animated:     true

# ── MERMAID (static view; same graph as flow:) ───────────────────────────────
mermaid: |
  %%{init: {"theme":"base","themeVariables":{"primaryColor":"#E1F5EE","primaryTextColor":"#085041","primaryBorderColor":"#1D9E75","lineColor":"#5F5E5A","secondaryColor":"#E6F1FB","tertiaryColor":"#FAEEDA"}}}%%
  flowchart LR

    %% ── classDef ──────────────────────────────────────────────────────────
    classDef inp    fill:#E1F5EE,stroke:#1D9E75,color:#085041,stroke-width:2px
    classDef dflt   fill:#E6F1FB,stroke:#378ADD,color:#0C447C,stroke-width:1.5px
    classDef out    fill:#EAF3DE,stroke:#639922,color:#27500A,stroke-width:2px
    classDef flag   fill:#FCEBEB,stroke:#E24B4A,color:#501313,stroke-width:2px
    classDef custom fill:#EEEDFE,stroke:#7F77DD,color:#3C3489,stroke-width:1.5px

    %% ── INPUT ─────────────────────────────────────────────────────────────
    n_winners[/"{{subject}}\n(input)"/]
    n_config[/"config\n(input)"/]

    %% ── DEFAULT ───────────────────────────────────────────────────────────
    n_scrape["scrape demo URLs\n(default)"]
    n_filter["filter by confidence\n(default)"]
    n_score["score demos\n(default)"]
    n_route{route by score}

    %% ── OUTPUT ────────────────────────────────────────────────────────────
    n_gallery[/"{{solution}}\n(output)"/]
    n_flagged[/"flagged for review\n(output)"/]

    %% ── CUSTOM ────────────────────────────────────────────────────────────
    n_gauge@{ shape: diamond, label: "score gauge\n(custom)" }

    %% ── edges ─────────────────────────────────────────────────────────────
    n_winners -->|signal| n_scrape
    n_config  -->|vars|   n_scrape
    n_config  -->|vars|   n_filter
    n_config  -->|vars|   n_score
    n_config  -->|vars|   n_route
    n_scrape  -->|raw_demos|   n_filter
    n_filter  -->|clean_demos| n_score
    n_score   -->|scored_demos| n_route
    n_score   -->|scored_demos| n_gauge
    n_route   -->|"score ≥ {{threshold}}"| n_gallery
    n_route   -->|"score < {{threshold}}"| n_flagged

    %% ── class assignments ─────────────────────────────────────────────────
    class n_winners,n_config inp
    class n_scrape,n_filter,n_score dflt
    class n_route dflt
    class n_gallery out
    class n_flagged flag
    class n_gauge custom

    %% ── click → AI Chat UI ────────────────────────────────────────────────
    click n_winners "#input-nodes"   "Chat: what does {{subject}} trigger?"
    click n_config  "#input-nodes"   "Chat: edit threshold via @ toolbar"
    click n_scrape  "#default-nodes" "Chat: what does scrape produce?"
    click n_filter  "#default-nodes" "Chat: how does confidence filtering work?"
    click n_score   "#default-nodes" "Chat: explain {{score_formula}}"
    click n_route   "#default-nodes" "Chat: what happens at the routing split?"
    click n_gallery "#output-nodes"  "Chat: what is in the gallery output?"
    click n_flagged "#output-nodes"  "Chat: why was this demo flagged?"
    click n_gauge   "#custom-nodes"  "Chat: what does avg_score mean?"
---

# Computing flows — knowledge graph canvas sample

*Demonstrates input → default → output node pipeline with live `compute:` propagation.*
*Variables managed via `@` toolbar. Same sample throughout: `{{subject}}` need `{{action}}`; builders want `{{goal}}`. `{{solution}}`.*

## Embedded GeoJSON dataset

The same sample includes a small GeoJSON layer so Geospatial Mode can be validated through the markdown ingest -> parse -> render path.

```geojson
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "sg-gallery",
        "label": "Singapore gallery launch",
        "stage": "publish"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [103.8198, 1.3521]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "id": "jkt-review",
        "label": "Jakarta review queue",
        "stage": "review"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [106.8456, -6.2088]
      }
    }
  ]
}
```

---

## Node type reference

| Type | Handles | `compute:` | Editable? | In this sample |
|---|---|---|---|---|
| `input` | source only | none | yes — via `@` toolbar | `n-winners`<!-- @node:n-winners -->, `n-config`<!-- @node:n-config --> |
| `default` | target + source | required | no — computed | `n-scrape`, `n-filter`, `n-score`, `n-route` |
| `output` | target only | none | no — terminal | `n-gallery`<!-- @node:n-gallery -->, `n-flagged`<!-- @node:n-flagged --> |
| `custom` | any | optional | configurable | `n-gauge`<!-- @node:n-gauge --> |

---

## Input nodes

Input nodes are the **authors of data**. They carry no upstream; their `data:` is
edited directly by the author via the `@` toolbar. Every edit triggers a full
recompute of all downstream `default` nodes in topological order.

### `n-winners`<!-- @node:n-winners --> — `{{subject}}`

```yaml
type:  input
handles:
  source: [signal]
data:
  pain:   "need {{action}}"
  goal:   "{{goal}}"
  active: true
```

`signal` carries the `data:` object downstream to `n-scrape`.
Toggle `data.active` to `false` via `@` toolbar →
`n-scrape` returns `raw_demos: []` →
`n-filter`, `n-score`, `n-route` all propagate empty arrays →
`n-gallery` and `n-flagged` receive nothing — pipeline silenced.

`@edge:n-winners:signal→n-scrape:signal` is the first computable edge in the graph.

### `n-config`<!-- @node:n-config --> — config

```yaml
type:  input
handles:
  source: [vars]
data:
  demo_url:       "{{demo_url}}"
  threshold:      "{{threshold}}"
  score_formula:  "{{score_formula}}"
  min_confidence: "high"
```

`vars` fans out to four downstream nodes: `n-scrape`, `n-filter`, `n-score`,
`n-route`. Changing `threshold` here → `n-route` immediately re-partitions
`scored_demos` into `winners` and `review` → both output nodes update.

`@edge:n-config:vars→n-score:vars` and `@edge:n-config:vars→n-route:vars`
are the config distribution edges.

---

## Default nodes

Default nodes are **pure compute steps**. Each declares a `compute:` function
that receives `inputs` — a map of `handleName → value` from all connected
upstream edges — and returns `outputs` — a map pushed to all connected
downstream target handles.

### `n-scrape` — scrape demo URLs

```yaml
type:  default
handles:
  target: [signal, vars]
  source: [raw_demos]
compute: |
  (inputs) => {
    if (!inputs.signal?.active) return { raw_demos: [] };
    const urls = [inputs.vars.demo_url];
    return {
      raw_demos: urls.map(url => ({
        id: url, url, winner: false, confidence: null,
        scraped_at: new Date().toISOString()
      }))
    };
  }
```

Guard: `!inputs.signal?.active` → short-circuit → `raw_demos: []`.
This silence propagates downstream — no items reach `n-filter`.

`@edge:n-scrape:raw_demos→n-filter:raw_demos` carries the scraped payload.

### `n-filter` — filter by confidence

```yaml
type:  default
handles:
  target: [raw_demos, vars]
  source: [clean_demos, dropped]
compute: |
  (inputs) => {
    const rank = { high: 2, medium: 1, low: 0 };
    const min  = rank[inputs.vars.min_confidence ?? 'high'] ?? 0;
    return {
      clean_demos: inputs.raw_demos.filter(d => (rank[d.confidence] ?? 0) >= min),
      dropped:     inputs.raw_demos.filter(d => (rank[d.confidence] ?? 0) < min)
    };
  }
```

Two source handles: `clean_demos` (wired forward) and `dropped` (not wired
in this sample — available for a future `n-review-queue` node).

`@edge:n-filter:clean_demos→n-score:clean_demos` carries only confidence-passing demos.

### `n-score` — score demos

```yaml
type:  default
handles:
  target: [clean_demos, vars]
  source: [scored_demos]
compute: |
  (inputs) => ({
    scored_demos: inputs.clean_demos.map(d => ({
      ...d,
      score: Math.min(Math.max(
        (d.demos_count ?? 1) * 0.4 + (d.winner ? 0.6 : 0),
        0), 1)
    }))
  })
data:
  formula: "{{score_formula}}"
```

`score_formula` = `{{score_formula}}` — declared in `n-config` input node,
passed via `inputs.vars.score_formula`. Change the formula via `@` toolbar on
`n-config` → `n-score` recomputes immediately.

`scored_demos` fans out to two consumers: `n-route` (partitions by threshold)
and `n-gauge` (computes average for the gauge widget).

`@edge:n-score:scored_demos→n-route:scored_demos` and
`@edge:n-score:scored_demos→n-gauge:scored_demos` are the fan-out edges.

### `n-route` — route by score

```yaml
type:  default
handles:
  target: [scored_demos, vars]
  source: [winners, review]
compute: |
  (inputs) => {
    const t = Number(inputs.vars.threshold ?? 0.75);
    return {
      winners: inputs.scored_demos.filter(d => d.score >= t),
      review:  inputs.scored_demos.filter(d => d.score < t)
    };
  }
```

The routing split: `winners` → `n-gallery` output; `review` → `n-flagged` output.
Threshold is read from `inputs.vars` (sourced from `n-config`) — not hardcoded.

Editing `threshold` in `n-config` via `@` toolbar → `n-route` re-partitions →
both output nodes receive updated payloads in the same propagation cycle.

`@edge:n-route:winners→n-gallery:winners` and
`@edge:n-route:review→n-flagged:review` are the terminal delivery edges.

---

## Output nodes

Output nodes are **terminal sinks**. They receive data through target handles,
hold it in `data:`, and surface it on the canvas. They have no source handles
and cannot feed downstream nodes.

### `n-gallery`<!-- @node:n-gallery --> — `{{solution}}`

```yaml
type:  output
handles:
  target: [winners]
data:
  subject:      "{{subject}}"
  goal:         "{{goal}}"
  winner_badge: true
  demo_url:     "{{demo_url}}"
  repo_url:     TBD
annotation: "`bg#EAF3DE:output`"
```

Receives `winners` from `n-route` — demos with `score ≥ {{threshold}}`.
Rendered on canvas as the published project gallery page.
`repo_url: TBD` renders a `@flag:waiting` badge until the value is filled.

### `n-flagged`<!-- @node:n-flagged --> — flagged for review

```yaml
type:  output
handles:
  target: [review]
data:
  note: "`@flag:score below {{threshold}}; verify before publish`"
annotation: "`bg#FCEBEB:output`"
```

Receives `review` from `n-route` — demos with `score < {{threshold}}`.
Rendered on canvas as a review queue card.

---

## Custom nodes

Custom nodes have any handle configuration and an optional `compute:`.
Used for widgets, readouts, feature gates, and AI Chat triggers.

### `n-gauge`<!-- @node:n-gauge --> — score gauge

```yaml
type:  custom
handles:
  target: [scored_demos]
compute: |
  (inputs) => {
    const demos   = inputs.scored_demos ?? [];
    const avg     = demos.length
      ? demos.reduce((s, d) => s + d.score, 0) / demos.length
      : 0;
    return { avg_score: Math.round(avg * 100) / 100 };
  }
data:
  display:   gauge
  min:       0
  max:       1
  threshold: "{{threshold}}"
annotation: "`#185FA5|bg#E6F1FB:custom`"
```

Receives `scored_demos` from `n-score` and computes `avg_score`.
`avg_score` is display-only — not wired to any edge.
Renders a live gauge widget on the canvas node card.
`data.threshold` draws the threshold marker on the gauge face.

---

## Propagation walkthrough

The table below traces one full compute cycle triggered by editing
`data.active = false` on `n-winners` via the `@` toolbar:

| Step | Node | Trigger | `inputs` received | `outputs` produced | Canvas effect |
|---|---|---|---|---|---|
| 1 | `n-winners` | author edits `active → false` | — | `signal: { active: false }` | input node updates immediately |
| 2 | `n-scrape` | `signal` handle receives new value | `signal.active = false` | `raw_demos: []` | node card shows empty |
| 3 | `n-filter` | `raw_demos` handle receives `[]` | `raw_demos: []` | `clean_demos: []`, `dropped: []` | node card shows 0 passed |
| 4 | `n-score` | `clean_demos` handle receives `[]` | `clean_demos: []` | `scored_demos: []` | node card shows 0 scored |
| 5 | `n-route` | `scored_demos` handle receives `[]` | `scored_demos: []` | `winners: []`, `review: []` | routing split shows 0/0 |
| 6 | `n-gauge` | `scored_demos` handle receives `[]` | `scored_demos: []` | `avg_score: 0` | gauge drops to 0 |
| 7 | `n-gallery` | `winners` handle receives `[]` | `winners: []` | — | gallery shows empty |
| 8 | `n-flagged` | `review` handle receives `[]` | `review: []` | — | review queue shows empty |

Restoring `active → true` reverses all steps in the same propagation order.

---

## Handle map

| Edge sigil | Data type | Carries | Animated |
|---|---|---|---|
| `@edge:n-winners:signal→n-scrape:signal` | `object` | `{ active, pain, goal }` | yes |
| `@edge:n-config:vars→n-scrape:vars` | `object` | `{ demo_url, threshold, score_formula, min_confidence }` | no |
| `@edge:n-config:vars→n-filter:vars` | `object` | same config object | no |
| `@edge:n-config:vars→n-score:vars` | `object` | same config object | no |
| `@edge:n-config:vars→n-route:vars` | `object` | same config object | no |
| `@edge:n-scrape:raw_demos→n-filter:raw_demos` | `object[]` | `{ id, url, winner, confidence, scraped_at }[]` | yes |
| `@edge:n-filter:clean_demos→n-score:clean_demos` | `object[]` | confidence-passing subset | yes |
| `@edge:n-score:scored_demos→n-route:scored_demos` | `object[]` | `{ ...demo, score: float }[]` | yes |
| `@edge:n-score:scored_demos→n-gauge:scored_demos` | `object[]` | same scored array | yes |
| `@edge:n-route:winners→n-gallery:winners` | `object[]` | `score ≥ {{threshold}}` subset | yes |
| `@edge:n-route:review→n-flagged:review` | `object[]` | `score < {{threshold}}` subset | yes |

---

## PostgreSQL JSONB insert — `n-gallery` resolved output

When the canvas persists the `n-gallery` output node after a compute cycle:

```json
{
  "id": "n-gallery",
  "doc_id": "doc:sample:computing-flow",
  "type": "output",
  "label": "publish a project gallery with winner-marked submissions and links to demos/repos",
  "position": { "x": 1120, "y": 0 },
  "handles": { "target": ["winners"] },
  "data": {
    "subject":      "hackathon winners",
    "goal":         "a single page to browse winning demos",
    "winner_badge": true,
    "demo_url":     "https://treehacks-2026.devpost.com/project-gallery",
    "repo_url":     null
  },
  "compute_fn": null
}
```

```sql
INSERT INTO flow_nodes (id, doc_id, type, label, position, handles, data, compute_fn)
VALUES (
  'n-gallery',
  'doc:sample:computing-flow',
  'output',
  'publish a project gallery with winner-marked submissions and links to demos/repos',
  '{"x":1120,"y":0}'::jsonb,
  '{"target":["winners"]}'::jsonb,
  '{"subject":"hackathon winners","goal":"a single page to browse winning demos","winner_badge":true,"demo_url":"https://treehacks-2026.devpost.com/project-gallery","repo_url":null}'::jsonb,
  null
);
```

---

## Anti-patterns (forbidden in `compute:` functions)

| Anti-pattern | Why forbidden | Correct approach |
|---|---|---|
| `fetch()` inside `compute:` | async; breaks propagation cycle | pre-fetch in `input` node `data:`; pass via handle |
| Mutating `inputs` directly | breaks referential integrity across nodes | spread into new object: `{ ...inputs.demos, score }` |
| Reading `inputs.vars` without null guard | `TBD` vars are `null`; throws | `inputs.vars?.threshold ?? 0.75` |
| Hardcoding threshold in `compute:` | decouples from `n-config` input node | always read from `inputs.vars.threshold` |
| Source handle on `output` node | terminal contract violation | use `custom` node if intermediate output is needed |
| Target handle on `input` node | input nodes have no upstream | use `default` node if upstream data is needed |
| Side effects (setState, emit, log) | non-pure; breaks determinism | surface as `data:` on the output node; let canvas handle rendering |

---

*type `@` to manage `{{subject}}`, `{{threshold}}`, `{{score_formula}}` — all downstream nodes recompute on change*
