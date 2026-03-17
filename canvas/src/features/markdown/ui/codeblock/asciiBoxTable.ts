export type AsciiBoxTable = { header: string[] | null; rows: string[][] }

const BORDER_CHARS_RE = /^[\s┌┐└┘┬┴┼├┤│─╔╗╚╝╦╩╬║═+|:-]+$/

const rtrim = (s: string): string => s.replace(/\s+$/g, '')

const isBorderLine = (line: string): boolean => {
  const t = String(line || '')
  if (!t.trim()) return true
  if (!/[┌┐└┘┬┴┼├┤│─╔╗╚╝╦╩╬║═+|\-:]/.test(t)) return false
  return BORDER_CHARS_RE.test(t)
}

const pickSepChar = (text: string): '│' | '|' | null => {
  if (text.includes('│')) return '│'
  const hasPipe = /(^|[^`])\|/.test(text)
  return hasPipe ? '|' : null
}

export const parseAsciiBoxTable = (codeText: string): AsciiBoxTable | null => {
  const raw = String(codeText || '')
  if (!raw.trim()) return null
  const sep = pickSepChar(raw)
  if (!sep) return null

  const lines = raw
    .split(/\r?\n/)
    .map(rtrim)
    .filter(l => l.trim().length > 0)

  const contentCandidates = lines.filter(l => l.includes(sep) && !isBorderLine(l))
  if (!contentCandidates.length) return null

  const pick = contentCandidates.reduce((best, cur) => (cur.split(sep).length > best.split(sep).length ? cur : best), contentCandidates[0] || '')
  if (!pick) return null

  const sepIdx: number[] = []
  for (let i = 0; i < pick.length; i += 1) {
    if (pick[i] === sep) sepIdx.push(i)
  }
  if (sepIdx.length < 3) return null

  const extractCells = (line: string): string[] => {
    const out: string[] = []
    for (let i = 0; i < sepIdx.length - 1; i += 1) {
      const a = sepIdx[i] ?? 0
      const b = sepIdx[i + 1] ?? a
      const cell = line.slice(a + 1, b).trim()
      out.push(cell)
    }
    return out
  }

  type Mark = { kind: 'border' } | { kind: 'row'; cells: string[] }
  const marks: Mark[] = []
  for (const line of lines) {
    if (isBorderLine(line)) {
      marks.push({ kind: 'border' })
      continue
    }
    if (!line.includes(sep)) continue
    const cells = extractCells(line)
    if (cells.every(c => !c)) continue
    marks.push({ kind: 'row', cells })
  }

  const rowMarks = marks.filter(m => m.kind === 'row') as Array<{ kind: 'row'; cells: string[] }>
  if (!rowMarks.length) return null

  let header: string[] | null = null
  let body: string[][] = rowMarks.map(r => r.cells)
  if (rowMarks.length >= 2) {
    const firstRowIdx = marks.findIndex(m => m.kind === 'row')
    const secondRowIdx = marks.findIndex((m, i) => i > firstRowIdx && m.kind === 'row')
    if (firstRowIdx >= 0 && secondRowIdx >= 0) {
      const hasBorderBetween = marks.some((m, i) => i > firstRowIdx && i < secondRowIdx && m.kind === 'border')
      if (hasBorderBetween) {
        const first = marks[firstRowIdx] as { kind: 'row'; cells: string[] }
        header = first.cells
        body = rowMarks.slice(1).map(r => r.cells)
      }
    }
  }

  const width = Math.max(0, ...(body.length ? body.map(r => r.length) : [0]), ...(header ? [header.length] : [0]))
  if (width < 2) return null

  const normalizeRow = (r: string[]): string[] => {
    if (r.length === width) return r
    const out = r.slice(0, width)
    while (out.length < width) out.push('')
    return out
  }

  return {
    header: header ? normalizeRow(header) : null,
    rows: body.map(normalizeRow),
  }
}
