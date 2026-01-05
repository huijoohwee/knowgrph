## Visualization (Global)
- Node shape per type: circle, rect, diamond, hex, image
- Node icon/image URL per type; badge/marker overlays
- Node opacity, z-index, halo/shadow/glow styles
- Label: wrap width, clamp lines, ellipsis, background pill, offset
- Edge caps/joins, arrowhead shapes (triangle, bar), dash patterns
- Edge curvature and bundling toggles; label along path; multi-line labels

## Interaction & UX
- Double-click actions per type/label (open, focus, expand neighbors)
- Hover tooltip templates per type/label; show/hide rules
- Selection styles (stroke/halo) per type; lasso/marquee settings
- Keyboard shortcuts overrides; contextual menu item enable/disable per type/label
- Drag constraint per type; snap tolerance; pan friction; zoom bounds

## Validation & Rules
- Allowed endpoints matrix: edge label → { sourceTypes[], targetTypes[] }
- Cardinality constraints: min/max edges per node type/edge label
- Disallowed property keys; computed properties (read-only)
- Default values enforcement; deprecation warnings for keys
- Cross-entity constraints via expressions (e.g., edge.amount requires source.type = Investor)

## Templates & Defaults
- Node templates per type: default props, default label pattern
- Edge templates per label: default props, default label
- ID strategies: uuid/short/custom; label auto-formatters
- Default auto-placement strategies (grid, radial ring per type)
- Property formats: number (locale), date/time (ISO), enum lists

## Layout & Physics
- Per-type mass/charge; edge strength by label
- Link distance function by property (e.g., weight → shorter)
- Clustering: group by property/type; cluster forces and hulls
- Preset layouts: grid, DAG (topological), radial; per-type radius
- Fit padding per selection; save/restore layout presets

## Serialization & Mapping
- JSON-LD: context fragments per type/label; predicate map per edge label
- Export options: embed schema vs external schema.json; versioning & migrations
- RDF/Turtle mappings; external vocab URIs and prefixes

## Performance & Rendering
- LOD thresholds: hide labels under zoom, cull small nodes/edges
- Max nodes/edges render caps; lazy updates; animation duration caps
- Throttle/debounce for highlight/selection; memory budgets

## Accessibility & Guidance
- High-contrast palette; font scale; keyboard navigation
- Legend entries per type/label; mini-map; grid/ruler
- Quick filters definitions; saved views and filter presets

## Panel Additions (Global)
- Sections: Shapes & Icons, Tooltip & Selection, Endpoint Matrix, Cardinality, Templates, Clustering, Serialization, Performance, Accessibility, Legend & Filters
- Controls: dropdowns (shapes), color pickers, numeric inputs, matrices (endpoint/types), JSON editors for templates/context, toggles for bundling/LOD

## Implementation Notes
- Extend GraphSchema with optional blocks: visualization, interaction, endpointMatrix, cardinality, templates, clustering, serialization, performance, accessibility, legend
- Add non-breaking defaults; merge setters in store; validate endpoint/cardinality on edge/node updates (warn/error)
- Canvas: apply shapes/icons, endpoint restrictions on creation, layout presets; respect LOD and performance knobs
- Docs: examples for common configurations; migration guidance and versioning