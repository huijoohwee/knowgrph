import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'
import { LS_KEYS, UI_COPY } from '@/lib/config'
import { lsJson, lsSetJson } from '@/lib/persistence'
import type { JsonToMarkdownMode } from '@/features/markdown/jsonToMarkdown'
import { jsonToMarkdown } from '@/features/markdown/jsonToMarkdown'
import { getIconSizeClass } from '@/lib/ui'
import type {
  MarkdownPreviewPresentationApi,
  MarkdownPreviewPresentationSlideState,
} from '@/features/markdown/ui/MarkdownPreview'
import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { getDocumentPathFromMetadata } from '@/features/graph-data-table/graphDataTable'
import { toMetadataRecord } from '@/lib/graph/markdownMetadata'
import {
  useBottomPanelMarkdownModel,
  useBottomPanelMarkdownSplitView,
} from './BottomPanelMarkdownSectionModel'
import { BottomPanelMarkdownSectionView } from './BottomPanelMarkdownSectionView'
import { emitMarkdownPanelMetric } from '@/features/metrics/uiMetrics'
import { BOTTOM_PANEL_MARKDOWN_AUTO_OPEN_EVENT } from '@/features/bottom-panel/constants'
import type { BottomTab } from '@/features/bottom-panel/open'

export type MarkdownLayoutMode = 'split' | 'editor' | 'viewer'

type JsonMarkdownMode = JsonToMarkdownMode

type BottomPanelMarkdownSectionProps = {
  setBottomPanelCurationView?: (view: 'table' | 'json' | 'markdown') => void
  setTabStore?: (tab: BottomTab) => void
}

