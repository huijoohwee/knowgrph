# KnowGrph System Design Document

## Design Mantras

```
- [ ] Client-First; process in browser; forbid server dependencies
- [ ] Performance; optimize hot paths; forbid blocking operations
- [ ] Neutrality; store raw structures; forbid domain assumptions
- [ ] Modularity; isolate subsystems; forbid tight coupling
- [ ] Observability; track all interactions; forbid silent failures
- [ ] Stability; cleanup async operations; forbid memory leaks
- [ ] Scalability; support 10k+ nodes; forbid O(n²) algorithms
```

---

## Universal Design Principles

| Context             | Intent                              | Directive                                                                                      |
|---------------------|-------------------------------------|------------------------------------------------------------------------------------------------|
| Client Architecture | Process locally                     | - [ ] Execute in browser; minimize network; forbid server-side processing                     |
| State Management    | Establish single source of truth    | - [ ] Centralize in Zustand store; slice by domain; forbid scattered state                    |
| Performance         | Optimize rendering pipeline         | - [ ] Debounce heavy operations; virtualize lists; forbid synchronous blocking                |
| Domain Neutrality   | Abstract domain logic               | - [ ] Store JSON-LD structures; inject via parsers; forbid hardcoded domains                  |
| Memory Management   | Prevent leaks                       | - [ ] Cleanup listeners; cancel animations; forbid dangling references                        |
| Rendering           | Minimize repaint cost               | - [ ] Layer static/dynamic content; batch updates; forbid layout thrashing                    |
| Data Flow           | Maintain unidirectional flow        | - [ ] Ingestion → Store → Derivation → Layout → Render; forbid circular updates              |
| Error Handling      | Surface failures gracefully         | - [ ] Use Error Boundaries; log to metrics; forbid silent crashes                             |

---

## Architecture Overview

**Frontend Stack**: React 18 | Zustand | D3.js | Three.js | Monaco Editor | Tailwind CSS

**Core Subsystems**: Graph State Engine | Canvas Renderer | Panel System | Code/Data Editors | Metrics & Observability

**Design Principles**: Client-side processing | Domain-agnostic storage | Performance-first rendering | Strict cleanup patterns

### Technology Stack

| Context          | Intent                     | Directive                                                                                   | Component       | Library/Framework | Version      | Purpose                                      | Constraint                                |
|------------------|----------------------------|---------------------------------------------------------------------------------------------|-----------------|-------------------|--------------|----------------------------------------------|-------------------------------------------|
| UI Framework     | Build reactive interfaces  | - [ ] Use React 18; leverage concurrent features; forbid class components                  | Frontend        | React             | 18+          | Component rendering and lifecycle            | Functional components with hooks only     |
| State Management | Centralize application state| - [ ] Use Zustand with slices; forbid Redux or Context API sprawl                         | State Engine    | Zustand           | Latest       | Single source of truth for graph data        | Slice-based pattern, no global mutations  |
| 2D Visualization | Render large graphs        | - [ ] Use D3.js for force simulation; SVG for rendering; forbid canvas-only approach       | Canvas 2D       | D3.js             | 7+           | Force layout and 2D graph rendering          | Debounced simulation restarts             |
| 3D Visualization | Support spatial graphs     | - [ ] Use Three.js for WebGL; forbid heavy shader computation                              | Canvas 3D       | Three.js          | r128         | 3D graph rendering with camera controls      | CapsuleGeometry not available in r128     |
| Code Editor      | Edit JSON-LD and configs   | - [ ] Use Monaco Editor; debounce validation; forbid blocking parsing                      | Editors         | Monaco Editor     | Latest       | In-browser code editing with syntax support  | Async validation with mounted checks      |
| Styling          | Apply consistent design    | - [ ] Use Tailwind utility classes; forbid custom CSS files                                | UI Components   | Tailwind CSS      | 3+           | Rapid, consistent styling across components  | Core utilities only, no compiler needed   |

---

## Core Subsystems

### Subsystem 1: Graph State Engine

**Responsibility**: Manages single source of truth for graph data, metadata, selection state, and UI preferences.

**Pattern**: Slice-based Zustand store with immutable updates.

**Neutrality**: Stores raw JSON-LD compatible structures; domain-specific logic injected via Parsers.

