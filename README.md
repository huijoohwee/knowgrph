# Summary: Complete Knowledge Graph Pipeline

This project implements a **Complete Knowledge Graph Pipeline** for transforming structured and semi‑structured content into interactive, analyzable knowledge graphs.

- **Universal CSV Schema Pattern (A0)** is the superset schema that unifies A1–A999 patterns.  
- A0 allows flexible extensions and supports mapping Markdown content into RDF triples.  
- Example source: [Chapter Summaries](https://github.com/chiphuyen/aie-book/blob/main/chapter-summaries.md).  
- Flow: Markdown → CSV (A0 schema) → JSON‑LD → RDF knowledge graph.

---

## Quick‑win Implementation Strategy

### Minimal Working Solution
1. Convert Markdown content into **CSV (A0 schema)**.  
2. Transform CSV → JSON‑LD → RDF (Turtle).  
3. Process RDF with **rdflib (Python)**.  
4. Visualize with **D3.js** or **Cytoscape.js**.  
5. Deploy static dashboards via **GitHub Pages** or **Cloudflare Pages**.  

### Deployment Instructions
- **GitHub Pages**:  
  - Store CSV/JSON datasets in repo.  
  - Use **GitHub Actions** to auto‑convert Markdown → CSV → RDF.  
  - Publish visualization frontend (React + Recharts + D3.js/Cytoscape.js).  

- **Cloudflare Pages**:  
  - Alternative hosting with faster global CDN.  
  - Sync repo → auto‑deploy pipeline outputs.  

---

## Core Stack

- **GitHub Pages** (hosting) + **GitHub Actions** (processing)  
- **Cloudflare Pages** (alternative hosting with faster global CDN)  
- **RDF/Turtle** for knowledge graph A  
- **CSV/JSON** for datasets B & C  

---

## FOSS Tools (totally free solutions)

1. **rdflib (Python)** → knowledge graph processing, SPARQL queries, RDF persistence.  
2. **D3.js** or **Cytoscape.js** → visualization of analytics and graph relationships.  
3. **Papa Parse** → CSV parsing/handling in browser.  
4. **React + Recharts** → interactive dashboard for EDA, curriculum pathways, learner progress.  

---

## Example Flow

```text
Markdown → CSV (A0 schema) → JSON-LD → RDF (rdflib)
   |
   v
SPARQL queries (rdflib) → extract modules & datasets
   |
   v
EDA (pandas/NumPy) → distributions, correlations
   |
   v
MLP (scikit-learn/PyTorch) → train/evaluate models
   |
   v
Curriculum Engine (Python) → customized exercises, feedback
   |
   v
D3.js → charts (progress dashboards, skill mastery)
Cytoscape.js → KG view (relationships, curriculum pathways)
   |
   v
User edits graph → sync back → RDF store updates → loop continues
```

---

## ✅ MVP Principles

- **Minimal**: rdflib + file persistence (no heavy triple store servers).  
- **Free**: All components are open‑source.  
- **Lightweight**: Rapid prototyping with Python + JS libraries.  
- **Iterative**: Curriculum adapts as learners interact with the graph.  
