# Knowgrph Settings Architecture

## Design Mantras

```
- [ ] Configuration; externalize behavior; forbid hardcoded settings
- [ ] Automation; derive settings schema; forbid manual sync
- [ ] Validation; enforce bounds; forbid invalid values
- [ ] Documentation; explain all settings; forbid undocumented options
- [ ] Performance; optimize schema generation; forbid slow builds
```

---

## Settings Architecture

**Settings Stack**: Source Markdown → Schema Extraction → JSON Schema → TypeScript Types → Runtime Validation

**Data Flow**: Responsibility Flow Doc → Build Script → Settings Schema → Canvas Store → UI Controls → User Preferences

**Design Principles**: Single Source of Truth | Build-Time Generation | Runtime Type Safety | Bounded Value Ranges

---

## Import Settings: PDF

**Scope**: MainPanel → Settings → `Import: PDF`

**Intent**: Let users tune PDF→Markdown conversion performance/fidelity without changing environment variables.

**Keys**

- `pdfImportIncludeImages`, `pdfImportEmbedImages`
- `pdfImportMaxExtractedImagesPerPage`, `pdfImportMaxEmbeddedImagesPerPage`
- `pdfImportMaxEmbeddedTotalBytes`, `pdfImportMaxEmbeddedAssetBytes`
- `pdfImportReconstructTables`, `pdfImportTableMinColumns`, `pdfImportTableMinRows`, `pdfImportTableMaxRows`
- `pdfImportProvider`, `pdfImportDoclingEndpoint`, `pdfImportProviderFallbackToNative`
- `pdfImportOcrEnabled`, `pdfImportOcrMode`

---

## Import Settings: Webpage

**Scope**: Source Files / Markdown Workspace → Import URL; MainPanel → Settings

**Intent**: Keep webpage parsing generic while letting users choose Markdown/JSON/HTML view modes without mutating graph/layout/zoom.

**Keys**

- `webpageImportIncludeImages`
- `webpageImportView` (`markdown` | `json` | `html`)
  - `markdown`: editor/viewer use Markdown (graph parsing remains aligned to Markdown)
  - `json`: editor stays Markdown; viewer/presentation/slides render sandboxed JSON via iframe `srcdoc`
  - `html`: editor stays Markdown; viewer/presentation/slides render sandboxed HTML via iframe `srcdoc`

---

## Import Settings: Website

**Scope**: Markdown Workspace → Import website (sitemap); MainPanel → Settings

**Intent**: Crawl and import a whole website into the workspace as one Markdown file per page, while persisting conversion artifacts (markdown, JSON, HTML) for fast view switching.

**Keys**

- `websiteImportDiscoverSitemap`
- `websiteImportMaxPages`
- `websiteImportConcurrency`
- `websiteImportOutputDirRel`

**Derived rules**
- Website import uses `webpageImportIncludeImages` for conversion and `webpageImportView` as the default per-page view (stored in each stub’s `kgWebpageView`).
- In the active-row dropdown, Viewer/Presentation/Slides render HTML in a sandboxed iframe when `kgWebpageView ∈ {json, html}`.
- When `kgWebsiteImportId/kgWebsiteNodeId` exist, Viewer prefers rendering from stored `raw.html` artifacts (in-repo) instead of proxying live HTML.
- If `kgWebsiteOutputDirRel` is present, it overrides the artifact root directory for resolving `raw.html/page.md/conversion.json`.

---

## Markdown Settings: Viewer / Presentation

**Scope**: Markdown Workspace → Viewer/Presentation; MainPanel → Settings

**Intent**: Keep Markdown rendering defaults configurable and consistent across Viewer, Presentation, and Slides Gallery.

**Keys**

- `markdownWordWrap`
- `markdownTextHighlight`

---

## Settings UI Tooltip Semantics

**Scope**: MainPanel → Settings → key/value rows (hover tooltips)

**Key tooltip (max 50 words)**
- Format: `Role → Actions → Outcome`
- Semantics: one atomic role, 1–2 atomic actions, one concrete outcome

