export const buildReplacementLinesFromDraftWithPrefixes = (args: {
  draft: string
  prefixes: string[] | null
  initialPresentText: string
  editDefaultLinePrefix?: string
  hasEditStripLinePrefix: boolean
}): string[] => {
  const replacementLines = String(args.draft || '').split(/\r?\n/)
  const prefixes = args.prefixes
  if (!args.hasEditStripLinePrefix || !prefixes) return replacementLines
  const quotePrefixPattern = /^\s*(?:>\s*)+$/
  const allQuotePrefixed = (() => {
    if (prefixes.length === 0) return false
    let hasQuotePrefix = false
    for (let i = 0; i < prefixes.length; i += 1) {
      const prefix = String(prefixes[i] || '')
      if (quotePrefixPattern.test(prefix)) {
        hasQuotePrefix = true
        continue
      }
      const line = String(replacementLines[i] || '')
      if (!prefix && !line.trim()) continue
      return false
    }
    return hasQuotePrefix
  })()
  const baselinePresentLines = String(args.initialPresentText || '').split(/\r?\n/)
  const normalizedReplacementLines = (
    allQuotePrefixed && replacementLines.length < prefixes.length
      ? [
          ...replacementLines,
          ...Array.from({ length: prefixes.length - replacementLines.length }, (_, i) => (
            baselinePresentLines[replacementLines.length + i] ?? ''
          )),
        ]
      : replacementLines
  )
  const defaultPrefix = args.editDefaultLinePrefix ?? prefixes.find(p => p) ?? ''
  return normalizedReplacementLines.map((line, i) => {
    const prefix = prefixes[i] ?? defaultPrefix
    if (!line.trim()) {
      if (/^\s*(?:>\s*)+$/.test(prefix) || /^\s*(?:>\s*)+$/.test(defaultPrefix)) {
        const p = prefix || defaultPrefix
        return p.trimEnd() || '>'
      }
      return ''
    }
    if (!prefix) return line
    if (line.startsWith(prefix)) return line
    const taskPrefixMatch = prefix.match(/^(\s*[-*+]\s+\[(?: |x|X)?\]\s+)$/)
    if (taskPrefixMatch) {
      const isBulletWithoutTask = /^\s*[-*+]\s+(?!\[(?: |x|X)?\]\s+)/.test(line)
      if (isBulletWithoutTask) {
        return line.replace(/^\s*([-*+])\s+/, `${taskPrefixMatch[1] || '- [ ] '}`)
      }
    }
    if (/^\s*#{1,6}\s+/.test(line)) return line
    if (/^\s*>\s?/.test(line)) return line
    if (/^\s*(?:[-*+]|\d+\.)\s+/.test(line)) return line
    return `${prefix}${line}`
  })
}

export const HTML_TO_MARKDOWN_UNIFIED_DEFAULTS = {
  fidelityLevel: 2,
  includeImages: true,
} as const
