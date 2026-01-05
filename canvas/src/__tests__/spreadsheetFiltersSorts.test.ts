import {
  createInitialFilterState,
  addFilterGroupClause,
  removeFilterConditionClause,
} from '@/features/graph-data-table/graphDataTableFilters'
import {
  createInitialSortRules,
  addSortRuleFromColumns,
  updateSortRuleById,
  removeSortRuleById,
} from '@/features/graph-data-table/graphDataTableSorts'
import {
  applyGraphDataTableFilters,
  type GraphDataTableFilterClause,
  type GraphDataTableFilterCondition,
  type GraphDataTableFilterGroup,
  type GraphDataTableFilterMatch,
  type GraphDataTableSortRule,
  type UnifiedRow,
} from '@/features/graph-data-table/graphDataTable'

export function testSpreadsheetFiltersFallbackOnLastRemoval() {
  const state = createInitialFilterState()
  if (state.clauses.length !== 1) {
    throw new Error(`expected 1 initial clause, got ${state.clauses.length}`)
  }
  const only = state.clauses[0] as GraphDataTableFilterCondition
  const next = removeFilterConditionClause(state.clauses, only.id)
  if (next.length !== 1) {
    throw new Error(`expected 1 fallback clause after removal, got ${next.length}`)
  }
  const fallback = next[0] as GraphDataTableFilterCondition
  if (fallback.kind !== 'condition') {
    throw new Error('fallback clause should be a condition')
  }
  if (!fallback.id || fallback.id === only.id) {
    throw new Error('fallback clause id should be non-empty and different from removed id')
  }
  if (!fallback.key) {
    throw new Error('fallback clause should have a key')
  }
}

export function testSpreadsheetFiltersRemoveChildFromOnlyGroup() {
  const groupClauses = addFilterGroupClause([])
  if (groupClauses.length !== 1) {
    throw new Error(`expected 1 group clause, got ${groupClauses.length}`)
  }
  const group = groupClauses[0] as GraphDataTableFilterGroup
  if (group.kind !== 'group') {
    throw new Error('expected top-level group clause')
  }
  if (group.clauses.length !== 1) {
    throw new Error(`expected group to have 1 child, got ${group.clauses.length}`)
  }
  const child = group.clauses[0] as GraphDataTableFilterCondition
  const next = removeFilterConditionClause(groupClauses, child.id)
  if (next.length !== 1) {
    throw new Error(`expected fallback root clause after removing only child, got ${next.length}`)
  }
  const root = next[0] as GraphDataTableFilterClause
  if (root.kind !== 'condition') {
    throw new Error('expected fallback root clause to be a condition, not a group')
  }
}

export function testSpreadsheetSortsRemoveLastRuleKeepsFallback() {
  const initial = createInitialSortRules()
  if (initial.length !== 1) {
    throw new Error(`expected 1 initial sort rule, got ${initial.length}`)
  }
  const only = initial[0]
  const next = removeSortRuleById(initial, only.id)
  if (next.length !== 1) {
    throw new Error(`expected 1 fallback sort rule, got ${next.length}`)
  }
  const fallback = next[0]
  if (!fallback.id || fallback.id === only.id) {
    throw new Error('fallback sort rule id should be non-empty and different from removed id')
  }
  if (fallback.key !== 'id' || fallback.dir !== 'asc') {
    throw new Error('fallback sort rule should default to id asc')
  }
}

export function testSpreadsheetSortsDeduplicateSortKeysKeepsFirstRule() {
  const initial = createInitialSortRules()
  const extended: GraphDataTableSortRule[] = [
    initial[0],
    {
      id: `${initial[0].id}-dup`,
      key: initial[0].key,
      dir: initial[0].dir === 'asc' ? 'desc' : 'asc',
    },
  ]
  const patchedDir = extended[1].dir === 'asc' ? 'desc' : 'asc'
  const updated = updateSortRuleById(extended, extended[1].id, { dir: patchedDir })
  if (updated.length !== 1) {
    throw new Error(`expected duplicate sort keys to be deduplicated to 1 rule, got ${updated.length}`)
  }
  const [rule] = updated
  if (rule.id !== initial[0].id) {
    throw new Error('expected first sort rule id to be kept after deduplication')
  }
  if (rule.dir !== initial[0].dir) {
    throw new Error('expected first sort rule direction to be preserved when duplicates exist')
  }
}

export function testSpreadsheetSortsAddRuleSkipsExistingKeys() {
  const initial = createInitialSortRules()
  const next = addSortRuleFromColumns(initial)
  if (next.length !== 2) {
    throw new Error(`expected 2 sort rules after addSortRuleFromColumns, got ${next.length}`)
  }
  const keys = new Set(next.map(r => r.key))
  if (keys.size !== next.length) {
    throw new Error('expected sort rule keys to be unique after addSortRuleFromColumns')
  }
}

export function testSpreadsheetNumericFilterOperators() {
  const state = createInitialFilterState()
  const condition = state.clauses[0] as GraphDataTableFilterCondition
  const updatedGreater: GraphDataTableFilterCondition = {
    ...condition,
    operator: 'greater_than',
    value: '10',
  }
  const updatedLess: GraphDataTableFilterCondition = {
    ...condition,
    operator: 'less_than',
    value: '10',
  }
  if (updatedGreater.operator !== 'greater_than') {
    throw new Error('expected operator to be greater_than')
  }
  if (updatedLess.operator !== 'less_than') {
    throw new Error('expected operator to be less_than')
  }
  const match: GraphDataTableFilterMatch = 'all'
  const clauses: GraphDataTableFilterClause[] = [updatedGreater]
  const rows: UnifiedRow[] = [
    { kind: 'node', id: 'n1', label: 'A', type: 'T', properties: { score: 5 }, metadata: {} },
    { kind: 'node', id: 'n2', label: 'B', type: 'T', properties: { score: 15 }, metadata: {} },
  ]
  const filtered = applyGraphDataTableFilters(rows, match, clauses)
  if (!filtered.some(r => r.id === 'n2') || filtered.some(r => r.id === 'n1')) {
    throw new Error('numeric greater_than filter did not match expected rows')
  }
}
