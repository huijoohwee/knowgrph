# Knowgrph Canvas Default Initialization Document

## Design Mantras

```
- [ ] Defaults; enforce predictable startup state; forbid implicit persisted drift
- [ ] Separation; keep layout concerns schema-driven; forbid UI hardcoding
- [ ] Determinism; stabilize initial view across sessions; forbid random initial toggles
- [ ] Neutrality; default to document structure; forbid domain-tuned initial modes
- [ ] Safety; prefer reversible toggles; forbid one-way initialization side effects
```

---

## Universal Design Principles

| Context           | Intent                         | Directive                                                                 |
|------------------|--------------------------------|---------------------------------------------------------------------------|
| Configuration    | Externalize behavior            | - [ ] Drive layout via schema + store flags; forbid inline UI-only state  |
| Consistency      | Match user mental model         | - [ ] Apply the same startup defaults every init; forbid drift             |
| Determinism      | Repeatable startup              | - [ ] Normalize schema on init; forbid hidden variability                  |
| Separation       | Isolate responsibilities        | - [ ] Keep schema defaults in schema.ts; keep init normalization in store  |
| Reliability      | Avoid conflicting defaults      | - [ ] Remove contradicting initial values; forbid duplicate truth sources  |
| Performance      | Avoid unnecessary work          | - [ ] Skip initial simulation layout if stable; forbid redundant recalculation |

---

## Canvas Initialization Architecture

**Stack**: Store Initialization → Schema Normalization → Graph Derivation → Force Simulation → Render

**Flow**: App mount → load schema (storage or default) → apply init normalization → render force layout (skip seed if stable).

**Design Principles**: Consistency | Determinism | Separation | Configuration

### High-Level Components

- **Schema Defaults**:
  - [schema.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/lib/graph/schema.ts) defines the baseline schema defaults for new sessions.
- **Initialization Normalization**:
  - [useGraphStore.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/hooks/useGraphStore.ts) enforces the startup defaults by applying an initialization schema normalizer.
- **Canvas Rendering**:
  - [GraphCanvas.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas.tsx) renders the graph using the normalized schema and current toggle flags.
- **Simulation Control**:
  - [positioning.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/layout/positioning.ts) determines if simulation should skip initial seed layout (warm start).

---

## Module Specifications

### Module: Store Initialization Normalizer

**Responsibility**: Store initializer loads schema → applies default-init normalization → exposes a consistent startup state.

**Interface Pattern**: `applyCanvasDefaultInitSchema(schema)` → returns normalized schema → complexity: O(1)

**Enforcement Location**:
- [useGraphStore.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/hooks/useGraphStore.ts)

**Design Compliance**:

| Context          | Intent                          | Directive                                                                 | Module/Component | Function/Method                   | Input               | Output              | Decision Logic |
|-----------------|----------------------------------|---------------------------------------------------------------------------|------------------|-----------------------------------|---------------------|---------------------|----------------|
| Defaults        | Stable startup                   | - [ ] Normalize init schema; forbid inconsistent initial toggles          | useGraphStore.ts | applyCanvasDefaultInitSchema       | GraphSchema         | GraphSchema         | force + document + portHandles (default off) |
| Frontmatter     | Enable safe frontmatter focus     | - [ ] Default ON; forbid blank canvas: if no frontmatter Mermaid, fall back to full graph | uiSettingsSlice.ts | frontmatterModeEnabled default   | —                   | boolean             | default true + filter fallback |
| Toolbar Modes   | Prefer document semantics at init | - [ ] Default Document Structure + Document Mode; forbid keyword/geospatial as implicit default | uiSettingsSlice.ts | documentSemanticMode + geospatialEnabled | — | boolean/enum | documentSemanticMode='document'; geospatialEnabled=false |
| Layer Mode      | Prefer document structure        | - [ ] Default document mode; forbid semantic-first default                | schema.ts        | defaultSchema.layers.mode         | —                   | 'document'          | constant |
| Port Handles    | Disable by default               | - [ ] Default OFF; forbid implicit border anchoring at init               | schema.ts        | defaultSchema.behavior.portHandles | —                   | enabled false       | constant |

---

## Component Responsibility Matrix

| Layer/Subsystem | Path/Module                    | Component           | Interface/Method        | Responsibility (S-V-O)                                                | Dependencies                    | Contracts                             | LOC    |
|-----------------|--------------------------------|---------------------|-------------------------|-----------------------------------------------------------------------|---------------------------------|---------------------------------------|--------|
| Store           | `hooks/useGraphStore.ts`       | useGraphStore       | `applyCanvasDefaultInitSchema` | Store enforces schema defaults → returns normalized schema → guarantees safe init | `schema.ts`                     | Must return valid schema              | ~10    |
| Store           | `hooks/store/uiSettingsSlice.ts`| createUiSettingsSlice| `frontmatterModeEnabled` | Slice initializes UI flags → sets default boolean → controls frontmatter focus mode | `types.ts`                      | Default must be true (safe fallback)  | ~5     |
| Canvas          | `components/GraphCanvas.tsx`   | GraphCanvas         | `useEffect`             | Canvas initializes scene → triggers simulation → renders graph        | `scene.ts`, `simulation.ts`     | Renders SVG from graphData            | ~100   |
| Layout          | `layout/positioning.ts`        | determineLayoutPositions | `determineLayoutPositions` | Logic calculates cache usage → determines skipInitialLayout → optimizes re-render | `types.ts`                      | Returns layout strategy               | ~80    |

