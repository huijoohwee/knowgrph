export type DiagramSelectionRow = {
  key?: string
  lineIndex?: number
  lineNumber?: number
  kind?: string
  label?: string
  raw?: string
}

export const normalizeDiagramSelectionText = (value: unknown): string => {
  return String(value || '').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export const splitDiagramSelectionTokens = (value: string): string[] => {
  return String(value || '')
    .split(/[^A-Za-z0-9_.-]+/g)
    .map(token => token.trim())
    .filter(token => token.length >= 3)
}

export const readDiagramSelectionLabels = (row: DiagramSelectionRow | null | undefined): string[] => {
  if (!row) return []
  const out: string[] = []
  const push = (value: unknown) => {
    const text = String(value || '').trim()
    if (!text || out.includes(text)) return
    out.push(text)
  }
  push(row.label)
  push(row.raw)
  for (const token of splitDiagramSelectionTokens(String(row.label || ''))) push(token)
  for (const token of splitDiagramSelectionTokens(String(row.raw || ''))) push(token)
  return out
}

export const resolveDiagramRowKey = (row: DiagramSelectionRow | null | undefined, index = -1): string => {
  if (!row) return ''
  const explicit = String(row.key || '').trim()
  if (explicit) return explicit
  if (typeof row.lineIndex === 'number' && Number.isFinite(row.lineIndex)) return `line:${row.lineIndex}`
  return index >= 0 ? `row:${index}` : ''
}
