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

import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

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
  const containerClassName = [`mt-4 mb-4 overflow-auto rounded-lg border ${UI_THEME_TOKENS.table.cellBorder} shadow-sm`]
    .filter(Boolean)
    .join(' ')
  return (
    <MarkdownBlockContainer
      as="figure"
      className={containerClassName}
      highlightClass={highlightClass}
      highlightStyle={highlightStyle}
      startLine={t.startLine}
      endLine={t.endLine}
    >
      <table className={['min-w-full', opts.markdownPresentationMode ? 'text-lg' : 'text-sm'].join(' ')}>
        <thead className={`${UI_THEME_TOKENS.table.headerBg} ${UI_THEME_TOKENS.table.text}`}>
          <tr>
            {tbl.header.map((cell, j) => (
              <th key={j} className={`px-4 py-2 text-left font-semibold border-b ${UI_THEME_TOKENS.table.cellBorder} align-top`}>
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
        <tbody className={UI_THEME_TOKENS.table.text}>
          {tbl.rows.map((row, rIdx) => (
            <tr key={rIdx} className={`odd:${UI_THEME_TOKENS.table.rowBg} even:${UI_THEME_TOKENS.table.rowBgAlt} ${UI_THEME_TOKENS.table.rowHoverAmber} transition-colors`}>
              {row.map((cell, cIdx) => (
                <td key={cIdx} className={`px-4 py-2 border-b ${UI_THEME_TOKENS.table.cellBorder} align-top`}>
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
