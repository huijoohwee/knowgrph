## Current Global Schema Fields

- nodeStyles: `{ [type]: { color } }`
- edgeStyles: `{ [label]: { color } }`
- rules: `[{ target: 'node'|'edge', type?, required[] }]`
- behavior: `{ allowEdgeCreation, allowNodeDrag }`
- catalog: `{ nodeTypes: string[], edgeLabels: string[] }`
- propertySchemas:
  - node: `{ [type]: { [key]: { type, required?, uniqueness?, pattern?, range?, enum?, default?, description? } } }`
  - edge: `{ [label]: { [key]: { type, required?, uniqueness?, pattern?, range?, enum?, default?, description? } } }`

## Additional Configuration Categories

### Visualization
- Node shape: `circle | rect | diamond | hex | image`, per type
- Node size: radius/width/height per type; min/max clamps
- Node stroke: color/width/dash per type
- Edge style: width, dash, curvature, arrow markers (start/end), opacity
- Edge routing: straight | quadratic | bundled
- Labels: font size, weight, color, placement (above/right), max-length + ellipsis
- Palette: named palettes and per-type overrides
- Conditional styles: style rules based on property predicates (e.g., degree ≥ N → color X)

### Interaction & Behavior
- Drag constraint: `free | axis-x | axis-y | none`
- Snap to grid: on/off, grid size
- Select modes: single, multi-select, lasso
- Create modes: `shift-drag | click-source-then-click-target | panel-only`
- Prevent duplicates/self-loops: booleans per edge label
- Hover highlight intensity and debounce
- Context menu items: enable/disable per type/label

### Validation & Rules
- Property types: `{ key: 'string|number|boolean|array|object' }` per type/label
- Regex/patterns and ranges (min/max) for numeric props
- Uniqueness constraints: by property keys (e.g., `id`, `name`) per type
- Cross-entity constraints: e.g., edge `amount` present only if source.type = Investor
- Rule severity: `error | warn` and messaging

### Templates & Defaults
- Node templates per type: default properties, default label prefix, id strategy (`uuid | short | custom`)
- Edge templates per label: default properties, default label text
- Auto-populate on create: apply template

### Layout & Physics
- Force strengths: link distance per edge label, charge strength, collision radius per type
- Gravity/center strength, alphaDecay
- Padding around viewport (fit-to-screen behavior)

### Serialization & Mapping
- JSON-LD mapping: per edge label → predicate name, per node type → `@type`
- Context management: base prefixes, compact vs expanded IRIs
- Save schema: embed alongside graph or save separate `schema.json`
- Versioning: `schema.version`, migration notes

## UI Changes (SchemaEditorPanel)

- Sections: Types, Properties, Colors & Styles, Behavior, Validation & Rules, Templates & Defaults, Layout, Serialization
- Controls:
  - Pickers for colors, shape dropdowns, numeric sliders for sizes and physics
  - Toggles for behavior, select for drag constraint, grid size input
  - Rule builder: target/type, required, types, ranges, regex, severity
  - Template editors: per-type/label JSON editors with Apply/Format
  - Serialization: predicate/type mapping editor and context JSON editor
- Actions: Apply, Format, New (defaultSchema), Copy JSON, Clear Customizations

## Store & Types Updates

- Extend `GraphSchema`:
  - visualization: `nodeShapes`, `nodeSizes`, `nodeStroke`, `edgeStyles{ width, dash, curvature, arrow }`, `labels{ fontSize, color, placement }`, `palette`
  - behavior: `dragConstraint`, `snapGrid{ enabled, size }`, `selectMode`, `createMode`, `preventDuplicates`, `preventSelfLoops`, `hover{ intensity, debounceMs }`, `menu{ enabled: Record<string, boolean> }`
  - validation: `propertyTypes`, `patterns`, `ranges`, `uniqueness`, `crossConstraints`, `severity`
  - templates: `nodeTemplates`, `edgeTemplates`, `idStrategy`
  - layout: `forces{ linkDistanceByLabel, charge, collisionByType, center, alphaDecay }`, `fitPadding`
  - serialization: `predicatesByLabel`, `typesByNode`, `context`, `version`
- Add setters for each section and a `setSchema` merge helper
- Rule enforcement: light-touch validation in `updateNode/updateEdge` with `warn|error` honoring severity (block on `error`, notify on `warn`)

## Canvas Integrations

- Visualization: apply shapes (SVG paths), sizes, stroke, label styles; edge curvature/arrows
- Behavior: drag constraints, snapping, selection modes, creation modes
- Layout: apply force/link distances and collision radii per schema
- Conditional styles: recompute on selection/hover and property checks

## Persistence

- Save schema with graph (embedded) and support separate `schema.json`
- Load precedence: external schema overrides embedded; merge strategy documented
- Include `schema.version` and simple migration mapping

## Validation & Testing

- Unit tests for schema merge and rule enforcement
- Canvas snapshot tests for styles given schema fixtures
- End-to-end: create entity with template, verify visualization and validation

## Rollout Plan

- Add fields incrementally per section; ship behind sensible defaults
- Keep existing behavior for users without schema
- Document examples and migration guidance in README
- Add explicit catalogs and property schemas, and CRUD setters:
  - `addNodeType | renameNodeType | removeNodeType`
  - `addEdgeLabel | renameEdgeLabel | removeEdgeLabel`
  - `upsertNodeProperty | removeNodeProperty`
  - `upsertEdgeProperty | removeEdgeProperty`
- Synchronize property specs to `validation` and `templates`
