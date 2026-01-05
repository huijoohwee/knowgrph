## Goals & Scope
- Add full CRUD in the "Edit Schema" panel for:
  - Node types and Edge labels catalogs (create, read, rename, delete)
  - Property definitions per node type / edge label (create, update, delete)
  - Business rules (validation, endpoint constraints, cardinality)
  - Behavior configuration (existing, plus minor additions)
- Keep backward compatibility with current schema; no destructive data changes.

## Current State
- Schema model lives in `canvas/src/lib/graph/schema.ts:10-69`, with `defaultSchema` (`canvas/src/lib/graph/schema.ts:71-104`).
- Store holds schema and provides rich setters for styles, behavior, validation, endpoint matrix, cardinality, templates, serialization in `canvas/src/hooks/useGraphStore.ts:338-480`.
- UI panel exists and edits global schema in `canvas/src/components/SchemaEditorPanel.tsx:9-335` but lacks catalogs and property CRUD; also missing some destructured store functions.

## Data Model Updates
- Extend `GraphSchema` with explicit catalogs and property specs:
  - `catalog?: { nodeTypes: string[]; edgeLabels: string[] }`
  - `propertySchemas?: {
      node?: Record<string, Record<string, {
        type: 'string' | 'number' | 'boolean' | 'array' | 'object'
        required?: boolean
        uniqueness?: boolean
        pattern?: string
        range?: { min?: number; max?: number }
        enum?: string[]
        default?: any
        description?: string
      }>>
      edge?: Record<string, Record<string, {
        type: 'string' | 'number' | 'boolean' | 'array' | 'object'
        required?: boolean
        uniqueness?: boolean
        pattern?: string
        range?: { min?: number; max?: number }
        enum?: string[]
        default?: any
        description?: string
      }>>
    }`
- Keep using existing `validation`, `templates`, `endpointMatrix`, `cardinality`, `rules`, `behavior` fields; property CRUD will sync to these (e.g., required/types/patterns/ranges/uniqueness + defaults).
- Update `defaultSchema` with empty `catalog` and `propertySchemas` to avoid breaking reads.

## Store API Changes
- Add CRUD setters (pure state updates, no side effects):
  - `addNodeType(type: string)` / `renameNodeType(oldType: string, newType: string)` / `removeNodeType(type: string)`
  - `addEdgeLabel(label: string)` / `renameEdgeLabel(oldLabel: string, newLabel: string)` / `removeEdgeLabel(label: string)`
  - `upsertNodeProperty(type: string, key: string, spec: PropertySpec)` / `removeNodeProperty(type: string, key: string)`
  - `upsertEdgeProperty(label: string, key: string, spec: PropertySpec)` / `removeEdgeProperty(label: string, key: string)`
  - Internals sync:
    - Update `validation.node[type]` and `templates.node[type]` from node property specs
    - Update `validation.edge[label]` and `templates.edge[label]` from edge property specs
    - When renaming types/labels, migrate related entries across `nodeStyles`, `nodeSizes`, `nodeStroke`, `nodeShapes`, `layout.forces.collisionByType`, `endpointMatrix`, `cardinality`, `templates`, `validation`
    - On delete, remove related schema entries; do not delete data nodes/edges — validation will mark them invalid
- Fix missing destructures in Schema Editor to include existing setters like `setLabelOffset`, `setSerialization`, `setNodeTemplate`, `setEdgeTemplate`, `setLodHideLabelsBelow`, `setHighContrast`, `setEndpointMatrix`, `setCardinalityNodeType`, `setCardinalityEdgeLabel`, `setEdgeArrow` used in `SchemaEditorPanel.tsx`.

## UI Panel Changes
- Introduce tabs for clarity: `Types`, `Properties`, `Rules`, `Behavior`, `Styles`, `Layout`, `Serialization`, `Performance`, `Accessibility`.
- Types tab:
  - Show and manage `catalog.nodeTypes` and `catalog.edgeLabels`
  - Create, rename, delete actions; show detected types/labels from current data as suggestions
- Properties tab:
  - Select a node type or edge label; list property rows from `propertySchemas`
  - Add property: name, type, required, uniqueness, pattern, min/max, enum, default, description
  - Edit property spec inline; delete property
  - Automatic syncing to `validation.*`, `templates.*`
- Rules tab:
  - Validation severity per type/label; bulk required keys
  - Endpoint Matrix editor (existing UI upgraded with current values)
  - Cardinality editor (existing UI shows current schema values)
  - Global `rules[]` list editor (add/remove entries with target, type, required, severity)
- Behavior tab:
  - Keep existing toggles; add optional `selectMode`, `createMode`, `hover` controls surfaced if present in schema
- Styles/Layout/Serialization/Performance/Accessibility tabs:
  - Move existing controls into tabs, preserving current functionality

## Business Rules & Validation Behavior
- Enforce existing validation when updating nodes/edges in store (`canvas/src/hooks/useGraphStore.ts:100-152` and `210-253`).
- Property specs drive validation (types, required, patterns, ranges, uniqueness) and defaults via templates for newly added nodes/edges.
- Deleting a type/label only affects schema; existing data remains, flagged by validation and rendered with fallback styles.

## Backward Compatibility & Migration
- If `catalog` or `propertySchemas` is absent, derive lists from data (current behavior) and allow editing that initializes these fields.
- No changes to `GraphNode`/`GraphEdge` shapes.
- Keep schema JSON export/import stable; new fields are optional.

## Verification Plan
- Manual checks in dev server:
  - Create new node type and edge label; add properties and rules; confirm schema JSON reflects changes
  - Add nodes/edges; confirm templates apply defaults; validation prevents invalid updates
  - Rename/delete types/labels; confirm related schema entries migrate/clean up and existing data gets validation warnings
- Spot fix: ensure `SchemaEditorPanel` destructuring includes all used setters to avoid runtime errors.

## Deliverables
- Updated `GraphSchema` and `defaultSchema` definitions
- New store CRUD methods with migrations and synchronization
- Refactored `SchemaEditorPanel` with tabbed UI and property CRUD
- Minor alignment in `GraphCanvas` to read updated schema where applicable (no logic changes needed)
- Documentation snippet in `.trae/documents/Extend Global Schema Configuration.md` outlining new fields and usage