**Value tooltip (max 15 words)**
- Format: `Default: …; Min: …; Max: …; Interval: …; Impact: …`
- Semantics: include default; include min/max/interval when applicable; describe impact succinctly

**Implementation anchors**
- Tooltip builders: `canvas/src/lib/config-copy/tooltips.ts` (`buildRoleActionOutcomeTooltip`, `buildNumericTooltip`)
- Settings UI surface: `canvas/src/features/panels/views/SettingsView.tsx`

**Interaction**
- Hover key label → show key tooltip
- Hover value control → show value tooltip (no separate icon affordance)

**Expanded details row (click to expand)**
- Render only: `Modules | Classes/Objects | Functions/Methods`

---

## Settings Row Layout Consistency (Key / Type / Value)

**Scope**: MainPanel → Settings rows (shared key/value layout utilities)

**Layout rules**
- One setting row renders as one row: Key / Type / Value do not stack into multiple rows at narrow widths.
- Value controls are right-edge aligned within the Value column (text inputs, selects, checkboxes, pill buttons).
- Height is consistent: value controls, preview chips, and pill actions use the same baseline height (`h-6`) to keep rows visually stable.
- Composite value controls (preview + input) must be shrink-safe: wrappers use `w-full min-w-0` and inputs use `min-w-0` so the right border stays aligned.
- Clean interactions: clicking inside a value control does not toggle expand/collapse; only row click toggles.

**Implementation anchors**
- Key/Type/Value row grid: `canvas/src/features/panels/ui/KeyTypeValueRow.tsx`
- Settings surface + status/action pills: `canvas/src/features/panels/views/SettingsView.tsx`
- Settings input renderer (composite controls + alignment/height): `canvas/src/features/settings/ui.tsx` (`renderSettingInput`)

---

## Component Responsibility Matrix

| Layer/Subsystem       | Path/Module                                   | Component                   | Interface/Method            | Responsibility (S-V-O)                                                                        | Dependencies                          | Contracts                                         | LOC    |
|-----------------------|-----------------------------------------------|-----------------------------|-----------------------------|-----------------------------------------------------------------------------------------------|---------------------------------------|---------------------------------------------------|--------|
| Settings Extraction   | `canvas/src/cli/extract-settings-schema.ts`   | Settings Flow Builder       | `deriveFromCode`, `buildFromMarkdown` | Script → derives setting responsibilities and module traces → writes Settings flow artifacts | `canvas/src/features/settings/registry.ts`, `SettingsFallbackDetails.ts` | Outputs `knowgrph-codebase-responsibility-flow.md`, `settings-flow.json`, `settings-flow.schema.json` | ~300 |
| Settings Registry     | `canvas/src/features/settings/registry.ts`    | Settings Registry           | `settingsRegistry`, `loadFlowDetails` | Registry → enumerates all setting keys → provides flow metadata to Settings UI               | `registry-ui*`, `registry-three`, `registry-presets` | Single settings list used for docs, UI, and JSON-LD export | ~40 |
| Settings Store        | `canvas/src/hooks/useGraphStore.ts`           | Graph Store (Zustand)       | `set*` setters              | Store → owns runtime setting state → persists when needed                                    | Zustand, localStorage helpers         | Stable setting setter APIs consumed by registry and UI | ~800+ |
| Settings UI           | `canvas/src/features/panels/views/SettingsView.tsx` | MainPanel Settings View  | `SettingsView`, `useSettingsView` | UI → renders key/type/value rows → batches updates via Apply/Reset                           | Tooltip builders, registry, flow schema | Hover tooltips + click-to-expand modules/classes/functions | ~300 |
| Theme Mode             | `canvas/src/hooks/store/uiSettingsSlice.ts`, `canvas/src/lib/ui/theme.ts`, `canvas/src/App.tsx` | Theme Mode Sync | `setThemeMode`, `applyThemeMode`, `subscribeToSystemThemeChanges` | Store → persists `themeMode` → applies `data-theme` + `.dark` → syncs with OS when mode=system | Zustand, localStorage, matchMedia | DOM theme aligned for CSS vars + Tailwind `dark:` | ~120 |

