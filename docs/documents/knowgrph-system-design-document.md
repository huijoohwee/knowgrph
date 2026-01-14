# KnowGrph System Design Document

## Context

KnowGrph is a high-performance, client-side graph visualization and knowledge graph editing platform. It leverages modern web technologies to render large-scale graphs (10k+ nodes) with interactive editing capabilities, while maintaining strict neutrality and domain-agnosticism.

## Architecture Overview

### Frontend Stack
- **Framework**: React 18
- **State Management**: Zustand (with strict slice pattern)
- **Visualization**: D3.js (Force Simulation) + SVG (2D Rendering) / Three.js (3D Rendering)
- **Editor**: Monaco Editor (via React wrapper)
- **Styling**: Tailwind CSS

### Core Subsystems

#### 1. Graph State Engine (`useGraphStore`)
- **Responsibility**: Manages the single source of truth for graph data (`nodes`, `edges`), metadata, selection state, and UI preferences.
- **Pattern**: Slice-based Zustand store.
- **Neutrality**: Stores raw JSON-LD compatible structures; domain-specific logic is injected via Parsers.

#### 2. Canvas Renderer (`GraphCanvas`)
- **Responsibility**: Renders the graph visualization.
- **Performance Strategy**:
  - **Simulation**: D3 Force Simulation run in a `requestAnimationFrame` loop.
  - **Debouncing**: Simulation restarts are debounced (100ms) on window resize to prevent thrashing.
  - **Layering**: Separates static layers (grid) from dynamic layers (nodes/links) to minimize repaint cost.

#### 3. Panel System (`BottomPanel`, `Sidebar`)
- **Responsibility**: Provides tools for inspection, editing, and configuration.
- **Performance Strategy**:
  - **Throttling**: Resize and scroll listeners are strictly throttled/debounced.
  - **Virtualization**: Large lists (Node/Edge tables) use virtualization.
  - **Idle Work**: Heavy persistence tasks (saving zoom state) are scheduled via `requestIdleCallback`.

#### 4. Code/Data Editors (`JsonEditor`, `MonacoTextEditor`)
- **Responsibility**: Allows direct manipulation of the underlying data structures.
- **Performance Strategy**:
  - **Debounced Parsing**: `JSON.parse` and validation logic are debounced (300ms) to avoid blocking the main thread during typing.
  - **Safe Unmounting**: Async operations and event listeners include strict cleanup and mounted checks.

## Design Decisions & Trade-offs

### Client-Side First
- **Decision**: All graph processing happens in the browser.
- **Pros**: Zero latency interaction, offline capability, privacy (data stays local).
- **Cons**: Limited by client memory/CPU.
- **Mitigation**: Aggressive optimization (debouncing, throttling, virtualization) and strict performance guards.

### Domain Agnosticism
- **Decision**: The core engine knows nothing about specific domains (e.g., "Unicorn Companies").
- **Implementation**: All domain logic is encapsulated in **Parsers** and **Schema Configurations**.
- **Enforcement**: Hardcoded data files are strictly prohibited.

## Performance & Stability Directives (Enforced)

### Computation
- **Rule**: No heavy synchronous computation (parsing, layout) on keystroke or render loop.
- **Enforcement**: `useDebouncedValue` hook is mandatory for input-driven heavy tasks.

### Layout & Rendering
- **Rule**: Prevent layout thrashing and simulation loops.
- **Enforcement**:
  - `resize` listeners must be throttled/debounced.
  - D3 simulation restarts are debounced against viewport changes.
  - `getBoundingClientRect` calls are minimized and batched where possible.

### Component Stability
- **Rule**: No state updates or async callbacks on unmounted components.
- **Enforcement**:
  - `useEffect` hooks returning cleanup functions.
  - `cancelAnimationFrame` and `clearTimeout` used religiously.
  - Ref-based mounted checks for async callbacks.

## Data Flow

1.  **Ingestion**: Raw Text (Markdown/JSON) -> Parser -> Graph Data (JSON-LD).
2.  **Store**: `useGraphStore` updates `graphData`.
3.  **Derivation**: `deriveGraphDataForLayers` computes renderable subsets (filtering, grouping).
4.  **Layout**: `determineLayoutPositions` computes X/Y coordinates (Cached or Simulated).
5.  **Render**: `GraphCanvas` draws the scene based on computed positions.

## Observability

- **Metrics**: `uiMetrics` module tracks user interactions and performance markers.
- **Error Handling**: React Error Boundaries wrap major subsystems (`GraphCanvas`, `BottomPanel`).
