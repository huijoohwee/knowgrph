# Knowgrph Local Storage Document

**Context**: Persisted UI and workflow settings in the browser  
**Intent**: Provide stable, discoverable storage keys with a single source of truth  
**Directive**: Reference only canonical keys from `canvas/src/lib/config.ls.ts` (no magic strings). For plugin-owned keys, import keys from the plugin package (host must not hardcode).

---

## Source of Truth

- Canonical LocalStorage keys live in `LS_KEYS` in `canvas/src/lib/config.ls.ts`.
- Code should read/write keys via `ls*` helpers in `canvas/src/lib/persistence.ts`.

---

## Geospatial Mode (Extracted)

- Knowgrph keeps Geospatial Mode keys out of `canvas/src/lib/config.ls.ts` to preserve a geospatial-free core.
- The Geospatial Mode implementation (including its persistence design) lives in the sibling repo `gympgrph` and owns its LocalStorage keys.
