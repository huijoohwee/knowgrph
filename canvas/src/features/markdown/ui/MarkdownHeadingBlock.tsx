import React from 'react'
import type { TokensHeading } from './MarkdownTokens'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { renderInlineTokens } from './MarkdownInlineRenderer'
import type { RenderOpts } from './MarkdownRendererTypes'
import { MarkdownBlockContainer } from './MarkdownBlockContainer'

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
  const depth = Math.min(6, Math.max(1, h.depth || 1))
  const startLine = t.startLine
  const endLine = t.endLine || t.startLine
  const size =
    depth === 1
      ? opts.markdownPresentationMode
        ? 'text-5xl'
        : 'text-3xl pb-2 border-b border-gray-200'
      : depth === 2
      ? opts.markdownPresentationMode
        ? 'text-4xl'
        : 'text-2xl pb-1 border-b border-gray-100'
      : depth === 3
      ? opts.markdownPresentationMode
        ? 'text-3xl'
        : 'text-xl'
      : opts.markdownPresentationMode
      ? 'text-2xl'
      : 'text-lg'
  
  const color = depth === 1 ? 'text-slate-800' : depth === 2 ? 'text-slate-700' : 'text-slate-600'
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
  return (
    <MarkdownBlockContainer
      as={Tag}
      className={cls}
      highlightClass={highlightClass}
      highlightStyle={highlightStyle}
      startLine={startLine}
      endLine={endLine}
      id={h.id}
    >
      {content}
      {h.id && (
        <a
          href={`#${h.id}`}
          className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-500 no-underline"
          aria-hidden="true"
        >
          #
        </a>
      )}
    </MarkdownBlockContainer>
  )
})
