# Knowgrph Canvas Frontend: Universal Technical Specification

## Design Mantras

```
- [ ] Observability; expose graph state visibly; forbid opaque transformations
- [ ] Schema-driven; validate against type definitions; forbid untyped mutations
- [ ] Centralized state; use single store; forbid scattered local state
- [ ] Shallow selectors; minimize re-renders; forbid broad subscriptions
- [ ] UI density control; configure icons centrally; forbid hardcoded sizes
- [ ] Panel isolation; separate concerns by view; forbid cross-panel coupling
- [ ] Persistence clarity; localStorage for preferences; forbid implicit defaults
- [ ] Reproducibility; serialize workflows; forbid non-deterministic configs
```

---

## Universal Design Principles

| Context             | Intent                              | Directive                                                                                      |
|---------------------|-------------------------------------|------------------------------------------------------------------------------------------------|
| Abstraction         | Separate graph from presentation    | - [ ] Define clear store interfaces; hide implementation; forbid direct DOM manipulation      |
| Atomicity           | Ensure state consistency            | - [ ] Update graph/schema atomically; rollback on error; forbid partial updates               |
| Caching             | Optimize graph computations         | - [ ] Cache derived layers; invalidate on mutations; forbid stale community data              |
| Composition         | Build from reusable components      | - [ ] Compose panels from primitives; enable reuse; forbid monolithic views                   |
| Configuration       | Externalize behavior                | - [ ] Define workflow/schema configs; document presets; forbid embedded constants             |
| Consistency         | Maintain uniform patterns           | - [ ] Apply icon/density patterns uniformly; document conventions; forbid arbitrary exceptions|
| Decoupling          | Minimize panel dependencies         | - [ ] Use store selectors; inject configs; forbid tight panel-to-panel coupling              |
| Determinism         | Ensure reproducible workflows       | - [ ] Fix parser/workflow seeds; normalize inputs; forbid non-deterministic graph builds      |
| Documentation       | Explain architecture decisions      | - [ ] Document panel flows; provide diagrams; forbid undocumented magic                       |
| Encapsulation       | Hide store internals                | - [ ] Expose minimal store actions; version slices; forbid direct state mutation              |
| Error Handling      | Fail gracefully in UI               | - [ ] Validate schema inputs; return descriptive errors; forbid silent parser failures        |
| Extensibility       | Support new panels/parsers          | - [ ] Design plugin points for parsers; version schemas; forbid closed architectures          |
| Idempotence         | Guarantee safe re-runs              | - [ ] Parse/import idempotently; avoid side effects; forbid duplicate node creation           |
| Immutability        | Preserve graph integrity            | - [ ] Copy before transform; avoid in-place edits; forbid source graph corruption             |
| Instrumentation     | Enable UI observability             | - [ ] Emit panel events; expose metrics; forbid black-box rendering                           |
| Locality            | Bound component scope               | - [ ] Keep panels focused; single responsibility; forbid sprawling components                 |
| Modularity          | Isolate panel responsibilities      | - [ ] Define clear panel boundaries; minimize coupling; forbid cross-concern mixing           |
| Naming              | Use consistent conventions          | - [ ] Follow React/TS standards; be descriptive; forbid cryptic abbreviations                 |
| Neutrality          | Abstract domain logic               | - [ ] Use general graph algorithms; configure specifics; forbid workflow-specific assumptions |
| Performance         | Optimize render paths               | - [ ] Profile hot render paths; target shallow selectors; forbid premature optimization       |
| Provenance          | Track graph lineage                 | - [ ] Record sources; timestamp changes; forbid orphaned markdown nodes                       |
| Reusability         | Share common UI logic               | - [ ] Extract utilities; parameterize components; forbid copy-paste duplication               |
| Scalability         | Handle large graphs                 | - [ ] Design for thousands of nodes; test limits; forbid O(n²) layout algorithms             |
| Security            | Protect against threats             | - [ ] Validate parser inputs; sanitize outputs; forbid XSS in markdown rendering              |
| Separation          | Divide UI concerns                  | - [ ] Layer panels/store/canvas; forbid mixing presentation/business/state logic              |
| Simplicity          | Prefer straightforward solutions    | - [ ] Choose simple over clever; forbid unnecessary complexity                                |
| Testability         | Enable automated verification       | - [ ] Inject store dependencies; expose test hooks; forbid untestable components              |
| Transparency        | Make state visible                  | - [ ] Log store actions; expose panel state; forbid opaque operations                         |
| Validation          | Verify all graph inputs             | - [ ] Check schema preconditions; enforce invariants; forbid assumption-based processing      |
| Versioning          | Track schema evolution              | - [ ] Namespace schemas; deprecate gracefully; forbid breaking changes without migration      |

---

## Knowgrph Canvas Architecture

**UI Stack**: Canvas Visualization → Panel System → Zustand Store → Graph Data Model → Schema Catalog

**Data Flow**: Source Files → Parsers → useGraphStore → React Components → User Interaction → State Mutations

**Design Principles**: Schema-Driven | Observable State | Panel Isolation | Centralized Configuration

### High-Level Components

- **Graph Visualization**:
  - `canvas/src/components/GraphCanvas.tsx` implements node/edge rendering, selection handling, and layout modes (semantic, document, schema-centric).
- **Panel System**:
  - `canvas/src/features/panels/` organizes main panel (workflow, schema, settings), bottom panel (markdown, parsers, tables), and floating panels (props, orchestrator).
- **State Management**:
  - `canvas/src/hooks/store/useGraphStore.ts` coordinates graph data, schema, workflows, UI settings, and panel layout via Zustand slices.
- **Parsers & Loaders**:
  - `canvas/src/parsers/` transforms CSV, JSON, JSON-LD, and markdown into normalized graph representation.

### Integration Bridge: Product View ↔ Engineer View

| Product Mental Model            | Technical Implementation                 | Configuration Controls                                    |
|---------------------------------|------------------------------------------|-----------------------------------------------------------|
| Graph IDE "code editor"         | GraphCanvas component + selection state  | layoutMode, zoom, selection context                       |
| Debuggers & inspectors          | MainPanel tabs (workflow, schema, help)  | activeMainPanelTab, panel visibility toggles              |
| Consoles & tools                | BottomPanel (markdown, parsers, tables)  | activeBottomPanelTab, markdown sync settings              |
| Runnable pipelines              | Orchestrator workflows + GraphRAG config | workflow presets, orchestrator context                    |

---

## Frontend Layer Specifications

### Layer 1: Graph Canvas & Visualization

**From user interaction to visual feedback**: User selects nodes → Canvas updates selection state → Store notifies subscribers → Props panel updates → Minimap highlights selection.

**Rendering Pattern**: React-based canvas with SVG/HTML rendering, using Zustand selectors to minimize re-renders on graph mutations.

**Configuration Schema (core sections)**:

