import { useGraphStore } from '@/hooks/useGraphStore'
import { LS_KEYS } from '@/lib/config'
import { lsJson, lsSetJson } from '@/lib/persistence'
import { openWorkspaceEditorPane, openWorkspaceTable } from '@/features/workspace-table/workspaceTableSsot'
import { writeWorkspaceEditorMode } from '@/features/workspace-table/workspaceEditorMode'
import { WORKSPACE_TABLE_PREFS_EVENT } from '@/features/workspace-table/workspaceTablePreferencesEvents'

export type JsonImportWorkspaceTarget = 'editor' | 'multiDimTable' | 'canvas'

export const JSON_IMPORT_WORKSPACE_TARGET_OPTIONS: JsonImportWorkspaceTarget[] = ['editor', 'multiDimTable', 'canvas']

export const JSON_IMPORT_WORKSPACE_TARGET_LABELS: Record<JsonImportWorkspaceTarget, string> = {
  editor: 'Editor Workspace',
  multiDimTable: 'Multi-dimensional Table',
  canvas: 'Infinite Canvas',
}

const parseJsonImportWorkspaceTarget = (value: unknown): JsonImportWorkspaceTarget | null => {
  if (value === 'editor' || value === 'multiDimTable' || value === 'canvas') return value
  return null
}

export const readJsonImportWorkspaceTarget = (): JsonImportWorkspaceTarget =>
  lsJson<JsonImportWorkspaceTarget>(LS_KEYS.jsonImportWorkspaceTarget, 'multiDimTable', parseJsonImportWorkspaceTarget)

export const writeJsonImportWorkspaceTarget = (next: JsonImportWorkspaceTarget): JsonImportWorkspaceTarget =>
  lsSetJson<JsonImportWorkspaceTarget>(LS_KEYS.jsonImportWorkspaceTarget, next)

export function applyJsonImportWorkspaceTarget(args?: { preferFlowEditor?: boolean }) {
  const store = useGraphStore.getState()
  if (args?.preferFlowEditor === true) {
    store.setCanvasRenderMode('2d')
    store.setCanvas2dRenderer('flowEditor')
    store.setWorkspaceViewMode('canvas')
    return
  }

  const target = readJsonImportWorkspaceTarget()
  if (target === 'canvas') {
    store.setWorkspaceViewMode('canvas')
    return
  }
  if (target === 'editor') {
    openWorkspaceEditorPane({
      workspaceViewMode: store.workspaceViewMode,
      editorWorkspacePane: store.editorWorkspacePane,
      workspaceCanvasPaneOpen: store.workspaceCanvasPaneOpen,
      pane: 'markdown',
      setWorkspaceViewMode: store.setWorkspaceViewMode,
      setWorkspaceViewState: store.setWorkspaceViewState,
      setEditorWorkspacePane: store.setEditorWorkspacePane,
      setWorkspaceCanvasPaneOpen: store.setWorkspaceCanvasPaneOpen,
    })
    return
  }
  writeWorkspaceEditorMode('multiDimTable')
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new Event(WORKSPACE_TABLE_PREFS_EVENT))
    } catch {
      void 0
    }
  }
  openWorkspaceTable({
    workspaceViewMode: store.workspaceViewMode,
    editorWorkspacePane: store.editorWorkspacePane,
    workspaceCanvasPaneOpen: store.workspaceCanvasPaneOpen,
    setWorkspaceViewMode: store.setWorkspaceViewMode,
    setWorkspaceViewState: store.setWorkspaceViewState,
    setEditorWorkspacePane: store.setEditorWorkspacePane,
    setWorkspaceCanvasPaneOpen: store.setWorkspaceCanvasPaneOpen,
  })
}
