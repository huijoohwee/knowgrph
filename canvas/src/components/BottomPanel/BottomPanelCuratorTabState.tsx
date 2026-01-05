import React from 'react'
import type { GraphData, GraphNode, GraphEdge, SelectionAnchorIds } from '@/lib/graph/types'
import {
  GRAPH_DATA_TABLE_COLUMN_DEFS,
  applyGraphDataTableFilters,
  buildDefaultVisibleColumns,
  buildGraphDataTableListItems,
  filterRows,
  getRowFieldText,
  isGraphDataTablePropertyColumnKey,
  parseGraphDataTablePropertyColumnKey,
  type GraphDataTableColumnKey,
  type GraphDataTableColumnVisibilityByKey,
  type GraphDataTableFilterClause,
  type GraphDataTableFilterMatch,
  type GraphDataTableListItem,
  type GraphDataTableSortRule,
  type UnifiedRow,
} from '@/features/graph-data-table/graphDataTable'
import {
  computeDerivedFields,
  getAgenticRagFieldKind,
  normalizeSettingsForField,
  type GraphField,
  type GraphFieldId,
  type GraphFieldSettingsResolved,
  type GraphFieldSettingsById,
} from '@/features/graph-fields/graphFields'
import { normalized as normalizeText } from '@/features/panels/utils/json'
import {
  computeNumericSampleStatsForField,
  type GraphDataTableScope,
  type NumericSampleStats,
} from './BottomPanelCuratorModels'
import { buildSelectionSubgraphForAnchorIds } from '@/lib/graph/file'
import { normalizeSelectionIds } from '@/components/GraphCanvas/highlight'
import type { TraversalSummary } from '@/features/panels/utils/orchestratorTraversal'

interface UseBottomPanelCuratorVisibleRowsParams {
  nodes: GraphNode[]
  edges: GraphEdge[]
  query: string
  graphDataTableScope: GraphDataTableScope
  graphDataTableFilterMatch: GraphDataTableFilterMatch
  graphDataTableFilterClauses: ReadonlyArray<GraphDataTableFilterClause>
  graphDataTableViewMode: 'allRows' | 'selectionNeighborhood' | 'traversalSequence'
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  isGraphDataTableAutoSortEnabled: boolean
  graphDataTableSortRules: ReadonlyArray<GraphDataTableSortRule>
  lastTraversalSummary: TraversalSummary | null
}

function applySelectionNeighborhoodFilter(
  filteredRows: UnifiedRow[],
  graphDataTableViewMode: 'allRows' | 'selectionNeighborhood' | 'traversalSequence',
  nodes: GraphNode[],
  edges: GraphEdge[],
  selectedNodeId: string | null,
  selectedEdgeId: string | null,
  selectedNodeIds: string[],
  selectedEdgeIds: string[],
): UnifiedRow[] {
  if (graphDataTableViewMode !== 'selectionNeighborhood') return filteredRows
  if (!selectedNodeId && !selectedEdgeId && selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) {
    return filteredRows
  }

  const data: GraphData = { type: 'Graph', nodes, edges }

  const selectionAnchorIds: SelectionAnchorIds = normalizeSelectionIds({
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
  })

  const selectionSubgraph = buildSelectionSubgraphForAnchorIds(data, selectionAnchorIds)
  if (!selectionSubgraph) return filteredRows

  const nodeIdSet = new Set<string>(selectionSubgraph.nodes.map(n => String(n.id)))
  const edgeIdSet = new Set<string>(selectionSubgraph.edges.map(e => String(e.id)))

  return filteredRows.filter(row => {
    if (row.kind === 'node') return nodeIdSet.has(row.id)
    if (row.kind === 'edge') return edgeIdSet.has(row.id)
    return false
  })
}

