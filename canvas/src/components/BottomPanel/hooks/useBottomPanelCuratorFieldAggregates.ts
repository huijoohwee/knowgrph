import React from 'react'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import {
  type GraphDataTableColumnKey,
} from '@/features/graph-data-table/graphDataTable'
import {
  getCachedDerivedFields,
  getCachedResolvedFieldSettingsById,
  type GraphField,
  type GraphFieldId,
  type GraphFieldSettingsById,
} from '@/features/graph-fields/graphFields'
import {
  getCachedNumericSampleStatsByFieldId,
  type NumericSampleStats,
} from '../BottomPanelCuratorModels'
import { useBottomPanelCuratorSelectionNeighborhood } from './useBottomPanelCuratorSelectionNeighborhood'

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
  const {
    sampleGraphData,
    sampleNodes,
    sampleEdges,
    sampleGraphSemanticKey,
  } = useBottomPanelCuratorSelectionNeighborhood({
    nodes,
    edges,
    graphDataRevision,
    graphDataTableViewMode,
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
  })

  const derivedGraphFields = React.useMemo(() => {
    return getCachedDerivedFields({
      graphData: sampleGraphData,
      graphRevision: graphDataRevision,
      graphSemanticKey: sampleGraphSemanticKey,
    })
  }, [graphDataRevision, sampleGraphData, sampleGraphSemanticKey])

  const propertyColumnKeysFromGraphFields = React.useMemo(() => {
    return derivedGraphFields.map(f => `prop:${f.scope}:${f.key}` as GraphDataTableColumnKey)
  }, [derivedGraphFields])

  const resolvedSettingsById = React.useMemo(
    () => getCachedResolvedFieldSettingsById({ fields: derivedGraphFields, settingsById: graphFieldSettingsById, graphSemanticKey: sampleGraphSemanticKey }),
    [derivedGraphFields, graphFieldSettingsById, sampleGraphSemanticKey],
  )

  const numericSampleStatsByFieldId = React.useMemo(() => {
    const shouldComputeNumericSamples =
      graphDataTablePanel === 'group' || graphDataTableAggregateKeys.length > 0 || graphDataTableGroupKey !== ''
    if (!shouldComputeNumericSamples) return new Map<GraphFieldId, NumericSampleStats>()
    return getCachedNumericSampleStatsByFieldId({
      fields: derivedGraphFields.map(field => ({
        id: field.id,
        scope: field.scope,
        key: field.key,
      })),
      nodes: sampleNodes,
      edges: sampleEdges,
      numericSampleLimit,
      graphSemanticKey: sampleGraphSemanticKey,
    })
  }, [
    derivedGraphFields,
    sampleEdges,
    sampleNodes,
    numericSampleLimit,
    graphDataTableAggregateKeys.length,
    graphDataTableGroupKey,
    graphDataTablePanel,
    sampleGraphSemanticKey,
  ])

  const aggregatePanelColumnKeys = React.useMemo(() => {
    const keys: GraphDataTableColumnKey[] = []
    const shouldIncludeFieldAggregates =
      graphDataTablePanel === 'group' || graphDataTableAggregateKeys.length > 0 || graphDataTableGroupKey !== ''
    if (shouldIncludeFieldAggregates) {
      for (const field of derivedGraphFields) {
        const settings = resolvedSettingsById.get(field.id)
        if (!settings) continue
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
    includeIdAsNumeric,
    includeMixedNumericFields,
    includeSourceAsNumeric,
    includeTargetAsNumeric,
    numericSampleStatsByFieldId,
    numericSampleMinCount,
    numericSampleMinRatio,
    resolvedSettingsById,
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
