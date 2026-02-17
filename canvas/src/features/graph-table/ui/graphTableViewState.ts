export type GraphTableRowHeightPreset = 'compact' | 'comfortable'

export type GraphTableFilterMatch = 'all' | 'any'

export type GraphTableFilterOperator = 'contains' | 'equals' | 'startsWith' | 'endsWith'

export type GraphTableFilterClause = {
  id: string
  columnId: string
  operator: GraphTableFilterOperator
  value: string
}

export type GraphTableSortDirection = 'asc' | 'desc'

export type GraphTableSortRule = {
  id: string
  columnId: string
  direction: GraphTableSortDirection
}

export type GraphTableColumnVisibilityById = Record<string, boolean>
export type GraphTableColumnWidthsPxById = Record<string, number>
export type GraphTableColumnOrderByTableId = Record<string, string[]>

export const makeGraphTableRuleId = (): string => {
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export const parseRowHeightPreset = (raw: unknown): GraphTableRowHeightPreset | null => {
  if (raw === 'compact') return 'compact'
  if (raw === 'comfortable') return 'comfortable'
  return null
}

export const parseFilterMatch = (raw: unknown): GraphTableFilterMatch | null => {
  if (raw === 'all') return 'all'
  if (raw === 'any') return 'any'
  return null
}

export const parseFilterClauses = (raw: unknown): GraphTableFilterClause[] | null => {
  if (!Array.isArray(raw)) return null
  const out: GraphTableFilterClause[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const anyItem = item as Record<string, unknown>
    const id = typeof anyItem.id === 'string' ? anyItem.id : ''
    const columnId = typeof anyItem.columnId === 'string' ? anyItem.columnId : ''
    const operator = anyItem.operator
    const value = typeof anyItem.value === 'string' ? anyItem.value : String(anyItem.value ?? '')
    const op: GraphTableFilterOperator =
      operator === 'equals' || operator === 'startsWith' || operator === 'endsWith' ? operator : 'contains'
    if (!id || !columnId) continue
    out.push({ id, columnId, operator: op, value })
  }
  return out
}

export const parseSortRules = (raw: unknown): GraphTableSortRule[] | null => {
  if (!Array.isArray(raw)) return null
  const out: GraphTableSortRule[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const anyItem = item as Record<string, unknown>
    const id = typeof anyItem.id === 'string' ? anyItem.id : ''
    const columnId = typeof anyItem.columnId === 'string' ? anyItem.columnId : ''
    const direction: GraphTableSortDirection = anyItem.direction === 'desc' ? 'desc' : 'asc'
    if (!id || !columnId) continue
    out.push({ id, columnId, direction })
  }
  return out
}

export const parseColumnVisibilityById = (raw: unknown): GraphTableColumnVisibilityById | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const anyRaw = raw as Record<string, unknown>
  const out: GraphTableColumnVisibilityById = {}
  for (const [k, v] of Object.entries(anyRaw)) {
    if (!k) continue
    if (typeof v !== 'boolean') continue
    out[k] = v
  }
  return out
}

export const parseColumnWidthsPxById = (raw: unknown): GraphTableColumnWidthsPxById | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const anyRaw = raw as Record<string, unknown>
  const out: GraphTableColumnWidthsPxById = {}
  for (const [k, v] of Object.entries(anyRaw)) {
    const n = typeof v === 'number' ? v : Number(v)
    if (!k || !Number.isFinite(n)) continue
    out[k] = Math.max(60, Math.min(720, Math.round(n)))
  }
  return out
}

export const parseColumnOrderByTableId = (raw: unknown): GraphTableColumnOrderByTableId | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const anyRaw = raw as Record<string, unknown>
  const out: GraphTableColumnOrderByTableId = {}
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
