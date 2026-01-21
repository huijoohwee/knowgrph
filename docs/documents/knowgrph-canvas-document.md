# Knowgrph Canvas Document

## Slogan‑style, three‑beat mantra form

- Each line is a three‑beat `Context; Intent; Directive` mantra
- **Sorting**: each line/column is organized alphabetically (A→Z) for clarity and neutrality  

- [x] Aspect Ratio; fit via schema.layout.fitTargetAspectRatio (default 16:9); forbid hardcoded viewport assumptions
- [x] Anti-Line Force; apply perpendicular jitter to linear clusters; forbid long unbalanced concentrations
- [x] Centering; center by centroid (schema.layout.fitUseCentroid); forbid skew from bounding box bias
- [x] Clusters; filter outliers when fitting (schema.layout.fitDetectClusters); forbid distortion from distant nodes
- [x] Cross-mode Cache; key layout caches by semanticMode+frontmatter+layoutMode+renderMode; forbid cross-mode contamination
- [x] Documentation; keep schema options discoverable; forbid undocumented behaviors or hidden defaults
- [x] Integration; use schema-driven fit + mermaid layout paths; forbid bypass of configuration flow
- [x] Keyword Mode; derive keyword nodes/edges from document text, remove NLTK stopwords, map frequency/strength to sizes with user-tunable scaling, preserve media overlays, and align communities with layers; forbid stopword noise and selection-only dashboards
- [x] Padding; apply fitPadding + node padding; forbid edge clipping or truncation
- [x] Port Handles; route 2D edge endpoints via schema.behavior.portHandles.*; forbid interference with tree or mermaid layouts
- [x] Rectangular Nodes; size via minimap-relative defaults (tree and port handles); forbid drift across layouts
- [x] Scaling; clamp zoom scale to safe bounds; forbid rigid or non-responsive zoom
- [x] Schema; route layout + label sizing through schema.layout.*; forbid embedded constants or dataset ties
- [x] Subgraph Containment; clamp member nodes within bounds (Cluster Layers); forbid escape or touching borders
- [x] Verification; cover fit + layout via tests; forbid dataset-specific or brittle logic
