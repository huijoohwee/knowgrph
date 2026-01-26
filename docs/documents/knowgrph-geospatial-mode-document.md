# Knowgrph Geospatial Mode Document

**Context**: Map-oriented exploration on top of the 2D infinite canvas  
**Intent**: Overlay basemap + geo layers without breaking graph-first affordances  
**Directive**: Drive behavior via configuration (no hardcoded datasets/providers), bound all fetch/parse work, and preserve graph-first defaults (overlay is off until explicitly enabled)

---

## Status (2026-01-24)

- Knowgrph keeps Geospatial Mode logic out of its codebase and loads it on-demand from the sibling repo `gympgrph` (implementation lives in `gympgrph/src/`).
- Knowgrph exposes a toolbar entrypoint (**Geospatial Mode**, right of **3D Mode**) that opens the Geo side-panel tab and toggles the gympgrph overlay.

## Current Status (Runtime Overlay)

- In the extracted module, a MapLibre GL basemap renders as a translucent layer on top of the canvas.
- The overlay supports interaction gating (**Off / Hold Space / Always**). Default interaction mode is **Always** for immediate navigation, and users can switch in the Geo panel.
- To avoid conflicts with non-map UI (for example Workspace Actions → Imported files), the overlay is only mounted when the Geo side-panel tab is selected; SidePanel expand/collapse does not toggle Geospatial Mode.
- MapLibre’s required CSS is loaded by the extracted module so host runtimes do not need to remember to import it separately (restores reliable drag/pan/zoom + pointer hit-testing).
- **Default Style**: Uses **OpenFreeMap Liberty** (`https://tiles.openfreemap.org/styles/liberty`) as the default basemap if no style URL is provided.
- **Style URL Note**: The OpenFreeMap style endpoint is the `.../styles/<styleName>` path (no trailing `/style.json`). If a pasted URL ends with `/style.json`, it should be normalized to the canonical endpoint to avoid 404s.
- Projection is configurable (**Auto / Mercator / Globe**). In **Auto**, 3D render mode uses a globe-style projection.
- Dataset layers can be added as http(s) URLs (GeoJSON or record-style JSON) and rendered as points/lines/polygons.
- Same-origin datasets can also be referenced as absolute paths (starting with `/`) so hosts can serve local GeoJSON/JSON without CORS.
- Clicking a rendered **POI** selects it:
  - Graph-node POIs select the corresponding graph node in the main canvas (selectionSource aligns with canvas clicks).
  - Dataset POIs show a lightweight selection marker + popup with dataset/feature details.
  - POI clicking follows the interaction gating (Off / Hold Space / Always).
- Dataset point layers can optionally render as clusters (MapLibre GeoJSON source clustering). Clustering is configuration-driven and dataset-agnostic.
- Geo fields are read from `GraphData` node properties when present (the module does not derive geo fields during ingest).
- “Fit to data” computes a bounded bbox and updates the overlay camera (optional animation).
- In 3D render mode, the overlay auto-fits to active geo bounds so the globe doesn’t appear “blank” by default.
- In 3D render mode, when a graph selection contains geo-capable nodes, auto-fit prefers the selection bounds so Zoom-to-Selection stays aligned with the map.

### Reliability Notes

- The MapLibre instance is created once per enable-cycle (not on every dataset/graph update) to avoid cancelling in-flight style loads.
- In React dev StrictMode, effects mount/unmount twice; map creation is deferred to the next tick so the “probe” mount does not trigger aborted style requests.
- When enabling the overlay, if the persisted opacity is `0` the implementation restores a safe default opacity so the overlay cannot be “enabled but invisible”.
- Map style load failures are surfaced (console + toast) instead of silently producing a blank map.
- A persistent “blank overlay” state is prevented by warning when overlay opacity is `0%` and by timing out basemap load with a bounded error message.
- Cross-origin asset proxying is **dev-only**: on localhost, cross-origin map assets (style JSON, sprites, glyphs, tiles, and dataset fetches) can be routed through `/__fetch_remote` to avoid CORS issues; in production/static deploys the proxy does not exist, so assets must load directly.
- Style-relative URLs are resolved against a trailing-slash base (for example `.../styles/liberty/`) so `sprite`, `glyphs`, and `source.url` relative paths resolve correctly.
- Runtime overlay status is surfaced via a native in-app toast (top-right, below the toolbar) so it stays visible above the SidePanel and other UI layers.
- Hover and click popups are rendered by MapLibre (not by the host UI) to keep POI feedback colocated with the map.
- If the basemap stays blank after refresh while requests succeed, the most common cause is a **0px-height overlay container** (e.g. `canvas=1728x0`). The overlay is mounted via a portal and forces viewport-sized layout (`100vw/100vh` with px fallbacks) and calls `map.resize()` to avoid this dead state.

