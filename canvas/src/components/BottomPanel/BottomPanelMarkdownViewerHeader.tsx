import React from 'react'
import { Check, Edit3, LayoutPanelTop, Maximize2, MonitorPlay } from 'lucide-react'
import IconButton from '@/components/IconButton'
import { emitMarkdownPanelMetric } from '@/features/metrics/uiMetrics'
import type {
  MarkdownPreviewPresentationApi,
  MarkdownPreviewPresentationSlideState,
} from '@/features/markdown/ui/MarkdownPreview'

type ViewerHeaderRowProps = {
  uiPanelKeyValueTextSizeClass: string
  uiPanelTextFontClass: string
  viewerTitle: string
  markdownPresentationMode: boolean
  iconSizeClass: string
  uiIconStrokeWidth: number
  markdownTextHighlight: boolean
  setMarkdownTextHighlight: (next: boolean) => void
  markdownFullscreen: boolean
  toggleMarkdownFullscreen: () => void
  setMarkdownPresentationMode: (next: boolean) => void
  presentationApiRef: React.RefObject<MarkdownPreviewPresentationApi | null>
  presentationSlideState: MarkdownPreviewPresentationSlideState | null
  markdownPreviewPrevButtonLabel: string
  markdownPreviewNextButtonLabel: string
  textHighlightToggleTitle: string
  textHighlightOnTooltip: string
  textHighlightOffTooltip: string
  applyButtonLabel: string
  applyButtonTitle: string
  onApplyMarkdown: () => void
  presentationModeToggleTitle: string
  presentationModeOnTooltip: string
  presentationModeOffTooltip: string
  fullscreenToggleTitle: string
  fullscreenOnTooltip: string
  fullscreenOffTooltip: string
  editToggleTitle: string
  editOnTooltip: string
  editOffTooltip: string
  isEditing: boolean
  onToggleEdit: () => void
}

export function ViewerHeaderRow(props: ViewerHeaderRowProps) {
  const {
    uiPanelKeyValueTextSizeClass,
    uiPanelTextFontClass,
    markdownPresentationMode,
    iconSizeClass,
    uiIconStrokeWidth,
    markdownTextHighlight,
    setMarkdownTextHighlight,
    markdownFullscreen,
    toggleMarkdownFullscreen,
    setMarkdownPresentationMode,
    presentationApiRef,
    presentationSlideState,
    markdownPreviewPrevButtonLabel,
    markdownPreviewNextButtonLabel,
    textHighlightToggleTitle,
    textHighlightOnTooltip,
    textHighlightOffTooltip,
    applyButtonTitle,
    onApplyMarkdown,
    presentationModeToggleTitle,
    presentationModeOnTooltip,
    presentationModeOffTooltip,
    fullscreenToggleTitle,
    fullscreenOnTooltip,
    fullscreenOffTooltip,
    editToggleTitle,
    editOnTooltip,
    editOffTooltip,
    isEditing,
    onToggleEdit,
  } = props

  return (
    <div className={['flex items-center justify-between gap-2', uiPanelKeyValueTextSizeClass, uiPanelTextFontClass].join(' ')}>
      <div className="flex items-center gap-2 min-w-0">
        {markdownPresentationMode && (
          <>
            <button
              type="button"
              className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
              onClick={() => {
                emitMarkdownPanelMetric('markdownPresentationPrevClicked', {
                  activeIndex: presentationSlideState?.activeSlideIndex ?? null,
                  slideCount: presentationSlideState?.slideCount ?? null,
                })
                presentationApiRef.current?.prev()
              }}
              disabled={
                !presentationSlideState || presentationSlideState.activeSlideIndex <= 0
              }
            >
              {markdownPreviewPrevButtonLabel}
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
              onClick={() => {
                emitMarkdownPanelMetric('markdownPresentationNextClicked', {
                  activeIndex: presentationSlideState?.activeSlideIndex ?? null,
                  slideCount: presentationSlideState?.slideCount ?? null,
                })
                presentationApiRef.current?.next()
              }}
              disabled={
                !presentationSlideState ||
                presentationSlideState.activeSlideIndex >=
                  presentationSlideState.slideCount - 1
              }
            >
              {markdownPreviewNextButtonLabel}
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
        {isEditing && (
          <IconButton
            className="App-toolbar__btn flex items-center justify-center text-gray-600"
            title={applyButtonTitle}
            tooltipContent={applyButtonTitle}
            onClick={() => {
              void onApplyMarkdown()
            }}
            showTooltip
          >
            <Check className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
          </IconButton>
        )}
        <IconButton
          className={`App-toolbar__btn flex items-center justify-center ${markdownTextHighlight ? 'text-blue-600' : ''}`}
          title={textHighlightToggleTitle}
          tooltipContent={
            markdownTextHighlight
              ? textHighlightOnTooltip
              : textHighlightOffTooltip
          }
          onClick={() => {
            const next = !markdownTextHighlight
            setMarkdownTextHighlight(next)
            emitMarkdownPanelMetric('markdownTextHighlightToggled', {
              enabled: next,
            })
          }}
          showTooltip
        >
          <LayoutPanelTop className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
        </IconButton>
        <IconButton
          className={`App-toolbar__btn flex items-center justify-center ${isEditing ? 'text-blue-600' : ''}`}
          title={editToggleTitle}
          tooltipContent={isEditing ? editOnTooltip : editOffTooltip}
          onClick={onToggleEdit}
          showTooltip
        >
          <Edit3 className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
        </IconButton>
        <IconButton
          className={`App-toolbar__btn flex items-center justify-center ${markdownPresentationMode ? 'text-blue-600' : ''}`}
          title={presentationModeToggleTitle}
          tooltipContent={
            markdownPresentationMode
              ? presentationModeOnTooltip
              : presentationModeOffTooltip
          }
          onClick={() => {
            const next = !markdownPresentationMode
            setMarkdownPresentationMode(next)
            emitMarkdownPanelMetric('markdownPresentationModeToggled', {
              enabled: next,
              slideCount: presentationSlideState?.slideCount ?? null,
            })
          }}
          showTooltip
        >
          <MonitorPlay className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
        </IconButton>
        <IconButton
          className={`App-toolbar__btn flex items-center justify-center ${markdownFullscreen ? 'text-blue-600' : ''}`}
          title={fullscreenToggleTitle}
          tooltipContent={
            markdownFullscreen
              ? fullscreenOnTooltip
              : fullscreenOffTooltip
          }
          onClick={toggleMarkdownFullscreen}
          showTooltip
        >
          <Maximize2 className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
        </IconButton>
      </div>
    </div>
  )
}
