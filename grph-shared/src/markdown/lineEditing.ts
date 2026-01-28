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