```yaml
graph_visualization:
  scope: system_global
  type: object
  mutability: runtime_configurable
  validation: must contain nodes array, edges array, layoutMode enum
  impact: controls node positioning, edge routing, selection behavior

layout_modes:
  scope: deployment_configurable
  type: enum (semantic | document | schema_centric)
  mutability: runtime_configurable
  validation: one of allowed values
  impact: determines node clustering and positioning algorithm

selection_state:
  scope: module_local
  type: object
  mutability: runtime_configurable
  validation: selectedNodes, hoveredNode, focusedNode must reference existing IDs
  impact: drives props panel, highlights, and interaction feedback
```

**Interface Pattern**: `handleNodeClick(nodeId)` → validate node exists → update selection state → trigger panel updates → [complexity: O(1)]

**Design Compliance**:

| Context          | Intent                     | Directive                                                                                   | Module/Component | Class/Object | Function/Method | Dependency | Input                | Output              | Decision Logic                   |
|------------------|----------------------------|---------------------------------------------------------------------------------------------|------------------|--------------|-----------------|------------|----------------------|---------------------|----------------------------------|
| Node Selection   | Update focus context       | - [ ] Validate node ID; update store; forbid invalid selections                            | GraphCanvas      | —            | handleNodeClick | useGraphStore | nodeId (string)   | void                | ID validation + store update     |
| Layout Switching | Recompute positions        | - [ ] Apply layout algorithm; preserve selection; forbid layout thrashing                   | GraphCanvas      | —            | switchLayout    | layout library | layoutMode (enum) | node positions      | Force-directed or hierarchical   |
| Minimap Updates  | Reflect viewport           | - [ ] Compute visible bounds; render thumbnail; forbid stale minimap                        | Minimap          | —            | updateViewport  | canvas state | viewport bounds   | minimap SVG         | Scale viewport to minimap space  |

---

### Layer 2: Panel System

**From panel activation to content display**: User clicks toolbar button → Store updates activeMainPanelTab → MainPanel switch renders appropriate component → Component reads from store via selectors → UI updates.

**Panel Organization**: Main panel (workflow, schema, settings), Bottom panel (markdown, parsers, tables), Floating panels (props, orchestrator) with independent state slices.

**Configuration Schema (core sections)**:

```yaml
panel_layout:
  scope: system_global
  type: object
  mutability: runtime_configurable
  validation: activeMainPanelTab, activeBottomPanelTab must be valid tab keys
  impact: controls which panel is visible and active

panel_visibility:
  scope: deployment_configurable
  type: object (boolean flags per panel)
  mutability: runtime_configurable
  validation: mainPanelOpen, bottomPanelOpen, floatingPanelOpen
  impact: controls panel collapse/expand state

ui_density:
  scope: system_global
  type: object
  mutability: runtime_configurable
  validation: uiIconScale, uiIconStrokeWidth must be valid numbers
  impact: controls icon sizing and visual density across all panels
```

**Interface Pattern**: `openPanel(panelKey, tabKey)` → validate tab key → update store → trigger panel render → [complexity: O(1)]

**Design Compliance**:

| Context          | Intent                     | Directive                                                                                   | Module/Component | Class/Object | Function/Method | Dependency | Input                | Output              | Decision Logic                   |
|------------------|----------------------------|---------------------------------------------------------------------------------------------|------------------|--------------|-----------------|------------|----------------------|---------------------|----------------------------------|
| Panel Switching  | Activate target panel      | - [ ] Validate tab key; update active tab; forbid invalid tab keys                         | MainPanel        | —            | switchTab       | useGraphStore | tabKey (string)   | void                | Tab key validation + store update|
| Density Control  | Adjust UI scale            | - [ ] Update icon scale; apply to all icons; forbid inconsistent sizing                    | UISettings       | —            | setIconScale    | useGraphStore | scale (number)    | void                | Store update + Tailwind class map|
| Panel Persistence| Save preferences           | - [ ] Write to localStorage; restore on load; forbid lost preferences                       | UISettings       | —            | savePreferences | localStorage | preferences (obj) | void                | Serialize to LS_KEYS             |

---

### Layer 3: State Management (useGraphStore)

**From action dispatch to component update**: Component calls store action → Action mutates state slice → Zustand notifies subscribers → Shallow selectors detect changes → Components re-render with new data.

**Store Architecture**: Single Zustand store with domain-specific slices (graph, schema, workflow, UI settings, panel layout) and shallow selector patterns.

**Configuration Schema (core sections)**:

```yaml
graph_data_slice:
  scope: system_global
  type: object
  mutability: runtime_configurable
  validation: nodes/edges must conform to schema
  impact: holds all graph nodes, edges, and derived layers

schema_slice:
  scope: deployment_configurable
  type: object
  mutability: runtime_configurable
  validation: nodeTypes, edgeLabels, properties must be valid definitions
  impact: defines type system and validation rules

workflow_slice:
  scope: deployment_configurable
  type: object
  mutability: runtime_configurable
  validation: graphRagConfig, presets must be serializable
  impact: stores workflow configurations and orchestrator state

ui_settings_slice:
  scope: module_local
  type: object
  mutability: runtime_configurable
  validation: theme, icon settings, panel layout must be valid
  impact: controls visual presentation and localStorage persistence
```

**Interface Pattern**: `updateGraph(mutations)` → validate schema → apply mutations → notify subscribers → [complexity: O(n) for n mutations]

**Design Compliance**:

| Context          | Intent                     | Directive                                                                                   | Module/Component | Class/Object | Function/Method | Dependency | Input                | Output              | Decision Logic                   |
|------------------|----------------------------|---------------------------------------------------------------------------------------------|------------------|--------------|-----------------|------------|----------------------|---------------------|----------------------------------|
| Graph Mutations  | Update nodes/edges         | - [ ] Validate against schema; apply atomically; forbid partial updates                    | graphDataSlice   | —            | updateGraph     | schema validator | mutations (array) | updated graph       | Schema validation + atomic apply |
| Schema Updates   | Modify type definitions    | - [ ] Validate schema structure; migrate data; forbid breaking changes                     | schemaSlice      | —            | updateSchema    | migration tools | schema (object)   | updated schema      | Validation + migration check     |
| Selector Usage   | Read state efficiently     | - [ ] Use shallow selectors; minimize re-renders; forbid broad subscriptions               | useGraphStore    | —            | useShallow      | Zustand    | selector (fn)        | selected state      | Shallow equality check           |

---

### Layer 4: Parsers & Data Ingestion

**From source files to graph data**: User uploads file → Parser detects format → Normalize to internal representation → Validate against schema → Update store → Trigger canvas/panel updates.

**Parser Types**: CSV parser (tabular data), JSON/JSON-LD parser (graph interchange), Markdown parser (document-centric graphs with provenance).

**Configuration Schema (core sections)**:

```yaml
parser_config:
  scope: deployment_configurable
  type: object
  mutability: deployment_configurable
  validation: must specify format, normalization rules, schema mapping
  impact: controls how source data maps to graph nodes/edges

markdown_pipeline:
  scope: deployment_configurable
  type: object
  mutability: runtime_configurable
  validation: rendering mode, sync scroll settings, provenance tracking
  impact: controls markdown→graph transformation and bidirectional sync

validation_rules:
  scope: system_global
  type: object
  mutability: deployment_configurable
  validation: duplicate detection, dangling reference checks, required fields
  impact: ensures graph integrity during ingestion
```

