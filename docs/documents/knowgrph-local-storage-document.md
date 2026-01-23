# Knowgrph Local Storage Document

**Context**: Persisted UI and workflow settings in the browser  
**Intent**: Provide stable, discoverable storage keys with a single source of truth  
**Directive**: Reference only canonical keys from `canvas/src/lib/config.ls.ts` (no magic strings)

---

## Source of Truth

- Canonical LocalStorage keys live in `LS_KEYS` in `canvas/src/lib/config.ls.ts`.
- Code should read/write keys via `ls*` helpers in `canvas/src/lib/persistence.ts`.

---

## Geospatial Mode Keys

| Key | Purpose |
|---|---|
| `LS_KEYS.geospatialOverlayEnabled` | Persists whether Geospatial Mode is enabled. |
| `LS_KEYS.geospatialStyleUrl` | Persists MapLibre style URL for the basemap. |
| `LS_KEYS.geospatialOverlayOpacity` | Persists overlay opacity (clamped to [0,1]). |
| `LS_KEYS.geospatialDatasets` | Persists dataset layer URL references for the map overlay. |