---

## Settings Schema Extraction (`build:settings`)

### Build Script Architecture

**Command**: `npm run build:settings`

**Source Document**: `knowgrph-codebase-responsibility-flow.md` at repository root (build script bootstraps/rewrites it from code-derived defaults; markdown rows can override inferred fields)

**Processing Flow**:

| Stage              | Input                          | Output                         | Responsibility                                              | Performance Consideration                    |
|--------------------|--------------------------------|--------------------------------|-------------------------------------------------------------|----------------------------------------------|
| Document Reading   | Markdown file path             | Markdown text                  | Read settings flow table from responsibility doc (optional) | O(n) file read, typically <100 KB            |
| Code Derivation    | Settings registry + store code | Inferred flow rows             | Derive areas/modules/functions from runtime settings code   | O(files) scan over settings + store slices   |
| Merge              | Markdown rows + inferred rows  | Final flow rows                | Prefer non-placeholder markdown overrides over inferred rows | O(settings) merge                             |
| File Writing       | Final flow rows                | Disk files                     | Write flow doc + JSON artifacts used by Settings UI         | O(1) JSON serialization + disk I/O           |

**Performance Metrics** (macOS dev machine):

| Metric                  | Typical Value | Notes                                                  |
|-------------------------|---------------|--------------------------------------------------------|
| Total Execution Time    | 0.4-0.7s      | Most time spent in Node/TSX startup, not parsing      |
| Markdown Parse Time     | <50ms         | Regex-based table extraction                           |
| Schema Generation Time  | <20ms         | JSON object construction                               |
| File Write Time         | <10ms         | Two small JSON files to disk                           |

**Configuration Schema**:

```yaml
buildSettings.sourceDoc:
  scope: build_global
  type: string (file path)
  mutability: deployment_configurable
  validation: must exist as markdown file at repo root
  impact: source of truth for settings schema

buildSettings.outputDir:
  scope: build_global
  type: string (directory path)
  mutability: deployment_configurable
  validation: must be writable directory
  impact: location for generated settings schema files

buildSettings.fallbackBehavior:
  scope: build_global
  type: string (enum: "warn" | "error" | "defaults")
  mutability: deployment_configurable
  validation: valid fallback strategy
  impact: behavior when source doc missing (current: "defaults" with stdout warning)
```

**Design Compliance**:

| Context               | Intent                        | Directive                                                                                   | Module/Component          | Function/Method      | Input                     | Output                | Decision Logic                          |
|-----------------------|-------------------------------|---------------------------------------------------------------------------------------------|---------------------------|----------------------|---------------------------|-----------------------|-----------------------------------------|
| Source Doc Detection  | Check file existence          | - [ ] Check for markdown file; fallback to defaults if missing; forbid silent failure      | Settings builder          | `loadSourceDoc`      | file path                 | markdown text or null | fs.existsSync + conditional fs.readFileSync|
| Table Extraction      | Parse settings table          | - [ ] Extract table rows via regex; skip header; forbid partial table parsing               | Settings builder          | `extractTable`       | markdown text             | table rows array      | regex match + line filtering            |
| Setting Parsing       | Build setting descriptors     | - [ ] Parse each row into structured object; validate fields; forbid malformed rows         | Settings builder          | `parseSettingRow`    | table row string          | setting object        | column split + type inference           |
| Schema Generation     | Create JSON Schema            | - [ ] Build schema with types, bounds, descriptions; forbid missing required fields        | Settings builder          | `generateSchema`     | setting objects           | JSON Schema object    | schema template + setting iteration     |

---

## Core Settings Specifications

### `themeMode`

**Area**: UI Appearance

**Responsibility**: Global color theme (Light, Dark, or System)

**Configuration Schema**:

