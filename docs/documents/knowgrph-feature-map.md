# Knowgrph Feature Map

## Scope

This document maps user-facing features to built chunk families and ranks their likely mobile impact. It is based on:

- The primary built asset directory at `${KG_GITHUB_ROOT}/huijoohwee/content/knowgrph/assets`
- The managed public-route shell entry at `${KG_GITHUB_ROOT}/huijoohwee/knowgrph/index.html`
- Source-level lazy imports and worker entry points in `knowgrph/canvas/src`
- Rollup/Vite manual chunk rules in `knowgrph/canvas/vite.config.ts`

---

## Critical Path Summary

The initial mobile-critical shell appears to load these main assets:

| Asset | Role | Raw Size | Approx. Gzip Size |
|---|---|---:|---:|
| `index-qUzOfhKt.js` | app entry shell | 385,897 B | 102,928 B |
| `index-GhQFtAt1.css` | base app CSS | 115,736 B | 24,433 B |
| `react-DvR48Ysu.js` | React runtime | 178,279 B | 58,497 B |
| `d3-B3LdqdJ1.js` | graph interaction/render helper set | 146,862 B | 48,112 B |
| `ui-DBXVNWrN.js` | shared UI/runtime helpers | 58,226 B | 12,007 B |
| `elk-CVD44F0V.js` | small layout/runtime support | 5,279 B | 2,122 B |

Approximate critical-path total: about `248 KB gzip`.

Interpretation:

- The default shell is not tiny, but it is still reasonable for a feature-rich app.
- Mobile risk mainly comes from optional heavy features that are triggered after first paint.

---

## Feature-To-Chunk Mapping

| Feature | Typical User Trigger | Source Gate | Main Chunk Family / Built Chunk | Approx. Size | Mobile Risk | Notes |
|---|---|---|---|---:|---|---|
| Base 2D canvas shell | Opening the main app and staying in standard graph view | `CanvasViewport.tsx` lazy boundaries | `index-*`, `react-*`, `d3-*`, `ui-*`, `elk-*` | ~248 KB gzip critical path | Low-Medium | This is the default path and appears intentionally lean compared with optional editors/maps/3D views. |
| Graph canvas bundle | Entering 2D graph canvas | `React.lazy(() => import('@/components/GraphCanvas'))` | `GraphCanvas-DaHxw-6U.js` plus shared entry/runtime chunks | code-split | Medium | Not as individually large as Monaco/Mermaid, but still part of active interaction flow. |
| Flow canvas / flow editor | Entering flow-oriented editing surfaces | `FlowCanvasLazy`, `FlowEditorCanvasLazy` | `FlowCanvas-D6RoDgZy.js`, `FlowEditorCanvas-tUab0_Iz.js`, related manager/view chunks | code-split | Medium | Additional UI/editor complexity, but not the top bandwidth risk compared with Monaco/Mermaid. |
| Monaco editor | Opening code/text editor workflows | `ensureMonacoStyles()` and dynamic Monaco imports in `MonacoTextEditor.impl.tsx` | `monaco-CuNkO3p_.js` plus `monaco-*` chunk family and Monaco workers | 2.71 MB raw / 696 KB gzip | High | Largest single mobile feature risk; also likely to cost CPU and memory. |
| Mermaid diagrams | Rendering Mermaid code blocks or preview diagrams | `MermaidDiagramLazy`, `PlainMermaidDiagramLazy`, lazy Mermaid frontmatter geometry | `mermaid-IQEYyC-G.js`, `mermaid-elk-BCNLjWXe.js`, `mermaid-*` chunk family | 2.29 MB raw / 643 KB gzip | High | Large and easy to hit in markdown-heavy workflows. |
| Mermaid + ELK layout worker | Rendering Mermaid layouts that need ELK | Mermaid runtime + ELK integration | `elk-worker.min-BqREE3LP.js`, `mermaid-elk-BCNLjWXe.js`, `elk-CVD44F0V.js` | worker: 1.58 MB raw / 456 KB gzip | High | Secondary cost layered on top of Mermaid-heavy flows. |
| GeoJSON / geospatial map preview | Opening GeoJSON panels or geospatial previews | `ensureMapLibreStyles()` in `GeoJsonGeoPanelRenderer.tsx` | `maplibre-Bu2BfbQN.js`, `maplibre-B1CfjdFi.css`, `maplibre-*` chunk family | 946 KB raw / 246 KB gzip | Medium-High | Cost is acceptable if rare, but risky if common on phones. |
| 3D graph view | Switching to 3D graph surface | `ThreeGraphLazy` in `CanvasViewport.tsx` | `three-BPabpvXh.js`, `three-*` chunk family | 909 KB raw / 245 KB gzip | Medium-High | Heavy enough to matter, especially on lower-end GPUs/CPUs. |
| GLB export from 3D | Exporting 3D scene | dynamic import of `GLTFExporter.js` | `three-examples` chunk family | code-split | Medium | Triggered only on export, not normal first-view browsing. |
| HTML/markup worker paths | HTML processing or export-related flows | worker imports | `html.worker-DPJnqRvd.js` | 696 KB raw / 181 KB gzip | Medium | Background-only, but significant if hit frequently. |
| Graph parser worker | Parsing imported graph text/data | `parseGraphInWorker()` | `graphParser.worker-BoMiEpkI.js` | 81 KB raw / 26 KB gzip | Low-Medium | Much smaller than Monaco/Mermaid. Mostly background parse cost. |
| Keyword graph worker | Semantic keyword graph generation | `keywordGraph.worker.ts` worker client | `keywordGraph.worker-DmTITCAV.js` | built worker | Medium | Background cost; depends on semantic workflows rather than default browsing. |
| Minimap preview worker | Minimap preview generation | `requestMinimapPreview()` | `minimap.worker-Bctsm8A6.js` | 3 KB raw / 1.3 KB gzip | Low | Negligible bandwidth impact. |
| Monaco editor workers | Monaco JSON/HTML/editor workers | Monaco environment worker creation | `editor.worker-r3OlCkm2.js`, `json.worker-DsZ4xiA7.js`, `html.worker-DPJnqRvd.js` | varies | Medium-High | Only relevant after Monaco is already in play. |
| OpenAI Images generation | Generating images via OpenAI Images API | `generateRunImageWithDeerFlow` / OpenAI provider path | `openaiImagesSsot.ts`, `openaiImagesApiDocs.ts` | code-split | Low | API call latency dominates; SSOT rows are lightweight. |
| Gemini Veo video generation | Generating videos via Google Gemini Veo API | `generateRunVideoWithGemini` | `geminiVideoGenerationSsot.ts`, `geminiRunGeneration.ts` | code-split | Low | Long-running operation (poll up to ~6 min); payload is small. |
| DeerFlow rich media generation | Generating images/videos via DeerFlow provider | `generateRunImageWithDeerFlow`, `generateRunVideoWithDeerFlow` | `deerflowRunGeneration.ts` | code-split | Low | SSE streaming + binary download; SSOT is lightweight. |
| PWA install + offline | Install-to-homescreen, offline shell, Web Share API | `installPwaRuntime()` | `pwa/runtime.ts`, `sw.js` (generated) | SW: varies | Low | Service worker cached at build time; install prompt is deferred. |
| Canvas doc deep linking | Opening shared documents via URL | `CanvasDocDeepLinkRuntime` | `CanvasDocDeepLinkRuntime.tsx` | code-split | Low | Renderless component; triggers import on mount. |

