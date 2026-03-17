import React from 'react'
import type { TokensHeading } from './MarkdownTokens'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { renderInlineTokens } from './MarkdownInlineRenderer'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { RenderOpts } from './MarkdownRendererTypes'
import { MarkdownBlockContainer } from './MarkdownBlockContainer'
import { ChevronDown, Link2 } from 'lucide-react'
import { slugify } from 'grph-shared/markdown/slugify'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'
import { UI_COPY } from '@/lib/config'
import { getStickyHeadingCascadeOffsets } from './markdownSectionUtils'
import { getMarkdownHeadingTextSizeClass } from '@/features/markdown/ui/markdownTypography'
import {
  MARKDOWN_BLOCK_GUTTER_PADDING_LEFT_CLASS,
  MARKDOWN_BLOCK_GUTTER_PADDING_RIGHT_CLASS,
  MarkdownBlockDropMarkers,
  MarkdownBlockGutterControls,
} from './MarkdownBlockGutter'

type MarkdownHeadingBlockProps = {
  token: TokenWithLines
  highlightClass: string
  highlightStyle?: React.CSSProperties
  opts: RenderOpts
  fragmentsEnabled?: boolean
  fragmentStep?: number
  fragmentClassNames?: string[]
  fragmentTags?: string[]
}