export function BottomPanelMarkdownSection(props: BottomPanelMarkdownSectionProps) {
  const { setBottomPanelCurationView } = props
  const graphData = useGraphStore(s => s.graphData)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const importedMarkdownText = useGraphStore(s => s.markdownDocumentText)
  const markdownDocumentName = useGraphStore(s => s.markdownDocumentName)
  const markdownDocumentSourceUrl = useGraphStore(s => s.markdownDocumentSourceUrl)
  const jsonSourceDocumentText = useGraphStore(s => s.jsonSourceDocumentText)
  const setMarkdownDocument = useGraphStore(s => s.setMarkdownDocument)
  const setMarkdownDocumentSourceUrl = useGraphStore(s => s.setMarkdownDocumentSourceUrl)
  const selectNode = useGraphStore(s => s.selectNode)
  const selectEdge = useGraphStore(s => s.selectEdge)
  const setSelectionSource = useGraphStore(s => s.setSelectionSource)
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  )
  const schema = useGraphStore(s => s.schema)
  const selectionFlashDurationMs = useGraphStore(s => s.selectionFlashDurationMs || 500)

  const [markdownTextHighlight, setMarkdownTextHighlight] = usePersistedBoolean(
    LS_KEYS.markdownTextHighlight,
    false,
  )

  const selectionHighlightEnabled = markdownTextHighlight

  const [markdownWordWrap, setMarkdownWordWrap] = usePersistedBoolean(
    LS_KEYS.markdownWordWrap,
    false,
  )

  const [annotateDisplayMode, setAnnotateDisplayMode] = React.useState<'inline' | 'beside'>(() => {
    if (typeof window === 'undefined') return 'inline'
    try {
      const raw = window.localStorage.getItem('kg:ui:markdown:annotateDisplay')
      return raw === 'beside' ? 'beside' : 'inline'
    } catch {
      return 'inline'
    }
  })

  const [markdownPresentationMode, setMarkdownPresentationMode] = usePersistedBoolean(
    LS_KEYS.markdownPresentationMode,
    false,
  )

  const [markdownSyncScroll] = usePersistedBoolean(
    LS_KEYS.markdownSyncScroll,
    true,
  )
  const [markdownLayoutMode, setMarkdownLayoutMode] = React.useState<MarkdownLayoutMode>(() =>
    lsJson<MarkdownLayoutMode>(
      LS_KEYS.markdownLayoutMode,
      'viewer',
      value =>
        value === 'editor' || value === 'viewer' || value === 'split'
          ? value === 'split'
            ? 'viewer'
            : value
          : 'viewer',
    ),
  )

  const [jsonMarkdownMode, setJsonMarkdownMode] = React.useState<JsonMarkdownMode>(() =>
    lsJson<JsonMarkdownMode>(
      LS_KEYS.jsonMarkdownMode,
      'auto',
      value =>
        value === 'table' ||
        value === 'key-value' ||
        value === 'hierarchical' ||
        value === 'auto'
          ? value
          : 'auto',
    ),
  )

  const iconSizeClass = getIconSizeClass(uiIconScale)

  const {
    selectionInfo,
    selectionDocumentPath,
    activeDocumentPath,
    markdownText,
    setMarkdownText,
    isLoading,
    loadError,
    previewBasePath,
  } = useBottomPanelMarkdownModel({
    graphData,
    schema,
    selectedNodeId,
    selectedEdgeId,
    importedMarkdownText,
    markdownDocumentName,
    markdownDocumentSourceUrl,
    setMarkdownDocument,
    setMarkdownDocumentSourceUrl,
  })

  const {
    editorTextAreaRef,
    viewerRef,
    handleViewerScroll,
    syncViewerFromEditor,
    lineHeightPx,
    editorPaddingTopPx,
    editorRowStartByLine,
    editorContentHeightPx,
    editorGutterWidthCh,
    visibleLineRange,
    highlightedLineRange,
  } = useBottomPanelMarkdownSplitView({
    markdownText,
    markdownWordWrap,
    selectionInfo,
    uiPanelMonospaceTextClass,
    syncScroll: markdownSyncScroll,
  })

  const prevLayoutModeRef = React.useRef<MarkdownLayoutMode | null>(null)

  React.useEffect(() => {
    const prev = prevLayoutModeRef.current
    prevLayoutModeRef.current = markdownLayoutMode
    if (!markdownSyncScroll) return
    if (markdownLayoutMode !== 'split') return
    const ta = editorTextAreaRef.current
    const viewer = viewerRef.current
    if (!ta || !viewer) return
    if (prev === 'viewer') {
      handleViewerScroll()
    } else if (prev === 'editor') {
      if (syncViewerFromEditor) syncViewerFromEditor()
    }
  }, [editorTextAreaRef, handleViewerScroll, markdownLayoutMode, markdownSyncScroll, viewerRef, syncViewerFromEditor])

  const hasSelection = !!selectionInfo
  const hasMarkdown = !!(markdownText && markdownText.trim())
  const isJsonBacked = React.useMemo(
    () => !!(jsonSourceDocumentText && jsonSourceDocumentText.trim()),
    [jsonSourceDocumentText],
  )

  const [applyStatus, setApplyStatus] = React.useState<{
    ok: boolean | null
    msg: string
  } | null>(null)

  React.useEffect(() => {
    if (!applyStatus) return
    const timer = window.setTimeout(() => {
      setApplyStatus(null)
    }, 4000)
    return () => {
      window.clearTimeout(timer)
    }
  }, [applyStatus])

  const presentationApiRef = React.useRef<MarkdownPreviewPresentationApi | null>(null)
  const [presentationSlideState, setPresentationSlideState] =
    React.useState<MarkdownPreviewPresentationSlideState | null>(null)

  const [pendingFullscreenRequest, setPendingFullscreenRequest] = React.useState(false)

  React.useEffect(() => {
    if (markdownPresentationMode && pendingFullscreenRequest && presentationApiRef.current) {
      presentationApiRef.current.enterFullscreen?.()
      setPendingFullscreenRequest(false)
    }
  }, [markdownPresentationMode, pendingFullscreenRequest])

  const handleFullscreenToggleRequested = React.useCallback(() => {
    setMarkdownPresentationMode(true)
    setPendingFullscreenRequest(true)
  }, [setMarkdownPresentationMode])

  const [flashSelectionId, setFlashSelectionId] = React.useState<string | null>(null)

  React.useEffect(() => {
    const id = selectionInfo?.id || null
    if (!id) {
      setFlashSelectionId(null)
      return
    }
    setFlashSelectionId(id)
    let timer: number | null = null
    try {
      timer = window.setTimeout(() => {
        setFlashSelectionId(current => (current === id ? null : current))
      }, selectionFlashDurationMs)
    } catch {
      timer = null
    }
    return () => {
      if (timer != null) {
        try {
          window.clearTimeout(timer)
        } catch {
          void 0
        }
      }
    }
  }, [selectionInfo?.id, selectionFlashDurationMs])

  const handleApplyMarkdown = React.useCallback(async () => {
    if (!markdownText || !markdownText.trim()) return
    if (isJsonBacked) {
      setApplyStatus({
        ok: false,
        msg: UI_COPY.bottomPanelMarkdownApplyJsonBackedUnsupportedStatus,
      })
      return
    }
    const rawName = (selectionDocumentPath || markdownDocumentName || '').trim()
    const targetDocumentPath = (() => {
      const fromSelection = selectionDocumentPath && selectionDocumentPath.trim()
      if (fromSelection) return fromSelection
      const fromActive = activeDocumentPath && activeDocumentPath.trim()
      if (fromActive) return fromActive
      return ''
    })()
    const baseName = (() => {
      if (!rawName) return 'graph.md'
      if (rawName.endsWith('.md') || rawName.endsWith('.markdown')) return rawName
      return `${rawName}.md`
    })()
    emitMarkdownPanelMetric('markdownApplyRequested', {
      hasSelection,
      name: baseName,
    })
    try {
      const beforeStore = useGraphStore.getState()
      const beforeGraph = beforeStore.graphData || null
      const res = await loadGraphDataFromTextViaParser(baseName, markdownText)
      if (!res) {
        setApplyStatus({ ok: false, msg: UI_COPY.parserDataLoadFailed })
        return
      }
      const warnings = res.warnings || []
      const counts = res.counts
      const nodeCount = counts ? Number(counts.n || 0) : 0
      const edgeCount = counts ? Number(counts.e || 0) : 0
      const hasGraph = nodeCount > 0 || edgeCount > 0
      if (warnings.length > 0 && !hasGraph) {
        if (beforeGraph) {
          try {
            const store = useGraphStore.getState()
            store.setGraphData(beforeGraph)
          } catch {
            void 0
          }
        }
        setApplyStatus({
          ok: false,
          msg: UI_COPY.parserDataLoadSyntaxErrorStatus(warnings[0] || ''),
        })
        return
      }
      const afterStore = useGraphStore.getState()
      const parsedGraph = afterStore.graphData || null
      if (beforeGraph && parsedGraph && targetDocumentPath.trim()) {
        const trimmedPath = targetDocumentPath.trim()
        const normalizeNode = (node: typeof parsedGraph.nodes[number]) => {
          const record = toMetadataRecord(node.metadata as unknown)
          const nextMeta = { ...record, documentPath: trimmedPath }
          return { ...node, metadata: nextMeta }
        }
        const normalizeEdge = (edge: typeof parsedGraph.edges[number]) => {
          const record = toMetadataRecord(edge.metadata as unknown)
          const nextMeta = { ...record, documentPath: trimmedPath }
          return { ...edge, metadata: nextMeta }
        }
        const prevNodes = beforeGraph.nodes || []
        const prevEdges = beforeGraph.edges || []
        const newNodesRaw = parsedGraph.nodes || []
        const newEdgesRaw = parsedGraph.edges || []
        const newNodes = newNodesRaw.map(normalizeNode)
        const newEdges = newEdgesRaw.map(normalizeEdge)
        const shouldRemoveByPath = (meta: unknown) => {
          return getDocumentPathFromMetadata(meta) === trimmedPath
        }
        const remainingNodes = prevNodes.filter(n => !shouldRemoveByPath(n.metadata))
        const remainingNodeIds = new Set(remainingNodes.map(n => String(n.id)))
        const newNodeIds = new Set(newNodes.map(n => String(n.id)))
        const keepNodeId = (id: string) => remainingNodeIds.has(id) || newNodeIds.has(id)
        const remainingEdges = prevEdges.filter(e => {
          if (shouldRemoveByPath(e.metadata)) return false
          const src = String(e.source || '')
          const tgt = String(e.target || '')
          if (!keepNodeId(src) || !keepNodeId(tgt)) return false
          return true
        })
        const mergedGraph = {
          context: beforeGraph.context,
          metadata: beforeGraph.metadata,
          type: beforeGraph.type || parsedGraph.type || 'Graph',
          nodes: [...remainingNodes, ...newNodes],
          edges: [...remainingEdges, ...newEdges],
        }
        try {
          afterStore.setGraphData(mergedGraph)
        } catch {
          void 0
        }
      }
      setApplyStatus({
        ok: true,
        msg: res.input && res.input.name ? res.input.name : UI_COPY.parserDataLoadSuccess,
      })
    } catch {
      setApplyStatus({ ok: false, msg: UI_COPY.parserDataLoadFailed })
    }
  }, [markdownText, selectionDocumentPath, markdownDocumentName, hasSelection, isJsonBacked, activeDocumentPath])

  React.useEffect(() => {
    lsSetJson<MarkdownLayoutMode>(LS_KEYS.markdownLayoutMode, markdownLayoutMode)
  }, [markdownLayoutMode])

  React.useEffect(() => {
    try {
      window.localStorage.setItem('kg:ui:markdown:annotateDisplay', annotateDisplayMode)
    } catch {
      void 0
    }
  }, [annotateDisplayMode])

  React.useEffect(() => {
    if (!markdownPresentationMode) {
      setPresentationSlideState(null)
    }
  }, [markdownPresentationMode])

  React.useEffect(() => {
    if (!markdownPresentationMode) return
    if (!presentationSlideState) return
    emitMarkdownPanelMetric('markdownPresentationSlideStateChanged', {
      activeIndex: presentationSlideState.activeSlideIndex,
      slideCount: presentationSlideState.slideCount,
    })
  }, [markdownPresentationMode, presentationSlideState])

  const markdownIngestionKind = React.useMemo(() => {
    const meta = graphData && graphData.metadata
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
    const ingestionMetrics = (meta as Record<string, unknown>).ingestionMetrics
    if (!ingestionMetrics || typeof ingestionMetrics !== 'object' || Array.isArray(ingestionMetrics)) {
      return null
    }
    const record = ingestionMetrics as Record<string, unknown>
    const rawKind = record.kind
    return typeof rawKind === 'string' ? rawKind : null
  }, [graphData])

  const isMarkdownLargeSummary = markdownIngestionKind === 'markdown-large'

  const status = React.useMemo((): { ok: boolean | null; msg: string; details?: string } => {
    if (isLoading) return { ok: null, msg: UI_COPY.bottomPanelMarkdownStatusLoading }
    if (loadError) return { ok: false, msg: UI_COPY.bottomPanelMarkdownStatusError, details: loadError }
    if (hasMarkdown) return { ok: true, msg: UI_COPY.bottomPanelMarkdownStatusReady, details: markdownDocumentName || undefined }
    return { ok: null, msg: UI_COPY.bottomPanelMarkdownStatusReady }
  }, [hasMarkdown, isLoading, loadError, markdownDocumentName])

  const deferredMarkdownText = React.useDeferredValue(markdownText)
  const deferredJsonSourceText = React.useDeferredValue(jsonSourceDocumentText)

  const markdownPreviewText = React.useMemo(() => {
    const raw = deferredMarkdownText || ''
    const previewMaxChars = 180000
    if (raw.length <= previewMaxChars) return raw
    const slice = raw.slice(0, previewMaxChars)
    const lastNewline = slice.lastIndexOf('\n')
    if (lastNewline > previewMaxChars - 4000 && lastNewline > 0) {
      return slice.slice(0, lastNewline)
    }
    return slice
  }, [deferredMarkdownText])

  const isMarkdownPreviewTruncated = React.useMemo(() => {
    const raw = deferredMarkdownText || ''
    const previewMaxChars = 180000
    if (!raw) return false
    if (raw.length <= previewMaxChars) return false
    return markdownPreviewText.length < raw.length
  }, [deferredMarkdownText, markdownPreviewText])

  const jsonMarkdownSuggestedMode = React.useMemo((): JsonMarkdownMode => {
    try {
      const jsonTrimmed = (deferredJsonSourceText || '').trim()
      if (!jsonTrimmed) return 'auto'
      const parsed = JSON.parse(jsonTrimmed)
      const renderedTable = jsonToMarkdown(parsed, { defaultMode: 'table' }, 'table')
      const renderedKeyValue = jsonToMarkdown(parsed, { defaultMode: 'key-value' }, 'key-value')
      const renderedHierarchical = jsonToMarkdown(
        parsed,
        { defaultMode: 'hierarchical' },
        'hierarchical',
      )
      const original = deferredMarkdownText || ''
      const isClose = (candidate: string) => {
        const a = candidate.trim()
        const b = original.trim()
        if (!a || !b) return false
        const minLen = Math.min(a.length, b.length)
        if (!minLen) return false
        let same = 0
        const limit = Math.min(minLen, 1024)
        for (let i = 0; i < limit; i += 1) {
          if (a[i] === b[i]) same += 1
        }
        const ratio = same / limit
        return ratio >= 0.9
      }
      if (isClose(renderedTable)) return 'table'
      if (isClose(renderedKeyValue)) return 'key-value'
      if (isClose(renderedHierarchical)) return 'hierarchical'
      return 'auto'
    } catch {
      return 'auto'
    }
  }, [deferredJsonSourceText, deferredMarkdownText])

  const parsedJsonSource = React.useMemo(() => {
    try {
      const rawJson = (jsonSourceDocumentText || '').trim()
      if (!rawJson) return null
      return JSON.parse(rawJson)
    } catch {
      return null
    }
  }, [jsonSourceDocumentText])

  const jsonModeEnabled = !!parsedJsonSource

  React.useEffect(() => {
    if (!parsedJsonSource) return
    try {
      const mode = jsonMarkdownMode
      const markdown = jsonToMarkdown(parsedJsonSource, { defaultMode: mode }, mode)
      setMarkdownDocument(markdownDocumentName, markdown)
      setMarkdownText(markdown)
    } catch {
      void 0
    }
  }, [jsonMarkdownMode, parsedJsonSource, markdownDocumentName, setMarkdownDocument, setMarkdownText])

  React.useEffect(() => {
    lsSetJson<JsonMarkdownMode>(LS_KEYS.jsonMarkdownMode, jsonMarkdownMode)
  }, [jsonMarkdownMode])

  const [autoOpenHighlight, setAutoOpenHighlight] = React.useState(false)

  React.useEffect(() => {
    const handler = () => {
      setAutoOpenHighlight(true)
      const timer = window.setTimeout(() => {
        setAutoOpenHighlight(false)
      }, 1200)
      return () => {
        window.clearTimeout(timer)
      }
    }
    try {
      window.addEventListener(BOTTOM_PANEL_MARKDOWN_AUTO_OPEN_EVENT, handler)
    } catch {
      void 0
    }
    return () => {
      try {
        window.removeEventListener(BOTTOM_PANEL_MARKDOWN_AUTO_OPEN_EVENT, handler)
      } catch {
        void 0
      }
    }
  }, [])

  return (
    <BottomPanelMarkdownSectionView
      autoOpenHighlight={autoOpenHighlight}
      uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
      uiPanelTextFontClass={uiPanelTextFontClass}
      uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
      isJsonBacked={isJsonBacked}
      jsonModeEnabled={jsonModeEnabled}
      jsonMarkdownMode={jsonMarkdownMode}
      setJsonMarkdownMode={setJsonMarkdownMode}
      jsonMarkdownSuggestedMode={jsonMarkdownSuggestedMode}
      status={status}
      applyStatus={applyStatus}
      isMarkdownLargeSummary={isMarkdownLargeSummary}
      markdownPresentationMode={markdownPresentationMode}
      markdownLayoutMode={markdownLayoutMode}
      setMarkdownLayoutMode={setMarkdownLayoutMode}
      annotateDisplayMode={annotateDisplayMode}
      setAnnotateDisplayMode={setAnnotateDisplayMode}
      iconSizeClass={iconSizeClass}
      uiIconStrokeWidth={uiIconStrokeWidth}
      markdownWordWrap={markdownWordWrap}
      setMarkdownWordWrap={setMarkdownWordWrap}
      editorGutterWidthCh={editorGutterWidthCh}
      editorContentHeightPx={editorContentHeightPx}
      editorTextAreaRef={editorTextAreaRef}
      selectionHighlightEnabled={selectionHighlightEnabled}
      highlightedLineRange={highlightedLineRange}
      editorRowStartByLine={editorRowStartByLine}
      visibleLineRange={visibleLineRange}
      flashSelectionId={flashSelectionId}
      selectionInfo={selectionInfo}
      editorPaddingTopPx={editorPaddingTopPx}
      lineHeightPx={lineHeightPx}
      markdownText={markdownText}
      setMarkdownText={setMarkdownText}
      setMarkdownDocument={setMarkdownDocument}
      markdownDocumentName={markdownDocumentName}
      markdownPreviewText={markdownPreviewText}
      previewBasePath={previewBasePath}
      viewerRef={viewerRef}
      markdownTextHighlight={markdownTextHighlight}
      setMarkdownTextHighlight={setMarkdownTextHighlight}
      presentationApiRef={presentationApiRef}
      presentationSlideState={presentationSlideState}
      setPresentationSlideState={setPresentationSlideState}
      handleViewerScroll={handleViewerScroll}
      setMarkdownPresentationMode={setMarkdownPresentationMode}
      isMarkdownPreviewTruncated={isMarkdownPreviewTruncated}
      handleApplyMarkdown={handleApplyMarkdown}
      onFullscreenToggleRequested={handleFullscreenToggleRequested}
      onShowInGraphDataTable={() => {
        if (setBottomPanelCurationView) setBottomPanelCurationView('table')
      }}
      selectNode={selectNode}
      selectEdge={selectEdge}
      setSelectionSource={setSelectionSource}
    />
  )
}