| Context              | Intent                          | Directive                                                                                   | Module          | Class/Object   | Function/Method   | Dependency   | Input                        | Output                 | Decision Logic                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|-----------------|----------------|-------------------|--------------|------------------------------|------------------------|----------------------------------|
| Store Initialization | Bootstrap graph state           | - [ ] Initialize nodes/edges arrays; set defaults; forbid hardcoded data                  | useGraphStore   | GraphStore     | create            | zustand      | Initial config               | Store instance         | create() with slice combiners    |
| Node Updates         | Modify node properties          | - [ ] Update immutably; validate structure; forbid direct mutations                        | useGraphStore   | NodesSlice     | updateNode        | immer        | Node ID, partial node        | Updated nodes array    | produce() with structural clone  |
| Edge Updates         | Modify edge relationships       | - [ ] Update immutably; check referential integrity; forbid orphaned edges                | useGraphStore   | EdgesSlice     | updateEdge        | immer        | Edge ID, partial edge        | Updated edges array    | produce() with ID existence check|
| Selection State      | Track user selections           | - [ ] Store selected IDs; emit events; forbid side effects in setter                      | useGraphStore   | SelectionSlice | setSelected       | —            | Node/Edge IDs array          | Updated selection set  | Set.add() for O(1) lookup        |
| Metadata Management  | Store graph-level metadata      | - [ ] Preserve ontologies, layers, schema refs; forbid metadata loss                      | useGraphStore   | MetadataSlice  | updateMetadata    | —            | Metadata partial             | Updated metadata       | Deep merge with precedence rules |
| State Persistence    | Save/restore to localStorage    | - [ ] Serialize minimal state; debounce writes; forbid blocking main thread               | useGraphStore   | PersistenceSlice| persist          | zustand/persist| Store state                  | Persisted state        | requestIdleCallback for writes   |

**Design Compliance**:

| Context          | Intent                     | Directive                                                                                   |
|------------------|----------------------------|---------------------------------------------------------------------------------------------|
| Immutability     | Prevent accidental mutations| - [ ] Use Immer for updates; freeze in development; forbid direct array/object mutation   |
| Slicing          | Organize by domain          | - [ ] Separate nodes, edges, selection, metadata; forbid monolithic store                 |
| Neutrality       | Store raw JSON-LD           | - [ ] No domain-specific fields in core store; forbid hardcoded entity types              |

---

### Subsystem 2: Canvas Renderer

**Responsibility**: Renders graph visualization with interactive editing capabilities.

**Performance Strategy**: Force simulation in RAF loop | Debounced restarts | Layered rendering | Batched updates

| Context              | Intent                          | Directive                                                                                   | Module        | Class/Object  | Function/Method       | Dependency | Input                        | Output                 | Decision Logic                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|---------------|---------------|-----------------------|------------|------------------------------|------------------------|----------------------------------|
| Simulation Init      | Create force-directed layout    | - [ ] Initialize D3 forces; configure strength; forbid synchronous layout                 | GraphCanvas   | SimulationMgr | initSimulation        | d3-force   | Nodes, edges, config         | Simulation instance    | d3.forceSimulation() with forces |
| Simulation Tick      | Update node positions           | - [ ] Tick simulation; batch position updates; forbid per-node updates                    | GraphCanvas   | SimulationMgr | tick                  | d3-force   | Simulation instance          | Updated positions      | requestAnimationFrame loop       |
| Restart Debouncing   | Prevent simulation thrashing    | - [ ] Debounce restart on resize/data change; forbid immediate restarts                   | GraphCanvas   | SimulationMgr | restartSimulation     | lodash     | Trigger event                | Scheduled restart      | debounce(restart, 100ms)         |
| Layer Rendering      | Separate static/dynamic         | - [ ] Render grid once; update nodes/edges per tick; forbid full repaints                | GraphCanvas   | LayerRenderer | renderLayers          | d3-selection| Layer configs                | SVG groups             | Static layer caching             |
| Viewport Transform   | Handle pan/zoom                 | - [ ] Apply transform matrix; update viewport state; forbid direct DOM manipulation       | GraphCanvas   | ViewportMgr   | applyTransform        | d3-zoom    | Transform matrix             | Updated viewport       | d3.zoom() with constraints       |
| Hit Detection        | Identify clicked elements       | - [ ] Use quadtree for O(log n) lookup; forbid linear search                              | GraphCanvas   | InteractionMgr| hitTest               | d3-quadtree| Mouse coordinates            | Hit node/edge          | quadtree.find(x, y, radius)      |
| Selection Rendering  | Highlight selected elements     | - [ ] Apply visual style; update Z-order; forbid style recalculation per frame           | GraphCanvas   | StyleMgr      | applySelectionStyle   | d3-selection| Selected IDs                | Styled elements        | Batch setAttribute calls         |

