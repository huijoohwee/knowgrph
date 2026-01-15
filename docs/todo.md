# todo

## P0-Critical

### 2026-01-15

- npm run lint/ npm run check/ npm test: non-interactive, auto-exit; FIX test hang;
- [x] 1920 by 1080 (Fit to View/Screen support 16:9, centroid centering)
- [x] FIX "Mermaid Layout" rectangular nodes (consistency, text wrap) & subgraph auto-sizing
- [x] Cleanup duplicate/unused logic
- [x] Update system-design-guidelines.md (OOM/hang prevention)

### 2026-01-14
- https://github.com/haroldjcastillo/mermaid-land, https://haroldjcastillo.github.io/mermaid-land/,


### 2026-01-13
- [] when in full-screen mode, canvas inactive, forbid recompute
- code block
  - syntax highlighting
  - [layout](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/automating-projects-using-actions)

https://cs.brown.edu/people/jcmace/d3/graph.html?id=small.json


### 2026-01-10
- Enforce public version max 20 kb; pay to unlock to 100 kb;
- https://youtube-to-markdown.streamlit.app

### 2026-01-07
- Add semantic parsing mode as default; provide document‑structure parsing mode as fallback.

### 2026-01-06
- Showcase public demo repo; keep implementation private.  
  - Evaluate Git subtree split/CI/CD automation.  
  - Provide demo repo with simplified interactive version; enable instant run on FOSS hosting without installation.  

- Unify multiple documents at orchestration stage; current markdown import supports single document only.

## P1‑High

### 2026-01-06
- Support HTML import for extended format coverage.  

- Render images as panel‑like rectangular media panel nodes (default if available); link images as fallback.

---

- Maintain functionality with neutral, config‑driven approach.  
- Implement generic heuristic for normalization.  
- Make patterns configurable for adaptability.  

---

- Refactor remote URL rewriting logic for media from nodes.ts into helper function in helpers.ts.