---

## Mobile Risk Matrix

| Feature | Trigger Frequency On Mobile | Payload Cost | CPU / Memory Cost | First-Paint Reachability | Overall Mobile Risk | Recommended Mitigation |
|---|---|---|---|---|---|---|
| Base 2D shell | High | Medium | Medium | Immediate | Low-Medium | Keep entry lean; preserve current lazy boundaries; keep compression/caching enabled. |
| Graph canvas | High | Medium | Medium | Near-immediate after shell | Medium | Avoid pulling editor/map/3D helpers from the default graph path. |
| Monaco editor | Medium | Very High | Very High | Deferred | High | Keep off common phone flows; gate editor-first routes; lazy-load styles/workers only on demand. |
| Mermaid diagrams | Medium-High in markdown workflows | Very High | High | Deferred | High | Avoid eager diagram rendering on initial mobile views; lazy-render or defer offscreen diagrams. |
| Mermaid + ELK layouts | Medium | Very High | High | Deferred | High | Keep ELK-specific paths opt-in; avoid auto-running expensive layout work on small screens. |
| GeoJSON / MapLibre preview | Low-Medium | High | Medium-High | Deferred | Medium-High | Only load map mode when geospatial content is actually opened; consider mobile-specific gating or preview fallbacks. |
| 3D graph view | Low-Medium | High | High | Deferred | Medium-High | Keep 3D out of default routes; avoid auto-switching to 3D on coarse-pointer devices. |
| GLB export | Low | Medium | Medium | Deferred | Medium | Safe as a deep-action feature; do not preload export helpers. |
| HTML worker flows | Medium | Medium-High | Medium | Deferred | Medium | Keep in worker-only paths; avoid triggering HTML export/processing automatically on mobile. |
| Graph parser worker | Medium | Low | Low-Medium | Deferred | Low-Medium | Acceptable as-is; monitor parse latency on large imports rather than transfer size. |
| Keyword graph worker | Low-Medium | Medium | Medium | Deferred | Medium | Keep tied to explicit semantic workflows. |
| Minimap worker | Medium | Low | Low | Deferred | Low | Safe; already lightweight. |

