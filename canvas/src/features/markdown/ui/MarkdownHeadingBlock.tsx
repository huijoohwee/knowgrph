import React from 'react'
import type { TokensHeading } from './MarkdownTokens'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { renderInlineTokens } from './MarkdownInlineRenderer'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { RenderOpts } from './MarkdownRendererTypes'
import { MarkdownBlockContainer } from './MarkdownBlockContainer'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { slugify } from '@/features/parsers/markdownJsonLd'

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
  const cls = ['font-bold mt-6 mb-4', size, color, opts.uiPanelTextFontClass].filter(Boolean).join(' ')
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
    <MarkdownBlockContainer
      as={Tag}
      className={`${cls} flex items-center justify-between group`}
      highlightClass={highlightClass}
      highlightStyle={highlightStyle}
      startLine={startLine}
      endLine={endLine}
      id={id}
    >
      <div className="flex-1 min-w-0 flex items-center">
        {content}
        {id && (
          <a
            href={`#${id}`}
            className={`ml-2 opacity-0 group-hover:opacity-100 transition-opacity ${UI_THEME_TOKENS.text.tertiary} hover:${UI_THEME_TOKENS.text.primary} no-underline`}
            aria-hidden="true"
          >
            #
          </a>
        )}
      </div>
      {canCollapse && (
        <button
          onClick={e => {
            e.preventDefault()
            e.stopPropagation()
            opts.onToggleCollapse?.(id)
          }}
          className={`ml-2 inline-flex items-center justify-center p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 align-middle ${UI_THEME_TOKENS.text.secondary}`}
          aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
        </button>
      )}
    </MarkdownBlockContainer>
  )
})
