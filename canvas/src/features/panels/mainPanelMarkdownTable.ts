const normalizeMarkdownCell = (raw: unknown): string => String(raw ?? '').replace(/\s+/g, ' ').trim()

export const splitMarkdownTableRow = (raw: string): string[] => {
  const s = String(raw || '').trim()
  if (!s || !s.includes('|')) return []
  const cells: string[] = []
  let current = ''
  let escaped = false
  const body = s.replace(/^\|/, '').replace(/\|$/, '')
  for (let idx = 0; idx < body.length; idx += 1) {
    const ch = body[idx] || ''
    if (escaped) {
      current += ch
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      continue
    }
    if (ch === '|') {
      cells.push(normalizeMarkdownCell(current))
      current = ''
      continue
    }
    current += ch
  }
  cells.push(normalizeMarkdownCell(current))
  return cells
}

const isMarkdownDivider = (line: string): boolean => {
  const normalized = String(line || '').trim()
  if (!normalized.includes('|')) return false
  return /^(\|?\s*:?-{3,}:?\s*)+\|?\s*$/.test(normalized)
}

export function parseMarkdownTableRows(markdown: string): Array<Record<string, string>> {
  const lines = String(markdown || '').split(/\r?\n/)
  for (let idx = 0; idx < lines.length - 1; idx += 1) {
    const header = splitMarkdownTableRow(lines[idx] || '').map(cell => cell.toLowerCase())
    if (header.length === 0 || !isMarkdownDivider(lines[idx + 1] || '')) continue
    const rows: Array<Record<string, string>> = []
    for (let rowIdx = idx + 2; rowIdx < lines.length; rowIdx += 1) {
      const line = lines[rowIdx] || ''
      if (!line.trim()) break
      if (!line.includes('|')) break
      const cells = splitMarkdownTableRow(line)
      const row: Record<string, string> = {}
      header.forEach((column, columnIdx) => {
        if (!column) return
        row[column] = normalizeMarkdownCell(cells[columnIdx])
      })
      rows.push(row)
    }
    return rows
  }
  return []
}
