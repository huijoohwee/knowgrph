import type { CSSProperties } from 'react'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'

const MARKDOWN_LARGE_DOCUMENT_SOURCE_CHARS = 250_000
const MARKDOWN_LARGE_DOCUMENT_TOKEN_COUNT = 2_500
const MARKDOWN_LARGE_DOCUMENT_HEADING_COUNT = 120

export function deriveMarkdownPreviewDocumentMode(args: {
  sourceMarkdownText?: string
  tokens: TokenWithLines[]
}): {
  sourceMarkdownLength: number
  markdownLargeDocumentMode: boolean
} {
  const sourceMarkdownLength = typeof args.sourceMarkdownText === 'string' ? args.sourceMarkdownText.length : 0
  const headingTokenCount = args.tokens.reduce((count, token) => count + (token.type === 'heading' ? 1 : 0), 0)
  return {
    sourceMarkdownLength,
    markdownLargeDocumentMode:
      sourceMarkdownLength > MARKDOWN_LARGE_DOCUMENT_SOURCE_CHARS ||
      args.tokens.length > MARKDOWN_LARGE_DOCUMENT_TOKEN_COUNT ||
      headingTokenCount > MARKDOWN_LARGE_DOCUMENT_HEADING_COUNT,
  }
}

export function getMarkdownPreviewScrollStyle(
  scrollClass: string,
  stickyHeadingScrollPaddingTopPx: number,
): CSSProperties {
  const stickyPadding =
    stickyHeadingScrollPaddingTopPx > 0 ? { scrollPaddingTop: `${stickyHeadingScrollPaddingTopPx}px` } : null
  if (scrollClass === 'overflow-auto') {
    return {
      scrollbarGutter: 'stable',
      overflowY: 'auto',
      overflowX: 'hidden',
      ...(stickyPadding || {}),
    }
  }
  return {
    scrollbarGutter: 'stable',
    ...(stickyPadding || {}),
  }
}