```yaml
themeMode:
  scope: ui_global
  type: string (enum: "light" | "dark" | "system")
  mutability: runtime_configurable
  validation: must be valid theme mode
  impact: controls `data-theme` ("light" | "dark") and `.dark` class for Tailwind variants

themeMode.light:
  css: :root[data-theme='light']
  tokens: --kg-* CSS variables resolve to light palette

themeMode.dark:
  css: :root[data-theme='dark']
  tokens: --kg-* CSS variables resolve to dark palette

themeMode.system:
  css: resolved via matchMedia('(prefers-color-scheme: dark)')
  tokens: updates by listening to matchMedia "change" events (no polling)
```

**UI Control**: "Theme Mode" preset buttons in Settings panel

**Design Compliance**:

| Context               | Intent                        | Directive                                                                                   | Module/Component          | Function/Method      | Input                     | Output                | Decision Logic                          |
|-----------------------|-------------------------------|---------------------------------------------------------------------------------------------|---------------------------|----------------------|---------------------------|-----------------------|-----------------------------------------|
| Theme Application     | Apply color palette           | - [ ] Read `themeMode`; apply `data-theme` + `.dark`; forbid per-component overrides      | Theme utilities + store   | `applyThemeMode`, `setThemeMode` | theme mode string | DOM + store update  | `data-theme` drives CSS vars + Tailwind `dark:` |
| System Sync           | Match OS preference           | - [ ] Listen for OS theme changes; update when `system` active; forbid polling            | App bootstrap             | `subscribeToSystemThemeChanges` | media query change | theme refresh | `matchMedia` change → re-apply system theme |

---

### `canvasInteractionSpeedMultiplier`

**Area**: Canvas Interaction (2D Speed)

**Responsibility**: Unified 2D interaction speed multiplier (drag/pan/zoom) for D3/Flow/FlowEditor

**Configuration Schema**:

```yaml
canvasInteractionSpeedMultiplier:
  scope: ui_global
  type: number
  mutability: runtime_configurable
  validation: clamped to [0.25, 3.0]
  default: 1
  impact: multiplies schema-driven panSpeed/zoomSpeed at interaction points (wheel/pinch/pan)
```

**Implementation anchors**
- Store + persistence: `canvas/src/hooks/store/canvasSlice.ts` (`setCanvasInteractionSpeedMultiplier`)
- D3 interaction application: `canvas/src/components/GraphCanvas/zoom.ts` (wheel/pinch zoom, wheel/pointer/touch pan)
- Flow/FlowEditor interaction application: `canvas/src/components/FlowCanvas/bindNativeInteractions.ts` (wheel/pinch zoom, wheel/pointer pan)

---

### `canvasPanSpeedMultiplier`

**Area**: Canvas Interaction (Pan/Drag)

**Responsibility**: Pan/drag-only speed multiplier for 2D renderers

**Configuration Schema**:

```yaml
canvasPanSpeedMultiplier:
  scope: ui_global
  type: number
  mutability: runtime_configurable
  validation: clamped to [0.25, 3.0]
  default: 1
  impact: multiplies schema-driven panSpeed for wheel pan and pointer/touch panning (does not affect wheel/pinch zoom)
```

**Implementation anchors**
- Store + persistence: `canvas/src/hooks/store/canvasSlice.ts` (`setCanvasPanSpeedMultiplier`)
- D3 interaction application: `canvas/src/components/GraphCanvas/zoom.ts` (wheel pan, pointer/touch pan)
- Flow/FlowEditor interaction application: `canvas/src/components/FlowCanvas/bindNativeInteractions.ts` (wheel pan, pointer pan)

---

### `selectionFlashDurationMs`

**Area**: Selection Flash

**Responsibility**: Duration of canvas-driven selection flash highlights in milliseconds

**Configuration Schema**:

```yaml
selectionFlashDurationMs:
  scope: ui_global
  type: number
  mutability: runtime_configurable
  validation: clamped between 100ms and 2000ms
  impact: controls flash duration for canvas → panel synchronization

flashTargets:
  - Markdown gutter highlights in Bottom Panel
  - Markdown Preview selection flashes
  - Graph Data Table row flashes
```

