import React from 'react'
import type { Tokens, Token } from 'marked'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { addLineRangesToTokens } from '@/features/markdown/ui/markdownPreviewLex'
import MarkdownTokenRenderer from './MarkdownTokenRenderer'
import type { RenderOpts } from './MarkdownRendererTypes'

type MarkdownBlockquoteBlockProps = {
  token: TokenWithLines
  highlightClass: string
  opts: RenderOpts
  baseTextClass: string
  commonBlockClass: string
}

export const MarkdownBlockquoteBlock = React.memo(function MarkdownBlockquoteBlock({
  token: t,
  highlightClass,
  opts,
  baseTextClass,
  commonBlockClass,
}: MarkdownBlockquoteBlockProps) {
  const bq = t as unknown as Tokens.Blockquote
  return (
    <blockquote
      className={[
        'mt-3 mb-3 pl-3 border-l-4 border-gray-200 text-gray-700',
        baseTextClass,
        commonBlockClass,
        highlightClass,
      ].filter(Boolean).join(' ')}
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
      />
    </blockquote>
  )
})
