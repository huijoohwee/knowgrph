import React from 'react'
import type { TokensHeading } from './MarkdownTokens'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { renderInlineTokens } from './MarkdownInlineRenderer'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { RenderOpts } from './MarkdownRendererTypes'
import { MarkdownBlockContainer } from './MarkdownBlockContainer'
import { ChevronDown, Link2 } from 'lucide-react'
import { slugify } from '@/features/parsers/markdownJsonLd'
import IconButton from '@/components/IconButton'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'
import { getStickyHeadingCascadeOffsets } from './markdownSectionUtils'

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
  const size =
    depth === 1
      ? opts.markdownPresentationMode
        ? 'text-5xl'
        : `text-3xl pb-2 border-b ${UI_THEME_TOKENS.panel.border}`
      : depth === 2
      ? opts.markdownPresentationMode
        ? 'text-4xl'
        : `text-2xl pb-1 border-b ${UI_THEME_TOKENS.panel.divider}`
      : depth === 3
      ? opts.markdownPresentationMode
        ? 'text-3xl'
        : 'text-xl'
      : opts.markdownPresentationMode
      ? 'text-2xl'
      : 'text-lg'
  
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
  const cls = ['font-bold', size, color, opts.uiPanelTextFontClass].filter(Boolean).join(' ')
  const content = renderInlineTokens(h.tokens, {
    activeDocumentPath: opts.activeDocumentPath,
    uiPanelMonospaceTextClass: opts.uiPanelMonospaceTextClass,
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

  return (
    <header
      className={[
        'sticky',
        stickyTopClass,
        `${UI_THEME_TOKENS.panel.bg} backdrop-blur-md py-1 mb-4 border-b-0`, // Enhanced backdrop blur for better sticky visibility
      ].join(' ')}
      style={stickyStyle}
    >
      <MarkdownBlockContainer
        as={Tag}
        className={`${cls} flex items-center gap-2 group min-w-0`}
        highlightClass={highlightClass}
        highlightStyle={mergedStyle}
        startLine={startLine}
        endLine={endLine}
        id={id}
      >
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
            <IconButton
              className="App-toolbar__btn flex items-center justify-center shrink-0"
              title={isCollapsed ? 'Expand section' : 'Collapse section'}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                e.stopPropagation()
                opts.onToggleCollapse?.(id)
              }}
              showTooltip
            >
              <ChevronDown
                className={`${iconSizeClass} ${UI_THEME_TOKENS.text.secondary} transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
                strokeWidth={uiIconStrokeWidth}
                aria-hidden="true"
              />
            </IconButton>
          )}
        </span>
      </MarkdownBlockContainer>
    </header>
  )
})