**Design Compliance**:

| Context          | Intent                     | Directive                                                                                   |
|------------------|----------------------------|---------------------------------------------------------------------------------------------|
| Frame Budget     | Maintain 60fps             | - [ ] Keep tick under 16ms; profile with devtools; forbid synchronous heavy computation   |
| Debouncing       | Prevent restart storms     | - [ ] Debounce simulation restarts (100ms); forbid immediate restart on every event       |
| Layering         | Minimize repaint           | - [ ] Separate static (grid) from dynamic (nodes/edges); forbid monolithic rendering      |
| Cleanup          | Prevent animation leaks    | - [ ] cancelAnimationFrame on unmount; forbid dangling RAF loops                           |

---

### Subsystem 3: Panel System

**Responsibility**: Provides tools for inspection, editing, and configuration.

**Performance Strategy**: Throttled resize listeners | Virtualized lists | Idle persistence

| Context              | Intent                          | Directive                                                                                   | Module       | Class/Object  | Function/Method     | Dependency        | Input                        | Output                 | Decision Logic                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|--------------|---------------|---------------------|-------------------|------------------------------|------------------------|----------------------------------|
| Panel Resize         | Adjust layout dynamically       | - [ ] Throttle resize events; update dimensions; forbid layout thrashing                  | BottomSurface| ResizeMgr     | handleResize        | lodash            | Resize event                 | Updated dimensions     | throttle(handler, 100ms)         |
| List Virtualization  | Render visible items only       | - [ ] Use react-window; render buffer; forbid rendering all items                         | NodeTable    | VirtualList   | renderRow           | react-window      | Visible range                | Rendered rows          | window.scrollTop to index range  |
| Idle Persistence     | Save state without blocking     | - [ ] Schedule writes in idle time; forbid synchronous localStorage                       | Sidebar      | PersistMgr    | scheduleWrite       | —                 | State snapshot               | Promise<void>          | requestIdleCallback(write)       |
| Tab Switching        | Lazy load panel content         | - [ ] Mount on tab activation; cache if expensive; forbid preloading all tabs            | TabbedPanel  | TabMgr        | activateTab         | —                 | Tab ID                       | Mounted tab component  | Conditional rendering by activeTab|
| Search/Filter        | Filter large datasets           | - [ ] Debounce search input; use memoized filter; forbid re-filter on every keystroke    | SearchPanel  | FilterMgr     | filterItems         | lodash            | Search query, items          | Filtered items         | debounce(filter, 300ms)          |
| Context Menu         | Show contextual actions         | - [ ] Position near cursor; close on outside click; forbid memory leaks                  | ContextMenu  | MenuMgr       | showContextMenu     | —                 | Mouse event, options         | Positioned menu        | addEventListener with cleanup    |

**Design Compliance**:

| Context          | Intent                     | Directive                                                                                   |
|------------------|----------------------------|---------------------------------------------------------------------------------------------|
| Throttling       | Limit event frequency      | - [ ] Throttle resize/scroll to 100ms; forbid unthrottled high-frequency events           |
| Virtualization   | Handle large lists         | - [ ] Virtualize tables >100 rows; forbid full DOM rendering                              |
| Lazy Loading     | Defer expensive work       | - [ ] Lazy load tabs; defer heavy computation; forbid eager initialization                |

---

### Subsystem 4: Code/Data Editors

**Responsibility**: Allows direct manipulation of underlying data structures.

**Performance Strategy**: Debounced parsing | Safe async operations | Mounted checks