function applyTraversalSequenceFilter(
  baseRows: UnifiedRow[],
  filteredRows: UnifiedRow[],
  graphDataTableViewMode: 'allRows' | 'selectionNeighborhood' | 'traversalSequence',
  edges: GraphEdge[],
  lastTraversalSummary: TraversalSummary | null,
  graphDataTableSortRules: ReadonlyArray<GraphDataTableSortRule>,
): UnifiedRow[] {
  if (
    graphDataTableViewMode !== 'traversalSequence' ||
    !lastTraversalSummary ||
    !Array.isArray(lastTraversalSummary.edgeIds) ||
    lastTraversalSummary.edgeIds.length === 0
  ) {
    return baseRows
  }

  if (graphDataTableSortRules.length > 0) return baseRows

  const traversalEdgeIdSet = new Set<string>(lastTraversalSummary.edgeIds.map(id => String(id)))
  const traversalNodeIdSet = new Set<string>()

  for (const edge of edges) {
    const id = String(edge.id)
    if (!traversalEdgeIdSet.has(id)) continue
    traversalNodeIdSet.add(String(edge.source))
    traversalNodeIdSet.add(String(edge.target))
  }

  const nodeRows = filteredRows.filter(
    row => row.kind === 'node' && traversalNodeIdSet.has(row.id),
  )

  const edgeRows = filteredRows
    .filter(row => row.kind === 'edge' && traversalEdgeIdSet.has(row.id))
    .sort((a, b) => {
      const aStep = a.traversalStep ?? Number.MAX_SAFE_INTEGER
      const bStep = b.traversalStep ?? Number.MAX_SAFE_INTEGER
      if (aStep !== bStep) return aStep - bStep
      const aId = a.id || ''
      const bId = b.id || ''
      if (aId < bId) return -1
      if (aId > bId) return 1
      return 0
    })

  return [...nodeRows, ...edgeRows]
}

export function useBottomPanelCuratorVisibleRows({
  nodes,
  edges,
  query,
  graphDataTableScope,
  graphDataTableFilterMatch,
  graphDataTableFilterClauses,
  graphDataTableViewMode,
  selectedNodeId,
  selectedEdgeId,
  selectedNodeIds,
  selectedEdgeIds,
  isGraphDataTableAutoSortEnabled,
  graphDataTableSortRules,
  lastTraversalSummary,
}: UseBottomPanelCuratorVisibleRowsParams): UnifiedRow[] {
  const rows = React.useMemo<UnifiedRow[]>(() => {
    const traversalEdgeStepMap = (() => {
      if (!lastTraversalSummary || !Array.isArray(lastTraversalSummary.edgeIds)) return null
      const map = new Map<string, number>()
      lastTraversalSummary.edgeIds.forEach((edgeId, index) => {
        const id = String(edgeId)
        if (!id) return
        if (map.has(id)) return
        map.set(id, index + 1)
      })
      return map
    })()

    const nodeRows: UnifiedRow[] = nodes.map(n => ({
      kind: 'node',
      id: n.id,
      label: n.label,
      type: n.type,
      properties: n.properties,
      metadata: n.metadata,
    }))
    const edgeRows: UnifiedRow[] = edges.map(e => {
      const traversalStep =
        traversalEdgeStepMap && traversalEdgeStepMap.size > 0
          ? traversalEdgeStepMap.get(String(e.id))
          : undefined
      return {
        kind: 'edge',
        id: e.id,
        label: e.label,
        source: e.source,
        target: e.target,
        properties: e.properties,
        metadata: e.metadata,
        traversalStep,
      }
    })
    return [...nodeRows, ...edgeRows]
  }, [edges, lastTraversalSummary, nodes])

  const visibleRows = React.useMemo(() => {
    const queryFilteredRows = filterRows(rows, query, graphDataTableScope)
    const filteredRows = applyGraphDataTableFilters(
      queryFilteredRows,
      graphDataTableFilterMatch,
      graphDataTableFilterClauses,
    )

    let baseRows = applySelectionNeighborhoodFilter(
      filteredRows,
      graphDataTableViewMode,
      nodes,
      edges,
      selectedNodeId,
      selectedEdgeId,
      selectedNodeIds,
      selectedEdgeIds,
    )

    baseRows = applyTraversalSequenceFilter(
      baseRows,
      filteredRows,
      graphDataTableViewMode,
      edges,
      lastTraversalSummary,
      graphDataTableSortRules,
    )

    if (!isGraphDataTableAutoSortEnabled || graphDataTableSortRules.length === 0) return baseRows

    const rules = graphDataTableSortRules
    return [...baseRows].sort((a, b) => {
      for (const rule of rules) {
        const dir = rule.dir === 'desc' ? -1 : 1
        const av = getRowFieldText(a, rule.key)
        const bv = getRowFieldText(b, rule.key)
        const cmp = av.localeCompare(bv) * dir
        if (cmp !== 0) return cmp
      }
      return 0
    })
  }, [
    edges,
    graphDataTableFilterClauses,
    graphDataTableFilterMatch,
    graphDataTableScope,
    graphDataTableSortRules,
    graphDataTableViewMode,
    isGraphDataTableAutoSortEnabled,
    lastTraversalSummary,
    nodes,
    query,
    rows,
    selectedEdgeId,
    selectedNodeId,
    selectedEdgeIds,
    selectedNodeIds,
  ])

  return visibleRows
}

