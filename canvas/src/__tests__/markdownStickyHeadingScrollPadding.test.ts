import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { computeStickyHeadingScrollPaddingTopPx } from '@/features/markdown/ui/markdownSectionUtils'

export const testMarkdownStickyHeadingScrollPaddingComputesCascadeHeight = () => {
  const tokens = [
    { type: 'heading', depth: 3, startLine: 3, endLine: 3 } as unknown as TokenWithLines,
  ]
  const px = computeStickyHeadingScrollPaddingTopPx({ tokens, baseTopPx: 98, markdownPresentationMode: false })
  if (px !== 146) {
    throw new Error(`expected scroll padding 146px but got ${px}`)
  }
}

export const testMarkdownStickyHeadingScrollPaddingIsZeroWithoutHeadings = () => {
  const tokens: TokenWithLines[] = []
  const px = computeStickyHeadingScrollPaddingTopPx({ tokens, baseTopPx: 98, markdownPresentationMode: false })
  if (px !== 0) {
    throw new Error(`expected scroll padding 0px but got ${px}`)
  }
}

