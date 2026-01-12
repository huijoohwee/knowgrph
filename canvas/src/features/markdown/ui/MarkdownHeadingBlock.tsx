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
        ? 'text-3xl'
        : 'text-base'
      : depth === 2
      ? opts.markdownPresentationMode
        ? 'text-2xl'
        : 'text-sm'
      : opts.markdownPresentationMode
      ? 'text-xl'
      : 'text-xs'
  
  const cls = ['font-semibold mt-5 mb-2', size, opts.uiPanelTextFontClass].filter(Boolean).join(' ')
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
    >
      {content}
    </MarkdownBlockContainer>
  )
})
