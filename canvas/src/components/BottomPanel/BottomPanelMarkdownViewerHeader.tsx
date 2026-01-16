import React from 'react'
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  Columns,
  Edit3,
  Eye,
  LayoutPanelTop,
  MonitorPlay,
  WrapText,
} from 'lucide-react'
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
  markdownViewerWidthMode?: 'standard' | 'wide'
  setMarkdownViewerWidthMode?: (next: 'standard' | 'wide') => void
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
  editToggleTitle: string
  editOnTooltip: string
  editOffTooltip: string
  isEditing: boolean
  onToggleEdit: () => void
  onFullscreenToggleRequested?: () => void
  onExpandAll?: () => void
  onCollapseAll?: () => void
  allCollapsed?: boolean
  showSidebar?: boolean
  onToggleSidebar?: () => void
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
    markdownViewerWidthMode,
    setMarkdownViewerWidthMode,
    markdownWordWrap,
    setMarkdownWordWrap,
    wordWrapToggleTitle,
    wordWrapOnTooltip,
    wordWrapOffTooltip,
    annotateDisplayMode,
    setAnnotateDisplayMode,
    setMarkdownPresentationMode,
    presentationSlideState,
    textHighlightToggleTitle,
    textHighlightOnTooltip,
    textHighlightOffTooltip,
    applyButtonTitle,
    onApplyMarkdown,
    presentationModeToggleTitle,
    presentationModeOnTooltip,
    presentationModeOffTooltip,
    editToggleTitle,
    editOnTooltip,
    editOffTooltip,
    isEditing,
    onToggleEdit,
    onFullscreenToggleRequested,
    onExpandAll,
    onCollapseAll,
    allCollapsed,
    showSidebar,
    onToggleSidebar,
  } = props

  return (
    <div className={['flex items-center justify-between gap-2', uiPanelKeyValueTextSizeClass, uiPanelTextFontClass].join(' ')}>
      <div className="flex items-center gap-2 min-w-0">
        {!markdownPresentationMode && (
          <div className={`flex items-center gap-1.5 ${UI_THEME_TOKENS.text.secondary} select-none`}>
            {isEditing ? (
              <>
                {onToggleSidebar && (
                  <IconButton
                    className={`p-0.5 rounded-sm hover:bg-gray-200 dark:hover:bg-gray-700 ${showSidebar ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
                    onClick={onToggleSidebar}
                    title={showSidebar ? 'Close Sidebar' : 'Open Sidebar'}
                  >
                    <LayoutPanelTop className="w-3.5 h-3.5 rotate-90" strokeWidth={1.5} />
                  </IconButton>
                )}
                <Edit3 className="w-4 h-4" strokeWidth={1.5} />
                <span className="font-medium truncate">{props.editorTitle}</span>
              </>
            ) : (
              <>
                {onToggleSidebar && (
                  <IconButton
                    className={`p-0.5 rounded-sm hover:bg-gray-200 dark:hover:bg-gray-700 ${showSidebar ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
                    onClick={onToggleSidebar}
                    title={showSidebar ? 'Close Sidebar' : 'Open Sidebar'}
                  >
                    <LayoutPanelTop className="w-3.5 h-3.5 rotate-90" strokeWidth={1.5} />
                  </IconButton>
                )}
                <Eye className="w-4 h-4" strokeWidth={1.5} />
                <span className="font-medium truncate">{props.viewerTitle}</span>
              </>
            )}
          </div>
        )}
      </div>
      <nav className="flex items-center gap-1" aria-label="Markdown Toolbar">
        {!markdownPresentationMode && !isEditing && (
          <div className={`flex items-center mr-1 ${UI_THEME_TOKENS.badge.chip} p-0.5`}>
            <div className={`px-1 ${UI_THEME_TOKENS.text.tertiary}`}>
               <ArrowLeftRight className="w-3 h-3" strokeWidth={1.5} />
            </div>
            <button
              type="button"
              className={[
                'px-2 py-0.5 text-[10px] rounded-sm transition-colors',
                markdownViewerWidthMode === 'standard'
                  ? `${UI_THEME_TOKENS.panel.bg} shadow-sm ${UI_THEME_TOKENS.button.activeText}`
                  : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`,
              ].join(' ')}
              onClick={() => setMarkdownViewerWidthMode?.('standard')}
            >
              Standard
            </button>
            <button
              type="button"
              className={[
                'px-2 py-0.5 text-[10px] rounded-sm transition-colors',
                markdownViewerWidthMode === 'wide'
                  ? `${UI_THEME_TOKENS.panel.bg} shadow-sm ${UI_THEME_TOKENS.button.activeText}`
                  : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`,
              ].join(' ')}
              onClick={() => setMarkdownViewerWidthMode?.('wide')}
            >
              Wide
            </button>
          </div>
        )}
        <div className={`flex items-center mr-1 ${UI_THEME_TOKENS.badge.chip} p-0.5`}>
          <div className={`px-1 ${UI_THEME_TOKENS.text.tertiary}`}>
             <Columns className="w-3 h-3" strokeWidth={1.5} />
          </div>
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
        {!markdownPresentationMode && (onExpandAll || onCollapseAll) && typeof allCollapsed === 'boolean' && (
          <IconButton
            className={`App-toolbar__btn flex items-center justify-center ${uiPrimaryIconInactiveClassName}`}
            title={allCollapsed ? 'Expand all sections' : 'Collapse all sections'}
            tooltipContent={allCollapsed ? 'Expand all sections' : 'Collapse all sections'}
            onClick={() => {
              if (allCollapsed) {
                onExpandAll?.()
              } else {
                onCollapseAll?.()
              }
            }}
            showTooltip
          >
            <ChevronDown
              className={`${iconSizeClass} transition-transform ${allCollapsed ? '' : 'rotate-180'}`}
              strokeWidth={uiIconStrokeWidth}
            />
          </IconButton>
        )}
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
            if (next && onFullscreenToggleRequested) {
              onFullscreenToggleRequested()
            } else {
              setMarkdownPresentationMode(next)
            }
            emitMarkdownPanelMetric('markdownPresentationModeToggled', {
              enabled: next,
              slideCount: presentationSlideState?.slideCount ?? null,
            })
          }}
          showTooltip
        >
          <MonitorPlay className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
        </IconButton>
      </nav>
    </div>
  )
}
