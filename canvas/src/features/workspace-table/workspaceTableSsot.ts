import { warmGraphTableDb } from '@/features/graph-table-db/graphTableDb'

type WorkspaceViewMode = 'canvas' | 'editor'
type EditorWorkspacePane = 'markdown' | 'graphTable'

type OpenWorkspaceEditorPaneArgs = {
  workspaceViewMode: WorkspaceViewMode
  editorWorkspacePane: EditorWorkspacePane
  workspaceCanvasPaneOpen: boolean
  pane: EditorWorkspacePane
  setWorkspaceViewMode: (next: WorkspaceViewMode) => void
  setEditorWorkspacePane: (next: EditorWorkspacePane) => void
  setWorkspaceCanvasPaneOpen: (open: boolean) => void
}

type CloseWorkspaceViewArgs = {
  workspaceViewMode: WorkspaceViewMode
  workspaceCanvasPaneOpen: boolean
  setWorkspaceViewMode: (next: WorkspaceViewMode) => void
  setWorkspaceCanvasPaneOpen: (open: boolean) => void
}

export function isWorkspaceTableOpen(args: {
  workspaceViewMode: WorkspaceViewMode
  editorWorkspacePane: EditorWorkspacePane
}): boolean {
  return args.workspaceViewMode === 'editor' && args.editorWorkspacePane === 'graphTable'
}

export function openWorkspaceEditorPane(args: OpenWorkspaceEditorPaneArgs) {
  if (args.workspaceViewMode !== 'editor') args.setWorkspaceViewMode('editor')
  if (args.editorWorkspacePane !== args.pane) args.setEditorWorkspacePane(args.pane)
  if (args.workspaceCanvasPaneOpen !== true) args.setWorkspaceCanvasPaneOpen(true)
}

export function closeWorkspaceView(args: CloseWorkspaceViewArgs) {
  if (args.workspaceViewMode !== 'canvas') args.setWorkspaceViewMode('canvas')
  if (args.workspaceCanvasPaneOpen !== true) args.setWorkspaceCanvasPaneOpen(true)
}

export function openWorkspaceTable(args: {
  workspaceViewMode: WorkspaceViewMode
  editorWorkspacePane: EditorWorkspacePane
  workspaceCanvasPaneOpen: boolean
  setWorkspaceViewMode: (next: WorkspaceViewMode) => void
  setEditorWorkspacePane: (next: EditorWorkspacePane) => void
  setWorkspaceCanvasPaneOpen: (open: boolean) => void
}) {
  openWorkspaceEditorPane({
    workspaceViewMode: args.workspaceViewMode,
    editorWorkspacePane: args.editorWorkspacePane,
    workspaceCanvasPaneOpen: args.workspaceCanvasPaneOpen,
    pane: 'graphTable',
    setWorkspaceViewMode: args.setWorkspaceViewMode,
    setEditorWorkspacePane: args.setEditorWorkspacePane,
    setWorkspaceCanvasPaneOpen: args.setWorkspaceCanvasPaneOpen,
  })
  if (typeof window === 'undefined') return
  void warmGraphTableDb()
}
