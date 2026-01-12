import MarkdownIt from 'markdown-it'
import markdownItFootnote from 'markdown-it-footnote'
import markdownItSub from 'markdown-it-sub'
import markdownItSup from 'markdown-it-sup'
import markdownItMark from 'markdown-it-mark'
import markdownItAnchor from 'markdown-it-anchor'
import { parseMarkdownFrontmatter, splitMarkdownLines, type MarkdownFrontmatter } from '@/lib/markdown'
import {
  MdToken,
  TokenWithLines,
  normalizeVClicksHtmlBlocks,
} from './markdownPreviewLexUtils'
import { buildBlockTokens } from './markdownPreviewLexBlock'

// Re-export TokenWithLines as it was originally exported from here
export type { TokenWithLines } from './markdownPreviewLexUtils'
export { addLineRangesToTokens } from './markdownPreviewLexUtils'

const md = new MarkdownIt({
  html: true,
  linkify: false,
  typographer: false,
  breaks: false,
})
  .use(markdownItFootnote)
  .use(markdownItSub)
  .use(markdownItSup)
  .use(markdownItMark)
  .use(markdownItAnchor, {
    permalink: false,
  })

export const lexMarkdown = (
  markdownText: string,
): { tokens: TokenWithLines[]; startLineOffset: number; meta: MarkdownFrontmatter } => {
  const lines = splitMarkdownLines(markdownText)
  const { startIndex, meta } = parseMarkdownFrontmatter(lines)
  const content = lines.slice(startIndex).join('\n')
  const { tokens } = lexMarkdownContent(content, startIndex)
  return { tokens, startLineOffset: startIndex, meta }
}

export const lexMarkdownContent = (
  markdownText: string,
  lineOffset: number,
): { tokens: TokenWithLines[] } => {
  const content = normalizeVClicksHtmlBlocks(String(markdownText || ''))
  const srcLines = splitMarkdownLines(content)
  const mdTokens = md.parse(content, {}) as unknown as MdToken[]
  const tokens = buildBlockTokens(mdTokens, lineOffset, srcLines)
  return { tokens }
}
