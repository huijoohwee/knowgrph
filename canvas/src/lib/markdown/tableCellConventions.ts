export const normalizeTableCellText = (raw: unknown): string => {
  const s = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) return ''
  const lower = s.toLowerCase()
  if (lower === 'tbd') return ''
  if (s === '—') return ''
  return s
}

export const parseBacktickJsonStringArray = (raw: unknown): string[] | null => {
  const s = String(raw ?? '').trim()
  const inner = s.startsWith('`') && s.endsWith('`') ? s.slice(1, -1).trim() : s
  if (!inner.startsWith('[') || !inner.endsWith(']')) return null
  try {
    const parsed = JSON.parse(inner) as unknown
    if (!Array.isArray(parsed)) return null
    const out: string[] = []
    for (const v of parsed) {
      const text = normalizeTableCellText(v)
      if (text) out.push(text)
    }
    return out
  } catch {
    return null
  }
}

export const toTableCellStringArray = (raw: unknown): string[] => {
  const parsed = parseBacktickJsonStringArray(raw)
  if (parsed) return parsed
  const scalar = normalizeTableCellText(raw)
  return scalar ? [scalar] : []
}
