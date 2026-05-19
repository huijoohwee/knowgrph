import { readMarkdownSigilDisplayText } from './markdownSigil'

export type MarkdownTextHighlightRange = {
  start: number
  end: number
  count: number
}

const MAX_SCAN_CHARS = 160_000
const MAX_MATCH_COUNT = 999

export const normalizeMarkdownTextHighlightNeedle = (raw: unknown): string => {
  const display = readMarkdownSigilDisplayText(String(raw || ''))
  return display.replace(/\s+/g, ' ').trim()
}

export const findMarkdownTextHighlightLineRange = (
  markdown: string,
  rawNeedle: unknown,
  maxScanChars = MAX_SCAN_CHARS,
): MarkdownTextHighlightRange | null => {
  const needle = normalizeMarkdownTextHighlightNeedle(rawNeedle)
  if (needle.length < 2) return null
  const sourceRaw = String(markdown || '')
  if (!sourceRaw.trim()) return null
  const scanLimit = Math.max(1000, Math.min(2_000_000, Math.floor(maxScanChars)))
  const source = sourceRaw.length > scanLimit ? sourceRaw.slice(0, scanLimit) : sourceRaw
  const lowerNeedle = needle.toLowerCase()
  const lines = source.split(/\r?\n/)
  let firstLine = 0
  let count = 0
  for (let i = 0; i < lines.length; i += 1) {
    const line = String(lines[i] || '')
    if (!line.toLowerCase().includes(lowerNeedle)) continue
    const oneBased = i + 1
    if (firstLine === 0) firstLine = oneBased
    count += 1
    if (count >= MAX_MATCH_COUNT) break
  }
  if (count === 0 || firstLine === 0) return null
  return { start: firstLine, end: firstLine, count }
}

export const countMarkdownTextHighlightLineMatches = (
  markdown: string,
  rawNeedle: unknown,
  maxScanChars = MAX_SCAN_CHARS,
): number => {
  return findMarkdownTextHighlightLineRange(markdown, rawNeedle, maxScanChars)?.count || 0
}
