import { marked, type Token } from 'marked'
import { parseMarkdownFrontmatter, splitMarkdownLines, type MarkdownFrontmatter } from '@/lib/markdown'

export type TokenWithLines = Token & {
  startLine: number
  endLine: number
}

const countLines = (raw: string): number => {
  if (!raw) return 0
  let count = 1
  for (let i = 0; i < raw.length; i += 1) {
    if (raw.charCodeAt(i) === 10) count += 1
  }
  return count
}

export const addLineRangesToTokens = (tokens: Token[], lineOffset: number): TokenWithLines[] => {
  const out: TokenWithLines[] = []
  let cursorLine = 1
  for (const t of tokens) {
    const raw = String((t as unknown as { raw?: unknown }).raw || '')
    const startLine = cursorLine + lineOffset
    const lineCount = countLines(raw)
    const endLine = Math.max(startLine, startLine + Math.max(0, lineCount - 1))
    out.push(Object.assign({}, t, { startLine, endLine }) as TokenWithLines)
    cursorLine += Math.max(0, lineCount - 1)
  }
  return out
}

const scoreBlockTokens = (tokens: Token[]): number => {
  let score = 0
  for (const t of tokens) {
    const ty = String((t as unknown as { type?: unknown }).type || '')
    if (!ty || ty === 'space') continue
    score += 1
    if (ty === 'table' || ty === 'list' || ty === 'heading' || ty === 'blockquote' || ty === 'code') score += 3
    if (ty === 'hr') score += 1
  }
  return score
}

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
  const content = String(markdownText || '')
  const gfmTokens = marked.lexer(content, { gfm: true, breaks: false }) as unknown as Token[]
  const commonTokens = marked.lexer(content, { gfm: false, breaks: false }) as unknown as Token[]
  const chosen = scoreBlockTokens(gfmTokens) >= scoreBlockTokens(commonTokens) ? gfmTokens : commonTokens
  return { tokens: addLineRangesToTokens(chosen, lineOffset) }
}