**Interface Pattern**: `parseFile(file, format)` → detect format → normalize → validate → update store → [complexity: O(n) for n elements]

**Design Compliance**:

| Context          | Intent                     | Directive                                                                                   | Module/Component | Class/Object | Function/Method | Dependency | Input                | Output              | Decision Logic                   |
|------------------|----------------------------|---------------------------------------------------------------------------------------------|------------------|--------------|-----------------|------------|----------------------|---------------------|----------------------------------|
| Format Detection | Identify source format     | - [ ] Inspect file headers; match patterns; forbid ambiguous detection                     | ParserUtils      | —            | detectFormat    | file API   | file (File)          | format (enum)       | Header pattern matching          |
| Normalization    | Convert to internal model  | - [ ] Map fields to schema; apply defaults; forbid data loss                               | CSVParser        | —            | normalize       | schema     | rows (array)         | nodes/edges         | Field mapping + type coercion    |
| Provenance Track | Link markdown to graph     | - [ ] Record source positions; enable bidirectional sync; forbid orphaned nodes            | MarkdownParser   | —            | trackProvenance | provenance utils | AST + positions | graph + metadata    | Position mapping + ID generation |

---

### Layer 5: Theme System & Visual Consistency

**From theme selection to UI rendering**: User selects theme → Store updates theme mode → Root element updates data-theme attribute → Tailwind applies dark: modifiers → All components re-render with new tokens.

**Theme Architecture**: Centralized theme tokens (`UI_THEME_TOKENS`) provide semantic color/spacing values, consumed by all components to ensure consistency across light/dark modes.

**Configuration Schema (core sections)**:

```yaml
theme_mode:
  scope: system_global
  type: enum (light | dark | system)
  mutability: runtime_configurable
  validation: one of three allowed values
  impact: controls global color palette and component styling

ui_theme_tokens:
  scope: system_global
  type: object
  mutability: deployment_configurable
  validation: must include panel, table, tooltip, status token sets
  impact: provides semantic color/spacing values for all components

icon_configuration:
  scope: system_global
  type: object
  mutability: runtime_configurable
  validation: uiIconScale (number), uiIconStrokeWidth (number)
  impact: controls icon sizing and stroke weight across application

semantic_html:
  scope: deployment_configurable
  type: boolean
  mutability: immutable
  validation: enforced at component level
  impact: ensures accessibility and proper document structure
```

**Interface Pattern**: `setTheme(mode)` → update store → update DOM attributes → trigger re-render → [complexity: O(1)]

**Design Compliance**:

| Context          | Intent                     | Directive                                                                                   | Module/Component | Class/Object | Function/Method | Dependency | Input                | Output              | Decision Logic                   |
|------------------|----------------------------|---------------------------------------------------------------------------------------------|------------------|--------------|-----------------|------------|----------------------|---------------------|----------------------------------|
| Theme Switching  | Update color palette       | - [ ] Set data-theme attribute; toggle dark class; forbid hardcoded colors                | UISettings       | —            | setTheme        | DOM API    | mode (enum)          | void                | Attribute update + class toggle  |
| Token Resolution | Map semantic to concrete   | - [ ] Read UI_THEME_TOKENS; apply to components; forbid direct color values              | ThemeProvider    | —            | resolveToken    | theme config | token key (string) | CSS class/hex       | Token lookup + mode check        |
| Icon Sizing      | Apply consistent scale     | - [ ] Call getIconSizeClass; apply uiIconStrokeWidth; forbid hardcoded sizes             | IconButton       | —            | render          | UISettings | icon component       | styled icon         | Scale/stroke from store          |

---

## Component Responsibility Matrix

| Layer/Subsystem | Path/Module                                  | Component           | Interface/Method        | Responsibility (S-V-O)                                                              | Dependencies                    | Contracts                             | LOC    |
|-----------------|----------------------------------------------|---------------------|-------------------------|-------------------------------------------------------------------------------------|---------------------------------|---------------------------------------|--------|
| Visualization   | `canvas/src/components/GraphCanvas.tsx`      | GraphCanvas         | `render`                | Canvas renders nodes → positions elements → handles interactions → updates selection | `useGraphStore`, React          | Reads graph data, writes selection    | ~800   |
| Panels          | `canvas/src/features/panels/MainPanel.tsx`   | MainPanel           | `renderActiveTab`       | Panel reads active tab → renders component → subscribes to store → displays content  | `useGraphStore`, panel views    | Renders based on activeMainPanelTab   | ~400   |
| State           | `canvas/src/hooks/store/useGraphStore.ts`    | useGraphStore       | `updateGraph`           | Store validates mutations → applies changes → notifies subscribers → triggers renders | Zustand, schema validator       | Maintains graph invariants            | ~2000  |
| Parsers         | `canvas/src/parsers/csvParser.ts`            | CSVParser           | `parse`                 | Parser reads CSV → normalizes rows → validates schema → returns graph data           | PapaParse, schema definitions   | Conforms to internal graph format     | ~300   |
| UI Settings     | `canvas/src/hooks/store/uiSettingsSlice.ts`  | UISettings          | `setIconScale`          | Slice updates scale → writes to localStorage → notifies components → reapplies styles | localStorage, LS_KEYS           | Persists UI density preferences       | ~200   |
| Orchestrator    | `canvas/src/features/orchestrator/`          | Orchestrator        | `executeWorkflow`       | Orchestrator reads config → executes steps → tracks context → surfaces results        | workflow config, GraphRAG       | Serializable workflow state           | ~600   |
| Theme           | `canvas/src/hooks/store/uiSettingsSlice.ts`  | ThemeManager        | `setTheme`              | Manager updates mode → applies DOM attributes → triggers re-renders → persists choice | localStorage, UI_THEME_TOKENS   | Consistent color palette application  | ~150   |
| Markdown        | `canvas/src/features/markdown/`              | MarkdownSection     | `renderViewer`          | Section lexes tokens → shares with views → syncs scroll → handles selection          | marked, Monaco, useGraphStore   | Bidirectional canvas ↔ markdown sync  | ~500   |
| Media Panels    | `canvas/src/components/MediaNode.tsx`        | MediaNode           | `renderPanel`           | Node renders media → scales to density → handles zoom → displays in panel-only mode  | schema, UI_THEME_TOKENS         | 16:9 aspect ratio, minimap sizing     | ~400   |

---

## Theme System & Visual Design Standards

### Theme and Color Palette

**Supported Modes**: Light, Dark, System (OS preference detection)

**Color Palette**: GitHub Tritanopia palette for optimal contrast and accessibility

**Mode-Specific Styling**:
- **Light Mode**: `text-gray-600`, `bg-gray-100` hover states, `bg-white` panels
- **Dark Mode**: `text-gray-300`, `bg-gray-800` hover states, `bg-[#0d1117]` panels

