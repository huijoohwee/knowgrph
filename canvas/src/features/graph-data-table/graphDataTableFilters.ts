import type {
  GraphDataTableColumnKey,
  GraphDataTableFilterClause,
  GraphDataTableFilterCondition,
  GraphDataTableFilterMatch,
} from './graphDataTable'
import { createUniqueGraphDataTableId } from './graphDataTableIds'

const DEFAULT_FILTER_ID_PREFIX = 'f'
const DEFAULT_FILTER_GROUP_ID_PREFIX = 'g'
const DEFAULT_FILTER_COLUMN_KEY: GraphDataTableColumnKey = 'label'
const DEFAULT_FILTER_OPERATOR: GraphDataTableFilterCondition['operator'] = 'contains'
const DEFAULT_ROOT_FILTER_MATCH: GraphDataTableFilterMatch = 'all'
const DEFAULT_GROUP_FILTER_MATCH: GraphDataTableFilterMatch = 'any'
const EMPTY_FILTER_VALUE = ''

export type GraphDataTableFilterState = {
  match: GraphDataTableFilterMatch
  clauses: GraphDataTableFilterClause[]
}

export function createInitialFilterState(): GraphDataTableFilterState {
  const used = new Set<string>()
  const initialCondition = buildDefaultFilterCondition(used, DEFAULT_FILTER_COLUMN_KEY)
  return {
    match: DEFAULT_ROOT_FILTER_MATCH,
    clauses: [initialCondition],
  }
}

export function collectFilterClauseIds(clauses: ReadonlyArray<GraphDataTableFilterClause>): Set<string> {
  const ids = new Set<string>()
  const walk = (clause: GraphDataTableFilterClause) => {
    ids.add(clause.id)
    if (clause.kind === 'group') clause.clauses.forEach(walk)
  }
  clauses.forEach(walk)
  return ids
}

export function buildDefaultFilterCondition(
  used: Set<string>,
  key: GraphDataTableColumnKey = DEFAULT_FILTER_COLUMN_KEY,
): GraphDataTableFilterCondition {
  const id = createUniqueGraphDataTableId(DEFAULT_FILTER_ID_PREFIX, used)
  used.add(id)
  return {
    kind: 'condition',
    id,
    key,
    operator: DEFAULT_FILTER_OPERATOR,
    value: EMPTY_FILTER_VALUE,
  }
}

export function appendFilterConditionClause(
  clauses: ReadonlyArray<GraphDataTableFilterClause>,
  key: GraphDataTableColumnKey,
): GraphDataTableFilterClause[] {
  const used = collectFilterClauseIds(clauses)
  const condition = buildDefaultFilterCondition(used, key)
  return [...clauses, condition]
}

export function addFilterGroupClause(
  clauses: ReadonlyArray<GraphDataTableFilterClause>,
): GraphDataTableFilterClause[] {
  const used = collectFilterClauseIds(clauses)
  const groupId = createUniqueGraphDataTableId(DEFAULT_FILTER_GROUP_ID_PREFIX, used)
  used.add(groupId)
  const child = buildDefaultFilterCondition(used, DEFAULT_FILTER_COLUMN_KEY)
  return [
    ...clauses,
    {
      kind: 'group',
      id: groupId,
      match: DEFAULT_GROUP_FILTER_MATCH,
      clauses: [child],
    },
  ]
}

export function addFilterConditionToGroupClause(
  clauses: ReadonlyArray<GraphDataTableFilterClause>,
  groupId: string,
): GraphDataTableFilterClause[] {
  const used = collectFilterClauseIds(clauses)
  const nextCondition = buildDefaultFilterCondition(used, DEFAULT_FILTER_COLUMN_KEY)
  const updateClause = (clause: GraphDataTableFilterClause): GraphDataTableFilterClause => {
    if (clause.kind !== 'group') return clause
    if (clause.id === groupId) return { ...clause, clauses: [...clause.clauses, nextCondition] }
    return { ...clause, clauses: clause.clauses.map(updateClause) }
  }
  return clauses.map(updateClause)
}

export function updateFilterConditionClause(
  clauses: ReadonlyArray<GraphDataTableFilterClause>,
  id: string,
  patch: Partial<Omit<GraphDataTableFilterCondition, 'id'>>,
): GraphDataTableFilterClause[] {
  const updateClause = (clause: GraphDataTableFilterClause): GraphDataTableFilterClause => {
    if (clause.kind === 'group') {
      return { ...clause, clauses: clause.clauses.map(updateClause) }
    }
    if (clause.id !== id) return clause
    const next: GraphDataTableFilterCondition = { ...clause, ...patch }
    if (next.operator === 'is_empty' || next.operator === 'is_not_empty') {
      return { ...next, value: EMPTY_FILTER_VALUE }
    }
    return next
  }
  return clauses.map(updateClause)
}

export function setFilterGroupMatchOnClauses(
  clauses: ReadonlyArray<GraphDataTableFilterClause>,
  groupId: string,
  match: GraphDataTableFilterMatch,
): GraphDataTableFilterClause[] {
  const updateClause = (clause: GraphDataTableFilterClause): GraphDataTableFilterClause => {
    if (clause.kind !== 'group') return clause
    if (clause.id === groupId) return { ...clause, match }
    return { ...clause, clauses: clause.clauses.map(updateClause) }
  }
  return clauses.map(updateClause)
}

export function removeFilterConditionClause(
  clauses: ReadonlyArray<GraphDataTableFilterClause>,
  id: string,
): GraphDataTableFilterClause[] {
  const removeFromClause = (clause: GraphDataTableFilterClause): GraphDataTableFilterClause | null => {
    if (clause.id === id) return null
    if (clause.kind === 'group') {
      const nextChildren = clause.clauses
        .map(removeFromClause)
        .filter((child): child is GraphDataTableFilterClause => child !== null)
      if (nextChildren.length === 0) return null
      return { ...clause, clauses: nextChildren }
    }
    return clause
  }
  const next = clauses.map(removeFromClause).filter((clause): clause is GraphDataTableFilterClause => clause !== null)
  if (next.length === 0) {
    const used = collectFilterClauseIds(clauses)
    return [buildDefaultFilterCondition(used, DEFAULT_FILTER_COLUMN_KEY)]
  }
  return next
}

