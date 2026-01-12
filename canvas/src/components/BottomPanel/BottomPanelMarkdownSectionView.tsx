import React from 'react'
import MarkdownPreview, {
  type MarkdownPreviewPresentationApi,
  type MarkdownPreviewPresentationSlideState,
} from '@/features/markdown/ui/MarkdownPreview'
import { reorderSlidesInMarkdown } from '@/features/markdown/ui/markdownPreviewSlides'
import { emitMarkdownPanelMetric } from '@/features/metrics/uiMetrics'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import type { JsonToMarkdownMode } from '@/features/markdown/jsonToMarkdown'
import type { MarkdownLayoutMode } from './BottomPanelMarkdownSection'
import type { MarkdownSelectionInfo } from './BottomPanelMarkdownSectionModel'
import { HeaderStatusRow, ViewerHeaderRow } from './BottomPanelMarkdownHeaders'

type JsonMarkdownMode = JsonToMarkdownMode

type BottomPanelMarkdownSectionViewProps = {
  autoOpenHighlight: boolean
  uiPanelKeyValueTextSizeClass: string
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string
  isJsonBacked: boolean
  jsonModeEnabled: boolean
  jsonMarkdownMode: JsonMarkdownMode
  setJsonMarkdownMode: (mode: JsonMarkdownMode) => void
  jsonMarkdownSuggestedMode: JsonMarkdownMode
  status: { ok: boolean | null; msg: string; details?: string }
  applyStatus: { ok: boolean | null; msg: string } | null
  isMarkdownLargeSummary: boolean
  markdownPresentationMode: boolean
  markdownLayoutMode: MarkdownLayoutMode
  setMarkdownLayoutMode: (mode: MarkdownLayoutMode) => void
  iconSizeClass: string
  uiIconStrokeWidth: number
  markdownWordWrap: boolean
  editorGutterWidthCh: number
  editorContentHeightPx: number
  editorTextAreaRef: React.RefObject<HTMLTextAreaElement>
  gutterLayerRef: React.RefObject<HTMLDivElement>
  visibleLineNumbers: number[]
  selectionHighlightEnabled: boolean
  highlightedLineRange: { start: number; end: number } | null
  editorRowStartByLine: Record<number, number>
  visibleLineRange: { startLine: number; endLine: number }
  flashSelectionId: string | null
  selectionInfo: MarkdownSelectionInfo | null
  editorPaddingTopPx: number
  lineHeightPx: number
  markdownText: string
  setMarkdownText: (next: string) => void
  setMarkdownDocument: (name: string | null, text: string) => void
  markdownDocumentName: string | null
  markdownPreviewText: string
  previewBasePath: string
  viewerRef: React.RefObject<HTMLDivElement>
  markdownTextHighlight: boolean
  setMarkdownTextHighlight: (next: boolean) => void
  presentationApiRef: React.RefObject<MarkdownPreviewPresentationApi | null>
  presentationSlideState: MarkdownPreviewPresentationSlideState | null
  setPresentationSlideState: (next: MarkdownPreviewPresentationSlideState | null) => void
  handleViewerScroll: (event: React.UIEvent<HTMLElement>) => void
  setMarkdownPresentationMode: (next: boolean) => void
  isMarkdownPreviewTruncated: boolean
  handleApplyMarkdown: () => void | Promise<void>
}

