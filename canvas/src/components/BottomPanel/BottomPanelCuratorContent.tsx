import React from 'react'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import {
  type GraphDataTableColumnKey,
  type GraphDataTableFilterClause,
  type GraphDataTableFilterCondition,
  type GraphDataTableFilterMatch,
  type GraphDataTableListItem,
  type GraphDataTableRowDensity,
  type GraphDataTableSortRule,
  type UnifiedRow,
} from '@/features/graph-data-table/graphDataTable'
import {
  GraphDataTablePanelOverlay,
  type GraphDataTablePanel,
} from '@/features/graph-data-table/ui/GraphDataTablePanelOverlay'
import { GraphDataTable } from '@/features/graph-data-table/ui/GraphDataTableTable'
import { UI_COLOR_PRIMARY_BLUE_BORDER } from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles'
import { BottomPanelCuratorToolbar } from './BottomPanelCuratorToolbar'
import type { GraphDataTableScope } from './BottomPanelCuratorToolbarModel'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

interface BottomPanelCuratorToolbarModel {
  graphDataTablePanel: GraphDataTablePanel
  setGraphDataTablePanel: React.Dispatch<React.SetStateAction<GraphDataTablePanel>>
  graphDataTableScope: GraphDataTableScope
  setGraphDataTableScope: (scope: GraphDataTableScope) => void
  viewMode: 'allRows' | 'selectionNeighborhood' | 'traversalSequence'
  setViewMode: (mode: 'allRows' | 'selectionNeighborhood' | 'traversalSequence') => void
  selectedNodeId: string | null
  selectedEdgeId: string | null
  onDeleteSelected: () => void
  onAddNode: () => void
  onAddEdge: () => void
  nodesCount: number
  fieldsMenuRef: React.RefObject<HTMLButtonElement>
  filterMenuRef: React.RefObject<HTMLButtonElement>
  sortMenuRef: React.RefObject<HTMLButtonElement>
  groupMenuRef: React.RefObject<HTMLButtonElement>
  resetToken: number
  rowDensity: GraphDataTableRowDensity
  setRowDensity: (density: GraphDataTableRowDensity) => void
  isAutoScrollDisabled: boolean
  setIsAutoScrollDisabled: (value: boolean) => void
}

interface BottomPanelCuratorOverlayModel {
  activePanelAnchorRef: React.RefObject<HTMLElement>
  graphDataTableFieldsQuery: string
  setGraphDataTableFieldsQuery: (next: string) => void
  fieldsPanelColumnKeys: GraphDataTableColumnKey[]
  columnLabelByKey: Map<GraphDataTableColumnKey, string>
  isColumnVisible: (key: GraphDataTableColumnKey) => boolean
  setColumnVisibility: (key: GraphDataTableColumnKey, visible: boolean) => void
  moveColumn: (from: GraphDataTableColumnKey, to: GraphDataTableColumnKey) => void
  draggingColumnKey: GraphDataTableColumnKey | null
  setDraggingColumnKey: (key: GraphDataTableColumnKey | null) => void
  showAllColumns: () => void
  hideAllColumns: () => void
  filterMatch: GraphDataTableFilterMatch
  setFilterMatch: (match: GraphDataTableFilterMatch) => void
  filterClauses: ReadonlyArray<GraphDataTableFilterClause>
  addFilterCondition: () => void
  addFilterGroup: () => void
  addFilterConditionToGroup: (groupId: string) => void
  updateFilterCondition: (id: string, patch: Partial<Omit<GraphDataTableFilterCondition, 'id' | 'kind'>>) => void
  setFilterGroupMatch: (groupId: string, match: GraphDataTableFilterMatch) => void
  removeFilterCondition: (id: string) => void
  clearAllFilters: () => void
  isAutoSortEnabled: boolean
  setIsAutoSortEnabled: (enabled: boolean) => void
  sortRules: ReadonlyArray<GraphDataTableSortRule>
  addSortRule: () => void
  resetSortRules: () => void
  updateSortRule: (id: string, patch: Partial<Omit<GraphDataTableSortRule, 'id'>>) => void
  removeSortRule: (id: string) => void
  groupKey: GraphDataTableColumnKey | ''
  setGroupKey: (key: GraphDataTableColumnKey | '') => void
  aggregateKeys: GraphDataTableColumnKey[]
  setAggregateKeys: (keys: GraphDataTableColumnKey[]) => void
  aggregatePanelColumnKeys: GraphDataTableColumnKey[]
  includeMixedNumericFields: boolean
  setIncludeMixedNumericFields: (value: boolean) => void
  includeIdAsNumeric: boolean
  setIncludeIdAsNumeric: (value: boolean) => void
  includeSourceAsNumeric: boolean
  setIncludeSourceAsNumeric: (value: boolean) => void
  includeTargetAsNumeric: boolean
  setIncludeTargetAsNumeric: (value: boolean) => void
}

