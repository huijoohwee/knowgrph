type WorkspaceViewMode = 'canvas' | 'editor'
type EditorWorkspacePane = 'markdown' | 'graphTable'

type WorkspaceEditorOpenStore = {
  workspaceViewMode: WorkspaceViewMode
  editorWorkspacePane: EditorWorkspacePane
  workspaceCanvasPaneOpen: boolean
  setWorkspaceViewMode: (next: WorkspaceViewMode) => void
  setWorkspaceViewState?: (next: { mode: WorkspaceViewMode; paneOpen?: boolean }) => void
  setEditorWorkspacePane: (next: EditorWorkspacePane) => void
  setWorkspaceCanvasPaneOpen: (open: boolean) => void
}

export function isWorkspaceEditorOverlayOpen(args: {
  workspaceViewMode: WorkspaceViewMode
  workspaceCanvasPaneOpen: boolean
}): boolean {
  return args.workspaceViewMode === 'editor' && args.workspaceCanvasPaneOpen === true
}

export function isWorkspaceGraphMutationBlocked(args: {
  workspaceViewMode: WorkspaceViewMode
  workspaceCanvasPaneOpen: boolean
  markdownWorkspaceIndexingInFlight?: boolean
}): boolean {
  return isWorkspaceEditorOverlayOpen(args) || args.markdownWorkspaceIndexingInFlight === true
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

type CloseWorkspaceViewArgs = {
  workspaceViewMode: WorkspaceViewMode
  workspaceCanvasPaneOpen: boolean
  setWorkspaceViewMode: (next: WorkspaceViewMode) => void
  setWorkspaceViewState?: (next: { mode: WorkspaceViewMode; paneOpen?: boolean }) => void
  setWorkspaceCanvasPaneOpen: (open: boolean) => void
}

export function isWorkspaceTableOpen(args: {
  workspaceViewMode: WorkspaceViewMode
  editorWorkspacePane: EditorWorkspacePane
}): boolean {
  return args.workspaceViewMode === 'editor' && args.editorWorkspacePane === 'graphTable'
}

export function openWorkspaceEditorPane(args: OpenWorkspaceEditorPaneArgs) {
  if (args.editorWorkspacePane !== args.pane) args.setEditorWorkspacePane(args.pane)
  if (args.workspaceViewMode !== 'editor' || args.workspaceCanvasPaneOpen !== true) {
    if (args.setWorkspaceViewState) {
      args.setWorkspaceViewState({ mode: 'editor', paneOpen: true })
      return
    }
    if (args.workspaceViewMode !== 'editor') {
      args.setWorkspaceViewMode('editor')
      return
    }
    args.setWorkspaceCanvasPaneOpen(true)
  }
}

export function closeWorkspaceView(args: CloseWorkspaceViewArgs) {
  if (args.setWorkspaceViewState) {
    args.setWorkspaceViewState({ mode: 'canvas', paneOpen: false })
    return
  }
  if (args.workspaceViewMode !== 'canvas') args.setWorkspaceViewMode('canvas')
  if (args.workspaceCanvasPaneOpen !== false) args.setWorkspaceCanvasPaneOpen(false)
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

export function openWorkspaceTable(args: {
  workspaceViewMode: WorkspaceViewMode
  editorWorkspacePane: EditorWorkspacePane
  workspaceCanvasPaneOpen: boolean
  setWorkspaceViewMode: (next: WorkspaceViewMode) => void
  setWorkspaceViewState?: (next: { mode: WorkspaceViewMode; paneOpen?: boolean }) => void
  setEditorWorkspacePane: (next: EditorWorkspacePane) => void
  setWorkspaceCanvasPaneOpen: (open: boolean) => void
}) {
  openWorkspaceEditorPane({
    workspaceViewMode: args.workspaceViewMode,
    editorWorkspacePane: args.editorWorkspacePane,
    workspaceCanvasPaneOpen: args.workspaceCanvasPaneOpen,
    pane: 'graphTable',
    setWorkspaceViewMode: args.setWorkspaceViewMode,
    setWorkspaceViewState: args.setWorkspaceViewState,
    setEditorWorkspacePane: args.setEditorWorkspacePane,
    setWorkspaceCanvasPaneOpen: args.setWorkspaceCanvasPaneOpen,
  })
  if (typeof window === 'undefined') return
  void import('@/features/graph-table-db/graphTableDb').then(mod => mod.warmGraphTableDb())
}
