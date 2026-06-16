type WorkspaceViewMode = 'canvas' | 'editor'
type EditorWorkspacePane = 'markdown'

export type WorkspaceEditorOpenStore = {
  workspaceViewMode: WorkspaceViewMode
  editorWorkspacePane: EditorWorkspacePane
  workspaceCanvasPaneOpen: boolean
  setWorkspaceViewMode: (next: WorkspaceViewMode) => void
  setWorkspaceViewState?: (next: { mode: WorkspaceViewMode; paneOpen?: boolean }) => void
  setEditorWorkspacePane: (next: EditorWorkspacePane) => void
  setWorkspaceCanvasPaneOpen: (open: boolean) => void
}

type OpenWorkspaceEditorPaneArgs = {
  workspaceViewMode: WorkspaceViewMode
  editorWorkspacePane: EditorWorkspacePane
  workspaceCanvasPaneOpen: boolean
  pane: EditorWorkspacePane
  setWorkspaceViewMode: (next: WorkspaceViewMode) => void
  setWorkspaceViewState?: (next: { mode: WorkspaceViewMode; paneOpen?: boolean }) => void
  setEditorWorkspacePane: (next: EditorWorkspacePane) => void
  setWorkspaceCanvasPaneOpen: (open: boolean) => void
}

export function openWorkspaceEditorPane(args: OpenWorkspaceEditorPaneArgs) {
  if (args.editorWorkspacePane !== args.pane) args.setEditorWorkspacePane(args.pane)
  if (args.workspaceViewMode !== 'editor' || args.workspaceCanvasPaneOpen !== true) {
    if (args.setWorkspaceViewState) {
      args.setWorkspaceViewState({ mode: 'editor', paneOpen: true })
      return
    }
    if (args.workspaceViewMode !== 'editor') args.setWorkspaceViewMode('editor')
    if (args.workspaceCanvasPaneOpen !== true) args.setWorkspaceCanvasPaneOpen(true)
  }
}

export function openMarkdownWorkspaceEditorPane(store: WorkspaceEditorOpenStore) {
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
}
