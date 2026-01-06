import React from 'react'
import type { GraphNode, GraphEdge, GraphData, SelectionAnchorIds } from '@/lib/graph/types'
import {
  type GraphDataTableColumnKey,
} from '@/features/graph-data-table/graphDataTable'
import {
  computeDerivedFields,
  normalizeSettingsForField,
  type GraphField,
  type GraphFieldId,
  type GraphFieldSettingsById,
} from '@/features/graph-fields/graphFields'
import {
  computeNumericSampleStatsForField,
  type NumericSampleStats,
} from '../BottomPanelCuratorModels'
import { buildSelectionSubgraphForAnchorIds } from '@/lib/graph/file'
import { normalizeSelectionIds } from '@/components/GraphCanvas/highlight'

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