interface BottomPanelCuratorTableModel {
  listItems: GraphDataTableListItem[]
  orderedVisibleColumnKeys: GraphDataTableColumnKey[]
  visibleRows: UnifiedRow[]
  columnLabelByKey: Map<GraphDataTableColumnKey, string>
  propertyFieldSettingsByColumnKey: Map<GraphDataTableColumnKey, import('@/features/graph-fields/graphFields').GraphFieldSettingsResolved>
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  nodeById: Map<string, GraphNode>
  edgeById: Map<string, GraphEdge>
  updateNode: (id: string, patch: Partial<GraphNode>) => void
  updateEdge: (id: string, patch: Partial<GraphEdge>) => void
  onRowClick: (row: UnifiedRow) => void
  onRowDoubleClick: (row: UnifiedRow) => void
  onRowContextMenu?: (event: React.MouseEvent, row: UnifiedRow) => void
  sortRules: ReadonlyArray<GraphDataTableSortRule>
  onRequestAddFilter: (key: GraphDataTableColumnKey) => void
  onRequestGroupBy: (key: GraphDataTableColumnKey | '') => void
  onRequestHideColumn: (key: GraphDataTableColumnKey) => void
  onRequestSortByColumn: (key: GraphDataTableColumnKey, dir: 'asc' | 'desc') => void
  rowDensity: GraphDataTableRowDensity
  isAutoScrollDisabled: boolean
  freezeFirstDataColumn: 'none' | 'label' | 'id'
  setFreezeFirstDataColumn: (value: 'none' | 'label' | 'id') => void
}

export interface BottomPanelCuratorContentViewModel {
  toolbar: BottomPanelCuratorToolbarModel
  overlay: BottomPanelCuratorOverlayModel
  table: BottomPanelCuratorTableModel
}

interface BottomPanelCuratorContentProps {
  viewModel: BottomPanelCuratorContentViewModel
  selectionToolbar?: React.ReactNode
}