**Value Bounds**: [100, 2000] milliseconds

**UX Impact**:
- Lower values (100-500ms): Subtle, responsive flashes
- Medium values (500-1000ms): Balanced visibility and responsiveness
- Higher values (1000-2000ms): Extended dwell for accessibility

**Design Compliance**:

| Context               | Intent                        | Directive                                                                                   | Module/Component          | Function/Method      | Input                     | Output                | Decision Logic                          |
|-----------------------|-------------------------------|---------------------------------------------------------------------------------------------|---------------------------|----------------------|---------------------------|-----------------------|-----------------------------------------|
| Duration Clamping     | Enforce valid range           | - [ ] Clamp input to [100, 2000]; forbid values outside bounds                             | Settings validator        | `clampFlashDuration` | duration input            | clamped duration      | Math.max(100, Math.min(2000, duration)) |
| Flash Triggering      | Synchronize flash timing      | - [ ] Trigger flash with configured duration; clear after timeout; forbid stuck highlights | Flash controller          | `triggerFlash`       | target element, duration  | void (DOM update)     | setTimeout-based highlight removal      |

---

### `selectionFlashOpacity`

**Area**: Selection Flash

**Responsibility**: Opacity of canvas-driven selection flash overlays

**Configuration Schema**:

```yaml
selectionFlashOpacity:
  scope: ui_global
  type: number
  mutability: runtime_configurable
  validation: clamped between 0.0 and 1.0
  impact: alpha for overlay-based flashes instead of native selection colors

flashTargets:
  - Markdown editor gutter flashes
  - Markdown Preview block flashes
  - Graph Data Table row flashes
```

**Value Bounds**: [0.0, 1.0] (alpha transparency)

**Default**: 0.18 (subtle overlay)

**Design Compliance**:

| Context               | Intent                        | Directive                                                                                   | Module/Component          | Function/Method      | Input                     | Output                | Decision Logic                          |
|-----------------------|-------------------------------|---------------------------------------------------------------------------------------------|---------------------------|----------------------|---------------------------|-----------------------|-----------------------------------------|
| Opacity Clamping      | Enforce valid alpha range     | - [ ] Clamp input to [0.0, 1.0]; forbid negative or >1.0 values                            | Settings validator        | `clampOpacity`       | opacity input             | clamped opacity       | Math.max(0.0, Math.min(1.0, opacity))   |
| Overlay Application   | Apply alpha to flash overlays | - [ ] Set CSS background with configured opacity; forbid solid color overlays               | Flash renderer            | `applyFlashOverlay`  | element, opacity          | void (CSS update)     | `rgba(r, g, b, opacity)` background     |

---

### `graphHoverPreview`

**Area**: Graph Interaction

**Responsibility**: Configures visibility of information in graph hover tooltip

**Configuration Schema**:

```yaml
graphHoverPreview.showNodeId:
  scope: graph_interaction
  type: boolean
  mutability: runtime_configurable
  validation: boolean
  impact: show Node ID in hover tooltip (default: false)

graphHoverPreview.showNodeName:
  scope: graph_interaction
  type: boolean
  mutability: runtime_configurable
  validation: boolean
  impact: show Node Name/Label (default: true)

graphHoverPreview.showNodeLabel:
  scope: graph_interaction
  type: boolean
  mutability: runtime_configurable
  validation: boolean
  impact: show Node Type/Category (default: true)

graphHoverPreview.showNodeDescription:
  scope: graph_interaction
  type: boolean
  mutability: runtime_configurable
  validation: boolean
  impact: show Node Description (default: true)

graphHoverPreview.showNodeProperties:
  scope: graph_interaction
  type: boolean
  mutability: runtime_configurable
  validation: boolean
  impact: show Node Properties (default: true)

graphHoverPreview.showEdgeId:
  scope: graph_interaction
  type: boolean
  mutability: runtime_configurable
  validation: boolean
  impact: show Edge ID in hover tooltip (default: false)

graphHoverPreview.showEdgeLabel:
  scope: graph_interaction
  type: boolean
  mutability: runtime_configurable
  validation: boolean
  impact: show Edge Label (default: true)

graphHoverPreview.showEdgeWeight:
  scope: graph_interaction
  type: boolean
  mutability: runtime_configurable
  validation: boolean
  impact: show Edge Weight (default: true)

graphHoverPreview.showEdgeProperties:
  scope: graph_interaction
  type: boolean
  mutability: runtime_configurable
  validation: boolean
  impact: show Edge Properties (default: true)
```

