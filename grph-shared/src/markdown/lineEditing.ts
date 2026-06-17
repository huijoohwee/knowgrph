export function insertMarkdownLineAfter(args: {
  markdownText: string
  afterLine: number
  lineText?: string
}): string {
  const text = String(args.markdownText || '')
  const lines = text.split('\n')
  const afterLine = Math.max(0, Math.floor(args.afterLine || 0))
  const insertIndex = Math.max(0, Math.min(lines.length, afterLine))
  const newLine = typeof args.lineText === 'string' ? args.lineText : ''

  const next = [...lines]
  next.splice(insertIndex, 0, newLine)
  return next.join('\n')
}

export function replaceMarkdownLineRange(args: {
  markdownText: string
  startLine: number
  endLine: number
  replacementLines: string[]
}): string {
  const text = String(args.markdownText || '')
  const lines = text.split('\n')
  const startLine = Math.max(1, Math.floor(args.startLine || 1))
  const endLine = Math.max(startLine, Math.floor(args.endLine || startLine))

  const startIndex = startLine - 1
  const endIndexExclusive = Math.max(startIndex, Math.min(lines.length, endLine))
  const replacementLines = Array.isArray(args.replacementLines) ? args.replacementLines : []

  const next = [...lines]
  next.splice(startIndex, endIndexExclusive - startIndex, ...replacementLines)
  return next.join('\n')
}

export function duplicateMarkdownLineRange(args: {
  markdownText: string
  startLine: number
  endLine: number
  mapDuplicatedLines?: (lines: string[]) => string[]
}): {
  markdownText: string
  duplicatedStartLine: number
  duplicatedEndLine: number
} {
  const text = String(args.markdownText || '')
  const lines = text.split('\n')
  const startLine = Math.max(1, Math.floor(args.startLine || 1))
  const endLine = Math.max(startLine, Math.floor(args.endLine || startLine))
  const startIndex = Math.max(0, Math.min(lines.length, startLine - 1))
  const endIndexExclusive = Math.max(startIndex, Math.min(lines.length, endLine))
  let insertionIndex = endIndexExclusive
  while (insertionIndex < lines.length && !String(lines[insertionIndex] || '').trim()) insertionIndex += 1
  const duplicatedLines = lines.slice(startIndex, insertionIndex)
  const baseDuplicatedLines = duplicatedLines.length > 0 ? duplicatedLines : lines.slice(startIndex, endIndexExclusive)
  const withSeparator = (
    baseDuplicatedLines.length > 0
    && String(baseDuplicatedLines[baseDuplicatedLines.length - 1] || '').trim()
  )
    ? [...baseDuplicatedLines, '']
    : baseDuplicatedLines
  const mappedDuplicatedLines = typeof args.mapDuplicatedLines === 'function'
    ? args.mapDuplicatedLines([...withSeparator])
    : withSeparator
  const next = [...lines]
  next.splice(insertionIndex, 0, ...mappedDuplicatedLines)
  const firstNonBlankIndex = mappedDuplicatedLines.findIndex(line => String(line || '').trim())
  const duplicatedStartLine = insertionIndex + (firstNonBlankIndex >= 0 ? firstNonBlankIndex : 0) + 1
  let lastNonBlankIndex = -1
  for (let i = mappedDuplicatedLines.length - 1; i >= 0; i -= 1) {
    if (String(mappedDuplicatedLines[i] || '').trim()) {
      lastNonBlankIndex = i
      break
    }
  }
  const duplicatedEndLine = insertionIndex + (lastNonBlankIndex >= 0 ? lastNonBlankIndex + 1 : mappedDuplicatedLines.length)
  return {
    markdownText: next.join('\n'),
    duplicatedStartLine,
    duplicatedEndLine: Math.max(duplicatedStartLine, duplicatedEndLine),
  }
}
