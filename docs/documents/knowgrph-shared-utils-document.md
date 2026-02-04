# Knowgrph Shared Utilities (grph-shared)

## Design Mantras

```
- [ ] Boundaries; keep runtime contracts explicit; forbid importing `grph-shared/src/*` directly
- [ ] Neutrality; share domain-agnostic helpers; forbid project-specific assumptions
- [ ] Compatibility; run in Node+browser; forbid shipping TS-only exports to Node consumers
- [ ] Reusability; centralize shared logic; forbid copy-paste duplication across repos
```

---

## Architecture

**Package**: `knowgrph/grph-shared` exposes a small, stable surface used by sibling repos.

**Exports (public subpaths)**:
- `grph-shared/array/reorderList`
- `grph-shared/graph/types`
- `grph-shared/markdown/formatting`
- `grph-shared/markdown/backlinks`
- `grph-shared/markdown/slugify`
- `grph-shared/markdown/toc`
- `grph-shared/markdown/wikiLinks`
- `grph-shared/zoom/presets`
- `grph-shared/url`
- `grph-shared/hash/stringHash`
- `grph-shared/net/fetchRemoteText`
- `grph-shared/cache/LRUCache`

**Build contract**:
- Runtime imports resolve to `dist/*.js` (ESM).
- Type imports resolve to `dist/*.d.ts`.

This ensures Node-side entrypoints (notably Vite config) never attempt to execute `.ts` files from `node_modules`.

---

## Integration Points

**Knowgrph Canvas**
- Host wrappers live under `knowgrph/canvas/src/lib/*` and re-export from `grph-shared/*`.
- `knowgrph/canvas/vite.config.ts` may import small helpers (e.g. text sanitizers) but relies on the JS `dist/` export contract.
- Canvas scripts compile `grph-shared` as part of `predev`, `prebuild`, and `pretest:ci`.

**Markdown SSOT consumers**
- Viewer/Presentation share wikilinks/backlinks/slugify via `grph-shared/markdown/*` to prevent UI↔parser drift.

**Gympgrph**
- Depends on `grph-shared` via file dependency pointing at `knowgrph/grph-shared`.
- Uses the same wrapper pattern (`gympgrph/src/lib/*`) to keep downstream imports stable.

---

## Forbidden Patterns

| Context | Intent | Directive |
|---|---|---|
| Imports | Preserve boundaries | - [ ] Use `grph-shared/*` exports only; forbid `grph-shared/src/*` imports |
| Packaging | Preserve Node compatibility | - [ ] Export `dist/*.js` for runtime; forbid exporting TS source paths |
| Ownership | Keep SSOT | - [ ] Keep shared code under `knowgrph/grph-shared`; forbid a second sibling `../grph-shared` repo |

---

## Verification (Bounded)

- `npm --prefix knowgrph/canvas run build:grph-shared`
- `npm --prefix knowgrph/canvas run dev` (must reach Vite “ready”)
- `node --preserve-symlinks --preserve-symlinks-main ./node_modules/tsx/dist/cli.cjs src/tests/focusedSharedUtils.ts` (Canvas)
