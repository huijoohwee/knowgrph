# Knowgrph Geospatial Mode Document

**Context**: Knowledge graph visualization with location-aware entities  
**Intent**: Provide an integrated map view for spatial discovery while keeping GraphData + selection behavior consistent  
**Directive**: Integrate MapLibre GL + OpenFreeMap + Turf proximity queries via modular adapters; forbid hardcoded datasets and unbounded execution

---

## User Journey

1. User loads a dataset (JSON/JSON-LD/CSV/Markdown/YouTube).
2. User clicks **Geospatial Mode** (toolbar button next to **Radial Layout**).
3. The right-side panel opens on the **Map** tab and renders:
   - OpenFreeMap basemap via MapLibre GL.
   - Markers for nodes that include `properties.geo.{lat,lng}`.
4. User clicks a marker to select the corresponding graph node (bidirectional sync).
5. User clicks on the map background to set a proximity-search center and filters nearby entities.

---

## Data Contract

### Node Geo Shape (Canonical)

- **Input**: `GraphData.nodes[].properties.geo`
- **Expected shape**: `{ lat: number, lng: number }`
- Nodes with missing/invalid/out-of-range coordinates are skipped.

### Optional Boundary Overlay (GeoJSON)

- **Input**: external `FeatureCollection` (polygons/multipolygons/lines/points supported by GeoJSON)
- **Default source**: `import.meta.env.VITE_GEOSPATIAL_BOUNDARY_GEOJSON_URL` (optional)
- **Runtime override**: boundary URL input in the Geospatial panel

This is compatible with GeoJSON exports derived from the countries-states-cities database (e.g., country/state boundary FeatureCollections), provided via a URL you control.

**URL normalization**:
- GitHub `.../blob/...` URLs are normalized to `raw.githubusercontent.com/...` before fetching.
- Remote fetches are bounded by size/time and use the existing proxy fetch utility to avoid CORS surprises.

---

## Configuration

### Environment Variables (Vite)

- `VITE_GEOSPATIAL_MAP_STYLE_URL`
  - Default: `https://tiles.openfreemap.org/styles/liberty`
  - Sets MapLibre style URL (OpenFreeMap public instance or self-hosted).
- `VITE_GEOSPATIAL_BOUNDARY_GEOJSON_URL`
  - Default: empty (no overlay)
  - Optional GeoJSON boundary overlay URL.

---

## Architecture (Modular Components)

### MapLibre Adapter

- Transforms `GraphNode[]` into GeoJSON `FeatureCollection<Point>`.
- Implementation: `canvas/src/features/geospatial/mapLibreAdapter.ts`

### Spatial Query Engine (Turf)

- Proximity search uses modular Turf imports (`@turf/distance`, `@turf/helpers`).
- Output is bounded (max result limit enforced).
- Implementation: `canvas/src/features/geospatial/spatialQueryEngine.ts`

### View Synchronization (Selection)

- Map marker click → `selectNode(nodeId)` updates graph selection.
- Graph selection change → map highlight + flyTo.
- UI wiring: `canvas/src/pages/Canvas.tsx`

---

## Extensibility Hooks

- Add new coordinate extraction rules by extending the canonical `properties.geo` mapping upstream (parser transforms), rather than adding per-dataset heuristics in the map UI.
- Add additional spatial queries (area containment, relationship detection) as separate functions in the Spatial Query Engine.
- Add additional layers (D3 overlays, 3D custom layers) by extending the Geospatial panel with new MapLibre sources/layers and routing events through selection APIs.