export const MarkdownHeadingBlock = React.memo(function MarkdownHeadingBlock({
  token: t,
  highlightClass,
  highlightStyle,
  opts,
  fragmentsEnabled = false,
  fragmentStep = 0,
  fragmentClassNames,
  fragmentTags,
}: MarkdownHeadingBlockProps) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const h = t as unknown as TokensHeading
  const id = h.id || slugify(h.text || '')
  const depth = Math.min(6, Math.max(1, h.depth || 1))
  const startLine = t.startLine
  const endLine = t.endLine || t.startLine
  const baseSize = getMarkdownHeadingTextSizeClass({ depth, presentation: opts.markdownPresentationMode })
  const size =
    depth === 1 && !opts.markdownPresentationMode
      ? `${baseSize} pb-1`
      : depth === 2 && !opts.markdownPresentationMode
      ? `${baseSize} pb-0.5`
      : baseSize
  
  const color =
    depth === 1
      ? UI_THEME_TOKENS.text.primary
      : depth === 2
      ? UI_THEME_TOKENS.text.primary
      : UI_THEME_TOKENS.text.secondary
  const stickyTopClass = opts.stickyHeadingTopClass || 'top-0'
  const baseTopPx =
    typeof opts.stickyHeadingTopPx === 'number' && Number.isFinite(opts.stickyHeadingTopPx)
      ? opts.stickyHeadingTopPx
      : 0
  const cascadeBaseDepth =
    typeof opts.stickyHeadingCascadeBaseDepth === 'number' && Number.isFinite(opts.stickyHeadingCascadeBaseDepth)
      ? Math.min(6, Math.max(1, opts.stickyHeadingCascadeBaseDepth))
      : 1
  const { topPx, zIndex } = getStickyHeadingCascadeOffsets({
    depth,
    cascadeBaseDepth,
    baseTopPx,
    markdownPresentationMode: opts.markdownPresentationMode,
  })

  const stickyStyle = {
    top: `${topPx}px`,
    zIndex,
  } as React.CSSProperties
  const mergedStyle = { ...(highlightStyle || {}) } as React.CSSProperties
  const cls = ['font-semibold', size, color, opts.uiPanelTextFontClass].filter(Boolean).join(' ')
  const content = renderInlineTokens(h.tokens, {
    activeDocumentPath: opts.activeDocumentPath,
    uiPanelTextFontClass: opts.uiPanelTextFontClass,
    uiPanelMonospaceTextClass: opts.uiPanelMonospaceTextClass,
    markdownPresentationMode: opts.markdownPresentationMode,
    fragmentOptions:
      opts.markdownPresentationMode && fragmentsEnabled
        ? {
            enabled: true,
            currentStep: fragmentStep,
            classNames: fragmentClassNames || [],
            tags: fragmentTags || [],
          }
        : null,
  })
  const Tag = (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'][depth - 1] || 'h6') as
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'h5'
    | 'h6'

  const isCollapsed = opts.collapsedIds && id ? opts.collapsedIds.has(id) : false
  const canCollapse = !!opts.onToggleCollapse && !!id
  const canReorder =
    !opts.markdownPresentationMode &&
    !!opts.viewerBlockEditingEnabled &&
    !!opts.onReorderHeadingSection &&
    opts.markdownBlockControlsEnabled !== false &&
    !!id
  const canInsertLine =
    !opts.markdownPresentationMode &&
    !!opts.viewerBlockEditingEnabled &&
    !!opts.onInsertLineAfter &&
    opts.markdownBlockControlsEnabled !== false &&
    !!id
  const gutterEnabled = (canInsertLine || canReorder) && opts.markdownBlockGutterEnabled !== false

  const [dragState, setDragState] = React.useState<'none' | 'top' | 'bottom'>('none')
  const [isDragging, setIsDragging] = React.useState(false)

  const handleDragStart = React.useCallback(
    (e: React.DragEvent) => {
      if (!canReorder || !id) return
      setIsDragging(true)
      e.dataTransfer.setData('text/plain', id)
      e.dataTransfer.effectAllowed = 'move'
    },
    [canReorder, id],
  )

  const handleDragEnd = React.useCallback(() => {
    setIsDragging(false)
    setDragState('none')
  }, [])

  const handleDragOver = React.useCallback(
    (e: React.DragEvent) => {
      if (!canReorder || !id) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      const rect = e.currentTarget.getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      if (e.clientY < midY) {
        setDragState('top')
      } else {
        setDragState('bottom')
      }
    },
    [canReorder, id],
  )

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setDragState('none')
  }, [])

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      if (!canReorder || !id) return
      e.preventDefault()
      e.stopPropagation()
      setDragState('none')
      const sourceId = e.dataTransfer.getData('text/plain')
      if (!sourceId || sourceId === id) return
      opts.onReorderHeadingSection?.(sourceId, id, dragState === 'bottom' ? 'after' : 'before')
    },
    [canReorder, dragState, id, opts],
  )

  return (
    <header
      className={[
        'sticky',
        stickyTopClass,
        `${UI_THEME_TOKENS.panel.bg} backdrop-blur-md py-0.5 mb-2 border-b-0`,
      ].join(' ')}
      style={stickyStyle}
    >
      <MarkdownBlockContainer
        as={Tag}
        className={`${cls} flex items-center gap-1.5 group min-w-0 relative ${gutterEnabled ? `${MARKDOWN_BLOCK_GUTTER_PADDING_LEFT_CLASS} ${MARKDOWN_BLOCK_GUTTER_PADDING_RIGHT_CLASS}` : ''} ${isDragging ? `${UI_THEME_TOKENS.button.activeBg} opacity-60` : ''}`}
        highlightClass={highlightClass}
        highlightStyle={mergedStyle}
        startLine={startLine}
        endLine={endLine}
        id={id}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {gutterEnabled && (
          <>
            <MarkdownBlockDropMarkers dragState={dragState} withArrow />
            <MarkdownBlockGutterControls
              canInsertLine={canInsertLine}
              onInsertLine={() => opts.onInsertLineAfter?.(endLine)}
              canReorder={canReorder}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              iconSizeClass={iconSizeClass}
              iconStrokeWidth={uiIconStrokeWidth}
              labelReorder="Reorder section"
              labelInsert={UI_COPY.markdownBlockInsertLineLabel}
            />
          </>
        )}
        <bdi className="flex-1 min-w-0 overflow-hidden">{content}</bdi>
        <span className="ml-auto flex items-center gap-1 shrink-0">
          {id && (
            <a
              href={`#${id}`}
              className={[
                'opacity-0 group-hover:opacity-100 transition-opacity no-underline',
                UI_THEME_TOKENS.text.tertiary,
                'hover:text-gray-900 dark:hover:text-gray-100',
              ].join(' ')}
              aria-label="Permalink"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
              }}
            >
              <Link2 className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
            </a>
          )}
          {canCollapse && (
            <button
              type="button"
              className={[
                'opacity-0 group-hover:opacity-100 transition-opacity',
                'p-0.5 rounded',
                UI_THEME_TOKENS.button.text,
                UI_THEME_TOKENS.button.hoverBg,
                'flex items-center justify-center shrink-0',
              ].join(' ')}
              title={isCollapsed ? 'Expand section' : 'Collapse section'}
              aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                e.stopPropagation()
                opts.onToggleCollapse?.(id)
              }}
            >
              <ChevronDown
                className={`${iconSizeClass} ${UI_THEME_TOKENS.text.secondary} transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
                strokeWidth={uiIconStrokeWidth}
                aria-hidden="true"
              />
            </button>
          )}
        </span>
      </MarkdownBlockContainer>
    </header>
  )
})