**Theme Token Architecture**:

```yaml
UI_THEME_TOKENS:
  panel:
    bg: theme-adaptive background
    divider: consistent border color
    text: primary text color
  table:
    rowBg: base row background (flat, no zebra striping)
    rowHoverAmber: hover state with amber tint
    rowSelected: selected row highlight (subtle tint)
    header: sticky header styling
    border: cell and column dividers
  tooltip:
    bg: high-contrast overlay (dark in both modes)
    text: tooltip text color
  status:
    success: green feedback
    warning: amber/yellow feedback
    error: red feedback
    neutral: gray feedback
  code:
    bg: code block background
    text: code text color
    headerBg: code header background
    border: code block border
```

**Implementation Standards**:

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Token Usage          | Enforce consistency             | - [ ] Use UI_THEME_TOKENS for all styling; forbid hardcoded Tailwind classes like text-gray-* or bg-blue-* |
| Theme Switching      | Maintain visual coherence       | - [ ] Update data-theme attribute and dark class; trigger re-render; forbid partial updates |
| Canvas Colors        | Match theme in WebGL/SVG        | - [ ] Use UI_THEME_COLORS (raw hex) for D3/WebGL contexts; forbid mismatched palettes     |
| Icon Consistency     | Apply uniform sizing            | - [ ] Use uiIconScale and uiIconStrokeWidth; forbid per-component sizing                   |

### Code Block Styling

**Structure**: Semantic `figure` > `header` > `pre`/`code` hierarchy

**Header Components**:
- Language label
- Beside/Inline view toggle buttons (`name="annotate-display"`, `value="beside" | "inline"`, `aria-current="true"` on active)
- Copy button (writes to clipboard)

**Syntax Highlighting**:
- Light Mode: GitHub Light theme
- Dark Mode: GitHub Dark theme

**Layout Mode**: Stored in component state, reflected via `data-annotate-display` attribute to reuse lexed tokens without re-rendering

### Semantic HTML Standards

**Enforcement**: All components must use semantic HTML elements over generic `div` containers

| Component            | Semantic Elements                                                                                   |
|----------------------|-----------------------------------------------------------------------------------------------------|
| Toolbar              | `<nav role="navigation">`                                                                          |
| Bottom Panel         | `<section>` (container), `<header>` (tab bar, supports double-click fullscreen), `<article>` (content) |
| Main Panel           | `<section>` (container), `<header>` (tab bar), `<article>` (content)                               |
| Status Bar           | `<footer>`                                                                                         |
| Markdown Viewer      | `<article>` (content), `<nav>` (TOC), `<figure>` (code blocks, Mermaid diagrams)                  |
| Markdown Editor      | `<article>` (editor pane)                                                                          |
| Presentation         | `<section>` (slides container), `<article>` (slide content), `<aside>` (sidebar), `<footer>` (controls) |
| Slides Gallery       | `<section>` (container), `<header>` (slide label/index)                                            |
| Graph Data Table     | `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>` wrapped in `<section>`                   |
| Settings View        | `<table>` for technical details (replacing grid of divs)                                           |

### Typography Scale

**Panel Micro Labels**: `uiPanelMicroLabelTextSizeClass` (default 10px)
- Used in: Floating Panels, Table of Contents, Settings headers
- Distinct from standard `uiPanelKeyValueTextSizeClass` for data rows

**Presentation Mode**: Base font size increased to `text-2xl` (~24px) for large screen readability

### Visual Consistency Standards

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Table Styling        | Unified selection/hover         | - [ ] Use rowHoverAmber for hover; rowSelected for active; forbid legacy blue borders     |
| Slides Gallery       | Match table interactions        | - [ ] Use same hover/selection styles; 16:9 aspect ratio thumbnails; forbid inconsistent styles |
| Settings Panels      | Match table key/value rows      | - [ ] Use rowHoverAmber and rowSelected for interaction; forbid custom hover colors       |
| Graph Data Table     | Clean flat design               | - [ ] Use rowBg (no zebra striping); rowSelected for highlight; forbid outdated styling   |

---

## Media Node Panel Specifications

### Panel Rendering Modes

**Panel-Only Mode**: Hides base circle/rect glyphs, renders standalone media panels

**Header Format**: `Label (Type)` inline display in panel header strip

### Density Modes

**Compact Panels**:
- Height: `MINIMAP_HEIGHT` (fixed constant)
- Width: `round(MINIMAP_HEIGHT * 16 / 9)` (derived for 16:9 aspect ratio)
- Base: Minimap size as reference

**Standard Panels**:
- Tuned for maximum zoom visibility
- At `ZOOM_MAX`: panel appears ~1.5× minimap width and ~1.5× minimap height on screen
- Scaled proportionally at lower zoom levels

### Sizing Constants

**Definition Location**: `canvas/src/features/minimap/math.ts`

```typescript
MINIMAP_WIDTH: number
MINIMAP_HEIGHT: number
ZOOM_MAX: number
```

### Media URL Handling

**Normalization**: `getNodeMediaSpec` in `canvas/src/components/GraphCanvas/helpers.ts`

**Proxy Routing**: `applyMediaProxySrc` routes cross-origin HTTP(S) media through `/__fetch_remote`

**Supported Formats**: Image (jpg, png, gif, webp), Video (mp4, webm)

### Canvas Coordinate System

**2D Canvas**: Panel geometry expressed in graph units, scaled by zoom transform

**Zoom Behavior**: Standard panels visually match "1.5× minimap" sizing at ZOOM_MAX, scale down proportionally at lower zoom

### Content Padding

**Requirements**:
- Image/video content must not touch panel border
- Uniform margin between media frame and outer panel edges

### Media Panel Design Compliance

| Context              | Intent                          | Directive                                                                                   | Module/Component | Function/Method | Input                | Output              | Decision Logic                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|------------------|-----------------|----------------------|---------------------|----------------------------------|
| Panel Sizing         | Maintain aspect ratio           | - [ ] Calculate from MINIMAP dimensions; apply 16:9 ratio; forbid hardcoded sizes         | MediaNode        | calculateSize   | density mode         | width/height        | MINIMAP constants × density scale|
| Media URL Resolution | Handle cross-origin             | - [ ] Normalize via getNodeMediaSpec; apply proxy; forbid direct cross-origin loads       | MediaNode        | resolveMediaUrl | node media URL       | proxied URL         | Protocol check + proxy routing   |
| Zoom Scaling         | Maintain visibility             | - [ ] Scale panel with zoom; cap at density target; forbid clipping at max zoom           | GraphCanvas      | renderMediaPanel| zoom level + geometry| scaled panel        | Zoom transform × panel dimensions|

---

## Canvas ↔ Markdown Interaction Patterns

### Bidirectional Selection Sync

**Canvas to Markdown**:
- Node/edge selection → Auto-scroll markdown editor/viewer to corresponding source line
- Graph layer selection → Scroll to layer definition in frontmatter
- Mermaid frontmatter sync → Scroll to exact node definition line within frontmatter block

