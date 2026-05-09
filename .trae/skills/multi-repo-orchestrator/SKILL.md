---
name: "multi-repo-orchestrator"
description: "Orchestrates coordinated changes across knowgrph, curagrph, gympgrph, sandbox, and docs repo. Invoke when work spans repos or requires shared-contract alignment."
---

# Multi‑Repo Orchestrator

Use this skill to plan, implement, and verify changes that span multiple repositories under:

- `${KG_GITHUB_ROOT}/knowgrph`
- `${KG_GITHUB_ROOT}/curagrph`
- `${KG_GITHUB_ROOT}/gympgrph`
- `${KG_GITHUB_ROOT}/sandbox`
- `${KG_GITHUB_ROOT}/huijoohwee.github.io`

## When To Invoke

Invoke this skill when any of the following is true:

- A change touches 2+ repos or one repo depends on another and needs compatibility updates.
- You need to coordinate a shared interface: types, schemas, settings models, export/import formats, UI contracts.
- A bug reproduces in one repo but root cause likely lives in another.
- You need a safe rollout path for a breaking change across packages and the app.

## Repo Map (Default Mental Model)

- **knowgrph**
  - **Role:** primary app host (Vite + React) and integration point.
  - **Key path:** `knowgrph/canvas` (app)
  - **Local deps:** `curagrph` and `gympgrph` are consumed via local `file:` dependencies.
- **curagrph**
  - **Role:** UI + curation/markdown/preview features exported as a package.
  - **Key paths:** `curagrph/src/components`, `curagrph/src/features`
- **gympgrph**
  - **Role:** geospatial feature package (MapLibre integration, overlays, datasets).
  - **Key paths:** `gympgrph/src/features/geospatial`, `gympgrph/src/lib/geospatial`
- **sandbox**
  - **Role:** fixtures, demo inputs, and scratch artifacts for manual validation.
- **huijoohwee.github.io**
  - **Role:** guidelines + schemas + reference artifacts (documentation SSOT).

## Operating Principles

- **Contract‑first:** define or validate the interface boundary before changing internals.
- **Single SSOT:** choose one canonical source for shared types/schema and reference it consistently.
- **Minimal blast radius:** prefer additive changes; gate breaking changes behind compatibility adapters.
- **Cross‑repo safety:** avoid circular dependencies; keep package exports stable and explicit.
- **Verification is part of the change:** every cross‑repo change must include a verification path that proves the integration still works.

## Standard Workflow

### 1) Discover + Bound The Change

- Identify the user-visible behavior change and the involved surfaces (UI, parsing, schema, export, geospatial, etc.).
- Locate the contract boundary (exports, shared types, JSON shape, settings schema, etc.).
- Determine the dependency direction:
  - If `knowgrph/canvas` consumes a package (`curagrph` / `gympgrph`), implement package changes first, then update the host.

### 2) Decide The Change Strategy

Choose one:

- **Additive extension:** add fields/exports while keeping old behavior working.
- **Compatibility layer:** introduce an adapter that supports old + new at the boundary.
- **Breaking change:** only when required; stage in 2 steps (add new, migrate call sites, remove old).

### 3) Implement Per‑Repo With Tight Interfaces

- Keep repo-local concerns inside the repo; export only what the host must consume.
- If you need a new export from `curagrph` / `gympgrph`, add it to that repo’s `exports` surface, then update imports in the host.
- Ensure any shared JSON formats remain round‑trippable and version-tolerant when possible.

### 4) Verify In The Right Place

Run the narrowest verification that proves the integration:

- **knowgrph/canvas (host app)**
  - `npm test` (runs CI test runner)
  - `npm run lint`
  - `npm run typecheck`
- **curagrph (package)**
  - `npm run typecheck`
- **gympgrph (package)**
  - `npm run typecheck`

If the change affects runtime behavior in the app, also run:

- `npm run dev` in `knowgrph/canvas` and sanity-check the affected UI flow.

### 5) Stabilize + Prevent Regression

- Add or update the smallest possible test in the repo where the behavior is owned.
- If the bug was cross-repo, add a host-level integration test that exercises the boundary.

## Cross‑Repo Compatibility Checklist

- Exports remain stable (or host updated in lockstep).
- Types line up across repo boundaries (no duplicated “same” types with drift).
- Data formats remain backward compatible unless explicitly versioned.
- Any settings/schema changes are reflected in the generating/extracting logic and the consuming UI.
- Build/test scripts still pass in the host and in affected packages.

## Examples (Invocation Patterns)

- **“Add a new markdown feature used by the app.”**
  - Change `curagrph` markdown renderer/export surface → update `knowgrph/canvas` usage → run host tests.
- **“Geospatial overlay selection broken in the app.”**
  - Reproduce in `knowgrph/canvas` → trace into `gympgrph` overlay interactions → patch package → verify host behavior.
- **“New workflow/schema field needs UI + parser + docs alignment.”**
  - Update schema SSOT (docs repo) → update parsers/validators (packages/host) → update UI surfaces → add roundtrip test.
