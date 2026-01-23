# Knowgrph Geospatial Mode Document

**Context**: Map-oriented exploration on top of the 2D infinite canvas  
**Intent**: Overlay basemap + geo layers without breaking graph-first affordances  
**Directive**: Drive behavior via configuration (no hardcoded datasets/providers), bound all fetch/parse work, and preserve non-interactive overlay defaults

---

## Current Status (Runtime Overlay)

- The toolbar **Geospatial Mode** (globe) button and the **Map** tab enable a runtime map overlay.
- A non-interactive MapLibre GL basemap renders as a translucent layer on top of the canvas (pointer events pass through to the graph).
- **Default Style**: Uses **OpenFreeMap Liberty** (`https://tiles.openfreemap.org/styles/liberty`) as the default basemap if no style URL is provided.
- In 3D render mode, the overlay switches to a **globe-style projection**.
- Dataset layers can be added as URLs (GeoJSON or record-style JSON) and rendered as points/lines/polygons.
- Geo fields are derived during ingest for both GeoJSON inputs and record-style inputs when coordinates are present.
- “Fit to data” computes a bounded bbox and updates the overlay camera (no unbounded spatial loops).
- In 3D render mode, the overlay auto-fits to active geo bounds so the globe doesn’t appear “blank” by default.

---

## User Journey

1. User loads a dataset into the graph OR opens the **Map** tab.
2. User toggles **Geospatial Mode** ON (globe button).
3. A translucent basemap overlay appears on top of the canvas (defaulting to OpenFreeMap) while graph interactions remain primary.
4. User adds one or more dataset URLs in the Map tab to render additional map layers.
5. User clicks **Fit to data** to move the basemap camera to the combined bounds of the active geo layers.

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

## Configuration & Persistence

- Map settings persist via local storage:
  - `LS_KEYS.geospatialOverlayEnabled`
  - `LS_KEYS.geospatialStyleUrl`
  - `LS_KEYS.geospatialOverlayOpacity`
  - `LS_KEYS.geospatialDatasets`
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