**Markdown to Canvas**:
- Text selection → Highlight corresponding node/edge on canvas
- Double-click line → Position editor and update canvas selection
- Presentation/Slides Gallery click → Update canvas and editor position

### Auto-Scroll Behavior

**Editor (Monaco)**:
- Uses wrap model to align first wrapped row of selected range to top of viewport
- Preserves line numbers for nested content
- Flash effect on navigation from other views

**Viewer**:
- Uses block-level `data-start-line` markers to anchor rendered blocks
- Scrolls selected range to top of scroll container
- Avoids "lost in the middle" placements

### Text Highlight Toggle

**When Enabled**:
- Node-backed ranges: Inherit node fill color, appear as tinted background band in viewer and editor gutter
- Edge-backed ranges: Rendered with underline treatment mirroring edge color
- Graph layer highlights: Reuse layer background color for visual alignment

**When Disabled**: Markdown remains unadorned, scrolling and auto-alignment still active

### Bottom Panel Auto-Open

**Trigger**: Selecting media card in Slides Gallery

**Behavior**:
- Automatically opens Bottom Panel to Curation tab in Markdown mode
- Maintains alignment between media selection, canvas selection, and source text
- Applies brief, subtle highlight to panel chrome for visual feedback

### Markdown Preview Interaction

**Selection Toolbar**: Appears on text selection or double-click, provides context-aware navigation

**Available Actions**:
- Show on Canvas: Highlights corresponding node/edge
- Show in Viewer: Switches to Markdown Viewer, auto-positions to exact line
- Show in Editor: Switches to Markdown Editor
- Show in Presentation: Enters Presentation mode
- Show in Slides Gallery: Switches to Slides Gallery view
- Show in Graph Data Table: Opens Graph Data Table tab

**Conditional Availability**: Irrelevant options disabled based on current view

### Full Screen Presentation

**Entry**: Dedicated "Enter Full Screen" button (`Maximize2`) in toolbar when in Presentation/Slides Gallery mode

**Sidebar Behavior**:
- Auto-Hide: Sidebar hides on full screen entry
- Auto-Show on Hover: Sidebar reveals as overlay when hovering left edge
- Manual Toggle: Toolbar button or 'O' shortcut, shared state with embedded view

**Zoom Reset**: Automatically resets slide zoom to 100% on full screen entry

### Right-Click Context Menu

**Unified Behavior**: Displays Selection Toolbar in Viewer, Editor, Presentation, Slides Gallery, and Graph Data Table

**Consistent Navigation**: Provides same context-aware actions across all views

### Flash Feedback

**Purpose**: Visual emphasis when navigating from other views

**Implementation**:
- `flashLine` prop triggers temporary highlight
- CSS animations: `monaco-flash-fade` (Editor), `markdown-flash-highlight` (Viewer)
- Automatic fade-out after configured duration

### Token Sharing Architecture

**Optimization**: Markdown tokenization runs once, shared across Viewer, Editor, TOC, and Presentation

**Hook**: `useMarkdownPreviewTokens` ensures tokens computed once, reused during mode switches

**Line Map Preservation**: Maintained during token processing for accurate scroll synchronization

### Component Separation

**View Logic**: `useMarkdownSectionLogic` (scroll sync, auto-positioning, flash effects, TOC)

**Data Logic**: `useBottomPanelMarkdownModel` (markdown state management)

**Parsing Logic**: `useMarkdownApply` (markdown parsing and graph updates)

**JSON Conversion**: `useJsonMarkdown` (JSON ↔ Markdown transformation)

**File Size Constraint**: <600 lines per file enforced

### Canvas ↔ Markdown Interaction Compliance

| Context              | Intent                          | Directive                                                                                   | Module/Component | Function/Method | Input                | Output              | Decision Logic                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|------------------|-----------------|----------------------|---------------------|----------------------------------|
| Selection Sync       | Maintain bidirectional link     | - [ ] Track provenance metadata; update both views; forbid desync                          | MarkdownSection  | syncSelection   | selection event      | updated views       | Provenance lookup + scroll       |
| Auto-Scroll          | Position source in viewport     | - [ ] Calculate line offset; scroll to top; apply flash; forbid mid-viewport placement    | MonacoEditor     | scrollToLine    | line number          | scroll position     | Line to pixel + viewport offset  |
| Token Sharing        | Optimize rendering              | - [ ] Lex once; share tokens; preserve line maps; forbid redundant lexing                 | MarkdownTokens   | useTokens       | markdown text        | shared tokens       | Marked lexer + memoization       |
| Fullscreen Toggle    | Maximize presentation           | - [ ] Enter native fullscreen; auto-hide sidebar; reset zoom; forbid jarring transitions  | Presentation     | enterFullscreen | void                 | fullscreen state    | Fullscreen API + state updates   |

---

## Label and Tooltip Behavior

### Node Labels

**Default**: Center-aligned, wrapped text

**Compact Mode**: Truncate with ellipsis at low zoom to reduce clutter

**Word-Based Clamping**: Labels with >20 words (excluding markdown heading layers `hn`) are clamped with ellipsis; full text is revealed via the shared hover tooltip.

**Theme Safety**: Label fill + halo follow theme tokens (System/Light/Dark) to prevent “invisible text” in dark mode.

### Edge Labels

**Default**: Truncate with ellipsis in hover surfaces

**Expansion**: Full text expands on hover

### Hover Content

**Long Descriptions**: Scrollable overflow support

**Interaction**: Toggle expansion on click

### Tooltip Configuration

**User Controls**: Configurable via "Graph Interaction" settings in MainPanel Settings

**Options**:
- Show Node ID
- Show Node Name
- Show Node Label (Type)
- Show Node Description
- Show Node Properties
- Corresponding Edge options

**Schema Integration**: Settings override or work with `schema.behavior.hover.content` (project-level defaults)

### Fit to Screen & Zoom Behavior

**2D Implementation**: `useZoomEffects` and `applyZoomRequest("fit")`

**Fit Logic**:
- Uses `fitAllTransform` to compute strict bounding box of all nodes (ignoring origin)
- Centers box in SVG viewport with small margin on all sides
- Single-node graphs: treat node position as entire bounding box
- Empty to non-empty transition: guarantees visibility

**Fit Triggers**:
- Graph changes (node/edge add/remove)
- Viewport resize
- Does NOT trigger on: schema layout changes, layer toggles (prevents unexpected camera movement)

**Label Bounds**: Fit calculations account for node labels (estimated width/height from `schema.labelStyles.*`)

**Pin to View**: Toolbar toggle that preserves camera transform across graph updates and viewport resizes (no jump when side panels open/close)

**While Pinned**:
- Disables Fit to Screen
- Disables Zoom to Selection
- Selection (nodes, edges, graph layers) never triggers zoom/fit/camera moves
- In 3D: Also disables auto-rotate for visual stability

