import { parseDataViewRowHeightPreset, type DataViewRowHeightPreset } from '@/lib/ui/dataViewDensity'

export type GraphDataTableRowHeightPreset = DataViewRowHeightPreset

export type GraphDataTableFilterMatch = 'all' | 'any'

export type GraphDataTableFilterOperator = 'contains' | 'equals' | 'startsWith' | 'endsWith'

export type GraphDataTableFilterClause = {
  id: string
  columnId: string
  operator: GraphDataTableFilterOperator
  value: string
}

export type GraphDataTableSortDirection = 'asc' | 'desc'

export type GraphDataTableSortRule = {
  id: string
  columnId: string
  direction: GraphDataTableSortDirection
}

export type GraphDataTableColumnVisibilityById = Record<string, boolean>
export type GraphDataTableColumnWidthsPxById = Record<string, number>
export type GraphDataTableColumnOrderByTableId = Record<string, string[]>

export const makeGraphDataTableRuleId = (): string => {
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export const parseRowHeightPreset = (raw: unknown): GraphDataTableRowHeightPreset | null => {
  return parseDataViewRowHeightPreset(raw)
}

export const parseFilterMatch = (raw: unknown): GraphDataTableFilterMatch | null => {
  if (raw === 'all') return 'all'
  if (raw === 'any') return 'any'
  return null
}

export const parseFilterClauses = (raw: unknown): GraphDataTableFilterClause[] | null => {
  if (!Array.isArray(raw)) return null
  const out: GraphDataTableFilterClause[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const anyItem = item as Record<string, unknown>
    const id = typeof anyItem.id === 'string' ? anyItem.id : ''
    const columnId = typeof anyItem.columnId === 'string' ? anyItem.columnId : ''
    const operator = anyItem.operator
    const value = typeof anyItem.value === 'string' ? anyItem.value : String(anyItem.value ?? '')
    const op: GraphDataTableFilterOperator =
      operator === 'equals' || operator === 'startsWith' || operator === 'endsWith' ? operator : 'contains'
    if (!id || !columnId) continue
    out.push({ id, columnId, operator: op, value })
  }
  return out
}

export const parseSortRules = (raw: unknown): GraphDataTableSortRule[] | null => {
  if (!Array.isArray(raw)) return null
  const out: GraphDataTableSortRule[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const anyItem = item as Record<string, unknown>
    const id = typeof anyItem.id === 'string' ? anyItem.id : ''
    const columnId = typeof anyItem.columnId === 'string' ? anyItem.columnId : ''
    const direction: GraphDataTableSortDirection = anyItem.direction === 'desc' ? 'desc' : 'asc'
    if (!id || !columnId) continue
    out.push({ id, columnId, direction })
  }
  return out
}

export const parseColumnVisibilityById = (raw: unknown): GraphDataTableColumnVisibilityById | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const anyRaw = raw as Record<string, unknown>
  const out: GraphDataTableColumnVisibilityById = {}
  for (const [k, v] of Object.entries(anyRaw)) {
    if (!k) continue
    if (typeof v !== 'boolean') continue
    out[k] = v
  }
  return out
}

export const parseColumnWidthsPxById = (raw: unknown): GraphDataTableColumnWidthsPxById | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const anyRaw = raw as Record<string, unknown>
  const out: GraphDataTableColumnWidthsPxById = {}
  for (const [k, v] of Object.entries(anyRaw)) {
    const n = typeof v === 'number' ? v : Number(v)
    if (!k || !Number.isFinite(n)) continue
    out[k] = Math.max(60, Math.min(720, Math.round(n)))
  }
  return out
}

export const parseColumnOrderByTableId = (raw: unknown): GraphDataTableColumnOrderByTableId | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const anyRaw = raw as Record<string, unknown>
  const out: GraphDataTableColumnOrderByTableId = {}
  for (const [tableId, value] of Object.entries(anyRaw)) {
    if (!tableId) continue
    if (!Array.isArray(value)) continue
    const ids: string[] = []
    for (const item of value) {
      const id = typeof item === 'string' ? item.trim() : ''
      if (!id) continue
      ids.push(id)
    }
    out[tableId] = ids
  }
  return out
}
