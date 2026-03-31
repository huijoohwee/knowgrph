import { warmGraphTableDb } from '@/features/graph-table-db/graphTableDb'

type WorkspaceViewMode = 'canvas' | 'editor'
type EditorWorkspacePane = 'markdown' | 'graphTable'

export function isWorkspaceTableOpen(args: {
  workspaceViewMode: WorkspaceViewMode
  editorWorkspacePane: EditorWorkspacePane
}): boolean {
  return args.workspaceViewMode === 'editor' && args.editorWorkspacePane === 'graphTable'
}

export function openWorkspaceTable(args: {
  workspaceViewMode: WorkspaceViewMode
  editorWorkspacePane: EditorWorkspacePane
  setWorkspaceViewMode: (next: WorkspaceViewMode) => void
  setEditorWorkspacePane: (next: EditorWorkspacePane) => void
}) {
  if (args.workspaceViewMode !== 'editor') args.setWorkspaceViewMode('editor')
  if (args.editorWorkspacePane !== 'graphTable') args.setEditorWorkspacePane('graphTable')
  if (typeof window === 'undefined') return
  void warmGraphTableDb()
}
