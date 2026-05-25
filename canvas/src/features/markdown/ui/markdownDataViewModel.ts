import type { TokensTable } from './MarkdownTokens'
import { normalizeTableCellText, parseBacktickJsonStringArray, toTableCellStringArray } from '@/lib/markdown/tableCellConventions'

export type MarkdownDataViewColumnKind = 'text' | 'select' | 'multi-select'

export type MarkdownDataViewColumn = {
  id: string
  name: string
  kind: MarkdownDataViewColumnKind
  options?: string[]
}

export type MarkdownDataViewRow = {
  id: string
  cells: string[]
}

export type MarkdownDataView = {
  columns: MarkdownDataViewColumn[]
  rows: MarkdownDataViewRow[]
  titleColumnId: string
  groupByColumnId: string | null
}

const normalizeCellText = (v: unknown): string => normalizeTableCellText(v)

const parseTrailingColumnIndex = (columnId: string): number | null => {
  const match = /^col_(\d+)$/.exec(String(columnId || '').trim())
  if (!match) return null
  const parsed = Number.parseInt(match[1] || '', 10)
  return Number.isFinite(parsed) ? parsed : null
}

const buildNextColumnId = (columns: readonly MarkdownDataViewColumn[]): string => {
  let maxIndex = -1
  for (const column of columns) {
    const parsed = parseTrailingColumnIndex(column.id)
    if (parsed == null) continue
    if (parsed > maxIndex) maxIndex = parsed
  }
  return `col_${maxIndex + 1}`
}

const buildUniqueColumnName = (columns: readonly MarkdownDataViewColumn[], preferredName: string): string => {
  const baseName = normalizeCellText(preferredName) || `Column ${columns.length + 1}`
  const taken = new Set(columns.map(column => normalizeCellText(column.name).toLowerCase()).filter(Boolean))
  if (!taken.has(baseName.toLowerCase())) return baseName
  let copyIndex = 2
  while (copyIndex < 10_000) {
    const candidate = `${baseName} ${copyIndex}`
    if (!taken.has(candidate.toLowerCase())) return candidate
    copyIndex += 1
  }
  return `${baseName} Copy`
}

const uniqueStrings = (vals: string[]): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of vals) {
    const s = normalizeCellText(v)
    if (!s) continue
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}

const recomputeColumnsForRows = (columns: MarkdownDataViewColumn[], rows: MarkdownDataViewRow[]): MarkdownDataViewColumn[] => {
  return columns.map((column, columnIndex) => {
    if (column.kind !== 'select' && column.kind !== 'multi-select') return column
    const allValues = rows.map(row => row.cells[columnIndex] ?? '')
    const options = column.kind === 'multi-select'
      ? uniqueStrings(allValues.flatMap(value => toTableCellStringArray(value)))
      : uniqueStrings(allValues)
    return { ...column, options: options.length ? options : column.options }
  })
}

const looksLikeStatusOptions = (options: string[]): boolean => {
  const tokens = new Set(['todo', 'doing', 'done', 'backlog', 'in progress', 'blocked', 'wip'])
  let hits = 0
  for (const o of options) {
    const s = String(o || '').trim().toLowerCase()
    if (!s) continue
    if (tokens.has(s)) hits += 1
  }
  return hits >= 1
}

const inferColumnKind = (args: {
  headerName: string
  values: string[]
  rowCount: number
}): { kind: MarkdownDataViewColumnKind; options?: string[] } => {
  const headerName = normalizeCellText(args.headerName)
  const values = args.values.map(normalizeCellText)
  const rowCount = Math.max(0, Math.floor(args.rowCount))

  const lowerHeader = headerName.toLowerCase()
  if (lowerHeader === 'status') {
    const options = uniqueStrings(values)
    const distinctCount = options.length
    const isEnum = distinctCount >= 1 && distinctCount <= 10 && distinctCount < rowCount
    const statusLike = looksLikeStatusOptions(options)
    if (statusLike || isEnum) return { kind: 'select', options }
    return { kind: 'text' }
  }
  if (lowerHeader === 'owner') {
    const options = uniqueStrings(values)
    const distinctCount = options.length
    const meanLen = distinctCount
      ? Math.round(options.reduce((acc, s) => acc + s.length, 0) / distinctCount)
      : 0
    const isEnum = rowCount >= 3 && distinctCount >= 1 && distinctCount <= 12 && distinctCount < rowCount && meanLen <= 18
    const statusLike = looksLikeStatusOptions(options)
    if (statusLike || isEnum) return { kind: 'select', options }
  }
  if (lowerHeader === 'priority') {
    const all = values.flatMap(v => toTableCellStringArray(v))
    const options = uniqueStrings(all)
    if (options.length > 0 && options.length <= 24) return { kind: 'multi-select', options }
    return { kind: 'multi-select' }
  }

  const hasJsonArrayMulti = values.some(v => {
    const parsed = parseBacktickJsonStringArray(v)
    return Array.isArray(parsed) && parsed.length >= 2
  })
  if (hasJsonArrayMulti) {
    const all = values.flatMap(v => toTableCellStringArray(v))
    const options = uniqueStrings(all)
    return options.length > 0 && options.length <= 32
      ? { kind: 'multi-select', options }
      : { kind: 'multi-select' }
  }

  const distinct = uniqueStrings(values)
  const distinctCount = distinct.length
  const meanLen = distinctCount
    ? Math.round(distinct.reduce((acc, s) => acc + s.length, 0) / distinctCount)
    : 0

  const looksLikeEnum = rowCount >= 3 && distinctCount >= 1 && distinctCount <= 10 && distinctCount < rowCount && meanLen <= 18
  if (looksLikeEnum) return { kind: 'select', options: distinct }
  return { kind: 'text' }
}