### Troubleshooting: “Loaded” but blank

- Symptom: toast shows `styleLoaded=yes`, `tilesLoaded=yes`, `sourceLoaded=yes` but `canvas=...x0` and the basemap is invisible.
- Cause: the overlay DOM element has `height: 0` after refresh/layout transitions, so MapLibre has no drawable area.
- Fix: ensure the overlay is mounted at `document.body` (portal), forced to viewport size, and that `map.resize()` runs after style/load/resize events.

---

## User Journey

1. User loads a dataset into the graph.
2. In the extracted module UI, user enables the runtime overlay.
3. A translucent basemap overlay appears on top of the canvas (defaulting to OpenFreeMap) while graph interactions remain primary.
4. User optionally configures interaction/projection/animation settings in the overlay panel UI.
5. User adds one or more dataset URLs via **Source Files** (Workspace Actions), optionally registering them as Geo layers to render additional map overlay layers.
6. User clicks **Fit to data** to move the basemap camera to the combined bounds of the active geo layers.

---

## Data Contract

### Graph Nodes

- Geo-capable nodes carry `node.properties.geo.lat` and `node.properties.geo.lng` as numbers.
- Geo is derived from dataset-agnostic shapes:
  - **GeoJSON**: `FeatureCollection | Feature | Geometry`
    - Each Feature becomes a graph node.
    - Point Features derive `properties.geo` from `[lng, lat]`.
  - **Records**: generic record datasets with common coordinate fields
    - Supported record containers include arrays of objects and object maps (key → record).
    - Supported coordinate shapes include `geo.{lat,lng}` and `lat/lng`, `latitude/longitude`.

### Map Overlay Datasets

- Dataset layers are stored as URL references and loaded at runtime.
- Load is bounded by fetch size/time limits and uses best-effort parsing:
  - **GeoJSON**: Render directly.
  - **Records**: Derive a GeoJSON Point FeatureCollection when coordinate fields are detected.

---

## Implementation Map (Import → Render)

- Knowgrph pipeline (import → parse → store → render) remains in:
  - Parse routing: `canvas/src/features/parsers/default.ts` → `canvas/src/lib/graph/io/adapter.ts` (`parseGraph`)
  - Store commit: `canvas/src/hooks/store/graphDataSlice.ts` (`setGraphData`)
  - Render: `canvas/src/components/GraphCanvas.tsx` → `canvas/src/components/GraphCanvas/scene.ts`
- Extracted Geospatial Mode implementation lives in `gympgrph/src/`:
  - Overlay render + interaction gating: `gympgrph/src/features/geospatial/GeospatialOverlay.tsx`
  - Basemap lifecycle: `gympgrph/src/features/geospatial/useMapLibreBasemap.ts`
  - Dataset URL loading + layer creation: `gympgrph/src/features/geospatial/geospatialOverlayUtils.ts`
  - POI selection mapping: `gympgrph/src/features/geospatial/geospatialPoiSelection.ts`
  - UI controls: `gympgrph/src/features/geospatial/GeospatialPanel.tsx` (host may hide the dataset importer and consolidate import into Source Files)
  - Geo derivation helpers: `gympgrph/src/lib/graph/geo/*` and `gympgrph/src/lib/geospatial/*`

---

## Configuration & Persistence

- The extracted module keeps the original persistence/config design (LS-backed settings + optional env overrides) for future reuse, but Knowgrph no longer defines or uses Geospatial Mode LS keys.
- Persistence keys are namespaced to avoid collisions when multiple apps share the same origin:
  - `kg:ui:geospatial:*`

