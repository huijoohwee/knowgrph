import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { LS_KEYS, WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS } from '@/lib/config'
import { lsBool, lsInt, lsJson } from '@/lib/persistence'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_TOAST_TTL_MS } from '@/lib/ui/toastTiming'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { useDebouncedValue } from '@/features/hooks/useDebouncedValue'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { parseMarkdownWorkspaceLayoutMode, type MarkdownWorkspaceLayoutMode } from '@/features/markdown-explorer/workspaceUi'
import type { HighlightedLineRange, MarkdownPresentationApi } from '@/components/BottomPanel/markdownWorkspace/markdownWorkspaceTypes'
import { VerticalResizeSeparatorHr } from '@/components/ui/VerticalResizeSeparatorHr'
import { MarkdownWorkspaceExplorer } from '@/components/BottomPanel/markdownWorkspace/MarkdownWorkspaceExplorer'
import { MarkdownWorkspaceMain } from '@/components/BottomPanel/markdownWorkspace/MarkdownWorkspaceMain'
import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'
import { SIDEBAR_MAX_PX, SIDEBAR_MIN_PX, isMarkdownPath } from '@/components/BottomPanel/markdownWorkspace/markdownWorkspaceUtils'
import { loadWorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import { useWorkspaceFileActions, useWorkspaceStatusHelpers } from '@/components/BottomPanel/markdownWorkspace/useWorkspaceFileActions'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { resolveWorkspaceExplorerDefaultWidthPx } from '@/features/workspace-table/workspaceViewCanvasDefaults'
import { registerMarkdownWorkspaceActionBridge } from '@/features/markdown-explorer/workspaceActionBridge'
import { EMPTY_GRAPH_EDGES, EMPTY_GRAPH_NODES, EMPTY_WIDGET_REGISTRY, parseStringArray, type FolderModeContract } from './markdownWorkspaceRuntime.shared'
import { useMarkdownWorkspaceDerivedViews } from './useMarkdownWorkspaceDerivedViews'
import { useMarkdownWorkspaceEffectiveContent } from './useMarkdownWorkspaceEffectiveContent'
import { useMarkdownWorkspaceExplorerState } from './useMarkdownWorkspaceExplorerState'
import { useMarkdownWorkspaceIndexing } from './useMarkdownWorkspaceIndexing'
import { useMarkdownWorkspaceInteractions } from './useMarkdownWorkspaceInteractions'
import { useMarkdownWorkspaceSave } from './useMarkdownWorkspaceSave'
import { useMarkdownWorkspaceSelection } from './useMarkdownWorkspaceSelection'
import { useMarkdownWorkspaceViewShell } from './useMarkdownWorkspaceViewShell'
import { useMarkdownWorkspaceWidgetMode } from './useMarkdownWorkspaceWidgetMode'

export function MarkdownWorkspace(props: { active?: boolean } = {}) {
  const active = props.active !== false
  const activeRef = React.useRef(active)
  React.useEffect(() => {
    activeRef.current = active
  }, [active])

  const themeMode = useGraphStore(s => (s.resolvedThemeMode || 'light') as 'light' | 'dark')
  const bottomPanelCollapsed = useGraphStore(s => s.bottomPanelCollapsed)
  const workspaceViewMode = useGraphStore(s => s.workspaceViewMode)
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || 'font-sans')
  const uiPanelMonospaceTextClass = useGraphStore(s => s.uiPanelMonospaceTextClass || 'font-mono text-xs')
  const applyMarkdownDocumentToGraph = useGraphStore(s => s.applyMarkdownDocumentToGraph)
  const setActiveMarkdownDocument = useGraphStore(s => s.setActiveMarkdownDocument)
  const markdownDocumentName = useGraphStore(s => s.markdownDocumentName)
  const markdownDocumentText = useGraphStore(s => s.markdownDocumentText)
  const setGraphRagWorkflowJsonText = useGraphStore(s => s.setGraphRagWorkflowJsonText)
  const workspaceCanvasPaneOpen = useGraphStore(s => s.workspaceCanvasPaneOpen)
  const canvasWorkspaceSyncMode = useGraphStore(s => s.canvasWorkspaceSyncMode)
  const canvas2dRenderer = useGraphStore(s => s.canvas2dRenderer)
  const graphNodes = useGraphStore(
    s => ((s.graphData as GraphData | null)?.nodes as GraphNode[] | undefined) || EMPTY_GRAPH_NODES,
  )
  const graphEdges = useGraphStore(
    s => ((s.graphData as GraphData | null)?.edges as GraphEdge[] | undefined) || EMPTY_GRAPH_EDGES,
  )
  const graphContentRevision = useGraphStore(s => (s.graphContentRevision || 0) as number)
  const docLocationRevision = useGraphStore(s => (s.docLocationRevision || 0) as number)
  const widgetRegistry = useGraphStore(s => s.effectiveWidgetRegistry ?? EMPTY_WIDGET_REGISTRY)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const selectionSource = useGraphStore(s => s.selectionSource)
  const setSelectionSource = useGraphStore(s => s.setSelectionSource)
  const selectNode = useGraphStore(s => s.selectNode)
  const selectEdge = useGraphStore(s => s.selectEdge)
  const openWidgetNodeIds = useGraphStore(s => s.openWidgetNodeIds || [])

  const activePath = useMarkdownExplorerStore(s => s.activePath)
  const setActivePath = useMarkdownExplorerStore(s => s.setActivePath)
  const requestedRevealLine = useMarkdownExplorerStore(s => s.requestedRevealLine)
  const requestRevealLine = useMarkdownExplorerStore(s => s.requestRevealLine)
  const lastSetActivePath = useMarkdownExplorerStore(s => s.lastSetActivePath)

  const effectiveBottomPanelCollapsed = workspaceViewMode === 'editor' ? false : bottomPanelCollapsed
  const [entries, setEntries] = React.useState<WorkspaceEntry[]>([])
  const [sourcesByPath, setSourcesByPath] = React.useState(() => loadWorkspaceSourceIndex())
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [sidebarWidthPx, setSidebarWidthPx] = React.useState(() =>
    lsInt(
      LS_KEYS.markdownSidebarWidthPx,
      resolveWorkspaceExplorerDefaultWidthPx({ minPx: SIDEBAR_MIN_PX, maxPx: SIDEBAR_MAX_PX }),
    ),
  )
  const [explorerOpen, setExplorerOpen] = React.useState(() => lsBool(LS_KEYS.markdownSidebarOpen, true))
  const [sourceFilesCollapsed, setSourceFilesCollapsed] = React.useState(() =>
    lsBool(LS_KEYS.markdownExplorerSourceFilesCollapsed, false),
  )
  const [tocCollapsed, setTocCollapsed] = React.useState(() => lsBool(LS_KEYS.markdownExplorerOutlineCollapsed, false))
  const [backlinksCollapsed, setBacklinksCollapsed] = React.useState(() =>
    lsBool(LS_KEYS.markdownExplorerBacklinksCollapsed, false),
  )
  const [markdownWordWrap, setMarkdownWordWrap] = React.useState(() => lsBool(LS_KEYS.markdownWordWrap, true))
  const [markdownTextHighlight, setMarkdownTextHighlight] = React.useState(() =>
    lsBool(LS_KEYS.markdownTextHighlight, false),
  )
  const [folderModeContract, setFolderModeContract] = React.useState<FolderModeContract>(() =>
    lsJson<FolderModeContract>(
      LS_KEYS.markdownExplorerFolderModeContract,
      'sitemap',
      raw => (raw === 'user-journey' ? 'user-journey' : 'sitemap'),
    ),
  )
  const [layoutMode, setLayoutMode] = React.useState<MarkdownWorkspaceLayoutMode>(() =>
    lsJson<MarkdownWorkspaceLayoutMode>(LS_KEYS.markdownLayoutMode, 'split', parseMarkdownWorkspaceLayoutMode),
  )
  const [expandedPaths, setExpandedPaths] = React.useState<Set<string>>(() => {
    const arr = lsJson(LS_KEYS.markdownExplorerSourceFilesExpandedPaths, [] as string[], parseStringArray)
    return new Set((arr || []).map(path => normalizeWorkspacePath(path)))
  })
  const patchWorkspaceEntryInlineText = React.useCallback((path: WorkspacePath, text: string) => {
    const inlineText = text.length <= WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS ? text : undefined
    const updatedAtMs = Date.now()
    setEntries(prev => {
      let changed = false
      const next = prev.map(entry => {
        if (entry.path !== path || entry.kind !== 'file') return entry
        if (entry.text === inlineText) return entry
        changed = true
        return { ...entry, text: inlineText, updatedAtMs }
      })
      return changed ? next : prev
    })
  }, [])

  const editorRef = React.useRef<MonacoTextEditorHandle | null>(null)
  const [resizeHandleEl, setResizeHandleEl] = React.useState<HTMLHRElement | null>(null)
  const workspaceRootRef = React.useRef<HTMLElement | null>(null)
  const presentationApiRef = React.useRef<MarkdownPresentationApi | null>(null)
  const [highlightedLineRange, setHighlightedLineRange] = React.useState<HighlightedLineRange>(null)
  const [activeText, setActiveText] = React.useState('')
  const activeTextRef = React.useRef('')
  activeTextRef.current = activeText
  const [viewerInlineEditActive, setViewerInlineEditActive] = React.useState(false)
  const viewerInlineEditActiveRef = React.useRef(false)
  viewerInlineEditActiveRef.current = viewerInlineEditActive

  const status = useWorkspaceStatusHelpers()
  const setStatusInfo = status.setStatusInfo
  const setStatusError = status.setStatusError
  const setStatusProgress = status.setStatusProgress
  const setStatusWithAutoClear = React.useCallback(
    (label: string, ttlMs: number = UI_TOAST_TTL_MS.statusAutoClose) => setStatusInfo(label, { ttlMs }),
    [setStatusInfo],
  )
  const userEditedActiveTextRef = React.useRef(false)
  const setActiveTextProgrammatic = React.useCallback((next: string) => {
    userEditedActiveTextRef.current = false
    setActiveText(next)
  }, [])
  const debouncedText = useDebouncedValue(activeText, 450, activePath)
  const outlineText = useDebouncedValue(activeText, 160, activePath)
  const lastLoadedRef = React.useRef<{ path: WorkspacePath; text: string } | null>(null)
  const repairedMissingWorkspaceFilesRef = React.useRef<Set<WorkspacePath>>(new Set())
  const lastIndexedByPathRef = React.useRef<Map<WorkspacePath, string>>(new Map())
  const indexJobRef = React.useRef(0)
  const collapsedSnapshotRef = React.useRef<{ path: WorkspacePath; text: string } | null>(null)
  const prevCollapsedRef = React.useRef<boolean>(effectiveBottomPanelCollapsed)
  const lastRequestedActivePathRef = React.useRef<{ path: WorkspacePath; atMs: number } | null>(null)
  const activePathRef = React.useRef<WorkspacePath | null>(null)
  activePathRef.current = activePath

  const wasWorkspaceEditorModeOpenRef = React.useRef<boolean>(workspaceViewMode === 'editor')
  const layoutModeRef = React.useRef<MarkdownWorkspaceLayoutMode>(layoutMode)
  React.useEffect(() => {
    layoutModeRef.current = layoutMode
  }, [layoutMode])
  React.useEffect(() => {
    const open = workspaceViewMode === 'editor'
    const wasOpen = wasWorkspaceEditorModeOpenRef.current
    wasWorkspaceEditorModeOpenRef.current = open
    if (!open || wasOpen) return
    setLayoutMode('split')
    setExplorerOpen(true)
    setSidebarWidthPx(resolveWorkspaceExplorerDefaultWidthPx({ minPx: SIDEBAR_MIN_PX, maxPx: SIDEBAR_MAX_PX }))
  }, [workspaceViewMode])

  const widgetState = useMarkdownWorkspaceWidgetMode({
    graphNodes,
    graphEdges,
    graphContentRevision,
    widgetRegistry,
    openWidgetNodeIds,
    selectedNodeId,
    activePath,
    isMarkdownPath,
  })
  const explorerState = useMarkdownWorkspaceExplorerState({
    active,
    activePathRef,
    activeTextRef,
    viewerInlineEditActiveRef,
    lastLoadedRef,
    entries,
    setEntries,
    setSourcesByPath,
    setLoading,
    setLoadError,
    setStatusInfo,
    setStatusError,
    setStatusProgress,
    sidebarWidthPx,
    explorerOpen,
    sourceFilesCollapsed,
    tocCollapsed,
    backlinksCollapsed,
    markdownWordWrap,
    markdownTextHighlight,
    folderModeContract,
    layoutMode,
    expandedPaths,
    resizeHandleEl,
    setSidebarWidthPx,
    search,
  })
  const selectionState = useMarkdownWorkspaceSelection({
    activePath,
    setActivePath,
    entries,
    loading,
    activeText,
    setActiveText,
    setActiveTextProgrammatic,
    markdownDocumentName,
    markdownDocumentText,
    setActiveMarkdownDocument,
    sourcesByPath,
    viewerInlineEditActive,
    activeRef,
    activeTextRef,
    lastLoadedRef,
    userEditedActiveTextRef,
    collapsedSnapshotRef,
    prevCollapsedRef,
    effectiveBottomPanelCollapsed,
    canvas2dRenderer,
    lastSetActivePath,
    lastRequestedActivePathRef,
    patchWorkspaceEntryInlineText,
    clearStatus: status.clearStatus,
    setHighlightedLineRange: () => setHighlightedLineRange(null),
  })
  const derivedViews = useMarkdownWorkspaceDerivedViews({
    activePath,
    activeText,
    layoutMode,
    getFs: explorerState.getFs,
    sourcesByPath,
    lastLoadedRef,
    activeTextRef,
    userEditedActiveTextRef,
    patchWorkspaceEntryInlineText,
    setActiveTextProgrammatic,
    setActiveMarkdownDocument,
    setStatusError,
    setStatusProgress,
    setStatusWithAutoClear,
  })
  useMarkdownWorkspaceIndexing({
    active,
    viewerInlineEditActive,
    contentMode: widgetState.contentMode,
    widgetAvailable: widgetState.widgetAvailable,
    activePath,
    activeEntry: selectionState.activeEntry,
    activeEntryKind: selectionState.activeEntryKind,
    activeEntryText: selectionState.activeEntryText,
    activeDocumentKey: selectionState.activeDocumentKey,
    activeDocumentSourceUrl: selectionState.activeDocumentSourceUrl,
    sourcesByPath,
    getFs: explorerState.getFs,
    lastLoadedRef,
    activePathRef,
    activeTextRef,
    userEditedActiveTextRef,
    repairedMissingWorkspaceFilesRef,
    lastIndexedByPathRef,
    indexJobRef,
    patchWorkspaceEntryInlineText,
    setActiveTextProgrammatic,
    setActiveMarkdownDocument,
    setEntries,
    setStatusError,
    setStatusProgress,
    setStatusWithAutoClear,
  })
  const saveState = useMarkdownWorkspaceSave({
    active,
    viewerInlineEditActive,
    activePath,
    activeEntryKind: selectionState.activeEntryKind,
    activeText,
    debouncedText,
    activeDocumentKey: selectionState.activeDocumentKey,
    activeDocumentSourceUrl: selectionState.activeDocumentSourceUrl,
    getFs: explorerState.getFs,
    lastLoadedRef,
    patchWorkspaceEntryInlineText,
    setActiveMarkdownDocument,
    setGraphRagWorkflowJsonText,
    setStatusProgress,
    setStatusWithAutoClear,
    setStatusError,
    setActiveTextProgrammatic,
    refresh: explorerState.refresh,
    setActivePathSafe: selectionState.setActivePathSafe,
    setSelectionPathSafe: selectionState.setSelectionPathSafe,
    userEditedActiveTextRef,
  })
  const interactionState = useMarkdownWorkspaceInteractions({
    active,
    entries,
    explorerOpen,
    tocCollapsed,
    backlinksCollapsed,
    activePath,
    setActivePathSafe: selectionState.setActivePathSafe,
    setExpandedPaths,
    activeDocumentKey: selectionState.activeDocumentKey,
    activeText,
    setActiveText,
    outlineText,
    graphNodesRef: widgetState.graphNodesRef,
    graphEdgesRef: widgetState.graphEdgesRef,
    docLocationRevision,
    selectedNodeId,
    selectedEdgeId,
    selectionSource,
    setSelectionSource,
    selectNode,
    selectEdge,
    requestRevealLine,
    requestedRevealLine,
    editorRef: editorRef as React.MutableRefObject<any>,
    layoutModeRef,
    setLayoutMode,
    setHighlightedLineRange,
    markdownDocumentName,
    markdownDocumentText,
    workspaceCanvasPaneOpen,
    canvasWorkspaceSyncMode,
    contentMode: widgetState.contentMode,
    widgetEditorText: widgetState.widgetEditorText,
    applyMarkdownDocumentToGraph,
    setStatusError,
    setStatusInfo,
    setStatusProgress: label => setStatusProgress(label),
  })

  const refreshWorkspace = explorerState.refresh
  React.useEffect(() => {
    if (active) void refreshWorkspace()
  }, [active, refreshWorkspace])
  React.useEffect(() => {
    if (!highlightedLineRange) return
    const id = window.setTimeout(() => setHighlightedLineRange(null), 1500)
    return () => window.clearTimeout(id)
  }, [highlightedLineRange])

  const toggleFullscreen = React.useCallback(() => {
    const el = workspaceRootRef.current
    if (!el) return
    try {
      const doc = document as Document & { fullscreenElement?: Element | null; exitFullscreen?: () => Promise<void> }
      if (doc.fullscreenElement) {
        void doc.exitFullscreen?.()
        return
      }
      const requestFullscreen = (el as HTMLElement & { requestFullscreen?: () => Promise<void> }).requestFullscreen
      void requestFullscreen?.call(el)
    } catch {
      void 0
    }
  }, [])

  const fileActions = useWorkspaceFileActions({
    getFs: explorerState.getFs,
    refresh: explorerState.refresh,
    openedPath: activePath,
    selectionPath: selectionState.selectionPath,
    selectionEntryKind: selectionState.selectionEntry?.kind ?? null,
    activeDocumentKey: selectionState.activeDocumentKey,
    activeDocumentSourceUrl: selectionState.activeDocumentSourceUrl,
    setActiveText: setActiveTextProgrammatic,
    setEntries,
    lastLoadedRef,
    setExpandedPaths,
    setActivePathSafe: selectionState.setActivePathSafe,
    setSelectionPathSafe: selectionState.setSelectionPathSafe,
    setActiveMarkdownDocument,
    applyMarkdownDocumentToGraph,
  })
  const viewShell = useMarkdownWorkspaceViewShell({
    entries,
    sourcesByPath,
    folderModeContract,
    setFolderModeContract,
    selectionPath: selectionState.selectionPath,
    selectionEntryKind: selectionState.selectionEntry?.kind ?? null,
    setActivePathSafe: selectionState.setActivePathSafe,
    setSelectionPathSafe: selectionState.setSelectionPathSafe,
    setExpandedPaths,
    resolveFolderContractDocPath: explorerState.resolveFolderContractDocPath,
    pickFolderContractTargetPath: explorerState.pickFolderContractTargetPath,
    youtubeWorkspaceMeta: derivedViews.youtubeWorkspaceMeta,
    switchActiveYoutubeWorkspaceFormat: derivedViews.switchActiveYoutubeWorkspaceFormat,
    revealLineInEditor: interactionState.revealLineInEditor,
    setStatusWithAutoClear,
  })

  const effectiveContent = useMarkdownWorkspaceEffectiveContent({
    activePath,
    activeDocumentKey: selectionState.activeDocumentKey,
    activeEntryKind: selectionState.activeEntryKind,
    activeText,
    setActiveText,
    markdownDocumentName,
    markdownDocumentText,
    layoutMode,
    contentMode: widgetState.contentMode,
    widgetFormat: widgetState.widgetFormat,
    widgetEditorText: widgetState.widgetEditorText,
    widgetViewerText: widgetState.widgetViewerText,
    pdfWorkspaceViewerTextOverride: derivedViews.pdfWorkspaceViewerTextOverride,
    webpageWorkspaceMeta: derivedViews.webpageWorkspaceMeta,
    webpageWorkspaceEditorTextOverride: derivedViews.webpageWorkspaceEditorTextOverride,
    webpageWorkspaceViewerTextOverride: derivedViews.webpageWorkspaceViewerTextOverride,
    userEditedActiveTextRef,
  })
  const saveEnabled = effectiveContent.saveEnabled
  const saveActiveFileNow = saveState.saveActiveFileNow

  const actionBridge = React.useMemo(
    () => ({
      importLocalFiles: fileActions.handleImportLocalFiles,
      importLocalFolder: fileActions.handleImportLocalFolder,
      importUrl: fileActions.handleImportUrl,
      importWebsite: fileActions.handleImportWebsite,
      createNewFolder: () => void fileActions.createNewFolder({ parentPath: selectionState.createParentPath }),
      save: saveEnabled ? () => void saveActiveFileNow() : undefined,
    }),
    [fileActions, saveActiveFileNow, saveEnabled, selectionState.createParentPath],
  )
  React.useEffect(() => {
    return registerMarkdownWorkspaceActionBridge('markdown-workspace-explorer', actionBridge)
  }, [actionBridge])

  return (
    <section
      ref={workspaceRootRef}
      className={`flex-1 w-full h-full min-h-0 flex overflow-hidden rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg}`}
      aria-label="Markdown Workspace"
    >
      {explorerOpen ? (
        <>
          <MarkdownWorkspaceExplorer
            uiPanelTextFontClass={uiPanelTextFontClass}
            sidebarWidthPx={sidebarWidthPx}
            sidebarWidthMinPx={SIDEBAR_MIN_PX}
            sidebarWidthMaxPx={SIDEBAR_MAX_PX}
            entries={entries}
            filteredEntries={explorerState.filteredEntries}
            sourcesByPath={sourcesByPath}
            loading={loading}
            loadError={loadError}
            expandedPaths={expandedPaths}
            toggleExpanded={viewShell.toggleExpanded}
            activePath={selectionState.selectionPath || activePath}
            onSelectFile={viewShell.onSelectFile}
            onSelectFolder={viewShell.onSelectFolder}
            search={search}
            setSearch={setSearch}
            sourceFilesCollapsed={sourceFilesCollapsed}
            setSourceFilesCollapsed={setSourceFilesCollapsed}
            tocCollapsed={tocCollapsed}
            setTocCollapsed={setTocCollapsed}
            backlinksCollapsed={backlinksCollapsed}
            setBacklinksCollapsed={setBacklinksCollapsed}
            tocTokens={interactionState.tocTokens}
            backlinks={interactionState.backlinks}
            onRevealLine={interactionState.revealLineInEditor}
            onOpenBacklink={viewShell.openBacklink}
            onTocReorder={interactionState.onTocReorder}
            onCreateNewFile={() => void fileActions.createNewFile({ parentPath: selectionState.createParentPath })}
            onRefresh={() => void explorerState.refresh()}
            activeEntryName={selectionState.selectionEntry?.name || ''}
            activeEntryKind={selectionState.selectionEntry?.kind || ''}
            canClearActiveSelection={fileActions.canClearActiveSelection}
            onClearActiveSelection={fileActions.onClearActiveSelection}
            canRefreshActiveFromSource={viewShell.canRefreshActiveFromSource}
            onRefreshActiveFromSource={() => {
              if (!selectionState.selectionPath || selectionState.selectionEntry?.kind !== 'file') return
              void fileActions.refreshFileFromSource(selectionState.selectionPath)
            }}
            canDeleteActive={fileActions.canDeleteActive}
            onDeleteActive={fileActions.onDeleteActive}
            onRevealInFinder={viewShell.revealInFinder}
            onRenameEntry={fileActions.onRenameEntry}
            onDeleteEntry={fileActions.onDeleteEntry}
            renderSourceFileRight={viewShell.renderSourceFileRight}
          />
          <VerticalResizeSeparatorHr ref={setResizeHandleEl} ariaLabel="Resize explorer" visualStyle="centerGrip" />
        </>
      ) : null}

      <MarkdownWorkspaceMain
        themeMode={themeMode}
        uiPanelTextFontClass={uiPanelTextFontClass}
        uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
        geoDatasetIntegration={interactionState.geoDatasetIntegration}
        explorerOpen={explorerOpen}
        setExplorerOpen={setExplorerOpen}
        layoutMode={layoutMode}
        setLayoutMode={setLayoutMode}
        markdownWordWrap={markdownWordWrap}
        setMarkdownWordWrap={setMarkdownWordWrap}
        markdownTextHighlight={markdownTextHighlight}
        setMarkdownTextHighlight={setMarkdownTextHighlight}
        onStatusProgress={setStatusProgress}
        onStatusWithAutoClear={(label, ttlMs) => setStatusWithAutoClear(label, ttlMs)}
        onSaveAs={() => void saveState.saveAsActiveFileNow()}
        onToggleFullscreen={toggleFullscreen}
        presentationApiRef={presentationApiRef}
        isEditing={effectiveContent.effectiveIsEditing}
        isMarkdown={effectiveContent.effectiveIsMarkdown}
        onFormatAction={interactionState.handleFormatAction}
        webpageWorkspaceMeta={derivedViews.webpageWorkspaceMeta}
        onWebpageChangeView={view => void derivedViews.switchActiveWebpageWorkspaceView(view)}
        onWebpageUpdateMeta={patch => void derivedViews.updateActiveWebpageWorkspaceMeta(patch)}
        activeText={effectiveContent.effectiveActiveText}
        setActiveText={effectiveContent.effectiveSetActiveText}
        editorTextOverride={effectiveContent.effectiveEditorTextOverride}
        disableEditorMutations={
          effectiveContent.disableEditorMutations
        }
        webpageHtmlOverride={null}
        viewerTextOverride={effectiveContent.combinedViewerTextOverride}
        disableViewerMutations={effectiveContent.disableViewerMutations}
        activeDocumentKey={selectionState.activeDocumentKey}
        highlightedLineRange={highlightedLineRange}
        revealLineInEditor={interactionState.revealLineInEditor}
        showInViewer={interactionState.showInViewer}
        showInPresentation={interactionState.showInPresentation}
        showInSlidesGallery={interactionState.showInSlidesGallery}
        editorUri={effectiveContent.editorUri}
        editorLanguage={effectiveContent.editorLanguage}
        editorRef={editorRef}
        onEditorCaretLine={interactionState.onEditorCaretLine}
        onViewerInlineEditStateChange={activeState =>
          viewShell.handleViewerInlineEditStateChange(activeState, updater => setViewerInlineEditActive(updater))
        }
      />
    </section>
  )
}
