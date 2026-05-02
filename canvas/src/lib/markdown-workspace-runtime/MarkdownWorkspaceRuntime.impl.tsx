import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { WorkspacePath } from '@/features/workspace-fs/types'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import type { MarkdownWorkspaceLayoutMode } from '@/features/markdown-explorer/workspaceUi'
import { VerticalResizeSeparatorHr } from '@/components/ui/VerticalResizeSeparatorHr'
import { MarkdownWorkspaceExplorer } from '@/components/BottomPanel/markdownWorkspace/MarkdownWorkspaceExplorer'
import { MarkdownWorkspaceMain } from '@/components/BottomPanel/markdownWorkspace/MarkdownWorkspaceMain'
import {
  isMarkdownPath,
  SIDEBAR_MAX_PX,
  SIDEBAR_MIN_PX,
} from '@/components/BottomPanel/markdownWorkspace/markdownWorkspaceUtils'
import { useWorkspaceFileActions } from '@/components/BottomPanel/markdownWorkspace/useWorkspaceFileActions'
import { useWorkspaceStatusHelpers } from '@/components/BottomPanel/markdownWorkspace/useWorkspaceFileActions'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { EMPTY_GRAPH_EDGES, EMPTY_GRAPH_NODES, EMPTY_WIDGET_REGISTRY } from './markdownWorkspaceRuntime.shared'
import { useMarkdownWorkspaceDerivedViews } from './useMarkdownWorkspaceDerivedViews'
import { useMarkdownWorkspaceEffectiveContent } from './useMarkdownWorkspaceEffectiveContent'
import { useMarkdownWorkspaceExplorerState } from './useMarkdownWorkspaceExplorerState'
import { useMarkdownWorkspaceIndexing } from './useMarkdownWorkspaceIndexing'
import { useMarkdownWorkspaceInteractions } from './useMarkdownWorkspaceInteractions'
import { useMarkdownWorkspaceSave } from './useMarkdownWorkspaceSave'
import { useMarkdownWorkspaceSelection } from './useMarkdownWorkspaceSelection'
import { useMarkdownWorkspaceViewShell } from './useMarkdownWorkspaceViewShell'
import { useMarkdownWorkspaceWidgetMode } from './useMarkdownWorkspaceWidgetMode'
import { useMarkdownWorkspaceShell } from './useMarkdownWorkspaceShell'
import { isWorkspaceEditorOverlayOpen } from '@/features/workspace-table/workspaceTableSsot'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import { useMarkdownWorkspaceBootstrapState } from './useMarkdownWorkspaceBootstrapState'
import {
  buildMarkdownWorkspaceDerivedViewsArgs,
  buildMarkdownWorkspaceFileActionsArgs,
  buildMarkdownWorkspaceIndexingArgs,
  buildMarkdownWorkspaceSaveArgs,
  buildMarkdownWorkspaceSelectionArgs,
} from './markdownWorkspaceRuntime.composition'
import { UI_TOAST_TTL_MS } from '@/lib/ui/toastTiming'
import { resolveWorkspaceExplorerDefaultWidthPx } from '@/features/workspace-table/workspaceViewCanvasDefaults'

