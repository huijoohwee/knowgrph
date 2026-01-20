# todo

## RULES

### Universal, neutral, project‑agnostic one‑liner in context–intent–directive

- [x] Full‑screen; preserve inactive canvas; forbid unnecessary recompute
- [x] Markup; apply semantic elements; forbid generic `div` misuse
- [x] Modules; follow single responsibility; forbid cross‑cutting sprawl
- [x] Performance; apply memoization/cache results; forbid costly rerendering/recalculation
- [x] Refactoring; remove stale logic; forbid conflicting duplication
- [x] Resolution; support 16:9 centering; forbid fixed non‑scalable layouts
- [x] Store; centralize shared state; forbid direct mutation
- [x] Store; short‑circuit unchanged layout caches and canvas dimensions/positions; forbid redundant updates that trigger render/recalc loops
- [x] Styling; enforce theme tokens; forbid inconsistent overrides
- [x] Test; unit test all components; forbid regression
- [x] Test; ensure close-loop test; forbid hang or infinite loop
- [x] Utilities; centralize shared logic; forbid duplication across components
- [x] Document structure; adhere to `/Users/huijoohwee/Documents/GitHub/huijoohwee.github.io/docs/document-template.md`; forbid inconsistent structure

- [x] Post-task completion; update `/Users/huijoohwee/Documents/GitHub/knowgrph/docs/documents`

---

## FEATURES & FUNCTIONALITIES

### P0-Critical

#### 2026-01-21

#### 2026-01-20

- [] Plug-in: Geo 

- [] Trip planning use case

- [] ADD universal diff

- [] ENHANCE "Graph Layer" functionality for the parsing & rendering of mermaid.js subgraph, refer to & natively develop & implement, FORBID copy
  - https://mermaid.ai/open-source/syntax/flowchart.html
  - https://reactflow.dev/examples/grouping/sub-flows
  - https://reactflow.dev/learn/layouting/sub-flows

- [] Enhance Disjoint Force Directed Graph, Node Collision Algorithms
  - [] https://github.com/xyflow/node-collision-algorithms
  - [] https://observablehq.com/@d3/disjoint-force-directed-graph/2
  - [] https://reactflow.dev/examples/layout/node-collisions

- [] minimap 100% fidelity with canvas

#### 2026-01-19

- [] during initialization, on Canvas, GRAPH (nodes, edges, graph layers/subgraph) exhibits cluster‑aware heuristic layout, auto‑scale to 1920×1080 (16:9), center by centroid, apply bounding‑box fit with collision padding; forbid unbalanced cluster concentration/one long horizontal/vertical/diagonal line

#### 2026-01-18

- [] support PDF-to-markdown parsing & rendering

- [] support html url rendering
  - https://substack.com/home/post/p-154650527
  - https://docs.trae.ai/ide/memories?_lang=en

- [] Magnify node/edge/label on hover

#### 2026-01-16



- [x] Markdown Editor syntax highlight for Markdown

codeblock in table rendering;


  - [] 

text, `<br/>`, 
subgraph/graph layers centroid nodes, 95%;

presentation framework that supports fragment stepping:
`<v-mark color="yellow">`

Markdown Viewer/Markdown Presentation inline content yellow sticky note box;
example:
```
<h2>Speaker Notes (partially supported)</h2>
<div class="sticky-note">NOTE: Renderer partially supports this section</div>
```

#### 2026-01-15

- npm run lint/ npm run check/ npm test: non-interactive, auto-exit; FIX test hang;
- [x] FIX "Mermaid Layout" rectangular nodes (consistency, text wrap) & subgraph auto-sizing
- [x] Cleanup duplicate/unused logic
- [x] Update system-design-guidelines.md (OOM/hang prevention)

#### 2026-01-14
- https://github.com/haroldjcastillo/mermaid-land, https://haroldjcastillo.github.io/mermaid-land/,


#### 2026-01-13
- code block
  - syntax highlighting
  - [layout](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/automating-projects-using-actions)

https://cs.brown.edu/people/jcmace/d3/graph.html?id=small.json


#### 2026-01-10
- Enforce public version max 20 kb; pay to unlock to 100 kb;
- https://youtube-to-markdown.streamlit.app

#### 2026-01-07
- Add semantic parsing mode as default; provide document‑structure parsing mode as fallback.

#### 2026-01-06
- Showcase public demo repo; keep implementation private.  
  - Evaluate Git subtree split/CI/CD automation.  
  - Provide demo repo with simplified interactive version; enable instant run on FOSS hosting without installation.  

- Unify multiple documents at orchestration stage; current markdown import supports single document only.

### P1‑High

#### 2026-01-06
- Support HTML import for extended format coverage.  

- Render images as panel‑like rectangular media panel nodes (default if available); link images as fallback.

---

- Maintain functionality with neutral, config‑driven approach.  
- Implement generic heuristic for normalization.  
- Make patterns configurable for adaptability.  

---

- Refactor remote URL rewriting logic for media from nodes.ts into helper function in helpers.ts.

---

### P2-Medium

#### 2026-01-18

- [] integrate https://github.com/HeyPuter/puter.git

- [] support OCR
