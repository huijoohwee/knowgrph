import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useCanvasMarkdownSync } from '@/features/markdown-workspace/useCanvasMarkdownSync'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import type { HighlightedLineRange } from '@/features/markdown-workspace/markdownWorkspaceTypes'
import { buildDocLocationIndex } from '@/features/markdown-explorer/docLocationIndex'
import { matchesMarkdownDocumentPath } from 'grph-shared/markdown/documentPath'
import { createMarkdownGeoDatasetIntegration } from '@/features/geospatial/markdownGeoDatasetIntegration'
import { emitSidePanelOpen } from '@/features/canvas/utils'
import { setGeospatialModeEnabled } from '@/lib/gympgrph/api'
import { hashStringToHex } from '@/lib/hash/stringHash'
import {
  subscribeMarkdownLayoutRequest,
  WORKSPACE_REALTIME_APPLY_DEBOUNCE_MS,
} from './markdownWorkspaceRuntime.shared'
import {
  resolveMarkdownWorkspaceLineOffset,
  revealMarkdownWorkspaceLineFromCanvas,
  revealMarkdownWorkspaceLineInEditor,
  showMarkdownWorkspaceLineInMode,
  syncMarkdownWorkspaceSelectionFromEditorCaret,
  type MarkdownWorkspaceLineOffsetCache,
} from './markdownWorkspaceInteractionHelpers'
import { useMarkdownWorkspaceExplorerDerivations } from './useMarkdownWorkspaceExplorerDerivations'
import {
  ensureMarkdownWorkspaceApplyDocumentSemanticMode,
  registerMarkdownWorkspaceEmbeddedGeoDatasets,
  resolveMarkdownWorkspaceApplyText,
} from './markdownWorkspaceApply'
import type { MarkdownWorkspaceRuntimeInteractionStatusBindings } from './markdownWorkspaceRuntimeStatus'
import { applyMarkdownWorkspaceErrorStatus, applyMarkdownWorkspaceInfoStatus } from './markdownWorkspaceStatusTransitions'