| Context              | Intent                          | Directive                                                                                   | Module          | Class/Object   | Function/Method   | Dependency   | Input                        | Output                 | Decision Logic                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|-----------------|----------------|-------------------|--------------|------------------------------|------------------------|----------------------------------|
| JSON Parsing         | Validate and parse JSON input   | - [ ] Debounce parse calls; catch errors gracefully; forbid blocking parse               | JsonEditor      | ParseMgr       | parseJSON         | —            | Raw text                     | Parsed object or error | debounce(JSON.parse, 300ms)      |
| Syntax Validation    | Check for syntax errors         | - [ ] Run in debounced callback; show inline errors; forbid synchronous validation       | MonacoTextEditor| ValidationMgr  | validateSyntax    | monaco-editor| Editor content               | Error markers          | editor.getModel().validate()     |
| Auto-Save            | Persist changes automatically   | - [ ] Debounce save; check mounted state; forbid concurrent saves                        | JsonEditor      | SaveMgr        | autoSave          | —            | Editor content               | Promise<void>          | isMounted.current && save()      |
| Monaco Integration   | Embed Monaco editor             | - [ ] Initialize on mount; dispose on unmount; forbid memory leaks                       | MonacoTextEditor| EditorMgr      | initializeEditor  | monaco-editor| Container ref                | Editor instance        | useEffect with cleanup           |
| Theme Switching      | Apply editor themes             | - [ ] Set theme on prop change; avoid re-init; forbid theme drift                        | MonacoTextEditor| ThemeMgr       | setTheme          | monaco-editor| Theme name                   | Applied theme          | editor.updateOptions({theme})    |
| Content Sync         | Sync external changes           | - [ ] Compare versions; apply diffs; forbid overwriting user edits                       | JsonEditor      | SyncMgr        | syncContent       | —            | External content, local edit | Merged content         | Three-way merge with conflict detection|

**Design Compliance**:

| Context          | Intent                     | Directive                                                                                   |
|------------------|----------------------------|---------------------------------------------------------------------------------------------|
| Debouncing       | Prevent parse thrashing    | - [ ] Debounce parsing to 300ms; forbid parse on every keystroke                          |
| Mounted Checks   | Avoid state updates on unmount| - [ ] Check isMounted ref in async callbacks; forbid setState after unmount              |
| Cleanup          | Dispose editor properly    | - [ ] Call editor.dispose() in useEffect cleanup; forbid lingering instances              |

---

## Design Decisions & Trade-offs

| Decision             | Rationale                          | Pros                                                  | Cons                                      | Mitigation                                    |
|----------------------|------------------------------------|-------------------------------------------------------|-------------------------------------------|-----------------------------------------------|
| Client-Side First    | Zero latency, offline capability   | Instant interaction, privacy, no server cost         | Limited by client memory/CPU              | Aggressive optimization, virtualization       |
| Domain Agnosticism   | Reusable across domains            | Parser-driven flexibility, no hardcoded logic        | Requires configuration overhead           | Schema templates, clear parser contracts      |
| Zustand over Redux   | Simpler API, less boilerplate      | Easier to reason about, performant                   | Less established ecosystem                | Well-documented slice pattern                 |
| D3 Force Simulation  | Familiar, flexible layout          | Mature library, extensive customization              | Can be CPU-intensive for large graphs     | Debounced restarts, alpha decay tuning        |
| SVG over Canvas (2D) | Better interactivity, accessibility| Easy hit detection, CSS styling, screen reader support| Slower for very large graphs (>5k nodes) | Layer optimization, virtualization            |
| Monaco Editor        | Industry-standard editor           | Rich features, syntax support, familiar UX           | Large bundle size                         | Code-splitting, lazy loading                  |

---

## Performance & Stability Directives

### Computation Directives

| Context              | Intent                          | Directive                                                                                   | Enforcement Mechanism                        |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|----------------------------------------------|
| Heavy Operations     | Avoid blocking main thread      | - [ ] Debounce parsing, layout, validation; forbid synchronous heavy computation          | useDebouncedValue hook mandatory             |
| Parsing              | Defer expensive JSON parsing    | - [ ] Debounce JSON.parse to 300ms; forbid parse on keystroke                             | Lint rule for direct JSON.parse in handlers  |
| Batch Updates        | Group state changes             | - [ ] Use batch() for multiple store updates; forbid rapid sequential updates             | Zustand batch API                            |
| Memoization          | Cache expensive computations    | - [ ] Use useMemo for derived data; forbid recalculation per render                       | ESLint exhaustive-deps checking              |

### Layout & Rendering Directives