**View-only Toggle**:
- Rich Media (Render Media as Nodes) is a presentation-only switch and must not trigger zoom/fit/camera moves.
- Rich Media sources are sanitized and normalized (e.g. GitHub blob URLs resolve to raw) before proxying to avoid broken media placeholders.
- Rich Media opacity composes with graph layer opacity: `effectiveOpacity = mediaNodeOpacity × layerOpacity`, and media-specific opacity rules only apply while Rich Media is enabled.

**Safety Forces**:
- Box Force: Soft constraint around centered 16:9 frame capped at 1920×1080
- Collision avoidance: Accounts for rectangular node half-extents (including schema-driven `visual:width`/`visual:height`) and estimated label bounds
- Configuration: `schema.layout.forces.boxForce` and `boxForceStrength`

**3D Implementation**: `Controls` and `requestThreeCamera("fit")`

### Port Handles

**Toggle**: Toolbar button shows node connection handles

**Routing**: Routes 2D force/radial edge endpoints to nearest cardinal handle

**Schema Configuration**: `schema.behavior.portHandles.*`

**Layout Neutrality**: Border anchoring derives from graph topology + Mermaid direction when available (LR/RL/TB/BT); no hardcoded axis or domain assumptions

### Label & Tooltip Compliance

| Context              | Intent                          | Directive                                                                                   | Module/Component | Function/Method | Input                | Output              | Decision Logic                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|------------------|-----------------|----------------------|---------------------|----------------------------------|
| Label Truncation     | Reduce visual clutter           | - [ ] Clamp labels with >20 words (excluding heading layers `hn`); full text in tooltip; forbid overflow | NodeLabel        | renderLabel     | zoom level + text    | styled label        | Word threshold + zoom threshold  |
| Tooltip Content      | Show configurable details       | - [ ] Read settings; include enabled fields; forbid unconfigured display                  | HoverTooltip     | buildContent    | node/edge + settings | tooltip HTML        | Settings flags + field inclusion |
| Fit to Screen        | Center visible graph            | - [ ] Compute bbox; center with margin; account for labels; forbid origin-centric fit     | ZoomEffects      | fitAll          | nodes + labels       | zoom transform      | Bbox calculation + viewport fit  |
| Pin to View          | Preserve camera position        | - [ ] Lock transform; disable auto-fit; disable selection zoom; forbid unexpected movement| CameraControl    | togglePin       | void                 | pinned state        | Boolean flag + event blocking    |

---

## Unified Markdown Layout (Editor & Viewer)

### Layout Architecture

**Shared Container**: `MarkdownPanelLayout` with collapsible sidebar Table of Contents (TOC)

**Semantic Structure**:
- `<section>`: Outer container
- `<aside>`: Sidebar (TOC)
- `<header>`: Panel header
- `<main>`: Content area
- `<article>`: Editor/Viewer panes
- `<figure>`: Frontmatter Mermaid diagrams

**Sidebar Position**: Left side (default layout)

**Token Sharing**: Markdown lexer runs once at parent level, tokens shared between Viewer, TOC, Editor, and Presentation

**Line Map**: Preserved during token processing for accurate scroll synchronization

### Component Architecture

**View Separation**:
- `MarkdownEditorPane`: Dedicated editor component
- `MarkdownViewerPane`: Dedicated viewer component
- `MarkdownPreviewPresentation`: Presentation mode component
- `SlidesGallery`: Thumbnail navigation component

**View Mode Toolbar**: Explicit toggle buttons for "Viewer", "Editor", "Markdown Presentation", "Slides Gallery"

**Icon Buttons**:
- `MonitorPlay`: Markdown Presentation
- `LayoutGrid`: Slides Gallery
- `Edit3`: Editor
- `Eye`: Viewer

**Button Order**: Markdown Presentation positioned left of Slides Gallery for intuitive progression

### Editor Features

**Monaco Integration**: Robust text editing with syntax highlighting

**Word Wrap Toggle**: Toolbar control for long line readability

**Flash Line**: Visual feedback on navigation from other panels

**Code Block Modes**: "Beside" and "Inline" annotations with persisted user preference

**Apply Button**: Re-parse markdown and update graph

**Theme Alignment**: Fully respects global theme (Light/Dark/System), matches `UI_THEME_TOKENS` and `UI_THEME_COLORS`

### Viewer Features

**Rendered Preview**: Syntax highlighting and Mermaid diagram support

**Scroll Synchronization**: With editor

**Interactive Elements**: Links, anchors integrate with graph selection

**Error Feedback**: Descriptive errors for invalid Mermaid diagrams

**Sticky Headings**: `h1`-`h6` snap to top of viewer container (below panel header)

**Cascading Behavior**: Lower-level headers stick below higher-level headers (stacked context)

**Table Headers**: `<th>` inside `<figure>` elements stick to top of table container, ensuring column labels visible while scrolling

**Visual Treatment**: `backdrop-blur-md` and `UI_THEME_TOKENS.panel.bg` to obscure scrolling content

### Presentation Mode

**Aspect Ratio**: 16:9 (1920x1080) for slide layout

**Token Optimization**: Shares `fullDocTokens` via `MarkdownPreviewPresentation` prop

**Robust Rendering**: Fallback lexing ensures content visibility even with imperfect line maps or filtered tokens

**Sticky Headings in Slides**: Slide headings (`h1`-`h6`) are sticky within slide scroll container

**Dynamic Offset**: Top offset calculated based on slide header presence:
- 32px: Default theme
- 40px: Academic theme
- 0px: No header

**Sidebar Synchronization**:
- "Slides Gallery" sidebar uses same semantic structure (`aside`, `header`, `nav`) as Viewer sidebar
- UI components: `IconButton`, `UI_THEME_TOKENS` for consistent appearance
- State: `showSidebar` prop synchronized with Viewer sidebar
- Persistence: `LS_KEYS.bottomPanelMarkdownShowSidebar`

**Fixed Footer**: Matches header positioning strategy (`fixed bottom-0`, `h-8`), uses semantic `<footer>`, matching z-index/border styles

### Synchronization Guarantees

**100% Sync**: Enforced between Markdown Viewer, Editor, Presentation, Slides Gallery, and Graph Data Table

**Sync Aspects**:
- Heading navigation
- Content updates
- Scroll position
- Collapse/expand state

**Mechanism**: Shared state and explicit jump triggers

### Double-Click Behaviors

**Viewer/Presentation/Slides Gallery**: Double-click line → auto-position Markdown Editor to corresponding line

**Line Mapping**: Precise, preserving line numbers for nested content

**Bottom Panel Tab Bar**: Double-click → toggle fullscreen expansion

**Fullscreen Impact**: When expanded to 100% height, graph canvas rendering and simulation paused (frozen) for performance optimization

### Canvas Click Behavior

**Node/Edge/Graph Layer Click**: Auto-positions Markdown Editor to corresponding Mermaid Frontmatter line (if applicable)

**Single Source of Truth**: Removes legacy implementations, ensures consistent behavior

**Layout Neutrality**: `MermaidNode` and `pointsTo` edges styled and filtered via schema-driven layer configuration

