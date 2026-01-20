import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import { normalized as normalizeText } from '@/features/panels/utils/json'
import {
  getCodebasePathFromMetadata as getCodebasePathFromMetadataRaw,
  getDocumentPathFromMetadata as getDocumentPathFromMetadataRaw,
} from '@/lib/graph/documentMetadata'

export type GraphDataTableBaseColumnKey =
  | 'kind'
  | 'traversalStep'
  | 'id'
  | 'label'
  | 'type'
  | 'source'
  | 'target'
  | 'properties'
  | 'metadata'
  | 'codebasePath'
  | 'documentPath'

export type GraphDataTablePropertyScope = 'node' | 'edge'
export type GraphDataTablePropertyColumnKey = `prop:${GraphDataTablePropertyScope}:${string}`

export type GraphDataTableColumnKey = GraphDataTableBaseColumnKey | GraphDataTablePropertyColumnKey

export type GraphDataTableRowDensity = 'compact' | 'expanded'

export const GRAPH_DATA_TABLE_AGGREGATE_VIZ_MODES = ['none', 'radial', 'bars', 'sparkline'] as const
export type GraphDataTableAggregateVizMode = (typeof GRAPH_DATA_TABLE_AGGREGATE_VIZ_MODES)[number]

export function parseGraphDataTableAggregateVizMode(raw: unknown): GraphDataTableAggregateVizMode | null {
  if (raw === 'none') return 'none'
  if (raw === 'radial') return 'radial'
  if (raw === 'bars') return 'bars'
  if (raw === 'sparkline') return 'sparkline'
  return null
}

export type GraphDataTableAggregateNumericSummary = Readonly<{
  key: GraphDataTableColumnKey
  count: number
  sum: number
  min: number
  max: number
  avg: number
}>

export type GraphDataTableColumnVisibilityByKey = Record<GraphDataTableBaseColumnKey, boolean> &
  Partial<Record<GraphDataTablePropertyColumnKey, boolean>>

export type GraphDataTableListItem =
  | { kind: 'group'; id: string; label: string; rows: UnifiedRow[] }
  | {
      kind: 'aggregate'
      groupId: string
      count: number
      numericSummaries: GraphDataTableAggregateNumericSummary[]
    }
  | { kind: 'row'; row: UnifiedRow }

export const GRAPH_DATA_TABLE_COLUMN_DEFS: ReadonlyArray<{
  readonly key: GraphDataTableBaseColumnKey
  readonly label: string
  readonly isGroupable: boolean
}> = [
  { key: 'kind', label: 'Kind', isGroupable: true },
  { key: 'traversalStep', label: 'Step', isGroupable: false },
  { key: 'id', label: 'ID', isGroupable: false },
  { key: 'label', label: 'Label', isGroupable: true },
  { key: 'type', label: 'Type', isGroupable: true },
  { key: 'source', label: 'Source', isGroupable: true },
  { key: 'target', label: 'Target', isGroupable: true },
  { key: 'properties', label: 'Properties', isGroupable: false },
  { key: 'metadata', label: 'Metadata', isGroupable: false },
  { key: 'codebasePath', label: 'Codebase path', isGroupable: false },
  { key: 'documentPath', label: 'Document path', isGroupable: false },
] as const

export const GRAPH_DATA_TABLE_GROUP_KEYS: ReadonlyArray<GraphDataTableBaseColumnKey> = GRAPH_DATA_TABLE_COLUMN_DEFS.filter(
  d => d.isGroupable,
).map(d => d.key)

export function isGraphDataTableBaseColumnKey(key: string): key is GraphDataTableBaseColumnKey {
  return (
    key === 'kind' ||
    key === 'traversalStep' ||
    key === 'id' ||
    key === 'label' ||
    key === 'type' ||
    key === 'source' ||
    key === 'target' ||
    key === 'properties' ||
    key === 'metadata' ||
    key === 'codebasePath' ||
    key === 'documentPath'
  )
}

export function isGraphDataTablePropertyColumnKey(key: string): key is GraphDataTablePropertyColumnKey {
  if (!key.startsWith('prop:')) return false
  if (key.startsWith('prop:node:')) return key.slice('prop:node:'.length).trim().length > 0
  if (key.startsWith('prop:edge:')) return key.slice('prop:edge:'.length).trim().length > 0
  return false
}

export function isGraphDataTableColumnKey(key: string): key is GraphDataTableColumnKey {
  return isGraphDataTableBaseColumnKey(key) || isGraphDataTablePropertyColumnKey(key)
}

export function isGraphDataTableGroupableColumnKey(key: GraphDataTableColumnKey): boolean {
  if (isGraphDataTablePropertyColumnKey(key)) return true
  return GRAPH_DATA_TABLE_GROUP_KEYS.includes(key)
}