interface UseBottomPanelCuratorFieldAggregatesParams {
  nodes: GraphNode[]
  edges: GraphEdge[]
  graphDataRevision: number
  graphDataTablePanel: string
  graphDataTableAggregateKeys: GraphDataTableColumnKey[]
  graphDataTableGroupKey: GraphDataTableColumnKey | ''
  graphFieldSettingsById: GraphFieldSettingsById
  numericSampleLimit: number
  numericSampleMinCount: number
  numericSampleMinRatio: number
  includeMixedNumericFields: boolean
  includeIdAsNumeric: boolean
  includeSourceAsNumeric: boolean
  includeTargetAsNumeric: boolean
  graphDataTableViewMode: 'allRows' | 'selectionNeighborhood' | 'traversalSequence'
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  setGraphDataTableAggregateKeysState: (
    updater: GraphDataTableColumnKey[] | ((prev: GraphDataTableColumnKey[]) => GraphDataTableColumnKey[]),
  ) => void
}

interface BottomPanelCuratorFieldAggregatesResult {
  derivedGraphFields: ReadonlyArray<GraphField>
  propertyColumnKeysFromGraphFields: ReadonlyArray<GraphDataTableColumnKey>
  aggregatePanelColumnKeys: ReadonlyArray<GraphDataTableColumnKey>
}

