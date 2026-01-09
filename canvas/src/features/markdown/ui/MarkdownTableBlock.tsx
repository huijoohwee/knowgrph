import React from 'react'
import type { TokensTable, Token } from './MarkdownTokens'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { renderInlineTokens } from './MarkdownInlineRenderer'
import type { RenderOpts } from './MarkdownRendererTypes'

type MarkdownTableBlockProps = {
  token: TokenWithLines
  highlightClass: string
  opts: RenderOpts
  highlightStyle?: React.CSSProperties
}

export const MarkdownTableBlock = React.memo(function MarkdownTableBlock({
  token: t,
  highlightClass,
  opts,
  highlightStyle,
}: MarkdownTableBlockProps) {
  const tbl = t as unknown as TokensTable
  return (
    <div
      className={[
        'mt-3 mb-3 overflow-auto rounded border border-gray-200',
        highlightClass,
      ].filter(Boolean).join(' ')}
      style={highlightStyle}
      data-start-line={t.startLine}
      data-end-line={t.endLine || t.startLine}
    >
      <table className={['min-w-full', opts.markdownPresentationMode ? 'text-sm' : 'text-xs'].join(' ')}>
        <thead className="bg-gray-50 text-gray-700">
          <tr>
            {tbl.header.map((cell, j) => (
              <th key={j} className="px-2 py-1 text-left font-semibold border-b border-gray-200 align-top">
                {renderInlineTokens(cell.tokens as unknown as Token[] | undefined, { activeDocumentPath: opts.activeDocumentPath, uiPanelMonospaceTextClass: opts.uiPanelMonospaceTextClass })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-gray-900">
          {tbl.rows.map((row, rIdx) => (
            <tr key={rIdx} className="odd:bg-white even:bg-gray-50">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-2 py-1 border-b border-gray-100 align-top">
                  {renderInlineTokens(cell.tokens as unknown as Token[] | undefined, { activeDocumentPath: opts.activeDocumentPath, uiPanelMonospaceTextClass: opts.uiPanelMonospaceTextClass })}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
})
