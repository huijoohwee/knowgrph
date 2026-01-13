import React from 'react'
import type { TokensFootnoteBlock } from './MarkdownTokens'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { renderInlineTokens } from './MarkdownInlineRenderer'
import type { RenderOpts } from './MarkdownRendererTypes'
import { MarkdownBlockContainer } from './MarkdownBlockContainer'

type MarkdownFootnoteBlockProps = {
  token: TokenWithLines
  highlightClass: string
  highlightStyle?: React.CSSProperties
  opts: RenderOpts
}

export const MarkdownFootnoteBlock = React.memo(function MarkdownFootnoteBlock({
  token: t,
  highlightClass,
  highlightStyle,
  opts,
}: MarkdownFootnoteBlockProps) {
  const fb = t as unknown as TokensFootnoteBlock
  const startLine = t.startLine
  const endLine = t.endLine || t.startLine

  return (
    <MarkdownBlockContainer
      as="aside"
      className={`mt-8 pt-4 border-t border-slate-200 text-sm text-slate-500 ${opts.uiPanelTextFontClass}`}
      highlightClass={highlightClass}
      highlightStyle={highlightStyle}
      startLine={startLine}
      endLine={endLine}
    >
      <ol className="list-decimal list-inside space-y-2">
        {fb.items.map((item, idx) => (
          <li key={idx} id={`fn${item.label}`} className="pl-2">
            <span className="inline-block">
              {renderInlineTokens(item.tokens, {
                activeDocumentPath: opts.activeDocumentPath,
                uiPanelMonospaceTextClass: opts.uiPanelMonospaceTextClass,
              })}
              <a
                href={`#fnref${item.label}`}
                className="ml-1 text-blue-600 hover:text-blue-800 no-underline"
                aria-label="Back to content"
              >
                ↩
              </a>
            </span>
          </li>
        ))}
      </ol>
    </MarkdownBlockContainer>
  )
})