export function useBottomPanelCuratorFieldAggregates({
  nodes,
  edges,
  graphDataRevision,
  graphDataTablePanel,
  graphDataTableAggregateKeys,
  graphDataTableGroupKey,
  graphFieldSettingsById,
  numericSampleLimit,
  numericSampleMinCount,
  numericSampleMinRatio,
  includeMixedNumericFields,
  includeIdAsNumeric,
  includeSourceAsNumeric,
  includeTargetAsNumeric,
  graphDataTableViewMode,
  selectedNodeId,
  selectedEdgeId,
  selectedNodeIds,
  selectedEdgeIds,
  setGraphDataTableAggregateKeysState,
}: UseBottomPanelCuratorFieldAggregatesParams): BottomPanelCuratorFieldAggregatesResult {
  const { sampleNodes, sampleEdges } = React.useMemo(() => {
    if (
      graphDataTableViewMode === 'selectionNeighborhood' &&
      (selectedNodeId ||
        selectedEdgeId ||
        (selectedNodeIds && selectedNodeIds.length > 0) ||
        (selectedEdgeIds && selectedEdgeIds.length > 0))
    ) {
      const data: GraphData = { type: 'Graph', nodes, edges }
      const selectionAnchorIds: SelectionAnchorIds = normalizeSelectionIds({
        selectedNodeId,
        selectedEdgeId,
        selectedNodeIds,
        selectedEdgeIds,
      })
      const selectionSubgraph = buildSelectionSubgraphForAnchorIds(data, selectionAnchorIds)
      if (selectionSubgraph) {
        return {
          sampleNodes: selectionSubgraph.nodes,
          sampleEdges: selectionSubgraph.edges,
        }
      }
    }
    return {
      sampleNodes: nodes,
      sampleEdges: edges,
    }
  }, [edges, graphDataTableViewMode, nodes, selectedEdgeId, selectedEdgeIds, selectedNodeId, selectedNodeIds])

  const derivedGraphFields = React.useMemo(() => {
    void graphDataRevision
    const data: GraphData = { type: 'Graph', nodes: sampleNodes, edges: sampleEdges }
    return computeDerivedFields(data)
  }, [graphDataRevision, sampleEdges, sampleNodes])

  const propertyColumnKeysFromGraphFields = React.useMemo(() => {
    return derivedGraphFields.map(f => `prop:${f.scope}:${f.key}` as GraphDataTableColumnKey)
  }, [derivedGraphFields])

  const numericSampleStatsByFieldId = React.useMemo(() => {
    const shouldComputeNumericSamples =
      graphDataTablePanel === 'group' || graphDataTableAggregateKeys.length > 0 || graphDataTableGroupKey !== ''
    if (!shouldComputeNumericSamples) return new Map<GraphFieldId, NumericSampleStats>()
    const map = new Map<GraphFieldId, NumericSampleStats>()
    for (const field of derivedGraphFields) {
      const stats = computeNumericSampleStatsForField(field, sampleNodes, sampleEdges, numericSampleLimit)
      map.set(field.id, stats)
    }
    return map
  }, [
    derivedGraphFields,
    sampleEdges,
    sampleNodes,
    numericSampleLimit,
    graphDataTableAggregateKeys.length,
    graphDataTableGroupKey,
    graphDataTablePanel,
  ])

  const aggregatePanelColumnKeys = React.useMemo(() => {
    const keys: GraphDataTableColumnKey[] = []
    const shouldIncludeFieldAggregates =
      graphDataTablePanel === 'group' || graphDataTableAggregateKeys.length > 0 || graphDataTableGroupKey !== ''
    if (shouldIncludeFieldAggregates) {
      for (const field of derivedGraphFields) {
        const settings = normalizeSettingsForField(field, graphFieldSettingsById[field.id])
        const fieldType = settings.fieldType
        const isNumericKind = field.kind === 'number'
        const isMixedKind = field.kind === 'mixed'
        const isNumericType =
          fieldType === 'Number' || fieldType === 'Decimal' || fieldType === 'Currency'
        const stats = numericSampleStatsByFieldId.get(field.id)
        const numericSampleRatio =
          stats && stats.sampleCount > 0 ? stats.numericCount / stats.sampleCount : 0
        const hasMeaningfulNumericSamples =
          !!stats &&
          stats.numericCount >= numericSampleMinCount &&
          numericSampleRatio >= numericSampleMinRatio
        const allowMixed =
          includeMixedNumericFields && isMixedKind && !!stats && stats.numericCount > 0
        if (!isNumericKind && !isNumericType && !hasMeaningfulNumericSamples && !allowMixed) continue
        keys.push(`prop:${field.scope}:${field.key}` as GraphDataTableColumnKey)
      }
    }
    if (includeIdAsNumeric) {
      keys.push('id')
    }
    if (includeSourceAsNumeric) {
      keys.push('source')
    }
    if (includeTargetAsNumeric) {
      keys.push('target')
    }
    return keys
  }, [
    derivedGraphFields,
    graphDataTableAggregateKeys.length,
    graphDataTableGroupKey,
    graphDataTablePanel,
    graphFieldSettingsById,
    includeIdAsNumeric,
    includeMixedNumericFields,
    includeSourceAsNumeric,
    includeTargetAsNumeric,
    numericSampleStatsByFieldId,
    numericSampleMinCount,
    numericSampleMinRatio,
  ])

  React.useEffect(() => {
    if (aggregatePanelColumnKeys.length === 0 || graphDataTableAggregateKeys.length === 0) return
    const allowed = new Set<GraphDataTableColumnKey>(aggregatePanelColumnKeys)
    const sanitized = graphDataTableAggregateKeys.filter(k => allowed.has(k))
    if (sanitized.length !== graphDataTableAggregateKeys.length) {
      setGraphDataTableAggregateKeysState(sanitized)
    }
  }, [aggregatePanelColumnKeys, setGraphDataTableAggregateKeysState, graphDataTableAggregateKeys])

  return { derivedGraphFields, propertyColumnKeysFromGraphFields, aggregatePanelColumnKeys }
}

interface UseBottomPanelCuratorColumnsParams {
  derivedGraphFields: ReadonlyArray<GraphField>
  propertyColumnKeysFromGraphFields: ReadonlyArray<GraphDataTableColumnKey>
  graphDataTableColumnOrder: ReadonlyArray<GraphDataTableColumnKey>
  graphDataTableVisibleColumns: GraphDataTableColumnVisibilityByKey
  graphFieldSettingsById: GraphFieldSettingsById
  graphDataTableFieldsQuery: string
  setGraphDataTableVisibleColumnsState: (
    updater:
      | GraphDataTableColumnVisibilityByKey
      | ((prev: GraphDataTableColumnVisibilityByKey) => GraphDataTableColumnVisibilityByKey),
  ) => void
  setGraphDataTableColumnOrderState: (
    updater: GraphDataTableColumnKey[] | ((prev: GraphDataTableColumnKey[]) => GraphDataTableColumnKey[]),
  ) => void
}

