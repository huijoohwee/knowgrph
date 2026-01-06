import React from 'react'
import {
  buildGraphDataTableListItems,
  type GraphDataTableColumnKey,
  type GraphDataTableListItem,
  type UnifiedRow,
} from '@/features/graph-data-table/graphDataTable'

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
