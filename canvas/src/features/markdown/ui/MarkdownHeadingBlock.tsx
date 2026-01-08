import React from 'react'
import type { TokensHeading } from './MarkdownTokens'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { renderInlineTokens } from './MarkdownInlineRenderer'
import type { RenderOpts } from './MarkdownRendererTypes'

type MarkdownHeadingBlockProps = {
  token: TokenWithLines
  highlightClass: string
  opts: RenderOpts
}

export const MarkdownHeadingBlock = React.memo(function MarkdownHeadingBlock({
  token: t,
  highlightClass,
  opts,
}: MarkdownHeadingBlockProps) {
  const h = t as unknown as TokensHeading
  const depth = Math.min(6, Math.max(1, h.depth || 1))
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
  
  const cls = ['font-semibold mt-5 mb-2', size, opts.uiPanelTextFontClass, highlightClass].filter(Boolean).join(' ')
  const content = renderInlineTokens(h.tokens, { activeDocumentPath: opts.activeDocumentPath, uiPanelMonospaceTextClass: opts.uiPanelMonospaceTextClass })
  
  if (depth === 1) return <h1 className={cls}>{content}</h1>
  if (depth === 2) return <h2 className={cls}>{content}</h2>
  if (depth === 3) return <h3 className={cls}>{content}</h3>
  if (depth === 4) return <h4 className={cls}>{content}</h4>
  if (depth === 5) return <h5 className={cls}>{content}</h5>
  return <h6 className={cls}>{content}</h6>
})