export function BottomPanelCuratorContent({
  viewModel,
  selectionToolbar,
}: BottomPanelCuratorContentProps) {
  const { toolbar, overlay, table } = viewModel
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )

  const [visibleRange, setVisibleRange] = React.useState<{
    visibleStartRow: number
    visibleEndRow: number
    totalRows: number
    visibleRowCount: number
    totalGroups: number
    totalAggregates: number
  }>({
    visibleStartRow: 0,
    visibleEndRow: 0,
    totalRows: 0,
    visibleRowCount: 0,
    totalGroups: 0,
    totalAggregates: 0,
  })

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <BottomPanelCuratorToolbar
        graphDataTablePanel={toolbar.graphDataTablePanel}
        setGraphDataTablePanel={toolbar.setGraphDataTablePanel}
        graphDataTableScope={toolbar.graphDataTableScope}
        setGraphDataTableScope={toolbar.setGraphDataTableScope}
        viewMode={toolbar.viewMode}
        setViewMode={toolbar.setViewMode}
        selectedNodeId={toolbar.selectedNodeId}
        selectedEdgeId={toolbar.selectedEdgeId}
        onDeleteSelected={toolbar.onDeleteSelected}
        onAddNode={toolbar.onAddNode}
        onAddEdge={toolbar.onAddEdge}
        nodesCount={toolbar.nodesCount}
        fieldsMenuRef={toolbar.fieldsMenuRef}
        filterMenuRef={toolbar.filterMenuRef}
        sortMenuRef={toolbar.sortMenuRef}
        groupMenuRef={toolbar.groupMenuRef}
        resetToken={toolbar.resetToken}
        rowDensity={toolbar.rowDensity}
        setRowDensity={toolbar.setRowDensity}
        isAutoScrollDisabled={toolbar.isAutoScrollDisabled}
        setIsAutoScrollDisabled={toolbar.setIsAutoScrollDisabled}
      />

      <div className={`flex-1 min-h-0 overflow-hidden border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} rounded flex flex-col`}>
        {toolbar.graphDataTablePanel !== 'none' && (
          <GraphDataTablePanelOverlay
            panel={toolbar.graphDataTablePanel as Exclude<GraphDataTablePanel, 'none'>}
            anchorRef={overlay.activePanelAnchorRef}
            onClose={() => toolbar.setGraphDataTablePanel('none')}
            fieldsQuery={overlay.graphDataTableFieldsQuery}
            setFieldsQuery={overlay.setGraphDataTableFieldsQuery}
            fieldsPanelColumnKeys={overlay.fieldsPanelColumnKeys}
            columnLabelByKey={overlay.columnLabelByKey}
            isColumnVisible={overlay.isColumnVisible}
            setColumnVisibility={overlay.setColumnVisibility}
            moveColumn={overlay.moveColumn}
            draggingColumnKey={overlay.draggingColumnKey}
            setDraggingColumnKey={overlay.setDraggingColumnKey}
            showAllColumns={overlay.showAllColumns}
            hideAllColumns={overlay.hideAllColumns}
            filterMatch={overlay.filterMatch}
            setFilterMatch={overlay.setFilterMatch}
            filterClauses={overlay.filterClauses}
            addFilterCondition={overlay.addFilterCondition}
            addFilterGroup={overlay.addFilterGroup}
            addFilterConditionToGroup={overlay.addFilterConditionToGroup}
            updateFilterCondition={overlay.updateFilterCondition}
            setFilterGroupMatch={overlay.setFilterGroupMatch}
            removeFilterCondition={overlay.removeFilterCondition}
            clearAllFilters={overlay.clearAllFilters}
            isAutoSortEnabled={overlay.isAutoSortEnabled}
            setIsAutoSortEnabled={overlay.setIsAutoSortEnabled}
            sortRules={overlay.sortRules}
            addSortRule={overlay.addSortRule}
            resetSortRules={overlay.resetSortRules}
            updateSortRule={overlay.updateSortRule}
            removeSortRule={overlay.removeSortRule}
            groupKey={overlay.groupKey}
            setGroupKey={overlay.setGroupKey}
            aggregateKeys={overlay.aggregateKeys}
            setAggregateKeys={overlay.setAggregateKeys}
            aggregatePanelColumnKeys={overlay.aggregatePanelColumnKeys}
            includeMixedNumericFields={overlay.includeMixedNumericFields}
            setIncludeMixedNumericFields={overlay.setIncludeMixedNumericFields}
            includeIdAsNumeric={overlay.includeIdAsNumeric}
            setIncludeIdAsNumeric={overlay.setIncludeIdAsNumeric}
            includeSourceAsNumeric={overlay.includeSourceAsNumeric}
            setIncludeSourceAsNumeric={overlay.setIncludeSourceAsNumeric}
            includeTargetAsNumeric={overlay.includeTargetAsNumeric}
            setIncludeTargetAsNumeric={overlay.setIncludeTargetAsNumeric}
          />
        )}

      <div className="flex-1 min-h-0">
          <GraphDataTable
            listItems={table.listItems}
            orderedVisibleColumnKeys={table.orderedVisibleColumnKeys}
            columnLabelByKey={table.columnLabelByKey}
            propertyFieldSettingsByColumnKey={table.propertyFieldSettingsByColumnKey}
            rowDensity={table.rowDensity}
            isEmpty={table.visibleRows.length === 0}
            disableAutoScroll={table.isAutoScrollDisabled}
            freezeFirstDataColumn={table.freezeFirstDataColumn}
            setFreezeFirstDataColumn={table.setFreezeFirstDataColumn}
            onVisibleRangeChange={setVisibleRange}
            selectedNodeId={table.selectedNodeId}
            selectedEdgeId={table.selectedEdgeId}
            selectedNodeIds={table.selectedNodeIds}
            selectedEdgeIds={table.selectedEdgeIds}
            nodeById={table.nodeById}
            edgeById={table.edgeById}
            updateNode={table.updateNode}
            updateEdge={table.updateEdge}
            onRowClick={table.onRowClick}
            onRowDoubleClick={table.onRowDoubleClick}
            onRowContextMenu={table.onRowContextMenu}
            sortKey={table.sortRules[0]?.key ?? 'id'}
            sortDir={table.sortRules[0]?.dir ?? 'asc'}
            onRequestAddFilter={table.onRequestAddFilter}
            onRequestGroupBy={table.onRequestGroupBy}
            onRequestHideColumn={table.onRequestHideColumn}
            onRequestSortByColumn={table.onRequestSortByColumn}
          />
        </div>
        {selectionToolbar}
        <div className={`border-t ${UI_THEME_TOKENS.panel.divider} px-2 py-1 flex items-center justify-between ${UI_THEME_TOKENS.panel.headerBg}`}>
          <div className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>
            {visibleRange.totalRows === 0
              ? 'No rows'
              : `Rows ${visibleRange.visibleStartRow.toLocaleString()}–${visibleRange.visibleEndRow.toLocaleString()} of ${visibleRange.totalRows.toLocaleString()} (showing ${visibleRange.visibleRowCount.toLocaleString()} rows, ${visibleRange.totalGroups.toLocaleString()} groups, ${visibleRange.totalAggregates.toLocaleString()} aggregates)`}
          </div>
          <div className={`flex items-center gap-3 ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>
            <div className="flex items-center gap-1">
              <span className={`inline-block w-3 h-3 rounded-sm ${UI_THEME_TOKENS.table.rowSelected} border ${UI_COLOR_PRIMARY_BLUE_BORDER}`} />
              <span>Selected row</span>
            </div>
            <div className="flex items-center gap-1">
              <span className={`inline-block w-3 h-3 rounded-sm ${UI_THEME_TOKENS.table.rowRelated} border ${UI_COLOR_PRIMARY_BLUE_BORDER}`} />
              <span>Related to selection</span>
            </div>
            <div className="flex items-center gap-1">
              <span className={`inline-block w-3 h-3 rounded-sm ${UI_THEME_TOKENS.table.rowOutside} border ${UI_THEME_TOKENS.table.cellBorder}`} />
              <span>Outside selection neighborhood</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