---

## Dependency & Integration Standards

**Dependency Declaration**

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Store Dependencies   | Centralized state management    | - [ ] Import slices; compose store; forbid circular slice dependencies                     |
| Schema Dependencies  | Type-safe configuration         | - [ ] Import GraphSchema types; use defaultSchema constants; forbid magic strings          |

**Integration Contracts**

- **Initialization Contract**:
  - Must ensure `layout.mode` is 'force'.
  - Must ensure `frontmatterModeEnabled` is true.
  - Must ensure Frontmatter Mode never yields an empty canvas: if no frontmatter Mermaid nodes exist, render the full graph.
  - Must default to Document Mode by disabling Geospatial Mode on init (forbid persisted geospatial drift producing an empty graph canvas).
  - Must ensure `graphLayersVisible` is true.

---

## Code Organization Framework

**Directory Structure**:

```text
canvas/
├── src/
│   ├── components/
│   │   └── GraphCanvas/
│   │       ├── GraphCanvas.tsx       # Main component
│   │       ├── scene.ts              # Scene setup
│   │       ├── simulation.ts         # Force simulation
│   │       └── layout/
│   │           └── positioning.ts    # Layout strategy
│   ├── hooks/
│   │   ├── useGraphStore.ts          # Store entry point
│   │   └── store/
│   │       ├── uiSettingsSlice.ts    # UI settings
│   │       └── canvasSlice.ts        # Canvas settings
│   └── lib/
│       └── graph/
│           └── schema.ts             # Schema definitions
```

---

## Testing & Quality Standards

**Test Coverage Metrics**

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Initialization       | Verify defaults                 | - [ ] Assert initial store state; verify schema normalization; forbid drift                 |
| Re-rendering         | Verify stability                | - [ ] Mount canvas; update props; verify simulation does not restart unnecessarily          |

**Quality Gates**

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Default Config       | Ensure user safety              | - [ ] Validate defaults match 'Disjoint Force'; forbid 'Tree'/'Radial' default              |

---

## Data Flow

**Pipeline**: App Load → Store Init → Schema Normalization → Canvas Mount → Simulation Build → Render

| Stage       | Input                          | Output                         | Responsibility                                              | Performance Consideration                    |
|-------------|--------------------------------|--------------------------------|-------------------------------------------------------------|----------------------------------------------|
| Store Init  | LocalStorage / Defaults        | Initial State                  | Merges persisted data with enforced defaults                | Fast sync read                               |
| Normalization| Raw Schema                    | Normalized Schema              | Applies `applyCanvasDefaultInitSchema`                      | O(1)                                         |
| Canvas Mount| GraphData + Schema             | SVG Elements                   | Sets up D3 zoom, layers, simulation                         | Expensive DOM ops (use refs)                 |
| Simulation  | Nodes + Edges                  | Node Positions (x,y)           | Runs force layout (or skips if stable)                      | Heavy CPU (skip if `skipInitialLayout`)      |

---

## Design Decisions & Trade-offs

| Decision             | Rationale                          | Pros                                                  | Cons                                      | Mitigation                                    |
|----------------------|------------------------------------|-------------------------------------------------------|-------------------------------------------|-----------------------------------------------|
| Force 'Force' Mode   | Most general purpose layout        | Handles any graph structure; good for exploration     | Less structured than Tree/Radial          | User can switch modes manually                |
| Skip Initial Layout  | Prevent jitter/recalculation       | Stable rendering on minor updates; better perf        | Might not converge if positions are bad   | Fallback to layout if coverage < 95%          |
| Enforce Defaults     | Consistent user experience         | Users always start in a known state                   | Overrides persisted preference (sometimes)| Persist only specific user preferences        |

---

## Anti-Patterns (Forbidden)

| Context                | Intent                          | Directive                                                                 |
|------------------------|---------------------------------|---------------------------------------------------------------------------|
| Conflicting Defaults   | Single truth                     | - [ ] Align default values; forbid contradictory defaults across slices   |
| Hidden Startup Drift   | Predictable init                 | - [ ] Normalize schema on init; forbid dependence on stale persisted state |
| Layout Mode Leakage    | Correct init layout              | - [ ] Force layout.mode='force'; forbid implicit tree/radial activation   |
| Domain Bias            | Neutral behavior                 | - [ ] Default to document mode; forbid domain-specific default heuristics |
| Infinite Re-render     | Performance                      | - [ ] Avoid layout sync in render loop; forbid updating store from simulation tick |

---

## Repository Health Checklist

| Context               | Status | Directive                                                                 |
|----------------------|--------|---------------------------------------------------------------------------|
| Defaults Consistency | ✓      | - [ ] Unify init defaults; forbid contradictory startup flags             |
| Maintainability      | ✓      | - [ ] Centralize startup normalization; forbid scattered init logic       |
| Testability          | ✓      | - [ ] Keep defaults schema-driven; forbid untestable UI-only behavior     |
| Performance          | ✓      | - [ ] Optimize re-rendering; forbid simulation restart on stable state    |
