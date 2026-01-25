# curagrph Graph Data Curation (UI Surfaces)

## Overview

`curagrph` owns the Graph Data curation and presentation UI surfaces (tables, editors, viewers), while host apps (e.g. `knowgrph`) own pipeline orchestration and state.

**Goal**: enforce single-source-of-truth ownership for Graph Data UI surfaces while keeping host-visible UI behavior unchanged.

---

## Scope (owned by curagrph)

- BottomPanel curation/presentation submodules (curator + markdown + stats + JSON views)
- Graph Data Table (filter/sort/group + frozen areas + virtualized rows)
- Markdown viewer/editor/presentation/gallery surfaces
- Preview-panel UI primitives used by markdown/presentation (gallery + overlays + zoom/pan)
- JSON editor used by curation and inspectors

---

## Integration Contract

The canonical host integration pattern for extracted UI surfaces is:

- **Resolution target**: hosts resolve extracted modules from the installed package source at `node_modules/curagrph/src` (never from sibling `../../curagrph/src` paths).
- **Host aliases**: hosts map stable import prefixes (e.g. `@/features/markdown/*`) to `./node_modules/curagrph/src/...` in both bundler config (Vite) and TypeScript `paths`.
- **Symlink stability**: hosts preserve symlink paths in both bundler and TypeScript resolution so `node_modules/curagrph/src/...` stays the canonical resolved location.
- **Styling parity**: hosts include `node_modules/curagrph/src/**/*.{js,ts,jsx,tsx}` in Tailwind content scanning so extracted classes remain stable.
- **Dependency stability**: hosts dedupe shared deps across linked packages (notably `react` and `highlight.js`) and pre-optimize `highlight.js` so markdown rendering does not hit ESM/CJS default-export hazards.
- **Coupling guardrail**: `curagrph` must not import host code via hardcoded sibling paths; any host coupling must occur only through stable host-provided module prefixes (e.g. `@/hooks/*`, `@/lib/*`) so the host controls the contract surface.

This contract is the default pattern for future UI extractions so module ownership stays neutral and maintainable without reintroducing duplicate/competing implementations in host repos.