export function parseGraphDataTablePropertyColumnKey(
  key: GraphDataTablePropertyColumnKey,
): { scope: GraphDataTablePropertyScope; propertyKey: string } | null {
  if (key.startsWith('prop:node:')) return { scope: 'node', propertyKey: key.slice('prop:node:'.length) }
  if (key.startsWith('prop:edge:')) return { scope: 'edge', propertyKey: key.slice('prop:edge:'.length) }
  return null
}

export const buildDefaultVisibleColumns = (): GraphDataTableColumnVisibilityByKey =>
  GRAPH_DATA_TABLE_COLUMN_DEFS.reduce(
    (acc, d) => {
      acc[d.key] = true
      return acc
    },
    {} as Record<GraphDataTableBaseColumnKey, boolean>,
  )

export type UnifiedRow =
  | {
      kind: 'node'
      id: string
      label: string
      type: string
      properties: GraphNode['properties']
      metadata?: GraphNode['metadata']
      traversalStep?: number
    }
  | {
      kind: 'edge'
      id: string
      label: string
      source: string
      target: string
      properties: GraphEdge['properties']
      metadata?: GraphEdge['metadata']
      traversalStep?: number
    }

export function stringifyPreview(value: unknown): string {
  try {
    const maxLength = 360
    const s = JSON.stringify(value ?? {}, null, 2)
    if (!s) return ''
    if (s.length <= maxLength) return s
    const truncated = s.slice(0, maxLength)
    const lastNewline = truncated.lastIndexOf('\n')
    if (lastNewline > 40) {
      return `${truncated.slice(0, lastNewline)}…`
    }
    return `${truncated}…`
  } catch {
    return ''
  }
}

export function getCodebasePathFromMetadata(metadata: unknown): string {
  return getCodebasePathFromMetadataRaw(metadata) || ''
}

export function getDocumentPathFromMetadata(metadata: unknown): string {
  return getDocumentPathFromMetadataRaw(metadata) || ''
}

export function getRowFieldText(row: UnifiedRow, key: GraphDataTableColumnKey): string {
  if (key === 'kind') return row.kind
  if (key === 'traversalStep') {
    if (row.kind !== 'edge') return ''
    if (row.traversalStep == null) return ''
    return String(row.traversalStep)
  }
  if (key === 'id') return row.id
  if (key === 'label') return row.label
  if (key === 'type') return row.kind === 'node' ? row.type : ''
  if (key === 'source') return row.kind === 'edge' ? row.source : ''
  if (key === 'target') return row.kind === 'edge' ? row.target : ''
  if (key === 'properties') return stringifyPreview(row.properties)
  if (key === 'metadata') return stringifyPreview(row.metadata)
  if (key === 'codebasePath') return getCodebasePathFromMetadata(row.metadata as unknown)
  if (key === 'documentPath') return getDocumentPathFromMetadata(row.metadata as unknown)
  if (isGraphDataTablePropertyColumnKey(key)) {
    const parsed = parseGraphDataTablePropertyColumnKey(key)
    if (!parsed) return ''
    if (row.kind !== parsed.scope) return ''
    const raw = row.properties?.[parsed.propertyKey as keyof typeof row.properties]
    if (raw === null || raw === undefined) return ''
    if (Array.isArray(raw)) {
      const items = raw
        .map(value => {
          if (value === null || value === undefined) return ''
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return String(value)
          }
          return ''
        })
        .filter(Boolean)
      if (items.length === 0) return ''
      const unique: string[] = []
      const seen = new Set<string>()
      for (const value of items) {
        if (seen.has(value)) continue
        seen.add(value)
        unique.push(value)
      }
      return unique.join(' ')
    }
    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') return String(raw)
    return stringifyPreview(raw)
  }
  return ''
}

export type GraphDataTableFilterMatch = 'all' | 'any'

export type GraphDataTableFilterOperator =
  | 'contains'
  | 'does_not_contain'
  | 'equals'
  | 'not_equals'
  | 'starts_with'
  | 'ends_with'
  | 'is_empty'
  | 'is_not_empty'
  | 'greater_than'
  | 'greater_or_equal'
  | 'less_than'
  | 'less_or_equal'

export type GraphDataTableFilterCondition = Readonly<{
  kind: 'condition'
  id: string
  key: GraphDataTableColumnKey
  operator: GraphDataTableFilterOperator
  value: string
}>

export type GraphDataTableFilterGroup = Readonly<{
  kind: 'group'
  id: string
  match: GraphDataTableFilterMatch
  clauses: ReadonlyArray<GraphDataTableFilterClause>
}>

export type GraphDataTableFilterClause = GraphDataTableFilterCondition | GraphDataTableFilterGroup

export type GraphDataTableSortDir = 'asc' | 'desc'

