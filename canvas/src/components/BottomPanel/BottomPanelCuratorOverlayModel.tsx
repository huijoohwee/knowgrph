import type {
  GraphDataTableColumnKey,
  GraphDataTableFilterClause,
  GraphDataTableFilterCondition,
  GraphDataTableFilterMatch,
  GraphDataTableSortRule,
} from '@/features/graph-data-table/graphDataTable'
import type { BottomPanelCuratorContentViewModel } from '@/components/BottomPanel/BottomPanelCuratorContent'

export function buildBottomPanelCuratorOverlayModel(params: {
  activePanelAnchorRef: React.RefObject<HTMLElement>
  graphDataTableFieldsQuery: string
  setGraphDataTableFieldsQuery: (value: string) => void
  fieldsPanelColumnKeys: GraphDataTableColumnKey[]
  columnLabelByKey: Map<GraphDataTableColumnKey, string>
  isGraphDataTableColumnVisible: (key: GraphDataTableColumnKey) => boolean
  handleSetColumnVisibility: (key: GraphDataTableColumnKey, visible: boolean) => void
  moveGraphDataTableColumn: (from: GraphDataTableColumnKey, to: GraphDataTableColumnKey) => void
  draggingColumnKey: GraphDataTableColumnKey | null
  setDraggingColumnKey: (key: GraphDataTableColumnKey | null) => void
  showAllColumns: () => void
  hideAllColumns: () => void
  graphDataTableFilterMatch: GraphDataTableFilterMatch
  setGraphDataTableFilterMatch: (match: GraphDataTableFilterMatch) => void
  graphDataTableFilterClauses: ReadonlyArray<GraphDataTableFilterClause>
  addGraphDataTableFilterCondition: () => void
  addGraphDataTableFilterGroup: () => void
  addGraphDataTableFilterConditionToGroup: (groupId: string) => void
  updateGraphDataTableFilterCondition: (id: string, patch: Partial<Omit<GraphDataTableFilterCondition, 'id'>>) => void
  setGraphDataTableFilterGroupMatch: (groupId: string, match: GraphDataTableFilterMatch) => void
  removeGraphDataTableFilterCondition: (id: string) => void
  clearAllGraphDataTableFilters: () => void
  isGraphDataTableAutoSortEnabled: boolean
  setIsGraphDataTableAutoSortEnabled: (enabled: boolean) => void
  graphDataTableSortRules: ReadonlyArray<GraphDataTableSortRule>
  addGraphDataTableSortRule: () => void
  resetGraphDataTableSortRules: () => void
  updateGraphDataTableSortRule: (id: string, patch: Partial<Omit<GraphDataTableSortRule, 'id'>>) => void
  removeGraphDataTableSortRule: (id: string) => void
  graphDataTableGroupKey: GraphDataTableColumnKey | ''
  setGraphDataTableGroupKey: (key: GraphDataTableColumnKey | '') => void
  graphDataTableAggregateKeys: GraphDataTableColumnKey[]
  setGraphDataTableAggregateKeys: (keys: GraphDataTableColumnKey[]) => void
  aggregatePanelColumnKeys: GraphDataTableColumnKey[]
  includeMixedNumericFields: boolean
  setIncludeMixedNumericFields: (value: boolean) => void
  includeIdAsNumeric: boolean
  setIncludeIdAsNumeric: (value: boolean) => void
  includeSourceAsNumeric: boolean
  setIncludeSourceAsNumeric: (value: boolean) => void
  includeTargetAsNumeric: boolean
  setIncludeTargetAsNumeric: (value: boolean) => void
}): BottomPanelCuratorContentViewModel['overlay'] {
  return {
    activePanelAnchorRef: params.activePanelAnchorRef,
    graphDataTableFieldsQuery: params.graphDataTableFieldsQuery,
    setGraphDataTableFieldsQuery: params.setGraphDataTableFieldsQuery,
    fieldsPanelColumnKeys: params.fieldsPanelColumnKeys,
    columnLabelByKey: params.columnLabelByKey,
    isColumnVisible: params.isGraphDataTableColumnVisible,
    setColumnVisibility: params.handleSetColumnVisibility,
    moveColumn: params.moveGraphDataTableColumn,
    draggingColumnKey: params.draggingColumnKey,
    setDraggingColumnKey: params.setDraggingColumnKey,
    showAllColumns: params.showAllColumns,
    hideAllColumns: params.hideAllColumns,
    filterMatch: params.graphDataTableFilterMatch,
    setFilterMatch: params.setGraphDataTableFilterMatch,
    filterClauses: params.graphDataTableFilterClauses,
    addFilterCondition: params.addGraphDataTableFilterCondition,
    addFilterGroup: params.addGraphDataTableFilterGroup,
    addFilterConditionToGroup: params.addGraphDataTableFilterConditionToGroup,
    updateFilterCondition: params.updateGraphDataTableFilterCondition,
    setFilterGroupMatch: params.setGraphDataTableFilterGroupMatch,
    removeFilterCondition: params.removeGraphDataTableFilterCondition,
    clearAllFilters: params.clearAllGraphDataTableFilters,
    isAutoSortEnabled: params.isGraphDataTableAutoSortEnabled,
    setIsAutoSortEnabled: params.setIsGraphDataTableAutoSortEnabled,
    sortRules: params.graphDataTableSortRules,
    addSortRule: params.addGraphDataTableSortRule,
    resetSortRules: params.resetGraphDataTableSortRules,
    updateSortRule: params.updateGraphDataTableSortRule,
    removeSortRule: params.removeGraphDataTableSortRule,
    groupKey: params.graphDataTableGroupKey,
    setGroupKey: params.setGraphDataTableGroupKey,
    aggregateKeys: params.graphDataTableAggregateKeys,
    setAggregateKeys: params.setGraphDataTableAggregateKeys,
    aggregatePanelColumnKeys: params.aggregatePanelColumnKeys,
    includeMixedNumericFields: params.includeMixedNumericFields,
    setIncludeMixedNumericFields: params.setIncludeMixedNumericFields,
    includeIdAsNumeric: params.includeIdAsNumeric,
    setIncludeIdAsNumeric: params.setIncludeIdAsNumeric,
    includeSourceAsNumeric: params.includeSourceAsNumeric,
    setIncludeSourceAsNumeric: params.setIncludeSourceAsNumeric,
    includeTargetAsNumeric: params.includeTargetAsNumeric,
    setIncludeTargetAsNumeric: params.setIncludeTargetAsNumeric,
  }
}