**Universal Layout Support**: Force, radial, tidy-tree layouts operate on same schema-aligned subgraph without special cases

### Unified Markdown Layout Compliance

| Context              | Intent                          | Directive                                                                                   | Module/Component | Function/Method | Input                | Output              | Decision Logic                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|------------------|-----------------|----------------------|---------------------|----------------------------------|
| Token Sharing        | Optimize lexing                 | - [ ] Lex once; share across views; preserve line maps; forbid redundant processing       | MarkdownTokens   | usePreviewTokens| markdown text        | shared tokens       | Marked lexer + React memo        |
| Sidebar TOC          | Navigate document structure     | - [ ] Extract headings; render nav tree; sync with scroll; forbid stale TOC               | TableOfContents  | renderNav       | tokens + scroll pos  | TOC nav tree        | Heading extraction + position map|
| Sticky Headers       | Maintain context while scrolling| - [ ] Apply sticky positioning; cascade levels; obscure content; forbid header overlap     | Viewer           | renderHeading   | heading level        | styled header       | Z-index stack + backdrop blur    |
| Presentation Slides  | Generate slide boundaries       | - [ ] Parse heading levels; split content; apply 16:9 ratio; forbid content overflow      | Presentation     | buildSlides     | tokens               | slide array         | Heading delimiter + aspect calc  |
| Double-Click Nav     | Jump to corresponding view      | - [ ] Map line numbers; trigger scroll; flash target; forbid imprecise jumps              | PanelLayout      | handleDblClick  | click event          | view transition     | Line map lookup + scroll trigger |

---

## Visual QA Checklist: Media Panels

**Dependency Declaration**

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| React Components     | Minimize coupling               | - [ ] Inject store via hooks; use shallow selectors; forbid prop drilling                 |
| Store Slices         | Isolate state concerns          | - [ ] Define slice boundaries; export actions; forbid cross-slice mutations                |
| External Libraries   | Centralize imports              | - [ ] Import from canonical sources; document versions; forbid multiple import paths       |

**Integration Contracts**

- **Panel ↔ Store**:
  - Must use shallow selectors for performance.
  - Panel state updates must flow through store actions, not local state.
- **Parser ↔ Schema**:
  - Parsers must validate against current schema catalog.
  - Schema IDs use namespaced format defined in schema documentation.
- **Canvas ↔ Markdown**:
  - Must maintain bidirectional selection sync via provenance metadata.
  - Markdown section defines source position mappings for graph nodes.

**Coupling Metrics**

- Canvas is decoupled from panels:
  - Canvas only depends on store selection state, not panel implementation.
  - Panel visibility is attached via store flags, not direct canvas references.

---

## Code Organization Framework

**Directory Structure (relevant subset)**:

```text
canvas/
├── src/
│   ├── components/
│   │   ├── GraphCanvas.tsx
│   │   ├── Toolbar.tsx
│   │   └── Minimap.tsx
│   ├── features/
│   │   ├── panels/
│   │   │   ├── MainPanel.tsx
│   │   │   ├── BottomPanel.tsx
│   │   │   └── views/
│   │   │       ├── WorkflowPanel.tsx
│   │   │       ├── SchemaPanel.tsx
│   │   │       └── SettingsPanel.tsx
│   │   └── orchestrator/
│   │       ├── OrchestratorPanel.tsx
│   │       └── WorkflowExecutor.tsx
│   ├── hooks/
│   │   └── store/
│   │       ├── useGraphStore.ts
│   │       ├── graphDataSlice.ts
│   │       ├── schemaSlice.ts
│   │       └── uiSettingsSlice.ts
│   ├── parsers/
│   │   ├── csvParser.ts
│   │   ├── jsonParser.ts
│   │   └── markdownParser.ts
│   └── utils/
│       ├── iconUtils.ts
│       └── localStorageHelpers.ts
└── docs/
    └── documents/
        ├── knowgrph-design-document.md
        ├── knowgrph-parser-document.md
        └── knowgrph-ui-ux-design-document.md
```

**Naming Conventions**

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| TypeScript Files     | Follow React standards          | - [ ] Use PascalCase for components; camelCase for utilities; forbid inconsistent casing  |
| Store Slices         | Indicate domain                 | - [ ] Name slices by domain (graphDataSlice, schemaSlice); forbid generic names           |
| Panel Components     | Indicate purpose                | - [ ] Suffix with Panel (WorkflowPanel, SettingsPanel); forbid vague names                |
| Constants            | Signal immutability             | - [ ] Use SCREAMING_SNAKE_CASE for LS_KEYS; declare in utils; forbid inline magic strings |

**File Organization**

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Component Size       | Maintain readability            | - [ ] Keep components under 500 LOC; extract subcomponents; forbid monolithic files       |
| Function Length      | Enable comprehension            | - [ ] Limit functions to 50 lines; extract helpers; forbid deep nesting (>3 levels)       |
| Import Organization  | Clarify dependencies            | - [ ] Group React, external libs, internal modules; sort alphabetically; forbid arbitrary order |

---

## Testing & Quality Standards

**Test Coverage Metrics**

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Store Tests          | Validate state mutations        | - [ ] Test all store actions; assert state changes; forbid untested mutations             |
| Component Tests      | Verify rendering                | - [ ] Test panel switching; selection behavior; forbid untested user interactions         |
| Integration Tests    | Verify end-to-end flows         | - [ ] Test markdown→graph pipeline; parser→store→canvas; forbid incomplete coverage       |

**Test Categories**

- **Unit Tests**:
  - Schema CRUD and validation logic can be exercised via store action tests.
  - UI utilities (icon sizing, localStorage) can be tested in isolation.
- **Integration Tests**:
  - Full pipeline from markdown paste → parser → store update → canvas render → selection sync.
  - Panel open/close → preference persistence → reload verification.

**Quality Gates**

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Schema Validation    | Ensure compliance               | - [ ] Validate node/edge structure; check required fields; forbid invalid types           |
| UI Persistence       | Prevent lost preferences        | - [ ] Test localStorage read/write; verify restore on reload; forbid missing persistence  |
| Render Performance   | Avoid unnecessary updates       | - [ ] Assert shallow selectors used; measure re-render counts; forbid broad subscriptions |

---

## Operational Configuration: Environment Wiring

**Canvas Environment Variables**:

| Variable                          | Scope            | Default                            | Impact                                              |
|-----------------------------------|------------------|------------------------------------|-----------------------------------------------------|
| `VITE_DEFAULT_LAYOUT_MODE`        | deployment       | `'semantic'`                       | Controls initial graph layout algorithm             |
| `VITE_ENABLE_DEBUG_PANELS`        | deployment       | `false`                            | Shows debug panels for store inspection             |
| `VITE_PARSER_VALIDATION_LEVEL`    | deployment       | `'strict'`                         | Controls schema validation strictness during parse  |

**Artifact Generation**: `graph-export.json` (serialized graph) | `schema-export.yaml` (type definitions) | `workflow-config.json` (orchestrator settings)

