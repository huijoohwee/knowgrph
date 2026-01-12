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
        'mt-3 mb-3 pl-3 border-l-4 border-gray-200 text-gray-700',
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
