import React from 'react'
import type { TokensBlockquote, Token } from './MarkdownTokens'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { addLineRangesToTokens } from '@/features/markdown/ui/markdownPreviewLex'
import MarkdownTokenRenderer from './MarkdownTokenRenderer'
import type { RenderOpts } from './MarkdownRendererTypes'
import { MarkdownBlockContainer } from './MarkdownBlockContainer'

type MarkdownBlockquoteBlockProps = {
  token: TokenWithLines
  highlightClass: string
  highlightStyle?: React.CSSProperties
  opts: RenderOpts
  baseTextClass: string
  commonBlockClass: string
  fragmentsEnabled?: boolean
  fragmentStep?: number
  fragmentClassNames?: string[]
  fragmentTags?: string[]
}

import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export const MarkdownBlockquoteBlock = React.memo(function MarkdownBlockquoteBlock({
  token: t,
  highlightClass,
  highlightStyle,
  opts,
  baseTextClass,
  commonBlockClass,
  fragmentsEnabled,
  fragmentStep,
  fragmentClassNames,
  fragmentTags,
}: MarkdownBlockquoteBlockProps) {
  const bq = t as unknown as TokensBlockquote
  return (
    <MarkdownBlockContainer
      as="blockquote"
      className={[
        `mt-4 mb-4 pl-4 py-2 border-l-4 border-blue-400 dark:border-blue-600 ${UI_THEME_TOKENS.table.rowRelated} rounded-r ${UI_THEME_TOKENS.text.secondary} italic`,
        baseTextClass,
        commonBlockClass,
      ].filter(Boolean).join(' ')}
      highlightClass={highlightClass}
      highlightStyle={highlightStyle}
      startLine={t.startLine}
      endLine={t.endLine}
    >
      <MarkdownTokenRenderer
        tokens={addLineRangesToTokens(bq.tokens as unknown as Token[], 0)}
        activeDocumentPath={opts.activeDocumentPath}
        highlightedLineRange={null}
        markdownWordWrap={opts.markdownWordWrap}
        markdownPresentationMode={opts.markdownPresentationMode}
        uiPanelTextFontClass={opts.uiPanelTextFontClass}
        uiPanelMonospaceTextClass={opts.uiPanelMonospaceTextClass}
        mermaidFrontmatterConfig={opts.mermaidFrontmatterConfig}
        rootThemeMode={opts.rootThemeMode}
        previewOverlayScope={opts.previewOverlayScope}
        previewOverlayPortalTarget={opts.previewOverlayPortalTarget}
        fragmentsEnabled={fragmentsEnabled}
        fragmentStep={fragmentStep}
        fragmentClassNames={fragmentClassNames}
        fragmentTags={fragmentTags}
      />
    </MarkdownBlockContainer>
  )
})