| Context              | Intent                          | Directive                                                                                   | Enforcement Mechanism                        |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|----------------------------------------------|
| Simulation Restarts  | Prevent layout thrashing        | - [ ] Debounce simulation restarts (100ms); forbid restart on every data change           | Centralized restart function with debounce   |
| Resize Listeners     | Throttle high-frequency events  | - [ ] Throttle resize/scroll to 100ms; forbid unthrottled listeners                       | Mandatory throttle wrapper                   |
| getBoundingClientRect| Minimize layout queries         | - [ ] Batch rect queries; cache when possible; forbid per-frame queries                   | Code review checkpoint                       |
| Force Reflow         | Avoid style recalculation       | - [ ] Batch DOM reads before writes; forbid interleaved read/write                        | Manual review, performance profiling         |

### Component Stability Directives

| Context              | Intent                          | Directive                                                                                   | Enforcement Mechanism                        |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|----------------------------------------------|
| Unmount Cleanup      | Prevent memory leaks            | - [ ] Cancel animations/timers in useEffect cleanup; forbid dangling callbacks            | ESLint plugin for useEffect exhaustive-deps  |
| Async Callbacks      | Check mounted state             | - [ ] Use ref to track mounted; check before setState; forbid setState on unmount         | Ref-based isMounted pattern                  |
| Event Listeners      | Remove on unmount               | - [ ] Return cleanup function removing listeners; forbid persistent listeners             | Manual code review                           |
| Animation Frames     | Cancel RAF loops                | - [ ] cancelAnimationFrame in cleanup; forbid infinite RAF without cleanup                | Mandatory pattern in RAF usage               |

---

## Data Flow

**Pipeline**: Ingestion → Store → Derivation → Layout → Render

| Stage       | Input                          | Output                         | Responsibility                                              | Performance Consideration                    |
|-------------|--------------------------------|--------------------------------|-------------------------------------------------------------|----------------------------------------------|
| Ingestion   | Raw Text (Markdown/JSON)       | Graph Data (JSON-LD)           | Parser transforms source into normalized JSON-LD structure  | Async parsing, debounced validation          |
| Store       | Graph Data                     | Zustand State                  | useGraphStore updates nodes/edges arrays immutably          | Structural sharing, Immer for efficiency     |
| Derivation  | Zustand State                  | Renderable Subsets             | deriveGraphDataForLayers filters/groups nodes by layers    | Memoized selectors, shallow equality checks  |
| Layout      | Renderable Subsets             | X/Y Coordinates                | determineLayoutPositions runs simulation or uses cache      | Cached positions, debounced simulation       |
| Render      | Positioned Nodes/Edges         | Visual Display                 | GraphCanvas draws SVG/WebGL scene from computed positions   | Layered rendering, RAF loop optimization     |

| Context              | Intent                          | Directive                                                                                   | Module           | Function/Method              | Input                | Output                  | Decision Logic                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|------------------|------------------------------|----------------------|-------------------------|----------------------------------|
| Parser Dispatch      | Route source to correct parser  | - [ ] Detect format; dispatch to parser; forbid format ambiguity                           | ParserRegistry   | parseInput                   | Source text, format  | Parsed graph data       | Switch on file extension/MIME    |
| Store Update         | Apply parsed data to state      | - [ ] Validate structure; merge with existing; forbid overwrite without confirmation       | useGraphStore    | loadGraphData                | Parsed graph data    | Updated store state     | Validate schema before set       |
| Layer Derivation     | Filter nodes by active layers   | - [ ] Compute visible nodes; memoize result; forbid re-derive per render                  | deriveGraphData  | deriveGraphDataForLayers     | Nodes, active layers | Filtered nodes          | useMemo with layer deps          |
| Position Cache       | Retrieve/store positions        | - [ ] Check cache by graph hash; return cached or compute; forbid stale cache             | LayoutCache      | getCachedPositions           | Graph hash           | Positions or null       | Map lookup by hash               |
| Render Dispatch      | Draw based on render mode       | - [ ] Route to 2D/3D renderer; apply transforms; forbid mixed rendering                   | GraphCanvas      | render                       | Positioned graph     | Visual output           | Switch on renderMode prop        |

---

## Observability & Metrics

