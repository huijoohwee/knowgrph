# todo

## RULES

### Universal, neutral, project‑agnostic one‑liner in context–intent–directive
- [] For consistent functionality, reuse the shared utils module across components to centralize common logic and reduce duplication
- [] Maintain the `UI_THEME_TOKENS` styling for consistency
- [] 1920 by 1080 (Fit to View/Screen support 16:9, centroid centering)
- [] when in full-screen mode, canvas inactive, forbid recompute
- [] In markup, use semantic HTML elements and forbid generic div for structural meaning.
- [] Use feature‑scoped modules that follow the Single Responsibility Principle, and forbid cross‑cutting generic modules.
- [] During refactoring, cleanup duplicate, conflicting, stale, and legacy logic to maintain clarity and consistency.
- [] Apply memoization to cache results and forbid expensive recalculation or unnecessary rerendering.
- [] Update `/Users/huijoohwee/Documents/GitHub/knowgrph/docs/documents`

## FEATURES & FUNCTIONALITIES

### P0-Critical

#### 2026-01-18

- [] support PDF-to-markdown parsing & rendering

- [] support html url rendering
  - https://substack.com/home/post/p-154650527
  - https://docs.trae.ai/ide/memories?_lang=en

- [] Magnify node/edge/label on hover

#### 2026-01-16



Markdown Editor syntax highlight for Markdown

codeblock in table rendering;

- [] Initialize GRAPH (nodes, edges, graph layers/subgraph) with cluster‑aware heuristic layout, auto‑scale to 1920×1080 (16:9), center by centroid, and apply bounding‑box fit with collision padding
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

