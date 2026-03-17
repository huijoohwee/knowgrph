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
