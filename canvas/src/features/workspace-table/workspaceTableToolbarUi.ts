import { UI_COPY, UI_LABELS } from '@/lib/config'
import { JSON_IMPORT_WORKSPACE_TARGET_LABELS } from '@/features/workspace-table/jsonImportWorkspaceTarget'

export const WORKSPACE_TABLE_TOOLBAR_UI = {
  editorLabel: JSON_IMPORT_WORKSPACE_TARGET_LABELS.editor,
  editorOnTooltip: UI_COPY.toolbarEditorWorkspaceOnTooltip,
  editorOffTooltip: UI_COPY.toolbarEditorWorkspaceOffTooltip,
  tableLabel: UI_LABELS.workspaceGraphDataTable,
  tableOptionTooltip: UI_COPY.toolbarGraphDataTableToggleTitle,
  tableOpenedTooltip: UI_COPY.toolbarGraphDataTableWorkspaceOnTooltip,
  tableClosedTooltip: UI_COPY.toolbarGraphDataTableWorkspaceOffTooltip,
} as const