**Use Cases**:
- Reduce clutter during presentation mode (hide IDs, properties)
- Focus on specific attributes during analysis (show only labels, weights)
- Debugging mode (show all fields including IDs)

**Design Compliance**:

| Context               | Intent                        | Directive                                                                                   | Module/Component          | Function/Method      | Input                     | Output                | Decision Logic                          |
|-----------------------|-------------------------------|---------------------------------------------------------------------------------------------|---------------------------|----------------------|---------------------------|-----------------------|-----------------------------------------|
| Tooltip Content Generation | Build hover tooltip      | - [ ] Read `graphHoverPreview` settings; conditionally include fields; forbid missing checks| Hover controller          | `buildTooltipContent` | node/edge, settings      | tooltip HTML          | conditional field inclusion based on flags|
| Settings Persistence  | Save hover preferences        | - [ ] Persist settings to localStorage; restore on load; forbid session-only storage        | Settings store            | `persistSettings`    | settings object           | void (localStorage write)| JSON.stringify + localStorage.setItem   |

---

## Settings Extraction Flow

### Markdown Source → JSON Schema Pipeline

**Source Document Structure**:

```markdown
| Setting Name              | Type    | Default | Bounds        | Description                          |
|---------------------------|---------|---------|---------------|--------------------------------------|
| themeMode                 | string  | "light" | light/dark/system | Global color theme                 |
| selectionFlashDurationMs  | number  | 800     | 100-2000      | Flash duration in milliseconds       |
| selectionFlashOpacity     | number  | 0.18    | 0.0-1.0       | Flash overlay opacity                |
| graphHoverPreview.showNodeId | boolean | false | true/false  | Show node ID in tooltip              |
```

**Extraction Logic**:

| Column          | Parsing Rule                                      | Schema Mapping                           |
|-----------------|---------------------------------------------------|------------------------------------------|
| Setting Name    | Extract as `name`; support dot notation for nested| `properties[name]` or nested object      |
| Type            | Map to JSON Schema type (`string`, `number`, `boolean`, `object`, `array`) | `type` field |
| Default         | Parse as literal value; infer type if ambiguous   | `default` field                          |
| Bounds          | Parse range (X-Y), enum (A/B/C), or constraint    | `minimum`, `maximum`, `enum` fields      |
| Description     | Extract as documentation string                   | `description` field                      |