export type GraphDataTableSortRule = Readonly<{
  id: string
  key: GraphDataTableColumnKey
  dir: GraphDataTableSortDir
}>

function isConditionActive(condition: GraphDataTableFilterCondition): boolean {
  if (condition.operator === 'is_empty' || condition.operator === 'is_not_empty') return true
  return String(condition.value || '').trim().length > 0
}

function doesRowMatchCondition(row: UnifiedRow, condition: GraphDataTableFilterCondition): boolean {
  const fieldText = normalizeText(getRowFieldText(row, condition.key))
  const compare = normalizeText(String(condition.value || '')).trim()

  let rawValue: unknown = undefined
  if (isGraphDataTablePropertyColumnKey(condition.key)) {
    const parsed = parseGraphDataTablePropertyColumnKey(condition.key)
    if (parsed && row.kind === parsed.scope) {
      rawValue = row.properties?.[parsed.propertyKey as keyof typeof row.properties]
    }
  }

  if (condition.operator === 'is_empty') {
    if (Array.isArray(rawValue)) return rawValue.length === 0
    return fieldText.trim() === ''
  }
  if (condition.operator === 'is_not_empty') {
    if (Array.isArray(rawValue)) return rawValue.length > 0
    return fieldText.trim() !== ''
  }
  if (!compare) return true

  if (
    condition.operator === 'greater_than' ||
    condition.operator === 'greater_or_equal' ||
    condition.operator === 'less_than' ||
    condition.operator === 'less_or_equal'
  ) {
    if (Array.isArray(rawValue)) {
      const numericValues = rawValue
        .map(value => Number(value))
        .filter(value => Number.isFinite(value))
      if (numericValues.length === 0) return false
      const compareNum = Number(compare)
      if (!Number.isFinite(compareNum)) return false
      if (condition.operator === 'greater_than') return numericValues.some(value => value > compareNum)
      if (condition.operator === 'greater_or_equal') return numericValues.some(value => value >= compareNum)
      if (condition.operator === 'less_than') return numericValues.some(value => value < compareNum)
      if (condition.operator === 'less_or_equal') return numericValues.some(value => value <= compareNum)
    } else {
      const fieldNum = Number(fieldText)
      const compareNum = Number(compare)
      if (!Number.isFinite(fieldNum) || !Number.isFinite(compareNum)) return false
      if (condition.operator === 'greater_than') return fieldNum > compareNum
      if (condition.operator === 'greater_or_equal') return fieldNum >= compareNum
      if (condition.operator === 'less_than') return fieldNum < compareNum
      if (condition.operator === 'less_or_equal') return fieldNum <= compareNum
    }
  }

  if (condition.operator === 'contains' || condition.operator === 'does_not_contain') {
    if (Array.isArray(rawValue)) {
      const values = rawValue
        .map(value => normalizeText(String(value ?? '')).trim())
        .filter(Boolean)
      if (values.length === 0) return condition.operator === 'does_not_contain'
      const anyMatch = values.some(value => value.includes(compare))
      return condition.operator === 'contains' ? anyMatch : !anyMatch
    }
    if (condition.operator === 'contains') return fieldText.includes(compare)
    return !fieldText.includes(compare)
  }

  if (
    condition.operator === 'equals' ||
    condition.operator === 'not_equals' ||
    condition.operator === 'starts_with' ||
    condition.operator === 'ends_with'
  ) {
    if (Array.isArray(rawValue)) {
      const values = rawValue
        .map(value => normalizeText(String(value ?? '')).trim())
        .filter(Boolean)
      if (values.length === 0) {
        if (condition.operator === 'equals') return false
        if (condition.operator === 'not_equals') return true
        if (condition.operator === 'starts_with') return false
        if (condition.operator === 'ends_with') return false
      }
      const predicate = (value: string): boolean => {
        if (condition.operator === 'equals') return value === compare
        if (condition.operator === 'not_equals') return value !== compare
        if (condition.operator === 'starts_with') return value.startsWith(compare)
        if (condition.operator === 'ends_with') return value.endsWith(compare)
        return false
      }
      const anyMatch = values.some(predicate)
      if (condition.operator === 'not_equals') return anyMatch ? false : true
      return anyMatch
    }

    if (condition.operator === 'equals') return fieldText === compare
    if (condition.operator === 'not_equals') return fieldText !== compare
    if (condition.operator === 'starts_with') return fieldText.startsWith(compare)
    if (condition.operator === 'ends_with') return fieldText.endsWith(compare)
  }

  return true
}

function isClauseActive(clause: GraphDataTableFilterClause): boolean {
  if (clause.kind === 'condition') return isConditionActive(clause)
  return clause.clauses.some(isClauseActive)
}