const EMPTY_STRING_ARRAY: string[] = []

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
  const graphSourceLayerHash = useGraphStore(s => {
    const metadata = ((s.graphData as GraphData | null)?.metadata || null) as Record<string, unknown> | null
    return typeof metadata?.sourceLayerHash === 'string' ? metadata.sourceLayerHash : ''
  })
  const graphSourceLayerOrderHash = useGraphStore(s => {
    const metadata = ((s.graphData as GraphData | null)?.metadata || null) as Record<string, unknown> | null
    return typeof metadata?.sourceLayerOrderHash === 'string' ? metadata.sourceLayerOrderHash : ''
  })
  const docLocationRevision = useGraphStore(s => (s.docLocationRevision || 0) as number)
  const widgetRegistry = useGraphStore(s => s.effectiveWidgetRegistry ?? EMPTY_WIDGET_REGISTRY)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const selectionSource = useGraphStore(s => s.selectionSource)
  const setSelectionSource = useGraphStore(s => s.setSelectionSource)
  const selectNode = useGraphStore(s => s.selectNode)
  const selectEdge = useGraphStore(s => s.selectEdge)
  const openWidgetNodeIds = useGraphStore(s => s.openWidgetNodeIds ?? EMPTY_STRING_ARRAY)

  const activePath = useMarkdownExplorerStore(s => s.activePath)
  const setActivePath = useMarkdownExplorerStore(s => s.setActivePath)
  const requestedRevealLine = useMarkdownExplorerStore(s => s.requestedRevealLine)
  const requestRevealLine = useMarkdownExplorerStore(s => s.requestRevealLine)
  const lastSetActivePath = useMarkdownExplorerStore(s => s.lastSetActivePath)

  const workspaceEditorOverlayOpen = isWorkspaceEditorOverlayOpen({ workspaceViewMode, workspaceCanvasPaneOpen })
  const effectiveBottomPanelCollapsed = workspaceEditorOverlayOpen ? false : bottomPanelCollapsed
  const graphSemanticKey = React.useMemo(() => {
    return buildScopedGraphSemanticKey('workspace-graph', {
      graphRevision: graphContentRevision,
      sourceLayerHash: graphSourceLayerHash,
      sourceLayerOrderHash: graphSourceLayerOrderHash,
    })
  }, [graphContentRevision, graphSourceLayerHash, graphSourceLayerOrderHash])
  const bootstrapState = useMarkdownWorkspaceBootstrapState({
    activePath,
    effectiveBottomPanelCollapsed,
  })
  const {
    entries,
    setEntries,
    sourcesByPath,
    setSourcesByPath,
    loading,
    setLoading,
    loadError,
    setLoadError,
    search,
    setSearch,
    sidebarWidthPx,
    setSidebarWidthPx,
    explorerOpen,
    setExplorerOpen,
    sourceFilesCollapsed,
    setSourceFilesCollapsed,
    tocCollapsed,
    setTocCollapsed,
    backlinksCollapsed,
    setBacklinksCollapsed,
    markdownWordWrap,
    setMarkdownWordWrap,
    markdownTextHighlight,
    setMarkdownTextHighlight,
    folderModeContract,
    setFolderModeContract,
    layoutMode,
    setLayoutMode,
    expandedPaths,
    setExpandedPaths,
    patchWorkspaceEntryInlineText,
    editorRef,
    resizeHandleEl,
    setResizeHandleEl,
    workspaceRootRef,
    presentationApiRef,
    highlightedLineRange,
    setHighlightedLineRange,
    activeText,
    setActiveText,
    activeTextRef,
    viewerInlineEditActive,
    setViewerInlineEditActive,
    viewerInlineEditActiveRef,
    userEditedActiveTextRef,
    setActiveTextProgrammatic,
    debouncedText,
    outlineText,
    lastLoadedRef,
    repairedMissingWorkspaceFilesRef,
    lastIndexedByPathRef,
    indexJobRef,
    collapsedSnapshotRef,
    prevCollapsedRef,
    lastRequestedActivePathRef,
    activePathRef,
    layoutModeRef,
  } = bootstrapState

  const status = useWorkspaceStatusHelpers()
  const setStatusInfo = status.setStatusInfo
  const setStatusError = status.setStatusError
  const setStatusProgress = status.setStatusProgress
  const setStatusWithAutoClear = React.useCallback(
    (label: string, ttlMs: number = UI_TOAST_TTL_MS.statusAutoClose) => status.setStatusInfo(label, { ttlMs }),
    [status],
  )

  const wasWorkspaceEditorOverlayOpenRef = React.useRef<boolean>(workspaceEditorOverlayOpen)
  React.useEffect(() => {
    layoutModeRef.current = layoutMode
  }, [layoutMode, layoutModeRef])
  React.useEffect(() => {
    const wasOpen = wasWorkspaceEditorOverlayOpenRef.current
    wasWorkspaceEditorOverlayOpenRef.current = workspaceEditorOverlayOpen
    if (!workspaceEditorOverlayOpen || wasOpen) return
    setLayoutMode('split')
    setExplorerOpen(true)
    setSidebarWidthPx(resolveWorkspaceExplorerDefaultWidthPx({ minPx: SIDEBAR_MIN_PX, maxPx: SIDEBAR_MAX_PX }))
  }, [setExplorerOpen, setLayoutMode, setSidebarWidthPx, workspaceEditorOverlayOpen])

  const widgetState = useMarkdownWorkspaceWidgetMode({
    active,
    graphNodes,
    graphEdges,
    graphContentRevision,
    graphSemanticKey,
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
  const selectionState = useMarkdownWorkspaceSelection(
    buildMarkdownWorkspaceSelectionArgs({
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
    }),
  )
  const derivedViews = useMarkdownWorkspaceDerivedViews(
    buildMarkdownWorkspaceDerivedViewsArgs({
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
    }),
  )
  useMarkdownWorkspaceIndexing(
    buildMarkdownWorkspaceIndexingArgs({
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
    }),
  )
  const saveState = useMarkdownWorkspaceSave(
    buildMarkdownWorkspaceSaveArgs({
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
    }),
  )
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

  const fileActions = useWorkspaceFileActions(
    buildMarkdownWorkspaceFileActionsArgs({
      getFs: explorerState.getFs,
      refresh: explorerState.refresh,
      activePath,
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
    }),
  )
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
  const shellState = useMarkdownWorkspaceShell({
    active,
    refreshWorkspace: explorerState.refresh,
    highlightedLineRange,
    setHighlightedLineRange,
    workspaceRootRef,
    fileActions,
    createParentPath: selectionState.createParentPath,
    saveEnabled: effectiveContent.saveEnabled,
    saveActiveFileNow: saveState.saveActiveFileNow,
    setStatusWithAutoClear,
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
  const saveEnabled = effectiveContent.saveEnabled
  const saveActiveFileNow = saveState.saveActiveFileNow

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
        onToggleFullscreen={shellState.toggleFullscreen}
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
