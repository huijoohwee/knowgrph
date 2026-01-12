import React from 'react'
import type { TokensTable, Token } from './MarkdownTokens'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { renderInlineTokens } from './MarkdownInlineRenderer'
import type { RenderOpts } from './MarkdownRendererTypes'
import { MarkdownBlockContainer } from './MarkdownBlockContainer'

type MarkdownTableBlockProps = {
  token: TokenWithLines
  highlightClass: string
  opts: RenderOpts
  highlightStyle?: React.CSSProperties
  fragmentsEnabled?: boolean
  fragmentStep?: number
  fragmentClassNames?: string[]
  fragmentTags?: string[]
}

export const MarkdownTableBlock = React.memo(function MarkdownTableBlock({
  token: t,
  highlightClass,
  opts,
  highlightStyle,
  fragmentsEnabled = false,
  fragmentStep = 0,
  fragmentClassNames,
  fragmentTags,
}: MarkdownTableBlockProps) {
  const tbl = t as unknown as TokensTable
  const containerClassName = ['mt-3 mb-3 overflow-auto rounded border border-gray-200']
    .filter(Boolean)
    .join(' ')
  return (
    <MarkdownBlockContainer
      as="div"
      className={containerClassName}
      highlightClass={highlightClass}
      highlightStyle={highlightStyle}
      startLine={t.startLine}
      endLine={t.endLine}
    >
      <table className={['min-w-full', opts.markdownPresentationMode ? 'text-sm' : 'text-xs'].join(' ')}>
        <thead className="bg-gray-50 text-gray-700">
          <tr>
            {tbl.header.map((cell, j) => (
              <th key={j} className="px-2 py-1 text-left font-semibold border-b border-gray-200 align-top">
                {renderInlineTokens(cell.tokens as unknown as Token[] | undefined, {
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
                })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-gray-900">
          {tbl.rows.map((row, rIdx) => (
            <tr key={rIdx} className="odd:bg-white even:bg-gray-50">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-2 py-1 border-b border-gray-100 align-top">
                  {renderInlineTokens(cell.tokens as unknown as Token[] | undefined, {
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
                  })}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </MarkdownBlockContainer>
  )
})
