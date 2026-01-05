import React from 'react'
import { Maximize2, MonitorPlay, WrapText } from 'lucide-react'
import IconButton from '@/components/IconButton'
import { useGraphStore } from '@/hooks/useGraphStore'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'
import { LS_KEYS, UI_COPY, UI_LABELS } from '@/lib/config'
import { getIconSizeClass } from '@/lib/ui'
import MarkdownPreview, {
  type MarkdownPreviewPresentationApi,
  type MarkdownPreviewPresentationSlideState,
} from '@/features/markdown/ui/MarkdownPreview'
import StatusBadge from '@/features/panels/ui/StatusBadge'
import {
  useBottomPanelMarkdownModel,
  useBottomPanelMarkdownSplitView,
} from './BottomPanelMarkdownSectionModel'

export function BottomPanelMarkdownSection() {
  const graphData = useGraphStore(s => s.graphData)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const importedMarkdownText = useGraphStore(s => s.markdownDocumentText)
  const markdownDocumentName = useGraphStore(s => s.markdownDocumentName)
  const markdownDocumentSourceUrl = useGraphStore(s => s.markdownDocumentSourceUrl)
  const setMarkdownDocument = useGraphStore(s => s.setMarkdownDocument)
  const setMarkdownDocumentSourceUrl = useGraphStore(s => s.setMarkdownDocumentSourceUrl)
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

  const [markdownWordWrap, setMarkdownWordWrap] = usePersistedBoolean(
    LS_KEYS.markdownWordWrap,
    false,
  )

  const [markdownPresentationMode, setMarkdownPresentationMode] = usePersistedBoolean(
    LS_KEYS.markdownPresentationMode,
    false,
  )

  const iconSizeClass = getIconSizeClass(uiIconScale)

  const {
    selectionInfo,
    selectionDocumentPath,
    markdownText,
    setMarkdownText,
    isLoading,
    loadError,
    previewBasePath,
  } = useBottomPanelMarkdownModel({
    graphData,
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
    gutterLayerRef,
    splitRatio,
    handleDividerPointerDown,
    markdownFullscreen,
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
  })

  const toggleMarkdownFullscreen = React.useCallback(() => {
    const el = viewerRef.current
    if (!el) return
    void (async () => {
      try {
        if (!markdownPresentationMode) {
          setMarkdownPresentationMode(true)
        }
        if (document.fullscreenElement === el) {
          await document.exitFullscreen()
          return
        }
        await el.requestFullscreen()
      } catch {
        void 0
      }
    })()
  }, [markdownPresentationMode, setMarkdownPresentationMode, viewerRef])

  const visibleLineNumbers = React.useMemo(() => {
    const nums: number[] = []
    for (let line = visibleLineRange.startLine; line <= visibleLineRange.endLine; line += 1) {
      nums.push(line)
    }
    return nums
  }, [visibleLineRange])

  const hasSelection = !!selectionInfo
  const hasMarkdown = !!(markdownText && markdownText.trim())

  const presentationApiRef = React.useRef<MarkdownPreviewPresentationApi | null>(null)
  const [presentationSlideState, setPresentationSlideState] =
    React.useState<MarkdownPreviewPresentationSlideState | null>(null)

  React.useEffect(() => {
    if (!markdownPresentationMode) {
      setPresentationSlideState(null)
    }
  }, [markdownPresentationMode])

  const headerText =
    isLoading
      ? UI_COPY.bottomPanelMarkdownLoadingLabel
      : loadError
      ? UI_COPY.bottomPanelMarkdownLoadFailedLabel
      : hasMarkdown
      ? hasSelection && !selectionDocumentPath
        ? UI_COPY.bottomPanelMarkdownMissingDocumentPathLabel
        : UI_COPY.bottomPanelMarkdownNoSelectionLabel
      : UI_COPY.bottomPanelMarkdownNoMarkdownLabel

  const status = React.useMemo((): { ok: boolean | null; msg: string; details?: string } => {
    if (isLoading) return { ok: null, msg: UI_COPY.bottomPanelMarkdownStatusLoading }
    if (loadError) return { ok: false, msg: UI_COPY.bottomPanelMarkdownStatusError, details: loadError }
    if (hasMarkdown) return { ok: true, msg: UI_COPY.bottomPanelMarkdownStatusReady, details: markdownDocumentName || undefined }
    return { ok: null, msg: UI_COPY.bottomPanelMarkdownStatusReady }
  }, [hasMarkdown, isLoading, loadError, markdownDocumentName])

  const deferredMarkdownText = React.useDeferredValue(markdownText)

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 flex flex-col border border-gray-200 rounded bg-white overflow-hidden">
        <div
          className={[
            'px-2 py-1 border-b border-gray-200 flex items-center justify-between gap-2 text-gray-600',
            uiPanelKeyValueTextSizeClass,
            uiPanelTextFontClass,
          ].join(' ')}
        >
          <div className="min-w-0 truncate">{headerText}</div>
          <StatusBadge label={UI_LABELS.markdown} ok={status.ok} msg={status.msg} details={status.details} />
        </div>

        <div className="flex-1 min-h-0 flex">
          <div
            className="flex flex-col min-w-[20%] max-w-[80%]"
            style={{ width: `${Math.round(splitRatio * 100)}%` }}
          >
            <div
              className={[
                'px-2 py-1 border-b border-gray-200 text-gray-500 flex items-center justify-between gap-2',
                uiPanelKeyValueTextSizeClass,
                uiPanelTextFontClass,
              ].join(' ')}
            >
              <span>{UI_COPY.bottomPanelMarkdownEditorTitle}</span>
              <IconButton
                className={`App-toolbar__btn flex items-center justify-center ${markdownWordWrap ? 'text-blue-600' : ''}`}
                title={UI_COPY.bottomPanelMarkdownWordWrapToggleTitle}
                tooltipContent={
                  markdownWordWrap
                    ? UI_COPY.bottomPanelMarkdownWordWrapOnTooltip
                    : UI_COPY.bottomPanelMarkdownWordWrapOffTooltip
                }
                onClick={() => setMarkdownWordWrap(!markdownWordWrap)}
                showTooltip
              >
                <WrapText className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
              </IconButton>
            </div>
            <div className="flex-1 min-h-0 flex">
              <div
                className="shrink-0 border-r border-gray-200 bg-gray-50 text-gray-500 relative overflow-hidden"
                style={{ width: `${editorGutterWidthCh}ch` }}
                onWheel={e => {
                  const ta = editorTextAreaRef.current
                  if (!ta) return
                  if (!e.deltaY) return
                  e.preventDefault()
                  ta.scrollTop = ta.scrollTop + e.deltaY
                }}
              >
                <div
                  ref={gutterLayerRef}
                  className="absolute left-0 right-0 top-0"
                  style={{
                    height: `${editorContentHeightPx}px`,
                    transform: 'translateY(0px)',
                    willChange: 'transform',
                  }}
                >
                  {visibleLineNumbers.map(line => {
                    const isHighlighted =
                      highlightedLineRange != null && line >= highlightedLineRange.start && line <= highlightedLineRange.end
                    const startRow =
                      editorRowStartByLine[visibleLineRange.startLine] ?? visibleLineRange.startLine
                    const row = editorRowStartByLine[line] ?? line
                    return (
                      <div
                        key={line}
                        className={[
                          'absolute left-0 right-0 pr-2 text-right select-none',
                          uiPanelMonospaceTextClass,
                          isHighlighted ? 'bg-yellow-100' : '',
                        ].join(' ')}
                        style={{
                          top: `${editorPaddingTopPx + (row - startRow) * lineHeightPx}px`,
                          height: `${lineHeightPx}px`,
                          lineHeight: `${lineHeightPx}px`,
                        }}
                      >
                        {line}
                      </div>
                    )
                  })}
                </div>
              </div>
              <textarea
                ref={editorTextAreaRef}
                value={markdownText}
                onChange={e => {
                  const next = e.target.value
                  setMarkdownText(next)
                  setMarkdownDocument(markdownDocumentName, next)
                }}
                className={[
                  'w-full h-full px-2 py-2 border-0 rounded-none overflow-auto resize-none bg-transparent text-gray-900 outline-none',
                  markdownWordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre',
                  uiPanelMonospaceTextClass,
                ].join(' ')}
                style={{ lineHeight: `${lineHeightPx}px` }}
                wrap={markdownWordWrap ? 'soft' : 'off'}
              />
            </div>
          </div>

          <div
            className="w-1 cursor-col-resize bg-gray-200 hover:bg-gray-400"
            onPointerDown={handleDividerPointerDown}
          />

          <div className="flex-1 min-w-[20%] min-h-0 flex flex-col">
            <div
              className={[
                'px-2 py-1 border-b border-gray-200 text-gray-500 flex items-center justify-between gap-2',
                uiPanelKeyValueTextSizeClass,
                uiPanelTextFontClass,
              ].join(' ')}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="min-w-0 truncate">{UI_COPY.bottomPanelMarkdownViewerTitle}</span>
                {markdownPresentationMode && (
                  <>
                    <button
                      type="button"
                      className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                      onClick={() => presentationApiRef.current?.prev()}
                      disabled={!presentationSlideState || presentationSlideState.activeSlideIndex <= 0}
                    >
                      {UI_COPY.markdownPreviewPrevButtonLabel}
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                      onClick={() => presentationApiRef.current?.next()}
                      disabled={
                        !presentationSlideState
                        || presentationSlideState.activeSlideIndex >= presentationSlideState.slideCount - 1
                      }
                    >
                      {UI_COPY.markdownPreviewNextButtonLabel}
                    </button>
                    <div className="ml-1">
                      {Math.min(
                        presentationSlideState?.slideCount ?? 1,
                        (presentationSlideState?.activeSlideIndex ?? 0) + 1,
                      )}{' '}
                      / {presentationSlideState?.slideCount ?? 1}
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1">
                <IconButton
                  className={`App-toolbar__btn flex items-center justify-center ${markdownPresentationMode ? 'text-blue-600' : ''}`}
                  title={UI_COPY.bottomPanelMarkdownPresentationModeToggleTitle}
                  tooltipContent={
                    markdownPresentationMode
                      ? UI_COPY.bottomPanelMarkdownPresentationModeOnTooltip
                      : UI_COPY.bottomPanelMarkdownPresentationModeOffTooltip
                  }
                  onClick={() => setMarkdownPresentationMode(!markdownPresentationMode)}
                  showTooltip
                >
                  <MonitorPlay className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
                </IconButton>
                <IconButton
                  className={`App-toolbar__btn flex items-center justify-center ${markdownFullscreen ? 'text-blue-600' : ''}`}
                  title={UI_COPY.bottomPanelMarkdownFullscreenToggleTitle}
                  tooltipContent={
                    markdownFullscreen
                      ? UI_COPY.bottomPanelMarkdownFullscreenOnTooltip
                      : UI_COPY.bottomPanelMarkdownFullscreenOffTooltip
                  }
                  onClick={toggleMarkdownFullscreen}
                  showTooltip
                >
                  <Maximize2 className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
                </IconButton>
              </div>
            </div>
            <MarkdownPreview
              ref={viewerRef}
              markdownText={deferredMarkdownText}
              activeDocumentPath={previewBasePath}
              highlightedLineRange={highlightedLineRange}
              markdownWordWrap={markdownWordWrap}
              markdownPresentationMode={markdownPresentationMode}
              presentationApiRef={presentationApiRef}
              onPresentationSlideStateChange={setPresentationSlideState}
              uiPanelTextFontClass={uiPanelTextFontClass}
              uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
