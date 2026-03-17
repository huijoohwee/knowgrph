import {
  GRAPH_DATA_TABLE_COLUMN_DEFS,
  type GraphDataTableColumnKey,
  type GraphDataTableSortDir,
  type GraphDataTableSortRule,
} from './graphDataTable'
import { createUniqueGraphDataTableId } from './graphDataTableIds'

const DEFAULT_SORT_ID_PREFIX = 's'
const DEFAULT_SORT_PRIMARY_COLUMN_KEY: GraphDataTableColumnKey = 'id'
const DEFAULT_SORT_DIR: GraphDataTableSortDir = 'asc'

export function createInitialSortRules(): GraphDataTableSortRule[] {
  const used = new Set<string>()
  const id = createUniqueGraphDataTableId(DEFAULT_SORT_ID_PREFIX, used)
  return [
    {
      id,
      key: DEFAULT_SORT_PRIMARY_COLUMN_KEY,
      dir: DEFAULT_SORT_DIR,
    },
  ]
}

export function requestSortByColumnRules(
  prevRules: ReadonlyArray<GraphDataTableSortRule>,
  key: GraphDataTableColumnKey,
  dir: GraphDataTableSortDir,
): GraphDataTableSortRule[] {
  const existing = prevRules.find(rule => rule.key === key)
  const used = new Set(prevRules.map(rule => rule.id))
  const id = existing?.id ?? createUniqueGraphDataTableId(DEFAULT_SORT_ID_PREFIX, used)
  const nextPrimary: GraphDataTableSortRule = { id, key, dir }
  const rest = prevRules.filter(rule => rule.key !== key)
  return [nextPrimary, ...rest]
}

export function addSortRuleFromColumns(
  prevRules: ReadonlyArray<GraphDataTableSortRule>,
): GraphDataTableSortRule[] {
  const usedRuleIds = new Set(prevRules.map(rule => rule.id))
  const usedKeys = new Set(prevRules.map(rule => rule.key))
  const fallbackKey = GRAPH_DATA_TABLE_COLUMN_DEFS[0]?.key ?? DEFAULT_SORT_PRIMARY_COLUMN_KEY
  const key = GRAPH_DATA_TABLE_COLUMN_DEFS.find(def => !usedKeys.has(def.key))?.key ?? fallbackKey
  const id = createUniqueGraphDataTableId(DEFAULT_SORT_ID_PREFIX, usedRuleIds)
  return [...prevRules, { id, key, dir: DEFAULT_SORT_DIR }]
}

export function updateSortRuleById(
  prevRules: ReadonlyArray<GraphDataTableSortRule>,
  id: string,
  patch: Partial<Omit<GraphDataTableSortRule, 'id'>>,
): GraphDataTableSortRule[] {
  const updated = prevRules.map(rule => (rule.id === id ? { ...rule, ...patch } : rule))
  const seen = new Set<GraphDataTableColumnKey>()
  return updated.filter(rule => {
    if (seen.has(rule.key)) return false
    seen.add(rule.key)
    return true
  })
}

export function resetSortRules(): GraphDataTableSortRule[] {
  return createInitialSortRules()
}

export function removeSortRuleById(
  prevRules: ReadonlyArray<GraphDataTableSortRule>,
  id: string,
): GraphDataTableSortRule[] {
  const next = prevRules.filter(rule => rule.id !== id)
  if (next.length > 0) return next
  const used = new Set<string>()
  const nextId = createUniqueGraphDataTableId(DEFAULT_SORT_ID_PREFIX, used)
  return [
    {
      id: nextId,
      key: DEFAULT_SORT_PRIMARY_COLUMN_KEY,
      dir: DEFAULT_SORT_DIR,
    },
  ]
}

