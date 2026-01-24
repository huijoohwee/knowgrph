# Knowgrph Geospatial Mode Document

**Context**: Map-oriented exploration on top of the 2D infinite canvas  
**Intent**: Overlay basemap + geo layers without breaking graph-first affordances  
**Directive**: Drive behavior via configuration (no hardcoded datasets/providers), bound all fetch/parse work, and preserve non-interactive overlay defaults

---

## Current Status (Runtime Overlay)

- The toolbar **Geospatial Mode** (globe) button and the **Map** tab enable a runtime map overlay.
- A MapLibre GL basemap renders as a translucent layer on top of the canvas.
- The overlay is graph-first by default: map interactions are disabled unless explicitly enabled (for example, **Hold Space** to temporarily pan/zoom).
- **Default Style**: Uses **OpenFreeMap Liberty** (`https://tiles.openfreemap.org/styles/liberty`) as the default basemap if no style URL is provided.
- **Style URL Note**: The OpenFreeMap style endpoint is the `.../styles/<styleName>` path (no trailing `/style.json`). If a pasted URL ends with `/style.json`, it should be normalized to the canonical endpoint to avoid 404s.
- Projection is configurable (**Auto / Mercator / Globe**). In **Auto**, 3D render mode uses a globe-style projection.
- Dataset layers can be added as URLs (GeoJSON or record-style JSON) and rendered as points/lines/polygons.
- Geo fields are derived during ingest for both GeoJSON inputs and record-style inputs when coordinates are present.
- “Fit to data” computes a bounded bbox and updates the overlay camera (optional animation).
- In 3D render mode, the overlay auto-fits to active geo bounds so the globe doesn’t appear “blank” by default.

### Reliability Notes

- The MapLibre instance is created once per enable-cycle (not on every dataset/graph update) to avoid cancelling in-flight style loads.
- In React dev StrictMode, effects mount/unmount twice; map creation is deferred to the next tick so the “probe” mount does not trigger aborted style requests.
- When enabling the overlay, if the persisted opacity is `0` the implementation restores a safe default opacity so the overlay cannot be “enabled but invisible”.
- Map style load failures are surfaced (console + toast) instead of silently producing a blank map.
- A persistent “blank overlay” state is prevented by warning when overlay opacity is `0%` and by timing out basemap load with a bounded error message.
- Cross-origin asset proxying is **dev-only**: on localhost, cross-origin map assets can be routed through `/__fetch_remote` to avoid CORS issues; in production/static deploys the proxy does not exist, so assets must load directly.
- Style-relative URLs are resolved against a trailing-slash base (for example `.../styles/liberty/`) so `sprite`, `glyphs`, and `source.url` relative paths resolve correctly.
- Runtime overlay status is surfaced via a native in-app toast (top-right, below the toolbar) so it stays visible above the SidePanel and other UI layers.
- If the basemap stays blank after refresh while requests succeed, the most common cause is a **0px-height overlay container** (e.g. `canvas=1728x0`). The overlay is mounted via a portal and forces viewport-sized layout (`100vw/100vh` with px fallbacks) and calls `map.resize()` to avoid this dead state.

### Troubleshooting: “Loaded” but blank

- Symptom: toast shows `styleLoaded=yes`, `tilesLoaded=yes`, `sourceLoaded=yes` but `canvas=...x0` and the basemap is invisible.
- Cause: the overlay DOM element has `height: 0` after refresh/layout transitions, so MapLibre has no drawable area.
- Fix: ensure the overlay is mounted at `document.body` (portal), forced to viewport size, and that `map.resize()` runs after style/load/resize events.

---

## User Journey

1. User loads a dataset into the graph OR opens the **Map** tab.
2. User toggles **Geospatial Mode** ON (globe button).
3. A translucent basemap overlay appears on top of the canvas (defaulting to OpenFreeMap) while graph interactions remain primary.
4. User optionally configures interaction/projection/animation settings in the Map tab.
5. User adds one or more dataset URLs in the Map tab to render additional map layers.
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

- Parse routing: `features/parsers/default.ts` → `lib/graph/io/adapter.ts` (`parseGraph`)
- Geo derivation on ingest:
  - GeoJSON: `lib/graph/geo/geojsonToGraphData.ts`
  - Records: `lib/graph/geo/arrayRecordsToGraph.ts` + `lib/graph/geo/recordHeuristics.ts`
- Overlay render + readiness/toast: `features/geospatial/GeospatialOverlay.tsx`
- Dataset URL loading + layer creation: `features/geospatial/geospatialOverlayUtils.ts` + `lib/geospatial/geojson.ts`
- UI controls: `features/geospatial/GeospatialPanel.tsx`
- Persisted state: `hooks/store/geospatialSlice.ts` + `lib/config.ls.ts`

---

## Configuration & Persistence

- Map settings persist via local storage:
  - `LS_KEYS.geospatialOverlayEnabled`
  - `LS_KEYS.geospatialStyleUrl`
  - `LS_KEYS.geospatialOverlayOpacity`
  - `LS_KEYS.geospatialInteractionMode`
  - `LS_KEYS.geospatialProjectionMode`
  - `LS_KEYS.geospatialAnimateCamera`
  - `LS_KEYS.geospatialAutoFitEnabled`
  - `LS_KEYS.geospatialDatasets`
  - `LS_KEYS.geospatialDatasetTimeoutMs`
  - `LS_KEYS.geospatialDatasetMaxBytes`
- Optional runtime configuration (no hardcoded datasets/providers):
  - `VITE_GEOSPATIAL_STYLE_URL` (default: OpenFreeMap Liberty)
  - `VITE_GEOSPATIAL_OVERLAY_OPACITY` (default: 0.65, clamped to [0,1])
  - `VITE_GEOSPATIAL_DATASETS_JSON` (dataset catalog JSON)
  - `VITE_GEOSPATIAL_DATASET_TIMEOUT_MS`
  - `VITE_GEOSPATIAL_DATASET_MAX_BYTES`

---

## Multi-Dataset Examples (No Runtime Hardcoding)

- Layer 01 (records): `https://github.com/mwgg/Airports/blob/master/airports.json`
- Layer 02 (GeoJSON): `https://github.com/dr5hn/countries-states-cities-database/blob/master/geojson/countries.geojson`
- Layer 03 (local GeoJSON fixture): `canvas/src/__tests__/demo/cities.geojson` (very large; host a sampled/simplified copy for browser rendering)

Example dataset catalog (set as `VITE_GEOSPATIAL_DATASETS_JSON`):

```json
[
  { "label": "Airports", "url": "https://github.com/mwgg/Airports/blob/master/airports.json", "format": "records" },
  { "label": "Countries", "url": "https://github.com/dr5hn/countries-states-cities-database/blob/master/geojson/countries.geojson", "format": "geojson" }
]
```
