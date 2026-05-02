import React from 'react'

import type { SelectionAnchorIds } from '@/lib/graph/types'

export type SelectionIdParams = {
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedNodeIds?: ReadonlyArray<string> | null
  selectedEdgeIds?: ReadonlyArray<string> | null
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