const pickGroupByColumnId = (cols: MarkdownDataViewColumn[]): string | null => {
  const statusByName = cols.find(c => c.kind === 'select' && c.name.trim().toLowerCase() === 'status')
  if (statusByName) return statusByName.id

  const statusTokens = new Set(['todo', 'doing', 'done', 'backlog', 'in progress'])
  const byTokens = cols.find(c =>
    c.kind === 'select' &&
    Array.isArray(c.options) &&
    c.options.some(o => statusTokens.has(String(o || '').trim().toLowerCase())),
  )
  if (byTokens) return byTokens.id

  const firstSelect = cols.find(c => c.kind === 'select')
  return firstSelect ? firstSelect.id : null
}

const pickTitleColumnId = (cols: MarkdownDataViewColumn[], groupByColumnId: string | null): string => {
  const preferred = cols.find(c => c.id !== groupByColumnId && c.kind === 'text')
  if (preferred) return preferred.id
  const any = cols.find(c => c.id !== groupByColumnId) || cols[0]
  return any?.id || 'col_0'
}

export const isMarkdownDataViewCandidate = (table: TokensTable): boolean => {
  const headerNames = Array.isArray(table.header) ? table.header.map(h => normalizeCellText(h.text)) : []
  const nonEmptyHeaders = headerNames.filter(Boolean)
  if (nonEmptyHeaders.length < 2) return false
  if (nonEmptyHeaders.length > 12) return false
  const rows = Array.isArray(table.rows) ? table.rows : []
  if (rows.length < 2) return false
  const hasStructuredHeader = nonEmptyHeaders.some(h => /^(status|priority|owner)$/i.test(h))
  return hasStructuredHeader
}

export const buildMarkdownDataViewFromTableToken = (table: TokensTable): MarkdownDataView | null => {
  const headerCells = Array.isArray(table.header) ? table.header : []
  const rowsCells = Array.isArray(table.rows) ? table.rows : []
  const colCount = Math.max(headerCells.length, ...rowsCells.map(r => r.length))
  if (!Number.isFinite(colCount) || colCount <= 0) return null

  const headerNames = Array.from({ length: colCount }).map((_, i) => normalizeCellText(headerCells[i]?.text ?? ''))
  const rows: MarkdownDataViewRow[] = rowsCells.map((r, rowIndex) => {
    const cells = Array.from({ length: colCount }).map((_, colIndex) => normalizeCellText(r[colIndex]?.text ?? ''))
    return { id: `row_${rowIndex}`, cells }
  })

  const columns: MarkdownDataViewColumn[] = headerNames.map((name, colIndex) => {
    const values = rows.map(r => r.cells[colIndex] ?? '')
    const inferred = inferColumnKind({ headerName: name, values, rowCount: rows.length })
    return {
      id: `col_${colIndex}`,
      name: name || `Column ${colIndex + 1}`,
      kind: inferred.kind,
      options: inferred.options,
    }
  })

  const groupByColumnId = pickGroupByColumnId(columns)
  const titleColumnId = pickTitleColumnId(columns, groupByColumnId)

  return { columns, rows, titleColumnId, groupByColumnId }
}

export const updateMarkdownDataViewCell = (args: {
  view: MarkdownDataView
  rowId: string
  columnId: string
  nextValue: string
}): MarkdownDataView => {
  const { view } = args
  const colIndex = view.columns.findIndex(c => c.id === args.columnId)
  if (colIndex < 0) return view

  const rows = view.rows.map(r => {
    if (r.id !== args.rowId) return r
    const cells = [...r.cells]
    cells[colIndex] = normalizeCellText(args.nextValue)
    return { ...r, cells }
  })
  return { ...view, columns: recomputeColumnsForRows(view.columns, rows), rows }
}