**Development Workflow Integration**:

| Step | Action                                  | Command/Trigger                         | Artifact Consumer                  |
|------|----------------------------------------|------------------------------------------|-------------------------------------|
| 1    | Start development server               | `npm run dev`                            | Browser                             |
| 2    | Load sample graph                      | Upload CSV/JSON via UI                   | Parser → Store                      |
| 3    | Validate schema                        | Click "Validate" in Schema Panel         | Schema validator                    |
| 4    | Export graph                           | Click "Export" in Toolbar                | User downloads JSON                 |
| 5    | Run tests                              | `npm test`                               | Test runner                         |

| Context              | Intent                          | Directive                                                                                   | Module/Component  | Class/Object | Function/Method              | Dependency      | Input                        | Output                 | Decision Logic                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|-------------------|--------------|------------------------------|-----------------|------------------------------|------------------------|----------------------------------|
| Env Resolution       | Map env to config paths         | - [ ] Read VITE_ variables; construct config objects; forbid hardcoded paths               | ConfigModule      | —            | resolveConfig                | process.env     | env variables                | config object          | Env var parsing + defaults       |
| Parser Invocation    | Run selected parser             | - [ ] Detect format; execute parser; validate output; forbid silent failures               | ParserModule      | —            | runParser                    | parsers         | file, format                 | graph data             | Format detection + parsing       |
| Export Generation    | Serialize graph/schema          | - [ ] Serialize to JSON/YAML; validate structure; forbid partial exports                   | ExportModule      | —            | exportGraph                  | serializers     | graph + schema               | file download          | Serialization + validation       |

---

## Data Flow

**Pipeline**: File Upload → Parser Detection → Normalization → Schema Validation → Store Update → Canvas/Panel Render

| Stage       | Input                          | Output                         | Responsibility                                              | Performance Consideration                    |
|-------------|--------------------------------|--------------------------------|-------------------------------------------------------------|----------------------------------------------|
| Upload      | User file                      | File object                    | UI handles file input, passes to parser module              | File size validation to prevent large uploads|
| Detection   | File object                    | Format enum                    | Parser detects CSV/JSON/JSON-LD/Markdown format             | Header inspection only, O(1)                 |
| Normalize   | Raw file data                  | Internal graph representation  | Parser transforms to nodes/edges with typed properties      | O(n) for n elements, streaming for large files|
| Validate    | Graph data                     | Validated graph + errors       | Schema validator checks types, required fields, references  | O(n) for n nodes/edges, early exit on errors |
| Store Update| Validated graph                | Updated store state            | Store slice applies mutations atomically                    | Shallow selectors minimize re-render impact  |
| Render      | Store state                    | UI update                      | Canvas/panels subscribe via selectors, re-render on change  | Use shallow selectors, memoize components    |

| Context              | Intent                          | Directive                                                                                   | Module           | Function/Method              | Input                | Output                  | Decision Logic                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|------------------|------------------------------|----------------------|-------------------------|----------------------------------|
| File Upload          | Accept user files               | - [ ] Validate size/type; trigger parser; forbid unsupported formats                       | FileUploader     | handleUpload                 | File object          | parser invocation       | File type + size validation      |
| Format Detection     | Identify source format          | - [ ] Inspect headers/extension; return format enum; forbid ambiguous detection            | ParserUtils      | detectFormat                 | File object          | format enum             | Header/extension matching        |
| Normalization        | Convert to internal model       | - [ ] Map fields; apply defaults; validate types; forbid data loss                         | CSVParser        | normalize                    | CSV rows             | graph nodes/edges       | Field mapping + type coercion    |
| Schema Validation    | Ensure graph integrity          | - [ ] Check types/required fields; return errors; forbid invalid graphs                    | SchemaValidator  | validate                     | graph data + schema  | validation result       | Type checking + reference checks |
| Store Mutation       | Update application state        | - [ ] Apply mutations atomically; notify subscribers; forbid partial updates               | graphDataSlice   | updateGraph                  | mutations            | updated state           | Atomic apply + subscriber notify |

---

## Design Decisions & Trade-offs

| Decision             | Rationale                          | Pros                                                  | Cons                                      | Mitigation                                    |
|----------------------|------------------------------------|-------------------------------------------------------|-------------------------------------------|-----------------------------------------------|
| Single Zustand Store | Centralize all state for observability | Single source of truth, predictable updates, easy debugging | Risk of store becoming too large          | Use domain slices, shallow selectors          |
| Panel Isolation      | Separate concerns by view type     | Clear responsibilities, independent testing, reusable | Extra boilerplate for new panels          | Provide template/recipe for adding panels    |
| Shallow Selectors    | Minimize re-renders                | Better performance, avoid unnecessary updates         | Requires discipline to use correctly      | Document selector patterns, code review checks|
| localStorage for UI  | Persist user preferences           | Survives reloads, simple API                          | No sync across tabs, size limits          | Use LS_KEYS constants, validate on read       |
| Schema-Driven        | Validate all graph data            | Type safety, early error detection, clear contracts   | Initial setup overhead, schema migration  | Version schemas, provide migration tools      |

---

## Panel System Directives

### Panel Registration Directives

| Context              | Intent                          | Directive                                                                                   | Enforcement Mechanism                        |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|----------------------------------------------|
| Tab Key Uniqueness   | Avoid collisions                | - [ ] Use unique string keys; document in types; forbid duplicate tab keys                | TypeScript union type for tab keys           |
| Panel Body Component | Isolate rendering               | - [ ] Create focused component; read from store; forbid direct state mutation             | Code review, component structure conventions |
| Store Integration    | Use central state               | - [ ] Read via selectors; write via actions; forbid local state for shared data           | Enforce in linter rules, code review         |

### Panel Layout Directives

| Context              | Intent                          | Directive                                                                                   | Enforcement Mechanism                        |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|----------------------------------------------|
| Main Panel Tabs      | Organize by workflow concern    | - [ ] Group workflow/schema/settings; use clear labels; forbid ambiguous tab names        | Design review, user testing                  |
| Bottom Panel Tabs    | Organize by data concern        | - [ ] Group markdown/parsers/tables; use clear labels; forbid cross-concern mixing        | Component organization, code review          |
| Floating Panels      | Context-sensitive tools         | - [ ] Show on selection/action; hide when irrelevant; forbid always-visible floaters      | UI state rules, user preference toggles      |

---

## UI Density and Icon System Directives

### Icon Consistency Directives

| Context              | Intent                          | Directive                                                                                   | Enforcement Mechanism                        |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|----------------------------------------------|
| Icon Sizing          | Use central scale               | - [ ] Call getIconSizeClass(uiIconScale); apply uniformly; forbid hardcoded sizes         | Utility function, code review                |
| Stroke Width         | Use central setting             | - [ ] Read uiIconStrokeWidth from store; apply to Lucide icons; forbid inline stroke values| Store-driven rendering, code review          |
| Preview Consistency  | Match settings to UI            | - [ ] Reuse icon utilities in previews; show live changes; forbid static preview