---

## Highest-Value Mobile Targets

If mobile responsiveness needs the fastest wins, prioritize these in order:

1. Monaco editor
2. Mermaid runtime and Mermaid+ELK paths
3. MapLibre geospatial preview
4. Three.js 3D graph flows

Why:

- They combine the largest transfer sizes with the most likely CPU or memory pressure on mobile devices.
- They are also the most important feature families to keep out of default or first-session mobile flows.

---

## Current Evidence Of Healthy Lazy Loading

The current source already shows good mobile hygiene in several places:

- `main.tsx` stays lean and imports only the shell plus shared CSS/runtime setup.
- `CanvasViewport.tsx` lazy-loads major surfaces such as graph, flow, design, minimap, spotlight, and 3D.
- `MonacoTextEditor.impl.tsx` loads Monaco styles and Monaco modules on demand.
- Markdown Mermaid rendering uses `React.lazy(...)` instead of eager runtime imports.
- `GeoJsonGeoPanelRenderer.tsx` requests MapLibre styles only when GeoJSON behavior is relevant.
- `vite.config.ts` manually splits Monaco, Mermaid, Three, and MapLibre into dedicated chunk families.

This means the build is better described as:

- `mobile-safe default shell`
- `mobile-expensive optional feature set`

not:

- `globally too large for mobile`

---

## Practical Recommendation

For stronger mobile performance, the next step should be a focused optimization pass on the highest-cost optional features rather than broad shell changes.

Recommended order:

1. Monaco editor
2. Mermaid runtime and Mermaid+ELK flows
3. MapLibre geospatial preview
4. Three.js 3D graph flows

Why this order:

- These paths dominate optional transfer size.
- They are also the most likely to add CPU, memory, and interaction latency on lower-end phones.
- The default shell already appears relatively lean compared with these feature families.

Recommended mobile-first actions:

- Keep Monaco out of common phone entry flows and editor-first routes unless the user explicitly opens editing.
- Defer Mermaid rendering until the diagram is visible or requested, especially in markdown-heavy mobile sessions.
- Keep map and 3D features behind explicit user intent; avoid automatic activation on coarse-pointer devices.
- Preserve and extend granular chunk splitting so Monaco, Mermaid, MapLibre, and Three subfamilies remain independently cacheable and deferrable.
- Measure route-and-action journeys instead of raw asset totals, because the real mobile bottleneck is feature activation, not total build size.

The most useful concrete follow-up is a route-and-action matrix that records, for each mobile-relevant workflow:

- which user interaction triggers each heavy chunk family
- whether the interaction is common, occasional, or rare on phones
- whether the feature is required immediately, can be delayed, or can be replaced with a lighter mobile fallback
- whether the flow adds mainly bandwidth cost, CPU cost, memory cost, or all three

### Action Table

| Horizon | Focus | Goal | Actions |
|---|---|---|---|
| Immediate | Monaco and Mermaid entry control | Keep the default mobile shell lean | Verify Monaco is absent from common phone entry flows; defer Mermaid rendering until visible or requested; avoid eager diagram work on first mobile paint. |
| Immediate | Route-and-action measurement | Replace bundle-size guesswork with workflow evidence | Record which mobile journeys trigger Monaco, Mermaid, MapLibre, and Three; note trigger frequency and whether the feature is required immediately. |
| Near-Term | Map and 3D gating | Keep expensive visual modes opt-in | Prevent automatic MapLibre or Three activation on coarse-pointer devices; require explicit user intent before loading geospatial or 3D views. |
| Near-Term | Chunk and cache hygiene | Preserve deferrable heavy feature families | Keep granular Monaco, Mermaid, MapLibre, and Three chunk splitting; verify caching/compression on deploy so repeated mobile sessions reuse those chunks. |
| Later | Mobile-specific fallbacks | Reduce cost for high-frequency heavy workflows | Introduce lighter mobile alternatives where justified, such as static or deferred diagram/map previews before full runtime activation. |
| Later | Journey-based performance budgets | Turn the feature map into ongoing guardrails | Define acceptable mobile budgets per workflow for transfer, parse/execute time, and interaction latency; use them to prioritize future optimization work. |
