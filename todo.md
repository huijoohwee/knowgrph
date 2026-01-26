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