export const reorderMarkdownDataViewRows = (args: {
  view: MarkdownDataView
  orderedRowIds: readonly string[]
  rowPatch?: { rowId: string; columnId: string; nextValue: string }
}): MarkdownDataView => {
  const rowsById = new Map(args.view.rows.map(row => [row.id, row] as const))
  const nextRows: MarkdownDataViewRow[] = []
  const seen = new Set<string>()
  for (const rowId of args.orderedRowIds) {
    const row = rowsById.get(rowId)
    if (!row || seen.has(rowId)) continue
    seen.add(rowId)
    nextRows.push(row)
  }
  for (const row of args.view.rows) {
    if (seen.has(row.id)) continue
    nextRows.push(row)
  }

  let rows = nextRows
  if (args.rowPatch) {
    const colIndex = args.view.columns.findIndex(column => column.id === args.rowPatch?.columnId)
    if (colIndex >= 0) {
      rows = nextRows.map(row => {
        if (row.id !== args.rowPatch?.rowId) return row
        const cells = [...row.cells]
        cells[colIndex] = normalizeCellText(args.rowPatch.nextValue)
        return { ...row, cells }
      })
    }
  }

  return {
    ...args.view,
    columns: recomputeColumnsForRows(args.view.columns, rows),
    rows,
  }
}

export const appendMarkdownDataViewRow = (args: {
  view: MarkdownDataView
  seed?: Partial<Record<string, string>>
}): MarkdownDataView => {
  const rowIndex = args.view.rows.length
  const cells = args.view.columns.map(c => normalizeCellText(args.seed?.[c.id] ?? ''))
  const row: MarkdownDataViewRow = { id: `row_${rowIndex}`, cells }
  return { ...args.view, rows: [...args.view.rows, row] }
}

export const appendMarkdownDataViewColumn = (args: {
  view: MarkdownDataView
  name: string
  kind: MarkdownDataViewColumnKind
}): MarkdownDataView => {
  const id = buildNextColumnId(args.view.columns)
  const nextIndex = args.view.columns.length
  const name = buildUniqueColumnName(args.view.columns, args.name || `Column ${nextIndex + 1}`)
  const col: MarkdownDataViewColumn = { id, name, kind: args.kind }
  const columns = [...args.view.columns, col]
  const rows = args.view.rows.map(r => ({ ...r, cells: [...r.cells, ''] }))
  const titleColumnId = args.view.titleColumnId || (columns[0]?.id ?? id)
  return { ...args.view, columns, rows, titleColumnId }
}

export const renameMarkdownDataViewColumn = (args: {
  view: MarkdownDataView
  columnId: string
  nextName: string
}): MarkdownDataView => {
  const nextName = normalizeCellText(args.nextName)
  if (!nextName) return args.view
  const columnIndex = args.view.columns.findIndex(column => column.id === args.columnId)
  if (columnIndex < 0) return args.view
  const current = args.view.columns[columnIndex]
  if (current && normalizeCellText(current.name) === nextName) return args.view
  const columns = args.view.columns.map((column, index) => {
    if (index !== columnIndex) return column
    return { ...column, name: nextName }
  })
  return { ...args.view, columns }
}

export const duplicateMarkdownDataViewColumn = (args: {
  view: MarkdownDataView
  columnId: string
}): MarkdownDataView => {
  const sourceIndex = args.view.columns.findIndex(column => column.id === args.columnId)
  if (sourceIndex < 0) return args.view
  const sourceColumn = args.view.columns[sourceIndex]
  if (!sourceColumn) return args.view
  const nextColumn: MarkdownDataViewColumn = {
    ...sourceColumn,
    id: buildNextColumnId(args.view.columns),
    name: buildUniqueColumnName(args.view.columns, `${sourceColumn.name} Copy`),
    options: Array.isArray(sourceColumn.options) ? [...sourceColumn.options] : sourceColumn.options,
  }
  const columns = [
    ...args.view.columns.slice(0, sourceIndex + 1),
    nextColumn,
    ...args.view.columns.slice(sourceIndex + 1),
  ]
  const rows = args.view.rows.map(row => {
    const cells = [...row.cells]
    cells.splice(sourceIndex + 1, 0, row.cells[sourceIndex] ?? '')
    return { ...row, cells }
  })
  return {
    ...args.view,
    columns: recomputeColumnsForRows(columns, rows),
    rows,
  }
}

export const deleteMarkdownDataViewColumn = (args: {
  view: MarkdownDataView
  columnId: string
}): MarkdownDataView => {
  if (args.view.columns.length <= 1) return args.view
  const columnIndex = args.view.columns.findIndex(column => column.id === args.columnId)
  if (columnIndex < 0) return args.view
  const columns = args.view.columns.filter(column => column.id !== args.columnId)
  const rows = args.view.rows.map(row => {
    const cells = row.cells.filter((_, index) => index !== columnIndex)
    return { ...row, cells }
  })
  const recomputedColumns = recomputeColumnsForRows(columns, rows)
  const groupByColumnId =
    args.view.groupByColumnId === args.columnId
      ? pickGroupByColumnId(recomputedColumns)
      : args.view.groupByColumnId
  const titleColumnId =
    args.view.titleColumnId === args.columnId
      ? pickTitleColumnId(recomputedColumns, groupByColumnId)
      : args.view.titleColumnId
  return {
    ...args.view,
    columns: recomputedColumns,
    rows,
    titleColumnId,
    groupByColumnId,
  }
}
