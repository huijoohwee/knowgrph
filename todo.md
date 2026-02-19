# todo

## RULES

### Universal, neutral, project‑agnostic one‑liner in context–intent–directive

- [ ] Cross-mode; maintain separate layout caches; forbid cross-mode cache contamination
- [ ] Document Indexing; convert document over 600 lines into "index docs" that feature a section list with links to relevant code and schema
- [ ] Full‑screen; preserve inactive canvas; forbid unnecessary recompute
- [ ] Graphics; prioritize vector sources over raster
- [ ] Markup; apply semantic elements; forbid generic `div` misuse
- [ ] Modules; follow single responsibility; forbid cross‑cutting sprawl
- [ ] Performance; apply memoization/cache results; forbid costly rerendering/recalculation
- [ ] Refactoring; remove stale logic; forbid conflicting duplication
- [ ] Resolution; support 16:9 centering; forbid fixed non‑scalable layouts
- [ ] Store; centralize shared state; forbid direct mutation
- [ ] Store; short‑circuit unchanged layout caches and canvas dimensions/positions; forbid redundant updates that trigger render/recalc loops
- [ ] Styling; enforce theme tokens; forbid inconsistent overrides
- [ ] Test; unit test all components; forbid regression
- [ ] Test/Verification; ensure close-loop test/bounded execution (e.g. `KG_TEST_TIMEOUT_MS`); forbid hang/indefinite runs/infinite loop
- [ ] Utilities; centralize shared logic; forbid duplication across components
- [ ] Unique Dataset ID
- [ ] Document structure; adhere to [document-template.md](../huijoohwee.github.io/docs/document-template.md); forbid inconsistent structure

- [ ] Post-task completion; update `docs/documents/`

---

## FEATURES & FUNCTIONALITIES

### P0-Critical

#### 2026-02-19

# ENHANCE End-to-End native local in-repo Import → Render PIPELINE 
 
 ## 2D Renderer Flow Editor 
 - [x] fix; during initialization (not only when zoom-in), collective Node Quick Editors/edges layout centroid in center, well-spread out in viewport, FORBID clustering/overlaying on top each other 
 
 ## ANCHOR on Document Structure Mode (default) BASELINE, 
 ENFORCE GRAPHS/content alignment/consistency/sync, 
 FORBID mess-up other TOUCHPOINTS/MODES/LAYOUTS/ZOOMS WHEN switching across: 
     
 ### TOUCHPOINTS 
 - Editor workspace, Graph Data Table, Graph Fields, Props Panel, Markdown Editor/Viewer/Presentation/Slides Gallery, EXPLORER, Canvas Preview 
   
 ### MODES/LAYOUTS 
 - Keyword Mode/Frontmatter Mode/Canvas Mode (2D/3D), Document Mode/Geospatial Mode (2D/3D), 2D Renderer (D3 Graph, Flow, Flow Editor), Node Shape (Circle, Rect, Multi-shape), Cluster Shape (Rect, Polygon), Multi-select Mode, Port Handles, Radial Layout) 
     
 ### ZOOMS 
 - Pin to View, Fit to View, Fit to Screen, Zoom to Selection 
     
 ## ALIGN Semantic Definition 
 - **GRAPHS Elements:** nodes, Node Quick Editors, edges, graph layers (subgraphs, groups, clusters, communities), labels, text 
 - **GRAPHS Configs:** grouping, positioning, collisions, timing, knobs 
     
 ## Code Maintenance 
 - COMPLY with `/GitHub/{huijoohwee.github.io/guidelines/{codebase-neutrality-guidelines.md,codebase-maintainability-guidelines.md},knowgrph/todo.md#L5-21}` 
 - COMPLY with existing font/icon/label/text/text size/tooltip/typography semantic/design token SSOT 
 - REMOVE, PREVENT & RESOLVE cross‑repo conflicts/duplicates/stale/interference across layers/modes 
 - CENTRALIZE/REUSE shared algorithm/config/element/logic/utility (box, collision, drag, font, icon, knob, label, pan, scroll, text, text size, throttle, timing, typography, zoom) 
 - OPTIMIZE & ENHANCE cache, loading, modularity, memory, state, store, rendering performance; FORBID churn, re-calculation, re-rendering 
 - USE semantic HTML; forbid generic `<div>` 
 - UPDATE unified setting to MainPanel Settings schema 
 - TEST/VALIDATE only bounded diffs; FORBID indefinite runs 
     
 ## UPDATE CROSS‑REPO Docs `/GitHub/{knowgrph/todo-log.md,knowgrph/docs/documents,huijoohwee.github.io/schema/AgenticRAG}`