**Generated Schema Example**:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "themeMode": {
      "type": "string",
      "enum": ["light", "dark", "system"],
      "default": "light",
      "description": "Global color theme"
    },
    "selectionFlashDurationMs": {
      "type": "number",
      "minimum": 100,
      "maximum": 2000,
      "default": 800,
      "description": "Flash duration in milliseconds"
    }
  }
}
```

**Design Compliance**:

| Context               | Intent                        | Directive                                                                                   | Module/Component          | Function/Method      | Input                     | Output                | Decision Logic                          |
|-----------------------|-------------------------------|---------------------------------------------------------------------------------------------|---------------------------|----------------------|---------------------------|-----------------------|-----------------------------------------|
| Type Inference        | Derive JSON Schema type       | - [ ] Infer from default value or explicit type column; forbid ambiguous types              | Settings builder          | `inferType`          | setting descriptor        | schema type string    | default value type or explicit column   |
| Bounds Parsing        | Extract constraints           | - [ ] Parse range/enum syntax; apply to schema; forbid unparseable bounds                  | Settings builder          | `parseBounds`        | bounds string             | constraint object     | regex match + conditional schema fields |
| Nested Property Handling | Support dot notation       | - [ ] Split on `.`; create nested objects; forbid flat keys for nested settings            | Settings builder          | `buildNestedSchema`  | property path             | nested schema object  | path.split('.').reduce nesting          |

---

## Bootstrap Behavior

### Source Document Missing

**Condition**: `knowgrph-codebase-responsibility-flow.md` not found at repo root

**Behavior**:

| Action                     | Implementation                                      | Output                                             |
|----------------------------|-----------------------------------------------------|----------------------------------------------------|
| Bootstrap from code         | Derive flow rows from `settingsRegistry` + store setters | Flow rows with modules/classes/functions populated |
| Write source doc            | Emit `knowgrph-codebase-responsibility-flow.md`      | Canonical flow doc created at repo root            |
| Write JSON artifacts        | Emit Settings UI flow JSON files                     | `canvas/public/settings-flow.json` + `canvas/src/features/settings/settings-flow.schema.json` |
| Proceed with build          | Do not fail build process                            | Settings UI always has flow metadata               |

---

## Testing & Quality Standards

**Test Coverage Metrics**

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Schema Extraction    | Validate markdown parsing       | - [ ] Test table extraction; verify all rows parsed; forbid missing settings               |
| Type Inference       | Ensure correct schema types     | - [ ] Test string/number/boolean inference; forbid type mismatches                          |
| Bounds Parsing       | Validate constraint extraction  | - [ ] Test range, enum, boolean bounds; forbid unparsed constraints                        |

**Test Categories**:

- **Unit Tests**: Table parsing, type inference, bounds extraction, nested property handling.
- **Integration Tests**: Full markdown → JSON Schema → TypeScript types pipeline.

**Quality Gates**:

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Schema Completeness  | Ensure all settings extracted   | - [ ] Verify output schema includes all table rows; forbid partial extraction               |
| Performance Bounds   | Keep build fast                 | - [ ] Assert build completes in <1s; forbid slow regex or I/O operations                   |
| Fallback Safety      | Handle missing source gracefully| - [ ] Test fallback to defaults; verify warning logged; forbid build failure               |

---

## Repository Health Checklist

**Build Health**:

| Context              | Status | Directive                                                                                   |
|----------------------|--------|---------------------------------------------------------------------------------------------|
| Source Doc Presence  | ☐      | - [ ] `knowgrph-codebase-responsibility-flow.md` exists at repo root; forbid missing source|
| Schema Output        | ☐      | - [ ] `canvas/public/settings-flow.json` and `canvas/src/features/settings/settings-flow.schema.json` generated; forbid missing output|
| Build Performance    | ☐      | - [ ] `build:settings` completes in <1s; forbid slow extraction                            |

**Settings Quality**:

| Context              | Status | Directive                                                                                   |
|----------------------|--------|---------------------------------------------------------------------------------------------|
| Type Safety          | ☐      | - [ ] All settings have valid JSON Schema types; forbid `any` types                        |
| Bounds Validation    | ☐      | - [ ] Numeric settings have min/max; enums have valid values; forbid unbounded inputs      |
| Documentation        | ☐      | - [ ] All settings have `description` field; forbid undocumented settings                  |

---

## Anti-Patterns (Forbidden)

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Manual Schema Sync   | Automate schema generation      | - [ ] Prefer build script output; forbid hand-editing generated JSON artifacts              |
| Hardcoded Settings   | Externalize configuration       | - [ ] Keep settings in registry + store setters; forbid ad-hoc settings in random modules  |
| Unbounded Values     | Enforce validation              | - [ ] Apply min/max/enum constraints; forbid accepting arbitrary values                     |
| Silent Fallbacks     | Make bootstrap explicit         | - [ ] When source doc is missing, regenerate it; forbid silent empty-flow output            |
