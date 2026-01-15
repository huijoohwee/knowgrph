import React from 'react'
import { Check, Edit3, LayoutPanelTop, Maximize2, MonitorPlay, WrapText } from 'lucide-react'
import IconButton from '@/components/IconButton'
import { uiPrimaryIconActiveClassName, uiPrimaryIconInactiveClassName } from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles'
import { emitMarkdownPanelMetric } from '@/features/metrics/uiMetrics'
import type {
  MarkdownPreviewPresentationApi,
  MarkdownPreviewPresentationSlideState,
} from '@/features/markdown/ui/MarkdownPreview'

import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export type ViewerHeaderRowProps = {
  uiPanelKeyValueTextSizeClass: string
  uiPanelTextFontClass: string
  viewerTitle: string
  editorTitle?: string
  markdownPresentationMode: boolean
  iconSizeClass: string
  uiIconStrokeWidth: number
  markdownTextHighlight: boolean
  setMarkdownTextHighlight: (next: boolean) => void
  markdownWordWrap: boolean
  setMarkdownWordWrap: (next: boolean) => void
  wordWrapToggleTitle: string
  wordWrapOnTooltip: string
  wordWrapOffTooltip: string
  annotateDisplayMode: 'inline' | 'beside'
  setAnnotateDisplayMode: (mode: 'inline' | 'beside') => void
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
  onFullscreenToggleRequested?: () => void
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
    markdownWordWrap,
    setMarkdownWordWrap,
    wordWrapToggleTitle,
    wordWrapOnTooltip,
    wordWrapOffTooltip,
    annotateDisplayMode,
    setAnnotateDisplayMode,
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
    onFullscreenToggleRequested,
  } = props

  return (
    <div className={['flex items-center justify-between gap-2', uiPanelKeyValueTextSizeClass, uiPanelTextFontClass].join(' ')}>
      <div className="flex items-center gap-2 min-w-0">
        {!markdownPresentationMode && (
          <span className={`font-medium ${UI_THEME_TOKENS.text.secondary} select-none truncate`}>
            {isEditing && props.editorTitle ? props.editorTitle : props.viewerTitle}
          </span>
        )}
        {markdownPresentationMode && (
          <>
            <button
              type="button"
              className={`px-2 py-1 rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} disabled:opacity-50`}
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
              className={`px-2 py-1 rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.button.hoverBg} disabled:opacity-50`}
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
            <div className={`ml-1 ${UI_THEME_TOKENS.text.secondary}`}>
              {Math.min(
                presentationSlideState?.slideCount ?? 1,
                (presentationSlideState?.activeSlideIndex ?? 0) + 1,
              )}{' '}
              / {presentationSlideState?.slideCount ?? 1}
            </div>
          </>
        )}
      </div>
      <nav className="flex items-center gap-1" aria-label="Markdown Toolbar">
        <div className={`flex items-center mr-1 ${UI_THEME_TOKENS.badge.chip} p-0.5`}>
          <button
            type="button"
            name="annotate-display"
            value="beside"
            className={[
              'px-2 py-0.5 text-[10px] rounded-sm transition-colors',
              annotateDisplayMode === 'beside'
                ? `${UI_THEME_TOKENS.panel.bg} shadow-sm ${UI_THEME_TOKENS.button.activeText}`
                : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`,
            ].join(' ')}
            aria-current={annotateDisplayMode === 'beside' ? 'true' : undefined}
            onClick={() => setAnnotateDisplayMode('beside')}
          >
            Beside
          </button>
          <button
            type="button"
            name="annotate-display"
            value="inline"
            className={[
              'px-2 py-0.5 text-[10px] rounded-sm transition-colors',
              annotateDisplayMode === 'inline'
                ? `${UI_THEME_TOKENS.panel.bg} shadow-sm ${UI_THEME_TOKENS.button.activeText}`
                : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`,
            ].join(' ')}
            aria-current={annotateDisplayMode === 'inline' ? 'true' : undefined}
            onClick={() => setAnnotateDisplayMode('inline')}
          >
            Inline
          </button>
        </div>
        {isEditing && (
          <IconButton
            className={`App-toolbar__btn flex items-center justify-center ${UI_THEME_TOKENS.text.secondary}`}
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
          className={`App-toolbar__btn flex items-center justify-center ${
            markdownTextHighlight ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
          }`}
          title={textHighlightToggleTitle}
          tooltipContent={markdownTextHighlight ? textHighlightOnTooltip : textHighlightOffTooltip}
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
          className={`App-toolbar__btn flex items-center justify-center ${
            markdownWordWrap ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
          }`}
          title={wordWrapToggleTitle}
          tooltipContent={markdownWordWrap ? wordWrapOnTooltip : wordWrapOffTooltip}
          onClick={() => setMarkdownWordWrap(!markdownWordWrap)}
          showTooltip
        >
          <WrapText className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
        </IconButton>
        <IconButton
          className={`App-toolbar__btn flex items-center justify-center ${
            isEditing ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
          }`}
          title={editToggleTitle}
          tooltipContent={isEditing ? editOnTooltip : editOffTooltip}
          onClick={onToggleEdit}
          showTooltip
        >
          <Edit3 className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
        </IconButton>
        <IconButton
          className={`App-toolbar__btn flex items-center justify-center ${
            markdownPresentationMode ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
          }`}
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
          className="App-toolbar__btn flex items-center justify-center"
          title={fullscreenToggleTitle}
          tooltipContent={markdownPresentationMode ? fullscreenOnTooltip : fullscreenOffTooltip}
          onClick={() => {
            if (!markdownPresentationMode) {
              if (onFullscreenToggleRequested) {
                onFullscreenToggleRequested()
              } else {
                setMarkdownPresentationMode(true)
              }
              emitMarkdownPanelMetric('markdownPresentationModeToggled', {
                enabled: true,
                slideCount: presentationSlideState?.slideCount ?? null,
              })
            } else {
              presentationApiRef.current?.enterFullscreen?.()
            }
            emitMarkdownPanelMetric('markdownFullscreenToggleRequested', {
              enabled: true,
            })
          }}
          showTooltip
        >
          <Maximize2 className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
        </IconButton>
      </nav>
    </div>
  )
}
