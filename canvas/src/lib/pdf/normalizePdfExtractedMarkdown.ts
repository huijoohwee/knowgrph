const hasSpacedLetterRun = (line: string): boolean => {
  const s = String(line || '')
  if (!s) return false
  return /(?:^|[^A-Za-z0-9])[A-Za-z0-9](?:\s+[A-Za-z0-9]){3,}(?:$|[^A-Za-z0-9])/.test(s)
}

const normalizeGroup = (group: string): string => {
  const raw = String(group || '').trim()
  if (!raw) return ''
  const tokens = raw.split(/\s+/).filter(Boolean)
  if (tokens.length < 3) return tokens.join(' ')
  const singleCharCount = tokens.reduce((acc, t) => acc + (t.length === 1 ? 1 : 0), 0)
  const ratio = singleCharCount / tokens.length
  if (ratio < 0.7) return tokens.join(' ')
  return tokens.join('')
}

const normalizeSpacedLine = (line: string): string => {
  const raw = String(line || '')
  if (!hasSpacedLetterRun(raw)) return raw
  const trimmed = raw.trim()
  const groups = trimmed.split(/\s{2,}/g)
  const normalizedGroups = groups.map(normalizeGroup).filter(Boolean)
  return normalizedGroups.join(' ')
}

export function normalizePdfExtractedMarkdown(markdown: string): string {
  const raw = String(markdown || '')
  if (!raw) return ''
  if (!raw.includes(' ')) return raw
  const lines = raw.split(/\r?\n/)
  let changed = false
  const out = lines.map((line) => {
    const next = normalizeSpacedLine(line)
    if (next !== line) changed = true
    return next
  })
  return changed ? out.join('\n') : raw
}
