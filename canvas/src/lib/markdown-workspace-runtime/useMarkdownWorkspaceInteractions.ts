import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useCanvasMarkdownSync } from '@/components/BottomPanel/markdownWorkspace/useCanvasMarkdownSync'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { WorkspaceBacklink, WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import type { HighlightedLineRange } from '@/components/BottomPanel/markdownWorkspace/markdownWorkspaceTypes'
import { buildDocLocationIndex } from '@/features/markdown-explorer/docLocationIndex'
import { computeBacklinks } from '@/features/markdown-explorer/backlinks'
import { lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { reorderMarkdownHeadings } from '@/features/markdown/ui/markdownSectionUtils'
import { matchesMarkdownDocumentPath } from 'grph-shared/markdown/documentPath'
import { applyMarkdownFormatAction, type MarkdownFormatAction } from 'grph-shared/markdown/formatting'
import { extractEmbeddedGeoJsonGraphDataRequests } from '@/lib/markdown/embeddedGeoJson'
import { createMarkdownGeoDatasetIntegration } from '@/features/geospatial/markdownGeoDatasetIntegration'
import { emitSidePanelOpen } from '@/features/canvas/utils'
import { setGeospatialModeEnabled } from '@/lib/gympgrph/api'
import { hashStringToHex } from '@/lib/hash/stringHash'
import {
  subscribeMarkdownLayoutRequest,
  WORKSPACE_REALTIME_APPLY_DEBOUNCE_MS,
  WORKSPACE_TOC_PARSE_MAX_CHARS,
} from './markdownWorkspaceRuntime.shared'
import {
  resolveMarkdownWorkspaceLineOffset,
  revealMarkdownWorkspaceLineFromCanvas,
  revealMarkdownWorkspaceLineInEditor,
  showMarkdownWorkspaceLineInMode,
  syncMarkdownWorkspaceSelectionFromEditorCaret,
  type MarkdownWorkspaceLineOffsetCache,
} from './markdownWorkspaceInteractionHelpers'

export function useMarkdownWorkspaceInteractions(args: {
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
  canvasWorkspaceSyncMode: string
  contentMode: 'document' | 'widget'
  widgetEditorText: string
  applyMarkdownDocumentToGraph: (name: string, text: string, opts: { force: boolean }) => Promise<boolean>
  setStatusError: (label: string) => void
  setStatusInfo: (label: string) => void
  setStatusProgress: (label: string) => void
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

  const markdownLexCacheRef = React.useRef<{ text: string; tokens: TokenWithLines[] } | null>(null)
  const getLexedTokensCached = React.useCallback((text: string): TokenWithLines[] => {
    const cached = markdownLexCacheRef.current
    if (cached && cached.text === text) return cached.tokens
    const tokens = lexMarkdown(text).tokens
    markdownLexCacheRef.current = { text, tokens }
    return tokens
  }, [])

  const tocTokens = React.useMemo(() => {
    if (!active || !explorerOpen || tocCollapsed) return [] as TokenWithLines[]
    const text = String(outlineText || '')
    if (!text.trim() || text.length > WORKSPACE_TOC_PARSE_MAX_CHARS) return [] as TokenWithLines[]
    if (!text.includes('#') && !/<h[1-6]\b/i.test(text)) return [] as TokenWithLines[]
    try {
      return getLexedTokensCached(text)
    } catch {
      return [] as TokenWithLines[]
    }
  }, [active, explorerOpen, getLexedTokensCached, outlineText, tocCollapsed])

  const onTocReorder = React.useCallback(
    (parentId: string | null, fromIndex: number, toIndex: number) => {
      try {
        if (activeText.length > WORKSPACE_TOC_PARSE_MAX_CHARS) return
        const tokens = getLexedTokensCached(activeText)
        const next = reorderMarkdownHeadings(activeText, tokens, parentId, fromIndex, toIndex)
        if (next !== activeText) setActiveText(next)
      } catch {
        void 0
      }
    },
    [activeText, getLexedTokensCached, setActiveText],
  )

  const [backlinks, setBacklinks] = React.useState<WorkspaceBacklink[]>([])
  const backlinksJobRef = React.useRef(0)
  React.useEffect(() => {
    if (!active || !explorerOpen || backlinksCollapsed || !activePath) {
      setBacklinks([])
      return
    }
    const jobId = ++backlinksJobRef.current
    const run = () => {
      if (backlinksJobRef.current !== jobId) return
      try {
        const next = computeBacklinks({ activePath, entries })
        if (backlinksJobRef.current === jobId) setBacklinks(next)
      } catch {
        if (backlinksJobRef.current === jobId) setBacklinks([])
      }
    }
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(run, { timeout: 700 })
      return () => {
        try {
          w.cancelIdleCallback?.(id)
        } catch {
          void 0
        }
      }
    }
    const t = window.setTimeout(run, 0)
    return () => window.clearTimeout(t)
  }, [active, activePath, backlinksCollapsed, entries, explorerOpen])

  React.useEffect(() => {
    if (selectionSource !== 'canvas') return
    const nodeId = selectedNodeId ? String(selectedNodeId) : ''
    const edgeId = !nodeId && selectedEdgeId ? String(selectedEdgeId) : ''
    if (!nodeId && !edgeId) setHighlightedLineRange(null)
  }, [selectedEdgeId, selectedNodeId, selectionSource, setHighlightedLineRange])

  const lastAutoApplySigRef = React.useRef<string | null>(null)
  const lastRealtimeApplySigRef = React.useRef<string | null>(null)
  const workspaceApplyEffectsEnabled = active && workspaceCanvasPaneOpen === true
  const handleApply = React.useCallback(async () => {
    const current = argsRef.current
    const name = String(current.activeDocumentKey || '').trim()
    if (!name) {
      current.setStatusError('No file selected')
      return
    }
    const applyText = (() => {
      const raw = String(current.activeText || '')
      if (raw.trim()) return raw
      if (current.contentMode === 'widget') return String(current.widgetEditorText || '')
      if (current.markdownDocumentName === current.activeDocumentKey && typeof current.markdownDocumentText === 'string' && current.markdownDocumentText) {
        return current.markdownDocumentText
      }
      return raw
    })()
    current.setStatusProgress('Applying')
    try {
      try {
        const state = useGraphStore.getState()
        if (String(state.documentSemanticMode || 'document') !== 'document') state.setDocumentSemanticMode('document')
      } catch {
        void 0
      }
      const ok = await current.applyMarkdownDocumentToGraph(name, applyText, { force: true })
      const geoReqs = (() => {
        const text = String(applyText || '')
        if (!text.includes('```')) return []
        const extracted = extractEmbeddedGeoJsonGraphDataRequests({
          markdownText: text,
          sourceDocumentPath: name,
          limit: 40,
        })
        if (typeof geoDatasetIntegration.isGeoJsonCodeBlock !== 'function') return extracted
        return extracted.filter(req => {
          try {
            return !!geoDatasetIntegration.isGeoJsonCodeBlock?.(req as never)
          } catch {
            return false
          }
        })
      })()
      if (geoReqs.length > 0 && typeof geoDatasetIntegration.registerGeoJsonFeatureCollection === 'function') {
        await Promise.all(geoReqs.map(req => geoDatasetIntegration.registerGeoJsonFeatureCollection?.(req as never)))
      }
      current.setStatusInfo(ok ? 'Applied' : 'Skipped')
    } catch (e) {
      current.setStatusError(`Failed: ${String((e as { message?: unknown })?.message ?? e)}`)
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
    const name = String(activeDocumentKey || '').trim()
    const text = String(activeText || '')
    if (!name || !text.trim()) return
    const graphText = markdownDocumentName === name ? String(markdownDocumentText || '') : ''
    if (graphText === text) return
    const sig = `${name}:${hashStringToHex(text)}`
    if (lastRealtimeApplySigRef.current === sig) return
    const timer = window.setTimeout(() => {
      lastRealtimeApplySigRef.current = sig
      void handleApply()
    }, WORKSPACE_REALTIME_APPLY_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [activeDocumentKey, activeText, canvasWorkspaceSyncMode, contentMode, handleApply, markdownDocumentName, markdownDocumentText, workspaceApplyEffectsEnabled])

  const handleFormatAction = React.useCallback(
    (action: MarkdownFormatAction) => {
      const handle = editorRef.current
      if (!handle) return
      const offsets = handle.getSelectionOffsets()
      const selection = offsets || { startOffset: activeText.length, endOffset: activeText.length }
      const { nextText, nextSelection } = applyMarkdownFormatAction({ text: activeText, selection, action })
      setActiveText(nextText)
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const nextHandle = editorRef.current
          if (!nextHandle) return
          try {
            nextHandle.focus()
            nextHandle.setSelectionOffsets(nextSelection.startOffset, nextSelection.endOffset)
          } catch {
            void 0
          }
        }),
      )
    },
    [activeText, editorRef, setActiveText],
  )

  return {
    geoDatasetIntegration,
    revealLineInEditor,
    showInViewer,
    showInPresentation,
    showInSlidesGallery,
    onEditorCaretLine,
    tocTokens,
    backlinks,
    onTocReorder,
    handleApply,
    handleFormatAction,
  }
}
