import { LS_KEYS } from '@/lib/config'
import { lsJson, lsSetJson } from '@/lib/persistence'
import { parseGraphTableViewMode, type GraphTableViewMode } from '@/features/graph-table/ui/graphTableViewMode'

export type WorkspaceEditorMode = 'table' | 'multiDimTable' | 'kanban'
export type WorkspaceBackedGraphTableViewMode = Exclude<GraphTableViewMode, 'geospatial'>

export const WORKSPACE_EDITOR_MODE_OPTIONS: WorkspaceEditorMode[] = ['table', 'multiDimTable', 'kanban']

export function parseWorkspaceEditorMode(raw: unknown): WorkspaceEditorMode | null {
  const value = String(raw || '').trim().toLowerCase()
  if (value === 'multidimtable') return 'multiDimTable'
  if (value === 'kanban') return 'kanban'
  if (value === 'table') return 'table'
  return null
}

export function toWorkspaceBackedGraphTableViewMode(
  mode: WorkspaceEditorMode,
): WorkspaceBackedGraphTableViewMode {
  return mode === 'kanban' ? 'kanban' : mode === 'multiDimTable' ? 'multiDimTable' : 'table'
}

export function toWorkspaceEditorModeFromGraphTableViewMode(
  mode: GraphTableViewMode | null | undefined,
): WorkspaceEditorMode {
  return mode === 'kanban' ? 'kanban' : mode === 'multiDimTable' || mode === 'geospatial' ? 'multiDimTable' : 'table'
}

export function readWorkspaceEditorMode(): WorkspaceEditorMode {
  const primary = lsJson(LS_KEYS.workspaceEditorMode, 'table' as WorkspaceEditorMode, parseWorkspaceEditorMode)
  if (primary) return primary
  const graphTableView = lsJson(LS_KEYS.graphTableViewMode, 'table' as const, parseGraphTableViewMode)
  const fallback = toWorkspaceEditorModeFromGraphTableViewMode(graphTableView)
  if (typeof window !== 'undefined') lsSetJson(LS_KEYS.workspaceEditorMode, fallback)
  return fallback
}

export function writeWorkspaceEditorMode(next: WorkspaceEditorMode): WorkspaceEditorMode {
  const mode = parseWorkspaceEditorMode(next) || 'table'
  const currentWorkspaceMode = parseWorkspaceEditorMode(lsJson(LS_KEYS.workspaceEditorMode, mode, parseWorkspaceEditorMode)) || 'table'
  const nextGraphTableMode = toWorkspaceBackedGraphTableViewMode(mode)
  const currentGraphTableMode = lsJson(LS_KEYS.graphTableViewMode, 'table' as const, parseGraphTableViewMode)
  if (currentWorkspaceMode !== mode) {
    lsSetJson(LS_KEYS.workspaceEditorMode, mode)
  }
  if (currentGraphTableMode !== nextGraphTableMode) {
    lsSetJson(LS_KEYS.graphTableViewMode, nextGraphTableMode)
  }
  return mode
}
