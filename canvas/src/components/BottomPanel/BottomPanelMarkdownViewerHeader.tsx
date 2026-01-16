import React from 'react'
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  Columns,
  Edit3,
  Eye,
  LayoutGrid,
  LayoutPanelTop,
  Maximize2,
  MonitorPlay,
  WrapText,
} from 'lucide-react'
import IconButton from '@/components/IconButton'
import { uiPrimaryIconActiveClassName, uiPrimaryIconInactiveClassName } from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles'
import { emitMarkdownPanelMetric } from '@/features/metrics/uiMetrics'

import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export type ViewerHeaderRowProps = {
  uiPanelKeyValueTextSizeClass: string
  uiPanelTextFontClass: string
  viewerTitle: string
  editorTitle?: string
  iconSizeClass: string
  uiIconStrokeWidth: number
  markdownTextHighlight: boolean
  setMarkdownTextHighlight: (next: boolean) => void
  markdownViewerWidthMode?: 'standard' | 'wide'
  setMarkdownViewerWidthMode?: (next: 'standard' | 'wide') => void
  markdownLayoutMode: 'split' | 'editor' | 'viewer' | 'presentation' | 'slides-gallery'
  setMarkdownLayoutMode: (mode: 'split' | 'editor' | 'viewer' | 'presentation' | 'slides-gallery') => void
  markdownWordWrap: boolean
  setMarkdownWordWrap: (next: boolean) => void
  wordWrapToggleTitle: string
  wordWrapOnTooltip: string
  wordWrapOffTooltip: string
  annotateDisplayMode: 'inline' | 'beside'
  setAnnotateDisplayMode: (mode: 'inline' | 'beside') => void
  markdownPreviewPrevButtonLabel: string
  markdownPreviewNextButtonLabel: string
  textHighlightToggleTitle: string
  textHighlightOnTooltip: string
  textHighlightOffTooltip: string
  applyButtonLabel: string
  applyButtonTitle: string
  onApplyMarkdown: () => void
  onFullscreenToggleRequested: () => void
  fullscreenToggleTitle: string
  fullscreenToggleTooltip: string
  editToggleTitle: string
  editOnTooltip: string
  editOffTooltip: string
  isEditing: boolean
  onToggleEdit: () => void
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
    iconSizeClass,
    uiIconStrokeWidth,
    markdownTextHighlight,
    setMarkdownTextHighlight,
    markdownViewerWidthMode,
    setMarkdownViewerWidthMode,
    markdownLayoutMode,
    setMarkdownLayoutMode,
    markdownWordWrap,
    setMarkdownWordWrap,
    wordWrapToggleTitle,
    wordWrapOnTooltip,
    wordWrapOffTooltip,
    annotateDisplayMode,
    setAnnotateDisplayMode,
    textHighlightToggleTitle,
    textHighlightOnTooltip,
    textHighlightOffTooltip,
    applyButtonTitle,
    onApplyMarkdown,
    onFullscreenToggleRequested,
    fullscreenToggleTitle,
    fullscreenToggleTooltip,
    editToggleTitle,
    editOnTooltip,
    editOffTooltip,
    isEditing,
    onToggleEdit,
    onExpandAll,
    onCollapseAll,
    allCollapsed,
    showSidebar,
    onToggleSidebar,
  } = props

  const isPresentationOrGallery = markdownLayoutMode === 'presentation' || markdownLayoutMode === 'slides-gallery'

  return (
    <section className={['flex items-center justify-between gap-2', uiPanelKeyValueTextSizeClass, uiPanelTextFontClass].join(' ')}>
      <div className="flex items-center gap-2 min-w-0">
        <div className={`flex items-center gap-1.5 ${UI_THEME_TOKENS.text.secondary} select-none`}>
          {onToggleSidebar && (
            <IconButton
              className={`p-0.5 rounded-sm hover:bg-gray-200 dark:hover:bg-gray-700 ${showSidebar ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
              onClick={onToggleSidebar}
              title={showSidebar ? 'Close Sidebar' : 'Open Sidebar'}
            >
              <LayoutPanelTop className="w-3.5 h-3.5 rotate-90" strokeWidth={1.5} />
            </IconButton>
          )}
          {!isPresentationOrGallery && (
            isEditing ? (
              <>
                <Edit3 className="w-4 h-4" strokeWidth={1.5} />
                <span className="font-medium truncate">{props.editorTitle}</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" strokeWidth={1.5} />
                <span className="font-medium truncate">{props.viewerTitle}</span>
              </>
            )
          )}
          {isPresentationOrGallery && (
            <>
              <MonitorPlay className="w-4 h-4" strokeWidth={1.5} />
              <span className="font-medium truncate">Presentation</span>
            </>
          )}
        </div>
      </div>
      <nav className="flex items-center gap-1" aria-label="Markdown Toolbar">
        {!isPresentationOrGallery && !isEditing && (
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
        {!isPresentationOrGallery && (onExpandAll || onCollapseAll) && typeof allCollapsed === 'boolean' && (
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
            markdownLayoutMode === 'presentation' ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
          }`}
          title="Markdown Presentation"
          tooltipContent="Markdown Presentation"
          onClick={() => setMarkdownLayoutMode('presentation')}
          showTooltip
        >
          <MonitorPlay className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
        </IconButton>
        <IconButton
          className={`App-toolbar__btn flex items-center justify-center ${
            markdownLayoutMode === 'slides-gallery' ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
          }`}
          title="Gallery"
          tooltipContent="Gallery"
          onClick={() => setMarkdownLayoutMode('slides-gallery')}
          showTooltip
        >
          <LayoutGrid className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
        </IconButton>
        <IconButton
          className={`App-toolbar__btn flex items-center justify-center ${uiPrimaryIconInactiveClassName}`}
          title={fullscreenToggleTitle}
          tooltipContent={fullscreenToggleTooltip}
          onClick={onFullscreenToggleRequested}
          showTooltip
        >
          <Maximize2 className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
        </IconButton>
        {isPresentationOrGallery && (
          <IconButton
            className={`App-toolbar__btn flex items-center justify-center ${uiPrimaryIconInactiveClassName}`}
            title="Enter Full Screen"
            tooltipContent="Enter Full Screen"
            onClick={onFullscreenToggleRequested}
            showTooltip
          >
            <Maximize2 className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
          </IconButton>
        )}
      </nav>
    </section>
  )
}