export function useMarkdownWorkspaceInteractions(args: MarkdownWorkspaceRuntimeInteractionStatusBindings & {
  active: boolean
  entries: WorkspaceEntry[]
  explorerOpen: boolean
  tocCollapsed: boolean
  backlinksCollapsed: boolean
  activePath: WorkspacePath | null
  setActivePathSafe: (path: WorkspacePath) => void
  setExpandedPaths: React.Dispatch<React.SetStateAction<Set<string>>>
  activeDocumentKey: string
  activeText: string
  setActiveText: (text: string) => void
  outlineText: string
  graphNodesRef: React.MutableRefObject<GraphNode[]>
  graphEdgesRef: React.MutableRefObject<GraphEdge[]>
  docLocationRevision: number
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectionSource: string | null
  setSelectionSource: (source: string) => void
  selectNode: (id: string) => void
  selectEdge: (id: string) => void
  requestRevealLine: (line: number | null) => void
  requestedRevealLine: number | null
  editorRef: React.MutableRefObject<{
    focus: () => void
    setSelectionOffsets: (startOffset: number, endOffset: number) => void
    revealOffsetInCenter: (offset: number) => void
    getSelectionOffsets: () => { startOffset: number; endOffset: number } | null
  } | null>
  layoutModeRef: React.MutableRefObject<string>
  setLayoutMode: React.Dispatch<React.SetStateAction<any>>
  setHighlightedLineRange: React.Dispatch<React.SetStateAction<HighlightedLineRange>>
  markdownDocumentName: string
  markdownDocumentText: string
  workspaceCanvasPaneOpen: boolean
  indexingInFlight: boolean
  userEditedActiveTextRef: React.MutableRefObject<boolean>
  canvasWorkspaceSyncMode: string
  contentMode: 'document' | 'widget'
  widgetEditorText: string
  applyMarkdownDocumentToGraph: (name: string, text: string, opts: { force: boolean }) => Promise<boolean>
}) {
  const {
    active,
    entries,
    explorerOpen,
    tocCollapsed,
    backlinksCollapsed,
    activePath,
    setActivePathSafe,
    setExpandedPaths,
    activeDocumentKey,
    activeText,
    setActiveText,
    outlineText,
    graphNodesRef,
    graphEdgesRef,
    docLocationRevision,
    selectedNodeId,
    selectedEdgeId,
    selectionSource,
    setSelectionSource,
    selectNode,
    selectEdge,
    requestRevealLine,
    requestedRevealLine,
    editorRef,
    layoutModeRef,
    setLayoutMode,
    setHighlightedLineRange,
    markdownDocumentName,
    markdownDocumentText,
    workspaceCanvasPaneOpen,
    indexingInFlight,
    userEditedActiveTextRef,
    canvasWorkspaceSyncMode,
    contentMode,
    widgetEditorText,
    applyMarkdownDocumentToGraph,
    setStatusError,
    setStatusInfo,
    setStatusProgress,
  } = args
  const argsRef = React.useRef(args)
  argsRef.current = args

  const geoDatasetIntegration = React.useMemo(
    () =>
      createMarkdownGeoDatasetIntegration({
        requestOpenGeoPanel: () => {
          try {
            setGeospatialModeEnabled(true)
          } catch {
            void 0
          }
          emitSidePanelOpen({ tab: 'geo', open: true })
        },
        loadGraphData: (data: { nodes?: unknown[]; edges?: unknown[] }) => {
          try {
            useGraphStore.getState().setGraphData(data as never)
          } catch {
            void 0
          }
        },
      }),
    [],
  )

  const revealLineInEditor = React.useCallback(
    (line: number, endLine?: number) => {
      revealMarkdownWorkspaceLineInEditor({
        line,
        endLine,
        currentLayoutMode: layoutModeRef.current,
        setLayoutMode,
        requestRevealLine,
        setHighlightedLineRange,
      })
    },
    [layoutModeRef, requestRevealLine, setHighlightedLineRange, setLayoutMode],
  )

  const revealLineFromCanvas = React.useCallback(
    (line: number, endLine?: number) => {
      revealMarkdownWorkspaceLineFromCanvas({
        line,
        endLine,
        currentLayoutMode: layoutModeRef.current,
        setHighlightedLineRange,
        revealLineInEditor,
      })
    },
    [layoutModeRef, revealLineInEditor, setHighlightedLineRange],
  )

  useCanvasMarkdownSync({
    active,
    entries,
    activePath,
    setActivePathSafe,
    setExpandedPaths,
    revealLineInEditor: revealLineFromCanvas,
    setStatusError,
  })

  const requestedRevealOffsetCacheRef = React.useRef<MarkdownWorkspaceLineOffsetCache | null>(null)
  React.useEffect(() => {
    if (!requestedRevealLine) return
    const handle = editorRef.current
    if (!handle) return
    const text = String(activeText || '')
    const resolved = resolveMarkdownWorkspaceLineOffset({
      text,
      line: requestedRevealLine,
      cache: requestedRevealOffsetCacheRef.current,
    })
    requestedRevealOffsetCacheRef.current = resolved.cache
    try {
      handle.focus()
      handle.setSelectionOffsets(resolved.offset, resolved.offset)
      handle.revealOffsetInCenter(resolved.offset)
    } catch {
      void 0
    }
    requestRevealLine(null)
  }, [activeText, editorRef, requestRevealLine, requestedRevealLine])

  React.useEffect(() => {
    return subscribeMarkdownLayoutRequest(({ mode }) => {
      setLayoutMode(prev => (prev === mode ? prev : mode))
    })
  }, [setLayoutMode])

  const showInViewer = React.useCallback(
    (line: number) => {
      showMarkdownWorkspaceLineInMode({
        mode: 'viewer',
        line,
        setLayoutMode,
        setHighlightedLineRange,
      })
    },
    [setHighlightedLineRange, setLayoutMode],
  )
  const showInPresentation = React.useCallback(
    (line: number) => {
      showMarkdownWorkspaceLineInMode({
        mode: 'presentation',
        line,
        setLayoutMode,
        setHighlightedLineRange,
      })
    },
    [setHighlightedLineRange, setLayoutMode],
  )
  const showInSlidesGallery = React.useCallback(
    (line: number) => {
      showMarkdownWorkspaceLineInMode({
        mode: 'slides-gallery',
        line,
        setLayoutMode,
        setHighlightedLineRange,
      })
    },
    [setHighlightedLineRange, setLayoutMode],
  )

  const matchesActiveDoc = React.useCallback(
    (documentPath: unknown) => matchesMarkdownDocumentPath(activeDocumentKey, documentPath),
    [activeDocumentKey],
  )
  const docLocationIndex = React.useMemo(() => {
    void docLocationRevision
    return buildDocLocationIndex({ nodes: graphNodesRef.current, edges: graphEdgesRef.current, matchesDoc: matchesActiveDoc })
  }, [docLocationRevision, graphEdgesRef, graphNodesRef, matchesActiveDoc])

  const lastCaretLineRef = React.useRef<number | null>(null)
  const onEditorCaretLine = React.useCallback(
    (line: number) => {
      lastCaretLineRef.current = syncMarkdownWorkspaceSelectionFromEditorCaret({
        line,
        currentLayoutMode: layoutModeRef.current,
        lastCaretLine: lastCaretLineRef.current,
        setHighlightedLineRange,
        findDocLocation: value => docLocationIndex.find(value),
        selectedNodeId,
        selectedEdgeId,
        setSelectionSource,
        selectNode,
        selectEdge,
      })
    },
    [docLocationIndex, layoutModeRef, selectEdge, selectNode, selectedEdgeId, selectedNodeId, setHighlightedLineRange, setSelectionSource],
  )

  const explorerState = useMarkdownWorkspaceExplorerDerivations({
    active,
    explorerOpen,
    tocCollapsed,
    backlinksCollapsed,
    outlineText,
    activeText,
    activeDocumentKey,
    activePath,
    entries,
    setActiveText,
  })

  React.useEffect(() => {
    if (selectionSource !== 'canvas') return
    const nodeId = selectedNodeId ? String(selectedNodeId) : ''
    const edgeId = !nodeId && selectedEdgeId ? String(selectedEdgeId) : ''
    if (!nodeId && !edgeId) setHighlightedLineRange(null)
  }, [selectedEdgeId, selectedNodeId, selectionSource, setHighlightedLineRange])

  const lastAutoApplySigRef = React.useRef<string | null>(null)
  const lastRealtimeApplySigRef = React.useRef<string | null>(null)
  const workspaceApplyEffectsEnabled = active && workspaceCanvasPaneOpen === true && indexingInFlight !== true
  const handleApply = React.useCallback(async () => {
    const current = argsRef.current
    const name = String(current.activeDocumentKey || '').trim()
    if (!name) {
      applyMarkdownWorkspaceErrorStatus({
        setStatusError: current.setStatusError,
        error: 'No file selected',
        fallbackMessage: 'No file selected',
      })
      return
    }
    const applyText = resolveMarkdownWorkspaceApplyText({
      activeText: current.activeText,
      contentMode: current.contentMode,
      widgetEditorText: current.widgetEditorText,
      markdownDocumentName: current.markdownDocumentName,
      activeDocumentKey: current.activeDocumentKey,
      markdownDocumentText: current.markdownDocumentText,
    })
    current.setStatusProgress('Applying')
    try {
      ensureMarkdownWorkspaceApplyDocumentSemanticMode()
      const ok = await current.applyMarkdownDocumentToGraph(name, applyText, { force: true })
      await registerMarkdownWorkspaceEmbeddedGeoDatasets({
        markdownText: applyText,
        sourceDocumentPath: name,
        geoDatasetIntegration,
      })
      applyMarkdownWorkspaceInfoStatus({
        setStatusInfo: current.setStatusInfo,
        label: ok ? 'Applied' : 'Skipped',
      })
    } catch (e) {
      applyMarkdownWorkspaceErrorStatus({
        setStatusError: current.setStatusError,
        prefix: 'Failed',
        error: e,
        fallbackMessage: 'Request failed',
      })
    }
  }, [geoDatasetIntegration])

  React.useEffect(() => {
    if (!workspaceApplyEffectsEnabled || contentMode === 'widget') return
    const name = String(activeDocumentKey || '').trim()
    const text = String(activeText || '')
    if (!name || !text.trim()) return
    const graphText = markdownDocumentName === name ? String(markdownDocumentText || '') : ''
    if (graphText === text) return
    const nodes = Array.isArray(graphNodesRef.current) ? graphNodesRef.current : []
    const edges = Array.isArray(graphEdgesRef.current) ? graphEdgesRef.current : []
    if (!(nodes.length === 0 && edges.length === 0)) return
    const sig = `${name}:${hashStringToHex(text)}`
    if (lastAutoApplySigRef.current === sig) return
    lastAutoApplySigRef.current = sig
    void handleApply()
  }, [activeDocumentKey, activeText, contentMode, graphEdgesRef, graphNodesRef, handleApply, markdownDocumentName, markdownDocumentText, workspaceApplyEffectsEnabled])

  React.useEffect(() => {
    if (!workspaceApplyEffectsEnabled || canvasWorkspaceSyncMode !== 'realtime' || contentMode === 'widget') return
    if (!userEditedActiveTextRef.current) return
    const name = String(activeDocumentKey || '').trim()
    const text = String(activeText || '')
    if (!name || !text.trim()) return
    const graphText = markdownDocumentName === name ? String(markdownDocumentText || '') : ''
    if (graphText === text) return
    const sig = `${name}:${hashStringToHex(text)}`
    if (lastRealtimeApplySigRef.current === sig) return
    if (typeof window === 'undefined') {
      lastRealtimeApplySigRef.current = sig
      void handleApply()
      return
    }
    const timer = window.setTimeout(() => {
      lastRealtimeApplySigRef.current = sig
      void handleApply()
    }, WORKSPACE_REALTIME_APPLY_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [
    activeDocumentKey,
    activeText,
    canvasWorkspaceSyncMode,
    contentMode,
    handleApply,
    markdownDocumentName,
    markdownDocumentText,
    userEditedActiveTextRef,
    workspaceApplyEffectsEnabled,
  ])

  return {
    geoDatasetIntegration,
    revealLineInEditor,
    showInViewer,
    showInPresentation,
    showInSlidesGallery,
    onEditorCaretLine,
    tocTokens: explorerState.tocTokens,
    backlinks: explorerState.backlinks,
    onTocReorder: explorerState.onTocReorder,
    handleApply,
  }
}
