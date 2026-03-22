# Knowledge Graph

## Overview

This project implements a complete knowledge graph pipeline for transforming structured and semi-structured content into interactive, analyzable knowledge graphs. It follows the generic INGEST → PRODUCE → REUSE architecture defined in `docs/knowgrph-raci-document.md`, with a canonical `GraphData` model separating ingest from export. The Universal CSV Schema Pattern (A0) is provided as one reusable schema/template within this architecture.

**Core Flow:** Source → Loader → Parser → Validator → GraphData (canonical) → Exporter → Renderer/Indexers

---

## Repository Structure

### Directory Layout

**docs/** - Documentation and catalogs
- Documentation philosophy and required standards: [documentation-guidelines.md](https://huijoohwee.github.io/guidelines/documentation-guidelines.md)
- Architecture and design: `docs/knowgrph-technical-architecture.md`, `docs/knowgrph-design-document.md`
- Configuration references: `docs/knowgrph-settings-document.md`, `docs/knowgrph-schema-document.md`, `docs/knowgrph-graph-traversal-settings-document.md`
- Automation index: `docs/knowgrph-documentation-document.md`

### Guidelines sources

- Documentation: https://huijoohwee.github.io/guidelines/documentation-guidelines.md
- Codebase maintainability: https://huijoohwee.github.io/guidelines/codebase-maintainability-guidelines.md
- Codebase neutrality: https://huijoohwee.github.io/guidelines/codebase-neutrality-guidelines.md
- Pipeline (Knowgrph): https://huijoohwee.github.io/guidelines/knowgrph-pipeline-guidelines.md

**canvas/** - Interactive graph visualization application
- 2D (SVG) and 3D (Three.js) rendering modes
- Real-time graph editing and exploration
- Schema-driven styling and layout

**knowgrph_parser/** - Data transformation utilities
- Read CSV/JSON/JSON-LD from test-data
- Emit normalized graph data
- Support multiple input formats

**test-data/** - Sample datasets and fixtures
- Example graph data files
- Test cases and validation data
- Sample workflows

**schema-config/** - Schema and visualization configuration
- Node and edge styling rules
- Layout force parameters
- Rendering presets

**data/outputs/** - Generated artifacts
- Parser script outputs
- Regression test baselines
- Export files

---

## Pipeline Architecture

### End-to-End Workflow

At runtime the pipeline is structured into three phases, as described in `docs/knowgrph-raci-document.md`:

- Ingest: Source → Loader → Parser → Validator → `GraphData` (canonical)
- Produce: `GraphData` → Exporter → JSON/JSON-LD/CSV/GraphML/Database
- Reuse: Exported artifacts → Renderer (canvas) and external indexers/RAG pipelines

**Step 1: Data Ingestion**
- Import source data (CSV, JSON, JSON-LD)
- Auto-detect format and select parser
- Validate against schema

**Step 2: Normalization**
- Convert to A0 universal schema
- Extract nodes and edges
- Preserve metadata and context

**Step 3: Schema Application**
- Apply visual styling rules
- Configure layout forces
- Set validation constraints

**Step 4: Visualization**
- Render in 2D or 3D mode
- Apply interactive presets
- Enable exploration features

**Step 5: Export**
- Save as JSON-LD, JSON, or CSV
- Export schema configurations
- Generate artifacts for downstream use

---

## Development Setup

### Prerequisites
- Node.js runtime environment
- Python environment with package manager
- Modern web browser with ES6+ support

### Installation Steps

**Canvas Application**
Navigate to canvas directory, install dependencies, start development server. Access at local development URL with hot module replacement.

```bash
npm --prefix canvas install
npm run dev
```

**Parser Scripts**
Create virtual environment, install Python requirements, run transformation scripts from repository root.

```bash
python3 -m venv .venv
./.venv/bin/python -m pip install --upgrade pip
./.venv/bin/python -m pip install -r requirements.txt
./.venv/bin/python -m knowgrph_parser smoke --timeout-seconds 20
```

### Documentation Automation

- From code registries to consistent docs: CLI tooling → regenerates markdown tables and registries → keeps UI, schema fixtures, and documentation aligned.
- Run from `canvas/`:
  - `npm run doc:lint`
  - `npm run doc:sanity`

### Development vs Preview

**Development Mode**
- Serves source files directly
- Enables hot module replacement
- Fast iteration cycle

**Preview Mode**
- Serves production bundle
- Matches deployment environment
- Validates build artifacts

### Configuration

**Alias Resolution**
Ensure path aliases match between build configuration and TypeScript configuration.

**Badge Control**
Production-only badges disabled during build to maintain UI consistency.

**Port Management**
Development and preview use different ports. Check for conflicts and adjust as needed.

---

## Core Features

### Graph Visualization

**2D Canvas Mode**
- SVG-based rendering
- Force-directed layout
- Zoom and pan controls
- Node dragging and positioning

**3D Scene Mode**
- WebGL-based rendering
- Spherical layout algorithms
- Spatial indexing for performance
- Camera controls and navigation

### Interactive Editing

**Node Operations**
- Create, update, delete nodes
- Edit properties inline
- Assign types and labels
- Validate against schema

**Edge Operations**
- Create relationships via drag
- Edit edge properties
- Configure directionality
- Style by label type

### Schema Management

**Import/Export**
- Import `schema-config/*.json` via the Schema tab to replace the active schema
- Export the current schema as JSON for reuse across datasets

**Visual Styles**
- Node colors and sizes by type
- Edge colors and widths by label
- Label positioning and fonts
- Arrow styles and markers

**Behavior Rules**
- Drag constraints (free, axis-locked)
- Grid snapping
- Duplicate prevention
- Self-loop control

**Layout Configuration**
- Link distance by label
- Charge strength by type
- Collision radii
- Alpha decay rate

**Validation**
- Required field checks
- Property type validation
- Numeric range constraints
- Pattern matching rules

### Data Management

**Import Formats**
- CSV with configurable parsers
- Raw JSON with node/edge arrays
- JSON-LD with context mapping
- Workflow-specific formats

**Export Formats**
- JSON-LD with full context
- JSON for programmatic use
- Combined CSV for analysis
- Separate node/edge CSV files

### User Interface

**Unified Panel**
- Tabbed interface (Settings, Schema, History, Help)
- Persistent across sessions
- Search and filter capability
- Apply/Reset actions

**Bottom Panel**
- Node and edge tables
- Property inspection
- Global search
- Sortable columns

**Right Sidebar**
- Selected node details
- Related nodes and edges
- Media viewer
- Action buttons

**Side Panel Chat**
- Optional Chat tab in the right sidebar
- Uses current graph selection (node or dataset) as context
- Sends prompts to a configurable OpenAI-compatible HTTP endpoint
- Controlled via Chat settings (endpoint URL, model, temperature, system prompt)

**Toolbar**
- File operations (Load, Save, Export)
- View controls (2D/3D toggle)
- Panel toggles
- Help access

---

## Workflow Patterns

### Parser Workflow

**Step 1: Load Data**
Click Load Data button, select file, auto-detect format.

**Step 2: Select Parser**
System pre-selects matching parser, display rules summary.

**Step 3: Validate**
Parser extracts nodes and edges, validates structure, reports errors.

**Step 4: Preview**
Review parsed data in table view, inspect node/edge counts.

**Step 5: Apply**
Commit parsed data to graph store, render in canvas.

### Schema Workflow

**Step 1: Import Configuration**
Load schema preset from schema-config directory.

**Step 2: Review Settings**
Inspect node styles, edge styles, layout forces, validation rules.

**Step 3: Customize**
Adjust colors, sizes, distances, constraints as needed.

**Step 4: Test**
Create sample nodes/edges, verify styling and behavior.

**Step 5: Export**
Save customized schema for reuse, version control.

### Visualization Workflow

**Step 1: Select Mode**
Choose 2D (SVG) or 3D (Three.js) rendering mode.

**Step 2: Apply Preset**
Load curated visualization preset for dataset type.

**Step 3: Tune Layout**
Adjust force parameters, spacing, collision radii.

**Step 4: Refine Rendering**
Set edge opacity, arrow sizes, curvature, particles.

**Step 5: Explore**
Navigate graph, select elements, run traversal highlights.

### Export Workflow

**Step 1: Prepare Data**
Ensure all edits saved, history committed.

**Step 2: Choose Format**
Select JSON-LD (semantic), JSON (programmatic), or CSV (analysis).

**Step 3: Configure Options**
Set filename, include metadata, preserve context.

**Step 4: Export Files**
Save graph data and schema configuration together.

**Step 5: Verify**
Reload exported files to confirm round-trip integrity.

---

## Performance Guidelines

### Optimization Strategies

**Caching**
- Search results keyed by query and graph state
- Parser outputs cached with input hash
- Schema derivations use LRU cache
- TTL and versioned cache keys

**Memoization**
- Table computations use stable dependencies
- Large operations scheduled on idle
- Debounced user inputs
- Function identity preservation

**Selectors**
- Read specific store slices only
- Minimize re-render triggers
- Use action creators for updates
- Avoid anonymous inline functions

**Workers**
- Heavy parsing offloaded to web workers
- AST parsing via tree-sitter worker
- Large dataset transformation
- Non-blocking UI updates

**Effect Hygiene**
- Always return cleanup functions
- Cancel timers and listeners
- Guard async updates with mounted flags
- Check dependencies carefully

**Rendering**
- Single SVG node sized by container
- Avoid DOM tree recreation
- Virtualize large tables
- Defer non-critical renders

### Module Organization

**Feature-Scoped Utilities**
Extract helpers into focused modules, keep files under 600 lines, enforce single responsibility.

**Store Slices**
Separate concerns (graph data, selection, history, UI, canvas, schema), compose via barrel exports.

**Component Decomposition**
Split large components into subcomponents, use barrel exports for clean imports.

**Code Hygiene**
Remove conflicting, hardcoded, stale, duplicate code as you touch modules. Eliminate infinite loops, memory leaks, unused code.

---

## Storage and Persistence

### Persistent Storage API

Graph data and user preferences persist across sessions using key-value storage.

**Personal Data**
User-specific settings, history, preferences. Only accessible by current user.

**Shared Data**
Collaborative artifacts visible to all users. Explicitly marked as shared.

**Key Design**
Use hierarchical keys under 200 characters. Combine related data in single operations. Batch updates to minimize requests.

**Error Handling**
All operations can fail. Always use try-catch. Non-existent keys throw errors.

**Limitations**
Text and JSON only, no file uploads. Values under 5MB per key. Rate limited requests. Last-write-wins for conflicts.

---

## Testing Strategy

### Unit Tests

**Parser Tests**
Validate format detection, data extraction, error handling for each parser type.

**Schema Tests**
Verify style application, validation rules, layout calculations, template merging.

**Transform Tests**
Check aggregation functions, property mappings, edge inference, type conversions.

**Store Tests**
Test CRUD operations, history snapshots, undo/redo, persistence layer.

### Integration Tests

**Workflow Presets**
Exercise end-to-end workflows, verify typed paths, check round-trip integrity.

**Round-Trip Tests**
Load data, parse to graph, export, reload, compare nodes/edges counts and structure.

**Cross-Component Tests**
Validate selection sync between canvas and panels, verify zoom/pan on selection.

### End-to-End Verification

This runbook mirrors the core pipeline (Data Ingestion → Normalization → Schema Application → Visualization → Export) and exercises the responsibilities cataloged in `docs/knowgrph-codebase-audit-catalog.md` and `docs/knowgrph-codebase-raci-audit-catalog.md`. As of 2025-12-16, a repository scan confirms that all rows currently marked ✅ in those catalogs match the implementation and their Recommended Action guidance.

**Step 1: Verify Data Ingestion**
- From the repository root, run: `npm --prefix canvas install`.
- Run canvas ingestion and parser tests: `npm --prefix canvas run test:ci`.
- What this covers:
  - CSV/JSON/JSON-LD parsing and combined CSV export (`canvas/src/__tests__/roundtrip.test.ts:1-65`, `canvas/src/__tests__/export.test.ts:1-23`).
  - Format auto-detection and loader heuristics (`canvas/src/__tests__/loaderFlow.test.ts:1-14`, `canvas/src/__tests__/parserRegistry.test.ts:1-80`).
  - AI-KG JSON-LD ingestion via worker using `test-data/ai-kg-viz.json` and `test-data/ai-kg-viz-links.json` (`canvas/src/__tests__/roundtrip.test.ts:67-152`, `canvas/src/__tests__/roundtrip.test.ts:458-525`).

**Step 2: Verify Normalization**
- Still in `canvas`, reuse `npm run test:ci`.
- Focus on tests that assert normalized `GraphData` structure:
  - Graph validation and metrics on the unicorn dataset using `test-data/unicorn-investors-top-3-test.json` (`canvas/src/__tests__/graphValidation.test.ts:94-152`).
  - Structural JSON-LD to GraphData conversions for AI-KG fixtures (`canvas/src/__tests__/roundtrip.test.ts:118-345`).
- On the Python side, from the repo root run:
  - `python -m knowgrph_parser jsonld-universal --input test-data/ai-kg-viz.json --format graph`
  - `python -m knowgrph_parser jsonld-universal --input test-data/unicorn-investors-top-3-test.json --format graph`
- These commands confirm that canonical JSON/JSON-LD inputs normalize into consistent `GraphData` nodes/edges across both knowgrph_parser and canvas.

**Step 3: Verify Schema Application**
- In `canvas`, `npm run test:ci` exercises schema defaults and validation:
  - Schema defaults and behavior flags (`canvas/src/__tests__/schema.test.ts:1-25`).
  - Schema-driven validation rules and error reporting (`canvas/src/__tests__/graphValidation.test.ts:64-92`).
  - Settings registry behavior for schema-related UI controls (`canvas/src/__tests__/settings.test.ts:1-15`).
- Manual check (optional but recommended):
  - Start dev server: `npm run dev`.
  - Load `test-data/ai-kg-viz.json` and import `schema-config/ai-kg-viz-schema.json`.
  - Confirm node/edge styling, layout, and validation behavior match expectations described in the Schema and Visualization workflow sections above.

**Step 4: Verify Visualization**
- Automated checks via `npm run test:ci`:
  - GraphCanvas and ThreeGraph consumption of generic `GraphData` (smoke-checked via selection, traversal, and export tests: `canvas/src/__tests__/graphRagTraversal.test.ts:1-69`, `canvas/src/__tests__/roundtrip.test.ts:458-525`).
  - Minimap view rectangle math and unified panel exports (`canvas/src/__tests__/minimap.test.ts:1-17`, `canvas/src/__tests__/panel.test.ts:1-7`).
- Manual checks (requires `npm run dev`):
  - Use workflow presets to load AI-KG and unicorn demos, then:
    - Switch between 2D and 3D modes.
    - Adjust render and layout settings in the bottom panel.
    - Trigger AI-KG traversal to verify stepwise highlighting of `graphRAGPath.traverse`.

**Step 5: Verify Export and Round-Trip**
- In `canvas`, `npm run test:ci` covers:
  - Combined CSV and GraphML/Cypher export (`canvas/src/__tests__/roundtrip.test.ts:1-65`).
- JSON-LD round-trip for generic graphs and AI-KG fixtures (`canvas/src/__tests__/roundtrip.test.ts:67-152`).
- On the Python side, from the repo root run:
  - `python -m knowgrph_parser jsonld-universal --input test-data/ai-kg-viz.json --format graph`
- For a full round-trip sanity check:
  - Use the Export workflow in the canvas UI to save JSON-LD/JSON/CSV, then reload the exported files and confirm node/edge counts and structure match the original inputs as described under “Round-Trip Tests”.

### Regression Tests

**Baseline Comparisons**
Generate graph artifacts, store in data/outputs, compare against baselines on change.

**Visual Regression**
Capture canvas snapshots for preset configurations, detect unintended visual changes.

---

## Accessibility Guidelines

### Keyboard Navigation
- All interactive elements reachable via Tab
- Enter/Space activate buttons
- Arrow keys navigate lists
- Escape closes modals and dropdowns

### Screen Reader Support
- Semantic HTML elements
- ARIA labels and roles
- Live regions for updates
- Descriptive alt text

### Visual Accessibility
- Sufficient color contrast ratios
- Resizable text without breakage
- Focus indicators visible
- High-contrast mode support

### Motion Preferences
- Respect prefers-reduced-motion
- Disable auto-rotate when requested
- Provide static alternatives
- Smooth vs instant transitions

---

## Deployment

### Static Hosting

**Build Process**
Clean dist directory, run production build, verify output structure.

**Asset Optimization**
Minify JavaScript and CSS, compress images, generate source maps.

**Environment Variables**
Configure fallback data paths, API endpoints, feature flags.

### Continuous Deployment

**Trigger Conditions**
Push to main branch, manual workflow dispatch, scheduled builds.

**Build Pipeline**
Install dependencies, run parser scripts, build canvas app, run tests, deploy artifacts.

**Rollback Strategy**
Keep previous builds accessible, quick revert on errors, monitor deployment health.

---

## Troubleshooting

### Common Issues

**Port Conflicts**
Development and preview use different ports. If occupied, stop process or change port in configuration.

**Stale Previews**
Clear dist directory and rebuild. Check cache invalidation in browser.

**Worker Import Errors**
Ensure path aliases match between build config and TypeScript config. Verify worker scripts resolve correctly.

**Data Loading Failures**
Check file format matches parser expectations. Verify schema compatibility. Inspect console for detailed errors.

**Performance Degradation**
Monitor cache hit rates. Check for memory leaks in effects. Profile render times. Review worker usage.

### Debug Tools

**Browser DevTools**
Console for errors and warnings, Network tab for data loading, Performance profiler for bottlenecks.

**React DevTools**
Component tree inspection, Props and state examination, Render highlighting.

**Store DevTools**
State history, Action logging, Time-travel debugging.

---

## Contributing Guidelines

### Code Standards

**TypeScript**
Strict mode enabled, explicit types required, avoid any types, use branded types for domain concepts.

**React**
Functional components only, hooks for state and effects, memoization for performance, proper cleanup.

**Styling**
Tailwind utilities preferred, semantic classes for reusable patterns, CSS variables for theming.

**Testing**
Write tests for new features, maintain coverage thresholds, update regression baselines.

### Commit Conventions

Use semantic commit messages with scope: feat(parser), fix(canvas), docs(readme), refactor(store), test(schema).

### Pull Request Process

Create feature branch, implement changes with tests, update documentation, request review, address feedback.

### Documentation

Keep README template general, update catalogs for new features, document breaking changes, provide migration guides.

---

## License and Attribution

Project follows open-source principles using permissive licensing. Attribute third-party libraries per their requirements.

---

## Support and Community

File issues for bugs and feature requests. Join discussions for questions and ideas. Contribute improvements via pull requests.

---

## Roadmap

### Near Term
- Enhanced parser capabilities
- Additional visualization presets
- Performance optimizations
- Expanded test coverage

### Medium Term
- Advanced query interface
- Real-time collaboration
- Plugin architecture
- Mobile-responsive design

### Long Term
- Semantic reasoning engine
- Federated knowledge graphs
- AI-assisted graph construction
- Immersive 3D experiences
