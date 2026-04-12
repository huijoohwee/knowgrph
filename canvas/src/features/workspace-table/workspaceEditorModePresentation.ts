import { MARKDOWN_DATA_VIEW_COPY } from '@/lib/config-copy/markdownDataViewCopy'
import type { WorkspaceEditorMode } from './workspaceEditorMode'

export const WORKSPACE_EDITOR_MODE_LABELS: Readonly<Record<WorkspaceEditorMode, string>> = {
  table: MARKDOWN_DATA_VIEW_COPY.tableViewLabel,
  multiDimTable: MARKDOWN_DATA_VIEW_COPY.titleDefault,
  kanban: MARKDOWN_DATA_VIEW_COPY.kanbanViewLabel,
}

export function getWorkspaceEditorModeLabel(mode: WorkspaceEditorMode): string {
  return WORKSPACE_EDITOR_MODE_LABELS[mode]
}