### Host Integration Notes

- `gympgrph` treats `maplibre-gl` as a host-level dependency (peer) to prevent duplicated nested installs and to allow the host bundler to prebundle the CommonJS/UMD build for ESM dev servers.
- `gympgrph` uses Tailwind utility classes in its UI (panel + overlay). When hosted inside Knowgrph, Tailwind must scan `gympgrph/src` so required classes (including stacking / pointer capture) are generated.
  - Knowgrph host config: `canvas/tailwind.config.js` includes `../../gympgrph/src/**/*.{js,ts,jsx,tsx}` in `content`.
- The overlay container hardens critical layout properties (full-screen fixed positioning, z-index, pointer-events) via inline styles to avoid “map visible but non-interactive” failures when utility-class CSS is stale or missing.

### Dataset Fetch Limits (UI)

- Dataset fetch is always bounded by `timeoutMs` and `maxBytes` (user-configurable).
- In Knowgrph, the host UI surfaces these controls in **MainPanel Workflow → Step 3 (Ingest) → Dataset fetch limits** to avoid duplicating configuration in the Geo side panel.
- The Geo side panel does not render fetch-limit inputs; it only provides geospatial overlay configuration and a small icon hint pointing users to Source Files for dataset add/import.
- Default `maxBytes` is sized to handle common public GeoJSON datasets (for example ~20MB city datasets) while still remaining bounded.
- If a dataset is too large (based on Content-Length when available), loading fails early with an actionable error instead of streaming indefinitely.
- Basemap style/tiles are fetched via the local `/__fetch_remote` proxy when running on localhost to avoid CORS issues; binary tile responses are served with a corrected Content-Length to prevent truncated PBF parsing errors.
- Dataset status shows streaming progress when Content-Length is available (bytes + %), and datasets can be reloaded via an icon action without remove/re-add.

### Graph POI Styling (UI)

- Graph-node POIs are rendered as a dedicated overlay layer and are always clickable (an invisible hit layer is used to make selection reliable).
- The Map panel exposes color pickers for:
  - Graph POI color
  - Selected outline color

### Dataset Format (Auto)

- The dataset “format” selector is intentionally removed from the UI: parsing is auto-detected (GeoJSON first, then record-derived points).
- Record datasets support common coordinate shapes (e.g. `lat/lng`, `latitude/longitude`, `geo.{lat,lng}`, `location.{lat,lng}`, `geometry.coordinates`).

### Fit Behavior

- Map panel “Fit to data” is consolidated with existing Fit-to-Screen behavior:
  - In 2D, it triggers canvas fit-to-screen (map follows the canvas transform).
  - In 3D, it triggers camera fit plus map fit-to-data.

---

## Multi-Dataset Examples (No Runtime Hardcoding)

These are examples only. The application must not ship with hardcoded datasets; users add datasets via the Geo panel or via `VITE_GEOSPATIAL_DATASETS_JSON`.

- Layer 01 (records, object-map): `https://github.com/mwgg/Airports/blob/master/airports.json`
- Layer 02 (GeoJSON polygons): `https://github.com/dr5hn/countries-states-cities-database/blob/master/geojson/countries.geojson`
- Layer 05 (records, array): `https://github.com/lutangar/cities.json/blob/master/admin2.json`
- Layer 06 (records, array): `https://github.com/lutangar/cities.json/blob/master/admin1.json`

Notes:
- Prefer `raw.githubusercontent.com/...` URLs (or providers that serve CORS-enabled JSON) for browser loading; GitHub `blob` URLs are normalized to raw.
- Same-origin paths are supported for hosted datasets (for example `/data/cities.geojson`).
- Bounded fetch limits are a feature: very large datasets should be rejected unless the user explicitly increases `datasetFetchMaxBytes` (still bounded).

Example dataset catalog (set as `VITE_GEOSPATIAL_DATASETS_JSON`):

```json
[
  { "id": "layer-01", "label": "Airports", "url": "https://raw.githubusercontent.com/mwgg/Airports/master/airports.json", "format": "records", "enabled": true },
  { "id": "layer-02", "label": "Countries", "url": "https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/geojson/countries.geojson", "format": "geojson", "enabled": true }
]
```
