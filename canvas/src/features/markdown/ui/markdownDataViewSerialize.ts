import type { MarkdownDataView } from './markdownDataViewModel'

const escapeMarkdownTableCell = (raw: string): string => {
  const s = String(raw ?? '')
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const buildSeparatorCell = (name: string): string => {
  const trimmed = String(name || '').trim()
  if (!trimmed) return '---'
  if (trimmed.length <= 3) return '---'
  return '-'.repeat(Math.min(12, Math.max(3, trimmed.length)))
}

export type MarkdownPipeTableScalar = string | number | boolean | null | undefined
export type MarkdownPipeTableAlignment = 'left' | 'center' | 'right' | null | undefined

export type MarkdownPipeTableInput = {
  columns: readonly MarkdownPipeTableScalar[]
  rows: readonly (readonly MarkdownPipeTableScalar[])[]
  alignments?: readonly MarkdownPipeTableAlignment[]
}

/**
 * Canonical serializer for generated/persisted table artifacts.
 *
 * Keep HTML out of this boundary. Renderers may derive DOM tables from the
 * returned Markdown, while YAML frontmatter stores these lines as a block
 * scalar so the Markdown remains the single authored table authority.
 */
export const serializeMarkdownPipeTable = (input: MarkdownPipeTableInput): string[] => {
  const columns = Array.isArray(input.columns) ? input.columns.map(value => String(value ?? '')) : []
  const rows = Array.isArray(input.rows) ? input.rows : []
  if (columns.length < 1) return []

  const header = `| ${columns.map(escapeMarkdownTableCell).join(' | ')} |`
  const sep = `| ${columns.map((column, index) => {
    const base = buildSeparatorCell(column)
    const alignment = input.alignments?.[index]
    if (alignment === 'right') return `${base}:`
    if (alignment === 'center') return `:${base}:`
    return base
  }).join(' | ')} |`
  const body = rows.map(r => {
    const cells = columns.map((_, i) => escapeMarkdownTableCell(String(r[i] ?? '')))
    return `| ${cells.join(' | ')} |`
  })
  return [header, sep, ...body]
}

export const serializeMarkdownDataViewToTableLines = (view: MarkdownDataView): string[] =>
  serializeMarkdownPipeTable({
    columns: Array.isArray(view.columns) ? view.columns.map(column => column.name) : [],
    rows: Array.isArray(view.rows) ? view.rows.map(row => row.cells) : [],
  })

const splitMarkdownPipeRow = (line: string): string[] | null => {
  const trimmed = String(line || '').trim()
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null
  const body = trimmed.slice(1, -1)
  const cells: string[] = []
  let cell = ''
  let escaped = false
  for (const char of body) {
    if (escaped) {
      cell += char
      escaped = false
      continue
    }
    if (char === '\\') {
      cell += char
      escaped = true
      continue
    }
    if (char === '|') {
      cells.push(cell.trim())
      cell = ''
      continue
    }
    cell += char
  }
  cells.push(cell.trim())
  return cells
}

const isMarkdownPipeDelimiterRow = (line: string, expectedColumns: number): boolean => {
  const cells = splitMarkdownPipeRow(line)
  return !!cells
    && cells.length === expectedColumns
    && cells.every(cell => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, '')))
}

/** Detect a real GFM pipe table while ignoring fenced examples and prose pipes. */
export const containsMarkdownPipeTable = (value: unknown): boolean => {
  const lines = String(value ?? '').replace(/\r\n?/g, '\n').split('\n')
  let fence: '`' | '~' | null = null
  for (let index = 0; index < lines.length - 1; index += 1) {
    const line = lines[index] || ''
    const fenceMatch = line.trim().match(/^(`{3,}|~{3,})/)
    if (fenceMatch) {
      const marker = fenceMatch[1]?.startsWith('~') ? '~' : '`'
      fence = fence === marker ? null : (fence || marker)
      continue
    }
    if (fence) continue
    const headerCells = splitMarkdownPipeRow(line)
    if (!headerCells || headerCells.length < 1) continue
    if (isMarkdownPipeDelimiterRow(lines[index + 1] || '', headerCells.length)) return true
  }
  return false
}
