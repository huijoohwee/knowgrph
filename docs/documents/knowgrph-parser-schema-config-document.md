
# Knowgrph Parser + Schema Config (Workflow SSOT)

## SSOT UI Surfaces

- Parser and Schema Configurator UI live only in **MainPanel → Workflow**.
- BottomPanel does not contain Parser/Schema tabs and must not embed any Monaco text editors for these concerns.

## File-Based Editing (Editor Workspace)

- Parser script text is edited only via the Editor workspace file: `/parser/parser.py`.
- Schema configuration is edited only via the Editor workspace file: `/schema/schema.json`.

## Sync Rules

- Workspace autosave propagates:
  - `/parser/parser.py` → `useParserUIState.scriptText`
  - `/schema/schema.json` → `useGraphStore.schema` (only when JSON parses; otherwise schema op status reports parse failure)

## Spotlight / Discoverability

- Workflow tool buttons retain `data-kg-spotlight-tab="parser"` and `data-kg-spotlight-tab="schema"` anchors.

