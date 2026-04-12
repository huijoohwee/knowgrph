export type EditLineRange = { startLine: number; endLine: number }

export const QUOTE_LINE_RE = /^\s*>/
export const isQuoteLine = (line: string): boolean => QUOTE_LINE_RE.test(String(line || ''))

export const getStartLineFromEventTarget = (eventTarget: HTMLElement | null, fallbackStartLine: number): number => {
  try {
    const el = eventTarget?.closest('[data-start-line]') as HTMLElement | null
    if (!el) return fallbackStartLine
    const value = Number(el.getAttribute('data-start-line'))
    if (!Number.isFinite(value)) return fallbackStartLine
    return Math.max(1, Math.floor(value))
  } catch {
    return fallbackStartLine
  }
}

export const resolveContiguousQuoteLineRangeOnOpen = (args: {
  eventTarget: HTMLElement | null
  sourceLines: string[] | undefined
  fallbackStartLine: number
  minStartLine?: number
}): EditLineRange | null => {
  const lines = args.sourceLines
  if (!Array.isArray(lines) || lines.length === 0) return null
  const minStart = Math.max(1, Math.floor(args.minStartLine ?? 1))
  const fallbackStart = Math.max(minStart, Math.floor(args.fallbackStartLine))
  const clickedStart = Math.max(minStart, getStartLineFromEventTarget(args.eventTarget, fallbackStart))
  const startFrom = Math.max(minStart, Math.min(lines.length, clickedStart))
  const idx = startFrom - 1
  if (idx < 0 || idx >= lines.length) return null
  if (!isQuoteLine(lines[idx] || '')) {
    return { startLine: fallbackStart, endLine: fallbackStart }
  }

  let start = startFrom
  for (let i = idx - 1; i >= minStart - 1; i -= 1) {
    if (!isQuoteLine(lines[i] || '')) break
    start = i + 1
  }
  let end = startFrom
  for (let i = idx; i < lines.length; i += 1) {
    if (!isQuoteLine(lines[i] || '')) break
    end = i + 1
  }
  return { startLine: Math.max(minStart, start), endLine: Math.max(start, end) }
}

export const areReplacementLinesNoop = (args: {
  sourceLines: string[]
  startLine: number
  endLine: number
  replacementLines: string[]
}): boolean => {
  const normalizeQuotePrefixSpacingForNoop = (line: string): string => {
    const normalizedLine = String(line || '')
    const quotePrefixMatch = normalizedLine.match(/^(\s*(?:>\s*)+)/)
    if (!quotePrefixMatch) return normalizedLine
    const prefix = String(quotePrefixMatch[1] || '')
    const remainder = normalizedLine.slice(prefix.length)
    if (!remainder) return prefix.trimEnd()
    if (/^\s/.test(remainder)) return normalizedLine
    return `${prefix.trimEnd()} ${remainder}`
  }
  const currentLines = args.sourceLines.slice(
    Math.max(0, args.startLine - 1),
    Math.max(0, args.endLine),
  )
  if (currentLines.length !== args.replacementLines.length) return false
  for (let i = 0; i < currentLines.length; i += 1) {
    const currentLine = normalizeQuotePrefixSpacingForNoop(currentLines[i] || '')
    const replacementLine = normalizeQuotePrefixSpacingForNoop(args.replacementLines[i] || '')
    if (currentLine !== replacementLine) return false
  }
  return true
}