function doesRowMatchClause(row: UnifiedRow, clause: GraphDataTableFilterClause): boolean {
  if (clause.kind === 'condition') return doesRowMatchCondition(row, clause)
  const activeClauses = clause.clauses.filter(isClauseActive)
  if (activeClauses.length === 0) return true
  if (clause.match === 'any') return activeClauses.some(c => doesRowMatchClause(row, c))
  return activeClauses.every(c => doesRowMatchClause(row, c))
}

export function applyGraphDataTableFilters(
  rows: UnifiedRow[],
  match: GraphDataTableFilterMatch,
  clauses: ReadonlyArray<GraphDataTableFilterClause>,
): UnifiedRow[] {
  const active = clauses.filter(isClauseActive)
  if (active.length === 0) return rows

  return rows.filter(row => {
    if (match === 'any') return active.some(clause => doesRowMatchClause(row, clause))
    return active.every(clause => doesRowMatchClause(row, clause))
  })
}

export function filterRows(rows: UnifiedRow[], query: string, scope: 'all' | 'nodes' | 'edges'): UnifiedRow[] {
  const q = normalizeText(query).trim()
  const filteredByKind = scope === 'all' ? rows : rows.filter(r => r.kind === scope.slice(0, -1))
  if (!q) return filteredByKind
  return filteredByKind.filter(r => {
    const base =
      r.kind === 'node'
        ? `${r.kind} ${r.id} ${r.type} ${r.label} ${stringifyPreview(r.properties)} ${stringifyPreview(
            r.metadata,
          )} ${getCodebasePathFromMetadata(r.metadata as unknown)}`
        : `${r.kind} ${r.id} ${r.label} ${r.source} ${r.target} ${stringifyPreview(r.properties)} ${stringifyPreview(
            r.metadata,
          )} ${getCodebasePathFromMetadata(r.metadata as unknown)}`
    return normalizeText(base).includes(q)
  })
}

function computeNumericSummaryForGroup(
  rows: UnifiedRow[],
  keys: GraphDataTableColumnKey[],
): GraphDataTableAggregateNumericSummary[] {
  const summaries: GraphDataTableAggregateNumericSummary[] = []
  for (const key of keys) {
    const values: number[] = []
    for (const row of rows) {
      const text = getRowFieldText(row, key).trim()
      if (!text) continue
      const value = Number(text)
      if (!Number.isFinite(value)) continue
      values.push(value)
    }
    if (values.length === 0) continue
    let sum = 0
    let min = values[0]
    let max = values[0]
    for (const value of values) {
      sum += value
      if (value < min) min = value
      if (value > max) max = value
    }
    const count = values.length
    const avg = sum / count
    summaries.push({ key, count, sum, min, max, avg })
  }
  return summaries
}

export function buildGraphDataTableListItems(
  visibleRows: UnifiedRow[],
  groupKey: GraphDataTableColumnKey | '',
  aggregateKeys: GraphDataTableColumnKey[],
): GraphDataTableListItem[] {
  if (!groupKey) return visibleRows.map(r => ({ kind: 'row', row: r } as const))
  const grouped = visibleRows.reduce((acc, r) => {
    let groupValue = ''
    if (isGraphDataTablePropertyColumnKey(groupKey)) {
      const parsed = parseGraphDataTablePropertyColumnKey(groupKey)
      if (parsed && r.kind === parsed.scope) {
        const raw = r.properties?.[parsed.propertyKey as keyof typeof r.properties]
        if (Array.isArray(raw)) {
          const items = raw
            .map(value => {
              if (value === null || value === undefined) return ''
              if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                return String(value)
              }
              return ''
            })
            .filter(Boolean)
          if (items.length > 0) {
            const unique: string[] = []
            const seen = new Set<string>()
            for (const value of items) {
              if (seen.has(value)) continue
              seen.add(value)
              unique.push(value)
            }
            unique.sort((a, b) => a.localeCompare(b))
            groupValue = unique.join(', ')
          }
        }
      }
    }

    if (!groupValue) {
      groupValue = (getRowFieldText(r, groupKey) || '(empty)').trim()
    }
    if (!groupValue) groupValue = '(empty)'
    const next = acc.get(groupValue) ?? []
    next.push(r)
    acc.set(groupValue, next)
    return acc
  }, new Map<string, UnifiedRow[]>())
  return Array.from(grouped.entries()).flatMap(([groupValue, groupRows]) => {
    const numericSummaries = computeNumericSummaryForGroup(groupRows, aggregateKeys)
    return [
      { kind: 'group', id: groupValue, label: groupValue, rows: groupRows } as const,
      { kind: 'aggregate', groupId: groupValue, count: groupRows.length, numericSummaries } as const,
      ...groupRows.map(r => ({ kind: 'row', row: r } as const)),
    ]
  })
}

export {}
