import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'
import { LS_KEYS, UI_COPY } from '@/lib/config'
import { lsJson, lsSetJson } from '@/lib/persistence'
import { getIconSizeClass } from '@/lib/ui'
import type {
  MarkdownPreviewPresentationApi,
  MarkdownPreviewPresentationSlideState,
} from '@/features/markdown/ui/MarkdownPreview'
import {
  useBottomPanelMarkdownModel,
  useBottomPanelMarkdownSplitView,
} from './BottomPanelMarkdownSectionModel'
import { BottomPanelMarkdownSectionView } from './BottomPanelMarkdownSectionView'
import { emitMarkdownPanelMetric } from '@/features/metrics/uiMetrics'
import { BOTTOM_PANEL_MARKDOWN_AUTO_OPEN_EVENT } from '@/features/bottom-panel/constants'
import type { BottomTab } from '@/features/bottom-panel/open'
import { useRootThemeMode } from '@/features/panels/views/preview-panel/ui/mermaidConfig'
import { useMarkdownApply } from './hooks/useMarkdownApply'
import { useJsonMarkdown, type JsonMarkdownMode } from './hooks/useJsonMarkdown'
import { useDebouncedValue } from '@/features/hooks/useDebouncedValue'

export type MarkdownLayoutMode = 'split' | 'editor' | 'viewer'

type BottomPanelMarkdownSectionProps = {
  setBottomPanelCurationView?: (view: 'table' | 'json' | 'markdown') => void
  setTabStore?: (tab: BottomTab) => void
}

export function BottomPanelMarkdownSection(props: BottomPanelMarkdownSectionProps) {
  const { setBottomPanelCurationView } = props
  
  // Store selectors
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
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-xs')
  const uiPanelMicroLabelTextSizeClass = useGraphStore(s => s.uiPanelMicroLabelTextSizeClass || 'text-[10px]')
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || 'font-sans')
  const uiPanelMonospaceTextClass = useGraphStore(s => s.uiPanelMonospaceTextClass || 'font-mono text-xs')
  const schema = useGraphStore(s => s.schema)
  const selectionFlashDurationMs = useGraphStore(s => s.selectionFlashDurationMs || 500)
  
  const themeMode = useRootThemeMode()

  // UI State
  const [markdownTextHighlight, setMarkdownTextHighlight] = usePersistedBoolean(LS_KEYS.markdownTextHighlight, false)
  const selectionHighlightEnabled = markdownTextHighlight
  const [markdownWordWrap, setMarkdownWordWrap] = usePersistedBoolean(LS_KEYS.markdownWordWrap, false)
  const [markdownPresentationMode, setMarkdownPresentationMode] = usePersistedBoolean(LS_KEYS.markdownPresentationMode, false)
  const [markdownSyncScroll] = usePersistedBoolean(LS_KEYS.markdownSyncScroll, true)
  
  const [annotateDisplayMode, setAnnotateDisplayMode] = React.useState<'inline' | 'beside'>(() => {
    if (typeof window === 'undefined') return 'inline'
    try {
      const raw = window.localStorage.getItem(LS_KEYS.markdownAnnotateDisplay)
      return raw === 'beside' ? 'beside' : 'inline'
    } catch {
      return 'inline'
    }
  })

  React.useEffect(() => {
    try {
      window.localStorage.setItem(LS_KEYS.markdownAnnotateDisplay, annotateDisplayMode)
    } catch {
      void 0
    }
  }, [annotateDisplayMode])

  const [markdownLayoutMode, setMarkdownLayoutMode] = React.useState<MarkdownLayoutMode>(() =>
    lsJson<MarkdownLayoutMode>(
      LS_KEYS.markdownLayoutMode,
      'viewer',
      value => (value === 'editor' || value === 'viewer' || value === 'split' ? (value === 'split' ? 'viewer' : value) : 'viewer'),
    ),
  )

  React.useEffect(() => {
    lsSetJson<MarkdownLayoutMode>(LS_KEYS.markdownLayoutMode, markdownLayoutMode)
  }, [markdownLayoutMode])

  const iconSizeClass = getIconSizeClass(uiIconScale)

  // Model Hook
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

  // JSON Hook
  const {
    jsonMarkdownMode,
    setJsonMarkdownMode,
    jsonMarkdownSuggestedMode,
    jsonModeEnabled,
    isJsonBacked,
    deferredMarkdownText,
  } = useJsonMarkdown({
    jsonSourceDocumentText,
    markdownDocumentText: markdownText,
    markdownDocumentName,
    setMarkdownDocument,
    setMarkdownText,
  })

  // Apply Hook
  const { applyStatus, handleApplyMarkdown } = useMarkdownApply({
    markdownText,
    isJsonBacked,
    selectionDocumentPath,
    markdownDocumentName,
    activeDocumentPath,
    hasSelection: !!selectionInfo,
  })

  // Split View Hook
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

  // Layout Sync
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

  // Presentation State
  const presentationApiRef = React.useRef<MarkdownPreviewPresentationApi | null>(null)
  const [presentationSlideState, setPresentationSlideState] = React.useState<MarkdownPreviewPresentationSlideState | null>(null)
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

  // Flash Selection
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

  // Auto Open Highlight
  const [autoOpenHighlight, setAutoOpenHighlight] = React.useState(false)
  React.useEffect(() => {
    let timer: number | null = null
    const handler = () => {
      setAutoOpenHighlight(true)
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        setAutoOpenHighlight(false)
        timer = null
      }, 1200)
    }
    try {
      window.addEventListener(BOTTOM_PANEL_MARKDOWN_AUTO_OPEN_EVENT, handler)
    } catch {
      void 0
    }
    return () => {
      try {
        window.removeEventListener(BOTTOM_PANEL_MARKDOWN_AUTO_OPEN_EVENT, handler)
        if (timer) window.clearTimeout(timer)
      } catch {
        void 0
      }
    }
  }, [])

  // Derived Values
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
  const hasMarkdown = !!(markdownText && markdownText.trim())

  const status = React.useMemo((): { ok: boolean | null; msg: string; details?: string } => {
    if (isLoading) return { ok: null, msg: UI_COPY.bottomPanelMarkdownStatusLoading }
    if (loadError) return { ok: false, msg: UI_COPY.bottomPanelMarkdownStatusError, details: loadError }
    if (hasMarkdown) return { ok: true, msg: UI_COPY.bottomPanelMarkdownStatusReady, details: markdownDocumentName || undefined }
    return { ok: null, msg: UI_COPY.bottomPanelMarkdownStatusReady }
  }, [hasMarkdown, isLoading, loadError, markdownDocumentName])

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

  return (
    <BottomPanelMarkdownSectionView
      autoOpenHighlight={autoOpenHighlight}
      uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
      uiPanelMicroLabelTextSizeClass={uiPanelMicroLabelTextSizeClass}
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
      themeMode={themeMode}
      syncViewerFromEditor={syncViewerFromEditor}
    />
  )
}
