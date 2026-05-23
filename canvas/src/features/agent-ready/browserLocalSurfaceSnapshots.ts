export type LocalMainPanelSurfaceSnapshot = {
  activeTab: string
  activeTabLabel: string
  searchable: boolean
  searchOpen: boolean
  searchVisible: boolean
  searchQuery: string
  searchPlaceholder: string | null
  footerLabel: string | null
  traversalChip: {
    modeLabel: string
    edgesLabel: string
    nodesLabel: string | null
  } | null
  sharedActions: {
    hasApply: boolean
    hasReset: boolean
    hasGlobalReset: boolean
    hasCollapseAll: boolean
    hasExpandAll: boolean
    allCollapsed: boolean
  } | null
}

export type LocalEditorWorkspaceSurfaceSnapshot = {
  activeDocumentKey: string
  workspaceViewMode: string
  workspaceCanvasPaneOpen: boolean
  workspaceEditorOverlayOpen: boolean
  layoutMode: string
  viewerKind: string
  viewerMode: string
  isMarkdown: boolean
  isJsonMarkdownEditing: boolean
  paneVisibility: {
    markdown: boolean
    json: boolean
    viewer: boolean
    html: boolean
    binary: boolean
  }
  splitPaneVisibility: {
    markdown: boolean
    json: boolean
    viewer: boolean
    html: boolean
    bin: boolean
  }
  liveMarkdownText: string
  persistedMarkdownText: string
  hasUncommittedDraft: boolean
  liveDraftSource: 'viewer-inline' | 'json-derived' | 'persisted'
}

export type LocalChatPipelineSurfaceSnapshot = {
  messageCount: number
  isLoading: boolean
  errorText: string | null
  connectivity: 'unknown' | 'ok' | 'error'
  connectivityDetail: string | null
  chatProviderSummary: string
  chatProviderHint: string | null
  chatContextScope: string
  chatStorageTarget: string
  chatKnowgrphWorkspacePath: string | null
  chatHistoryWorkspacePath: string | null
  workspaceViewMode: string
  editorWorkspacePane: string
  markdownDocumentName: string | null
  selectedNodeId: string | null
  streamingAssistant: {
    id: string
    text: string
  } | null
  streamingWorkspacePath: string | null
  streamFollowPath: string | null
  streamDraft: {
    path: string
    text: string
  } | null
}

type TimestampedSnapshot<TSnapshot> = TSnapshot & {
  updatedAtMs: number
}

type BrowserLocalSurfaceSnapshots = {
  mainPanel: TimestampedSnapshot<LocalMainPanelSurfaceSnapshot> | null
  editorWorkspace: TimestampedSnapshot<LocalEditorWorkspaceSurfaceSnapshot> | null
  chatPipeline: TimestampedSnapshot<LocalChatPipelineSurfaceSnapshot> | null
}

const browserLocalSurfaceSnapshots: BrowserLocalSurfaceSnapshots = {
  mainPanel: null,
  editorWorkspace: null,
  chatPipeline: null,
}

const cloneSnapshot = <TSnapshot>(value: TSnapshot | null): TSnapshot | null => {
  if (!value) return null
  return JSON.parse(JSON.stringify(value)) as TSnapshot
}

const withTimestamp = <TSnapshot>(value: TSnapshot): TimestampedSnapshot<TSnapshot> => ({
  ...value,
  updatedAtMs: Date.now(),
})

export const publishLocalMainPanelSurfaceSnapshot = (value: LocalMainPanelSurfaceSnapshot): void => {
  browserLocalSurfaceSnapshots.mainPanel = withTimestamp(value)
}

export const clearLocalMainPanelSurfaceSnapshot = (): void => {
  browserLocalSurfaceSnapshots.mainPanel = null
}

export const readLocalMainPanelSurfaceSnapshot = (): TimestampedSnapshot<LocalMainPanelSurfaceSnapshot> | null =>
  cloneSnapshot(browserLocalSurfaceSnapshots.mainPanel)

export const publishLocalEditorWorkspaceSurfaceSnapshot = (value: LocalEditorWorkspaceSurfaceSnapshot): void => {
  browserLocalSurfaceSnapshots.editorWorkspace = withTimestamp(value)
}

export const clearLocalEditorWorkspaceSurfaceSnapshot = (): void => {
  browserLocalSurfaceSnapshots.editorWorkspace = null
}

export const readLocalEditorWorkspaceSurfaceSnapshot = (): TimestampedSnapshot<LocalEditorWorkspaceSurfaceSnapshot> | null =>
  cloneSnapshot(browserLocalSurfaceSnapshots.editorWorkspace)

export const publishLocalChatPipelineSurfaceSnapshot = (value: LocalChatPipelineSurfaceSnapshot): void => {
  browserLocalSurfaceSnapshots.chatPipeline = withTimestamp(value)
}

export const clearLocalChatPipelineSurfaceSnapshot = (): void => {
  browserLocalSurfaceSnapshots.chatPipeline = null
}

export const readLocalChatPipelineSurfaceSnapshot = (): TimestampedSnapshot<LocalChatPipelineSurfaceSnapshot> | null =>
  cloneSnapshot(browserLocalSurfaceSnapshots.chatPipeline)

export const resetBrowserLocalSurfaceSnapshotsForTests = (): void => {
  browserLocalSurfaceSnapshots.mainPanel = null
  browserLocalSurfaceSnapshots.editorWorkspace = null
  browserLocalSurfaceSnapshots.chatPipeline = null
}
