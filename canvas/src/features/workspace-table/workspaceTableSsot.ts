import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'

type WorkspaceViewMode = 'canvas' | 'editor'
type EditorWorkspacePane = 'markdown' | 'graphTable'

const WORKSPACE_GRAPH_MUTATION_TRANSITION_BLOCK_MS = 360

export type WorkspaceGraphMutationState = {
  workspaceViewMode: WorkspaceViewMode
  workspaceCanvasPaneOpen: boolean
  markdownWorkspaceIndexingInFlight?: boolean
  workspaceGraphMutationBlockUntilMs?: number
  workspaceGraphMutationBlockKey?: string
}

type WorkspaceGraphMutationKeyArgs = WorkspaceGraphMutationState & {
  transitionSemanticKey?: string | null
}

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
  return args.workspaceViewMode === 'editor'
}

export function isWorkspaceGraphMutationBlocked(args: WorkspaceGraphMutationState): boolean {
  if (isWorkspaceEditorOverlayOpen(args) || args.markdownWorkspaceIndexingInFlight === true) return true
  const untilMs = Number(args.workspaceGraphMutationBlockUntilMs || 0)
  return Number.isFinite(untilMs) && untilMs > Date.now()
}

export function buildWorkspaceGraphMutationBlockKey(args: WorkspaceGraphMutationKeyArgs): string {
  const transitionSemanticKey = String(args.transitionSemanticKey || '').trim()
  return buildScopedGraphSemanticKey('workspace-graph-mutation-block', {
    graphSemanticKey: [
      args.workspaceViewMode === 'editor' ? 'editor' : 'canvas',
      args.workspaceCanvasPaneOpen === true ? 'pane:1' : 'pane:0',
      args.markdownWorkspaceIndexingInFlight === true ? 'indexing:1' : 'indexing:0',
      transitionSemanticKey ? `transition:${transitionSemanticKey}` : 'transition:',
    ].join('|'),
  })
}

export function buildWorkspaceGraphMutationTransitionState(
  args: WorkspaceGraphMutationKeyArgs & { nowMs?: number },
): Pick<WorkspaceGraphMutationState, 'workspaceGraphMutationBlockUntilMs' | 'workspaceGraphMutationBlockKey'> {
  const nowMs = Number.isFinite(args.nowMs) ? Math.max(0, Math.floor(args.nowMs as number)) : Date.now()
  return {
    workspaceGraphMutationBlockUntilMs: nowMs + WORKSPACE_GRAPH_MUTATION_TRANSITION_BLOCK_MS,
    workspaceGraphMutationBlockKey: buildWorkspaceGraphMutationBlockKey(args),
  }
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
    if (args.workspaceViewMode !== 'editor') args.setWorkspaceViewMode('editor')
    if (args.workspaceCanvasPaneOpen !== true) args.setWorkspaceCanvasPaneOpen(true)
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