| Context              | Intent                          | Directive                                                                                   | Module        | Class/Object  | Function/Method   | Dependency | Input                        | Output                 | Decision Logic                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|---------------|---------------|-------------------|------------|------------------------------|------------------------|----------------------------------|
| Interaction Tracking | Log user actions                | - [ ] Track clicks, selections, edits; aggregate metrics; forbid PII capture              | uiMetrics     | MetricsTracker| trackEvent        | —          | Event type, metadata         | Logged event           | Append to in-memory buffer       |
| Performance Markers  | Measure critical paths          | - [ ] Mark start/end of operations; compute duration; forbid synchronous marks            | uiMetrics     | PerfTracker   | mark              | performance| Marker name                  | Timestamp              | performance.mark(name)           |
| Error Boundaries     | Catch rendering errors          | - [ ] Wrap subsystems; log errors; show fallback UI; forbid silent failures               | ErrorBoundary | ErrorHandler  | componentDidCatch | —          | Error, error info            | Fallback UI            | Log to metrics, render fallback  |
| Error Logging        | Persist error details           | - [ ] Capture stack trace; log to metrics; forbid information loss                        | errorLogger   | Logger        | logError          | —          | Error object                 | Logged error           | Append to persistent log         |
| Metric Aggregation   | Summarize user behavior         | - [ ] Aggregate event counts; compute averages; forbid raw data export                    | uiMetrics     | Aggregator    | aggregate         | —          | Event buffer                 | Summary statistics     | Group by event type, compute stats|

**Design Compliance**:

| Context          | Intent                     | Directive                                                                                   |
|------------------|----------------------------|---------------------------------------------------------------------------------------------|
| Privacy          | Protect user data          | - [ ] Never log PII or sensitive content; anonymize identifiers; forbid data leakage      |
| Performance      | Minimize overhead          | - [ ] Buffer events; batch logging; forbid synchronous I/O in tracking                    |
| Error Recovery   | Graceful degradation       | - [ ] Provide fallback UI; preserve state; forbid total app crash                         |

---

## Anti-Patterns (Forbidden)

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Synchronous Heavy Ops| Prevent UI blocking             | - [ ] Debounce/defer parsing, layout, validation; forbid synchronous operations in handlers|
| Direct Mutations     | Maintain immutability           | - [ ] Use Immer or spread operators; forbid direct array/object mutation                  |
| Unthrottled Listeners| Control event frequency         | - [ ] Throttle/debounce resize, scroll, input; forbid raw addEventListener                |
| Memory Leaks         | Cleanup resources               | - [ ] Cancel timers, animations, listeners in cleanup; forbid dangling references         |
| Layout Thrashing     | Avoid forced reflows            | - [ ] Batch reads before writes; forbid interleaved getBoundingClientRect                 |
| Hardcoded Domains    | Preserve neutrality             | - [ ] Use parsers and configs; forbid domain-specific logic in core                       |
| Blocking Parsing     | Async all I/O                   | - [ ] Parse in workers or debounced; forbid synchronous JSON.parse on large inputs        |
| Unguarded setState   | Check component mounted         | - [ ] Use isMounted ref in async callbacks; forbid setState after unmount                 |

---

## Repository Health Checklist

**Structural Health**:

| Context              | Status | Directive                                                                                   |
|----------------------|--------|---------------------------------------------------------------------------------------------|
| Subsystem Isolation  | ✓      | - [ ] Graph State, Canvas, Panels, Editors independent; forbid cross-subsystem imports    |
| Store Slicing        | ✓      | - [ ] Nodes, Edges, Selection, Metadata in separate slices; forbid monolithic store       |

**Performance Health**:

| Context              | Status | Directive                                                                                   |
|----------------------|--------|---------------------------------------------------------------------------------------------|
| Debouncing           | ✓      | - [ ] All heavy ops debounced/throttled; forbid synchronous computation in hot paths      |
| Virtualization       | ✓      | - [ ] Lists >100 items virtualized; forbid full DOM rendering                              |
| Animation Cleanup    | ✓      | - [ ] All RAF/setTimeout cancelled on unmount; forbid lingering timers                     |

**Maintainability**:

| Context              | Status | Directive                                                                                   |
|----------------------|--------|---------------------------------------------------------------------------------------------|
| Type Safety          | ✓      | - [ ] TypeScript strict mode; explicit types; forbid any except unavoidable cases         |
| Error Boundaries     | ✓      | - [ ] Major subsystems wrapped; fallback UI provided; forbid uncaught errors              |

---

## Version Control Standards

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Component Changes    | Track UI modifications          | - [ ] Document breaking changes; version component APIs; forbid silent breaking changes    |
| Performance Regression| Prevent degradation            | - [ ] Profile before/after; document metrics; forbid unchecked performance changes        |
| Store Schema         | Version state shape             | - [ ] Document store structure; migrate on breaking changes; forbid backward-incompatible changes|