export function BottomPanelMarkdownSectionView(
  props: BottomPanelMarkdownSectionViewProps,
) {
  const {
    autoOpenHighlight,
    uiPanelKeyValueTextSizeClass,
    uiPanelTextFontClass,
    uiPanelMonospaceTextClass,
    isJsonBacked,
    jsonModeEnabled,
    jsonMarkdownMode,
    setJsonMarkdownMode,
    jsonMarkdownSuggestedMode,
    status,
    applyStatus,
    isMarkdownLargeSummary,
    markdownPresentationMode,
  markdownLayoutMode,
  setMarkdownLayoutMode,
  iconSizeClass,
  uiIconStrokeWidth,
  markdownWordWrap,
    editorGutterWidthCh,
    editorContentHeightPx,
    editorTextAreaRef,
    gutterLayerRef,
    visibleLineNumbers,
    selectionHighlightEnabled,
    highlightedLineRange,
    editorRowStartByLine,
    visibleLineRange,
    flashSelectionId,
    selectionInfo,
    editorPaddingTopPx,
    lineHeightPx,
    markdownText,
    setMarkdownText,
    setMarkdownDocument,
    markdownDocumentName,
    markdownPreviewText,
    previewBasePath,
    viewerRef,
    markdownTextHighlight,
    setMarkdownTextHighlight,
    presentationApiRef,
    presentationSlideState,
    setPresentationSlideState,
    handleViewerScroll,
    setMarkdownPresentationMode,
    isMarkdownPreviewTruncated,
    handleApplyMarkdown,
  } = props

  const handleSlidesReordered = React.useCallback(
    (nextOrder: number[]) => {
      const source = markdownText || ''
      if (!source.trim()) return
      const next = reorderSlidesInMarkdown(source, nextOrder)
      if (next === source) return
      setMarkdownText(next)
      setMarkdownDocument(markdownDocumentName, next)
      emitMarkdownPanelMetric('markdownSlidesReordered', {
        slideCount: nextOrder.length,
        documentName: markdownDocumentName || null,
      })
    },
    [markdownDocumentName, markdownText, setMarkdownDocument, setMarkdownText],
  )

  const isEditing = !markdownPresentationMode && markdownLayoutMode === 'editor'

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div
        className={[
          'flex-1 min-h-0 flex flex-col border rounded bg-white overflow-hidden transition-colors duration-300',
          autoOpenHighlight ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200',
        ].join(' ')}
      >
        <div
          className={[
            'px-2 py-1 border-b border-gray-200 flex items-center justify-between gap-2 text-gray-600',
            uiPanelKeyValueTextSizeClass,
            uiPanelTextFontClass,
          ].join(' ')}
        >
          <HeaderStatusRow
            uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
            jsonBackedBadgeTooltip={UI_COPY.bottomPanelMarkdownJsonBackedPreviewBadgeTooltip}
            jsonBackedBadgeLabel={UI_COPY.bottomPanelMarkdownJsonBackedPreviewBadgeLabel}
            isJsonBacked={isJsonBacked}
            jsonModeEnabled={jsonModeEnabled}
            jsonMarkdownMode={jsonMarkdownMode}
            setJsonMarkdownMode={setJsonMarkdownMode}
            jsonMarkdownSuggestedMode={jsonMarkdownSuggestedMode}
            status={status}
            applyStatus={applyStatus}
            isMarkdownLargeSummary={isMarkdownLargeSummary}
            jsonModeLabel={UI_COPY.bottomPanelJsonMarkdownModeLabel}
            jsonModeAutoLabel={UI_COPY.bottomPanelJsonMarkdownModeAutoLabel}
            jsonModeTableLabel={UI_COPY.bottomPanelJsonMarkdownModeTableLabel}
            jsonModeKeyValueLabel={UI_COPY.bottomPanelJsonMarkdownModeKeyValueLabel}
            jsonModeHierarchicalLabel={UI_COPY.bottomPanelJsonMarkdownModeHierarchicalLabel}
            jsonModeSuggestedPrefix={UI_COPY.bottomPanelJsonMarkdownModeSuggestedPrefix}
            statusLabel={UI_LABELS.markdown}
            largeSummaryHelperText={UI_COPY.markdownLargeSummaryHelperText}
          />
          <ViewerHeaderRow
            uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
            uiPanelTextFontClass={uiPanelTextFontClass}
            viewerTitle={UI_COPY.bottomPanelMarkdownViewerTitle}
            markdownPresentationMode={markdownPresentationMode}
            iconSizeClass={iconSizeClass}
            uiIconStrokeWidth={uiIconStrokeWidth}
            markdownTextHighlight={markdownTextHighlight}
            setMarkdownTextHighlight={setMarkdownTextHighlight}
            setMarkdownPresentationMode={setMarkdownPresentationMode}
            presentationApiRef={presentationApiRef}
            presentationSlideState={presentationSlideState}
            markdownPreviewPrevButtonLabel={UI_COPY.markdownPreviewPrevButtonLabel}
            markdownPreviewNextButtonLabel={UI_COPY.markdownPreviewNextButtonLabel}
            textHighlightToggleTitle={UI_COPY.bottomPanelMarkdownTextHighlightToggleTitle}
            textHighlightOnTooltip={UI_COPY.bottomPanelMarkdownTextHighlightOnTooltip}
            textHighlightOffTooltip={UI_COPY.bottomPanelMarkdownTextHighlightOffTooltip}
            applyButtonLabel={UI_COPY.bottomPanelMarkdownApplyButtonLabel}
            applyButtonTitle={UI_COPY.bottomPanelMarkdownApplyButtonTitle}
            onApplyMarkdown={() => {
              void handleApplyMarkdown()
            }}
            presentationModeToggleTitle={UI_COPY.bottomPanelMarkdownPresentationModeToggleTitle}
            presentationModeOnTooltip={UI_COPY.bottomPanelMarkdownPresentationModeOnTooltip}
            presentationModeOffTooltip={UI_COPY.bottomPanelMarkdownPresentationModeOffTooltip}
            fullscreenToggleTitle={UI_COPY.bottomPanelMarkdownFullscreenToggleTitle}
            fullscreenOnTooltip={UI_COPY.bottomPanelMarkdownFullscreenOnTooltip}
            fullscreenOffTooltip={UI_COPY.bottomPanelMarkdownFullscreenOffTooltip}
            editToggleTitle={UI_COPY.bottomPanelMarkdownEditToggleTitle}
            editOnTooltip={UI_COPY.bottomPanelMarkdownEditOnTooltip}
            editOffTooltip={UI_COPY.bottomPanelMarkdownEditOffTooltip}
            isEditing={isEditing}
            onToggleEdit={() => {
              const nextIsEditing = !isEditing
              setMarkdownLayoutMode(nextIsEditing ? 'editor' : 'viewer')
              if (nextIsEditing) {
                handleViewerScroll({
                  currentTarget: viewerRef.current as unknown as HTMLElement,
                } as React.UIEvent<HTMLElement>)
              } else {
                const ta = editorTextAreaRef.current
                if (ta) {
                  const run = () => {
                    try {
                      ta.dispatchEvent(new Event('scroll', { bubbles: true }))
                    } catch {
                      void 0
                    }
                  }
                  try {
                    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
                      window.requestAnimationFrame(() => run())
                    } else {
                      setTimeout(() => run(), 0)
                    }
                  } catch {
                    run()
                  }
                }
              }
            }}
          />
        </div>

        <div className="flex-1 min-h-0 flex">
          <div
            className={[
              'flex-1 min-h-0 flex flex-col',
              'min-w-0',
            ].join(' ')}
          >
            <div className="flex-1 min-h-0 flex">
              <div
                className={[
                  'flex-1 min-h-0 flex flex-col',
                  isEditing ? '' : 'hidden',
                ].join(' ')}
              >
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
                          selectionHighlightEnabled &&
                          highlightedLineRange != null &&
                          line >= highlightedLineRange.start &&
                          line <= highlightedLineRange.end
                        const startRow =
                          editorRowStartByLine[visibleLineRange.startLine] ??
                          visibleLineRange.startLine
                        const row = editorRowStartByLine[line] ?? line
                        const useFlash =
                          !!flashSelectionId &&
                          !!selectionInfo &&
                          flashSelectionId === selectionInfo.id &&
                          isHighlighted
                        const baseBg =
                          isHighlighted && selectionInfo?.highlightBackgroundColor
                            ? selectionInfo.highlightBackgroundColor
                            : null
                        const bgColor = useFlash ? 'rgba(249,115,22,0.35)' : baseBg
                        return (
                          <div
                            key={line}
                            className={[
                              'absolute left-0 right-0 pr-2 text-right select-none',
                              uiPanelMonospaceTextClass,
                            ].join(' ')}
                            style={{
                              top: `${editorPaddingTopPx + (row - startRow) * lineHeightPx}px`,
                              height: `${lineHeightPx}px`,
                              lineHeight: `${lineHeightPx}px`,
                              backgroundColor: bgColor || undefined,
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
                      'w-full h-full px-2 py-2 border-0 rounded-none resize-none bg-transparent text-gray-900 outline-none',
                      'overflow-auto',
                      markdownWordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre',
                      uiPanelMonospaceTextClass,
                    ].join(' ')}
                    style={{ lineHeight: `${lineHeightPx}px` }}
                    wrap={markdownWordWrap ? 'soft' : 'off'}
                  />
                </div>
              </div>
              <div
                className={[
                  'flex-1 min-h-0 flex flex-col',
                  !isEditing ? '' : 'hidden',
                ].join(' ')}
              >
                {isMarkdownPreviewTruncated && (
                  <div
                    className={[
                      uiPanelKeyValueTextSizeClass,
                      'px-2 py-1 border-b border-gray-200 bg-gray-50 text-[10px] text-gray-400',
                    ].join(' ')}
                  >
                    {UI_COPY.markdownPreviewTruncatedHelperText}
                  </div>
                )}
                <MarkdownPreview
                  ref={viewerRef}
                  markdownText={markdownPreviewText}
                  activeDocumentPath={previewBasePath}
                  highlightedLineRange={highlightedLineRange}
                  markdownWordWrap={markdownWordWrap}
                  markdownPresentationMode={markdownPresentationMode}
                  markdownTextHighlight={selectionHighlightEnabled}
                  alwaysOnHighlightMode={markdownTextHighlight}
                  selectionKind={selectionInfo?.kind ?? null}
                  highlightBackgroundColor={selectionInfo?.highlightBackgroundColor ?? null}
                  highlightUnderlineColor={selectionInfo?.highlightUnderlineColor ?? null}
                  presentationApiRef={presentationApiRef}
                  onPresentationSlideStateChange={setPresentationSlideState}
                  onSlidesReordered={handleSlidesReordered}
                  uiPanelTextFontClass={uiPanelTextFontClass}
                  uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
                  previewScrollable
                  onScroll={markdownPresentationMode ? undefined : handleViewerScroll}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
