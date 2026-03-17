import type { MarkdownDataView } from './markdownDataViewModel'

const escapeMarkdownTableCell = (raw: string): string => {
  const s = String(raw ?? '')
  return s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim()
}

const buildSeparatorCell = (name: string): string => {
  const trimmed = String(name || '').trim()
  if (!trimmed) return '---'
  if (trimmed.length <= 3) return '---'
  return '-'.repeat(Math.min(12, Math.max(3, trimmed.length)))
}

export const serializeMarkdownDataViewToTableLines = (view: MarkdownDataView): string[] => {
  const columns = Array.isArray(view.columns) ? view.columns : []
  const rows = Array.isArray(view.rows) ? view.rows : []
  if (columns.length < 1) return []

  const header = `| ${columns.map(c => escapeMarkdownTableCell(c.name)).join(' | ')} |`
  const sep = `| ${columns.map(c => buildSeparatorCell(c.name)).join(' | ')} |`
  const body = rows.map(r => {
    const cells = columns.map((_, i) => escapeMarkdownTableCell(r.cells[i] ?? ''))
    return `| ${cells.join(' | ')} |`
  })
  return [header, sep, ...body]
}