interface BottomPanelCuratorColumnsResult {
  graphDataTableColumnLabelByKey: Map<GraphDataTableColumnKey, string>
  orderedAllColumnKeys: ReadonlyArray<GraphDataTableColumnKey>
  orderedVisibleColumnKeys: ReadonlyArray<GraphDataTableColumnKey>
  fieldsPanelColumnKeys: ReadonlyArray<GraphDataTableColumnKey>
  propertyFieldSettingsByColumnKey: Map<GraphDataTableColumnKey, GraphFieldSettingsResolved>
  isGraphDataTableColumnVisible: (key: GraphDataTableColumnKey) => boolean
  showAllColumns: () => void
  hideAllColumns: () => void
  moveGraphDataTableColumn: (from: GraphDataTableColumnKey, to: GraphDataTableColumnKey) => void
}

export function useBottomPanelCuratorColumns({
  derivedGraphFields,
  propertyColumnKeysFromGraphFields,
  graphDataTableColumnOrder,
  graphDataTableVisibleColumns,
  graphFieldSettingsById,
  graphDataTableFieldsQuery,
  setGraphDataTableVisibleColumnsState,
  setGraphDataTableColumnOrderState,
}: UseBottomPanelCuratorColumnsParams): BottomPanelCuratorColumnsResult {
  const uiPropertyColumnKeys = React.useMemo(() => {
    const set = new Set<GraphDataTableColumnKey>()
    for (const key of propertyColumnKeysFromGraphFields) set.add(key)
    for (const key of graphDataTableColumnOrder) {
      if (isGraphDataTablePropertyColumnKey(key)) set.add(key)
    }
    for (const key of Object.keys(graphDataTableVisibleColumns)) {
      if (isGraphDataTablePropertyColumnKey(key as GraphDataTableColumnKey)) {
        set.add(key as GraphDataTableColumnKey)
      }
    }
    return Array.from(set.values())
  }, [propertyColumnKeysFromGraphFields, graphDataTableColumnOrder, graphDataTableVisibleColumns])

  const graphDataTableColumnLabelByKey = React.useMemo(() => {
    const map = new Map<GraphDataTableColumnKey, string>(GRAPH_DATA_TABLE_COLUMN_DEFS.map(def => [def.key, def.label]))
    for (const field of derivedGraphFields) {
      const settings = normalizeSettingsForField(field, graphFieldSettingsById[field.id])
      const agenticKind = getAgenticRagFieldKind(field)
      const agenticPrefix =
        agenticKind === 'chunk_text' ||
        agenticKind === 'embedding' ||
        agenticKind === 'geo' ||
        agenticKind === 'media_url' ||
        agenticKind === 'graphRAGPath'
          ? 'AgenticRAG · '
          : ''
      const label = `${field.scope === 'node' ? 'Node' : 'Edge'} · ${agenticPrefix}${settings.displayName || field.key}`
      map.set(`prop:${field.scope}:${field.key}` as GraphDataTableColumnKey, label)
    }
    for (const key of uiPropertyColumnKeys) {
      if (!isGraphDataTablePropertyColumnKey(key)) continue
      if (map.has(key)) continue
      const parsed = parseGraphDataTablePropertyColumnKey(key)
      if (!parsed) continue
      const fieldId = `${parsed.scope}:${parsed.propertyKey}` as GraphFieldId
      const settings = graphFieldSettingsById[fieldId]
      const displayName = settings?.displayName || parsed.propertyKey
      const label = `${parsed.scope === 'node' ? 'Node' : 'Edge'} · ${displayName || parsed.propertyKey}`
      map.set(key, label)
    }
    return map
  }, [derivedGraphFields, graphFieldSettingsById, uiPropertyColumnKeys])

  const orderedAllColumnKeys = React.useMemo(() => {
    const next: GraphDataTableColumnKey[] = []
    const seen = new Set<GraphDataTableColumnKey>()
    const add = (key: GraphDataTableColumnKey) => {
      if (seen.has(key)) return
      seen.add(key)
      next.push(key)
    }

    for (const key of graphDataTableColumnOrder) add(key)
    for (const def of GRAPH_DATA_TABLE_COLUMN_DEFS) add(def.key)
    for (const key of propertyColumnKeysFromGraphFields) add(key)
    return next
  }, [propertyColumnKeysFromGraphFields, graphDataTableColumnOrder])

  const orderedVisibleColumnKeys = React.useMemo(
    () =>
      orderedAllColumnKeys.filter(key =>
        isGraphDataTablePropertyColumnKey(key) ? graphDataTableVisibleColumns[key] === true : graphDataTableVisibleColumns[key] !== false,
      ),
    [orderedAllColumnKeys, graphDataTableVisibleColumns],
  )

  const fieldsPanelColumnKeys = React.useMemo(() => {
    const normalizedQuery = normalizeText(graphDataTableFieldsQuery).trim()
    if (!normalizedQuery) return orderedAllColumnKeys
    return orderedAllColumnKeys.filter(key => {
      const label = graphDataTableColumnLabelByKey.get(key) ?? key
      return normalizeText(`${key} ${label}`).includes(normalizedQuery)
    })
  }, [orderedAllColumnKeys, graphDataTableColumnLabelByKey, graphDataTableFieldsQuery])

  const propertyFieldSettingsByColumnKey = React.useMemo(() => {
    const map = new Map<GraphDataTableColumnKey, GraphFieldSettingsResolved>()
    for (const field of derivedGraphFields) {
      const settings = normalizeSettingsForField(field, graphFieldSettingsById[field.id])
      const key = `prop:${field.scope}:${field.key}` as GraphDataTableColumnKey
      map.set(key, settings)
    }
    return map
  }, [derivedGraphFields, graphFieldSettingsById])

  const isGraphDataTableColumnVisible = React.useCallback(
    (key: GraphDataTableColumnKey) =>
      isGraphDataTablePropertyColumnKey(key) ? graphDataTableVisibleColumns[key] === true : graphDataTableVisibleColumns[key] !== false,
    [graphDataTableVisibleColumns],
  )

  const showAllColumns = React.useCallback(() => {
    const next: Record<string, boolean> = { ...buildDefaultVisibleColumns() }
    for (const key of orderedAllColumnKeys) {
      if (isGraphDataTablePropertyColumnKey(key)) next[key] = true
    }
    setGraphDataTableVisibleColumnsState(next as GraphDataTableColumnVisibilityByKey)
  }, [orderedAllColumnKeys, setGraphDataTableVisibleColumnsState])

  const hideAllColumns = React.useCallback(() => {
    const next: Record<string, boolean> = { ...buildDefaultVisibleColumns() }
    for (const def of GRAPH_DATA_TABLE_COLUMN_DEFS) next[def.key] = false
    for (const key of orderedAllColumnKeys) {
      if (isGraphDataTablePropertyColumnKey(key)) next[key] = false
    }
    next.label = true
    setGraphDataTableVisibleColumnsState(next as GraphDataTableColumnVisibilityByKey)
  }, [orderedAllColumnKeys, setGraphDataTableVisibleColumnsState])

  const moveGraphDataTableColumn = React.useCallback(
    (from: GraphDataTableColumnKey, to: GraphDataTableColumnKey) => {
      if (from === to) return
      setGraphDataTableColumnOrderState(prev => {
        const filtered = prev.filter(key => key !== from)
        const index = filtered.indexOf(to)
        if (index < 0) return [from, ...filtered]
        return [...filtered.slice(0, index), from, ...filtered.slice(index)]
      })
    },
    [setGraphDataTableColumnOrderState],
  )

  return {
    graphDataTableColumnLabelByKey,
    orderedAllColumnKeys,
    orderedVisibleColumnKeys,
    fieldsPanelColumnKeys,
    propertyFieldSettingsByColumnKey,
    isGraphDataTableColumnVisible,
    showAllColumns,
    hideAllColumns,
    moveGraphDataTableColumn,
  }
}

interface UseBottomPanelCuratorListItemsParams {
  visibleRows: UnifiedRow[]
  graphDataTableAggregateKeys: GraphDataTableColumnKey[]
  graphDataTableGroupKey: GraphDataTableColumnKey | ''
}

export function useBottomPanelCuratorListItems({
  visibleRows,
  graphDataTableAggregateKeys,
  graphDataTableGroupKey,
}: UseBottomPanelCuratorListItemsParams): GraphDataTableListItem[] {
  const listItems = React.useMemo<GraphDataTableListItem[]>(() => {
    const aggregateKeys =
      graphDataTableAggregateKeys.length > 0
        ? graphDataTableAggregateKeys
        : graphDataTableGroupKey
        ? [graphDataTableGroupKey]
        : []
    return buildGraphDataTableListItems(visibleRows, graphDataTableGroupKey, aggregateKeys)
  }, [graphDataTableAggregateKeys, graphDataTableGroupKey, visibleRows])

  return listItems
}
