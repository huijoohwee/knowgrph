import React from 'react'

import { resolveGraphNodeIdsByCanonicalIds } from '@/lib/graph/canonicalNodeIds'
import type { GraphData } from '@/lib/graph/types'
import type { SelectionAnchorIds } from '@/lib/graph/types'

export type SelectionIdParams = {
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedNodeIds?: ReadonlyArray<string> | null
  selectedEdgeIds?: ReadonlyArray<string> | null
}

export type SelectionIdParamsWithGroups = SelectionIdParams & {
  selectedGroupId?: string | null
  selectedGroupIds?: ReadonlyArray<string> | null
}

export type SelectionAnchorIdsWithGroups = SelectionAnchorIds & {
  selectionGroupIds: string[]
}

export function normalizeSelectionAnchorIds(
  params: SelectionIdParams,
): SelectionAnchorIds {
  const { selectedNodeId, selectedEdgeId, selectedNodeIds, selectedEdgeIds } = params
  const selectionNodeIds =
    Array.isArray(selectedNodeIds) && selectedNodeIds.length > 0
      ? [...selectedNodeIds]
      : selectedNodeId
        ? [selectedNodeId]
        : []
  const selectionEdgeIds =
    Array.isArray(selectedEdgeIds) && selectedEdgeIds.length > 0
      ? [...selectedEdgeIds]
      : selectedEdgeId
        ? [selectedEdgeId]
        : []
  return { selectionNodeIds, selectionEdgeIds }
}

export function normalizeSelectionAnchorIdsWithGroups(
  params: SelectionIdParamsWithGroups,
): SelectionAnchorIdsWithGroups {
  const { selectedGroupId, selectedGroupIds } = params
  const selectionAnchorIds = normalizeSelectionAnchorIds(params)
  const selectionGroupIds =
    Array.isArray(selectedGroupIds) && selectedGroupIds.length > 0
      ? [...selectedGroupIds]
      : selectedGroupId
        ? [selectedGroupId]
        : []
  return { ...selectionAnchorIds, selectionGroupIds }
}

export function buildSelectionAnchorIdSets(
  params: SelectionIdParams,
): {
  selectedNodeIdSet: Set<string>
  selectedEdgeIdSet: Set<string>
} {
  const { selectionNodeIds, selectionEdgeIds } = normalizeSelectionAnchorIds(params)
  return {
    selectedNodeIdSet: new Set<string>(selectionNodeIds.map(String)),
    selectedEdgeIdSet: new Set<string>(selectionEdgeIds.map(String)),
  }
}

export function resolveSelectionAnchorNodeIds(
  graphData: GraphData | null | undefined,
  rawIds: ReadonlyArray<string>,
): string[] {
  const resolved = resolveGraphNodeIdsByCanonicalIds(graphData, rawIds)
  if (resolved.length > 0) return resolved
  return rawIds.map(id => String(id || '').trim()).filter(Boolean)
}

export function resolveNormalizedSelectionAnchorNodeIds(
  graphData: GraphData | null | undefined,
  params: SelectionIdParams,
): string[] {
  return resolveSelectionAnchorNodeIds(
    graphData,
    normalizeSelectionAnchorIds(params).selectionNodeIds,
  )
}

export function useSelectionAnchorIds(
  params: SelectionIdParams,
): SelectionAnchorIds {
  const { selectedNodeId, selectedEdgeId, selectedNodeIds, selectedEdgeIds } = params
  return React.useMemo(() => {
    return normalizeSelectionAnchorIds({
      selectedNodeId,
      selectedEdgeId,
      selectedNodeIds,
      selectedEdgeIds,
    })
  }, [selectedEdgeId, selectedEdgeIds, selectedNodeId, selectedNodeIds])
}