#### 2026-02-13

- ENHANCE current native design tokens—a single source of truth to improve efficiency and collaboration between product design and development

- [ ] single SSOT “capability map” (URL import → conversion → artifact storage → explorer/tree → render modes)

- [ ] 

```
# ENHANCE End-to-End native local in-repo Import URL (website, including webpages in tree/sitemap view) → Render PIPELINE with **sandboxed srcdoc iframes** 
- adhere to generic, universal, neutrality, project-agnostic parsing of Website/Webpage (NOT custom made to process only any individual specific Website/Webpage); 

## ENFORCE Mode Contract alignment in editor/viewer across Markdown/JSON/HTML/Wireframe Mode
- SHARE/REUSE Component Categorization Tokens (NAV/CTA/PRICE/TIME, etc.) across all Mode Contracts; 
- SHARE/REUSE generic signal extraction logic (no site-specific branching)

#### `wireframe-enhanced` Editor output
ENHANCE generator to match fixture's detailed structure: extend sections with Header Navigation tables, Hero breakdown, per-feature "Section Statistics", Template Showcase ASCII grid with multi-row cells, richer content, exact template names grid, and table—all driven by extracted signals and enhanced upstream markdown with additional DOM heuristics: 
(test; FORBID hardcoded URL→fixture mapping and FORBID absolute sandbox paths; keep regression fixtures under `canvas/src/__tests__/fixtures/`)

## ANCHOR on Document Structure Mode (default) BASELINE, 
ENFORCE GRAPHS/content alignment/consistency/sync, 
FORBID mess-up other TOUCHPOINTS/MODES/LAYOUTS/ZOOMS WHEN switching across: 
    
### TOUCHPOINTS 
- Editor workspace, Graph Data Table, Graph Fields, Props Panel, Markdown Editor/Viewer/Presentation/Slides Gallery, EXPLORER, Canvas Preview 
  
### MODES/LAYOUTS 
- Keyword Mode/Frontmatter Mode/Canvas Mode (2D/3D), Document Mode/Geospatial Mode (2D/3D), 2D Renderer (D3 Graph, Flow, Flow Editor), Node Shape (Circle, Rect, Multi-shape), Cluster Shape (Rect, Polygon), Multi-select Mode, Port Handles, Radial Layout) 
    
### ZOOMS 
- Pin to View, Fit to View, Fit to Screen, Zoom to Selection 
    
## ALIGN Semantic Definition 
- **GRAPHS Elements:** nodes, Node Quick Editors, edges, graph layers (subgraphs, groups, clusters, communities), labels, text 
- **GRAPHS Configs:** grouping, positioning, collisions, timing, knobs 
    
## Code Maintenance 
- COMPLY with `/GitHub/{huijoohwee.github.io/guidelines/{codebase-neutrality-guidelines.md,codebase-maintainability-guidelines.md},knowgrph/todo.md#L5-21}` 
- COMPLY with existing font/icon/label/text/text size/tooltip/typography semantic/design token SSOT 
- REMOVE, PREVENT & RESOLVE cross‑repo conflicts/duplicates/stale/interference across layers/modes 
- CENTRALIZE/REUSE shared algorithm/config/element/logic/utility (box, collision, drag, font, icon, knob, label, pan, scroll, text, text size, throttle, timing, typography, zoom) 
- OPTIMIZE & ENHANCE cache, loading, modularity, memory, state, store, rendering performance; FORBID churn, re-calculation, re-rendering 
- USE semantic HTML; forbid generic `<div>` 
- UPDATE unified setting to MainPanel Settings schema 
- TEST/VALIDATE only bounded diffs; FORBID indefinite runs 
    
## UPDATE CROSS‑REPO Docs `/GitHub/{knowgrph/todo-log.md,knowgrph/docs/documents,huijoohwee.github.io/schema/AgenticRAG}`
```

#### 2026-02-12

- [ ] ASCII Wireframe Diagram view

#### 2026-02-11

- default state unpin, layout not messy, 
- ENFORCE colission avoidance pin/unpin

- produce a short “current switching matrix” (what combinations are valid/disabled today: baseline lock, geospatial on/off, 2d/3d, 2d renderer d3/flow) using the exact guards in the referenced files—still without code changes

- [X] PDF -> MD Conversion Mode
```
# "SOURCE FILES" shows & allows user select/switch:
- text-only: default
- image-heavy: when select, show image; fix; now broken; FORBID Editor produces giant base64 strings; 
- scan/OCR
```

- [X] PDF -> MD Conversion Mode
```
# "SOURCE FILES" 
## right-side-of file-name shows & allows user select/switch (NOT right side of the Source Files header)
- text-only: default; fix; SHOULD SHOW Markdown (fix; now shows JSON);
- image-heavy: when select, Viewer shows image (fix; now broken);
- scan/OCR: what's the difference from "image-heavy", SHOULD keep/consolidate?
```

- [X] Source Files -> active file row -> PDF -> Markdown Conversion Mode
```
- text-only: default; Editor SHOULD SHOW Markdown; Viewer SHOULD RENDER Markdown (fix; now JSON);
- image-heavy: Editor SHOULD SHOW Markdown; Viewer SHOULD RENDER Markdown + Image (fix; now JSON; image broken); Canvas shows image (good)
- scan/OCR: Editor SHOULD SHOW Markdown; Viewer SHOULD RENDER Markdown + Image (fix; now JSON; image broken)
```

- [ ] Source Files -> active file row -> PDF -> Markdown Conversion Mode
```
- Canvas Preview: fix; now jittery;
- image-heavy: fix; Viewer Image broken;
- scan/OCR: fix; Viewer Image broken;
- "Indexing PDF": shows loading/indexing indicator (shared utils with "Converting PDF • .../... • ...kb/...kb" utils)
```

#### 2026-02-04

- generate a MECE “store API surface map” (action → slice → primary callers) by extracting the top ~30 most-used selectors from the 80+ useGraphStore(...) call sites (components + panels)

#### 2026-01-29

- sync, diff across multiple devices

#### 2026-01-27

- handlebars.js for templating

“Contract” Modules Worth Knowing

single “call graph”-style outline (functions only, in execution order) for the two most common journeys: (1) load JSON/CSV → see nodes on MapLibre, (2) click map POI → host selects node → both canvas + map highlight update.

#### 2026-01-24

produce a single “happy path sequence diagram” for each repo (Knowgrph import → parse → store → GraphCanvas; Knowgrph store → Gympgrph hostBridge → MapLibre layers) using the exact function names



#### 2026-01-22

- [] Export/Import Markdown fidelity, achieved through YAML Frontmatter, e.g. nodes/edges/graph layers attributes, annotations, html, etc.

https://github.com/niieani/gpt-tokenizer.git
https://github.com/openai/tiktoken.git
https://github.com/Comfy-Org/ComfyUI.git

https://reactflow.dev/examples/nodes/shapes
https://mermaid.js.org/syntax/flowchart.html
https://tiptap.dev/docs/editor/markdown


https://yoa3d.com/demo/3d-globe/

- module: load plug-in -> activate

- [] Collective sites https://bytebytego.com/guides/api-web-development/
  - https://roadmap.sh/frontend?r=frontend-beginner
  - "Extracted JSON-LD" not in Markdown Editor


- [] **Recommended GraphRAG Stack:**
```
NLTK (preprocessing: stopwords, regex, lemmatization): https://github.com/nltk/nltk.git
  ↓
HuggingFace Tokenizers (primary tokenization interface): https://github.com/huggingface/tokenizers.git
  ├─ SentencePiece (Unigram/BPE, multilingual): https://github.com/google/sentencepiece.git
  ├─ BPE (minbpe, GPT-style): https://github.com/karpathy/minbpe.git
  └─ WordPiece internally (via HF Tokenizers)
  ↓
LLM Inference
```


#### 2026-01-21

- [x] Remove YouTube transcript functionality; keep YouTube import UI placeholder only
- [x] single “pipeline map” diagram (nodes = modules/functions, edges = calls/artifacts) using the repo’s own graph format (GraphData/JSON-LD) so you can load it into Canvas and click through to source locations

surveyed the knowgrph repo end-to-end (Python parser + Canvas UI) and the pipeline is fully traceable from entrypoints through import → parse → derive → layout → render.



#### 2026-01-20

- [] Plug-in: Geo 
modular, plug-in

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

#### 2026-01-21

- [] implement FOSS alternative to https://github.com/hoochanlon/awesome_cn_stopwords.git

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
