import { LS_KEYS } from '@/lib/config'
import { lsJson, lsSetJson } from '@/lib/persistence'
import { parseGraphTableViewMode } from '@/features/graph-table/ui/graphTableViewMode'

export type WorkspaceEditorMode = 'table' | 'multiDimTable' | 'kanban'

export const WORKSPACE_EDITOR_MODE_OPTIONS: WorkspaceEditorMode[] = ['table', 'multiDimTable', 'kanban']

export function parseWorkspaceEditorMode(raw: unknown): WorkspaceEditorMode | null {
  const value = String(raw || '').trim().toLowerCase()
  if (value === 'multidimtable') return 'multiDimTable'
  if (value === 'kanban') return 'kanban'
  if (value === 'table') return 'table'
  return null
}

export function readWorkspaceEditorMode(): WorkspaceEditorMode {
  const primary = lsJson(LS_KEYS.workspaceEditorMode, 'table' as WorkspaceEditorMode, parseWorkspaceEditorMode)
  if (primary) return primary

  const legacy = lsJson(LS_KEYS.markdownDerivedViewerMode, 'table' as WorkspaceEditorMode, parseWorkspaceEditorMode)
  if (legacy) {
    if (typeof window !== 'undefined') lsSetJson(LS_KEYS.workspaceEditorMode, legacy)
    return legacy
  }
  const graphTableView = lsJson(LS_KEYS.graphTableViewMode, 'table' as const, parseGraphTableViewMode)
  const fallback = graphTableView === 'kanban' ? 'kanban' : graphTableView === 'multiDimTable' ? 'multiDimTable' : 'table'
  if (typeof window !== 'undefined') lsSetJson(LS_KEYS.workspaceEditorMode, fallback)
  return fallback
}

export function writeWorkspaceEditorMode(next: WorkspaceEditorMode): WorkspaceEditorMode {
  const mode = parseWorkspaceEditorMode(next) || 'table'
  const currentWorkspaceMode = parseWorkspaceEditorMode(lsJson(LS_KEYS.workspaceEditorMode, mode, parseWorkspaceEditorMode)) || 'table'
  const currentDerivedMode = parseWorkspaceEditorMode(lsJson(LS_KEYS.markdownDerivedViewerMode, mode, parseWorkspaceEditorMode)) || 'table'
  const nextGraphTableMode = mode === 'kanban' ? 'kanban' : mode === 'multiDimTable' ? 'multiDimTable' : 'table'
  const currentGraphTableMode = lsJson(LS_KEYS.graphTableViewMode, 'table' as const, parseGraphTableViewMode)
  if (currentWorkspaceMode !== mode) {
    lsSetJson(LS_KEYS.workspaceEditorMode, mode)
  }
  if (currentDerivedMode !== mode) {
    lsSetJson(LS_KEYS.markdownDerivedViewerMode, mode)
  }
  if (currentGraphTableMode !== nextGraphTableMode) {
    lsSetJson(LS_KEYS.graphTableViewMode, nextGraphTableMode)
  }
  return mode
}
