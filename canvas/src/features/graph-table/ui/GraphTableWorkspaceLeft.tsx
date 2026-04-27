import React from 'react'
import type { GraphColumnDoc, GraphTableId } from '@/features/graph-table-db/graphTableDb'
import type { PanelTypography } from '@/lib/ui/panelTypography'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { VerticalResizeSeparatorHr } from '@/components/ui/VerticalResizeSeparatorHr'
import { GraphTableWorkspaceHeader } from '@/features/graph-table/ui/GraphTableWorkspaceHeader'
import { GraphTableKanbanView } from '@/features/graph-table/ui/GraphTableKanbanView'
import { GraphTableDomTableView } from '@/features/graph-table/ui/GraphTableDomTableView'
import { GraphTableInspector, type GraphTableInspectorRow } from '@/features/graph-table/ui/GraphTableInspector'
import type { GraphTableGridRow } from '@/features/graph-table/ui/graphTableTypes'
import type {
  GraphTableColumnVisibilityById,
  GraphTableColumnWidthsPxById,
  GraphTableFilterClause,
  GraphTableFilterMatch,
  GraphTableRowHeightPreset,
  GraphTableSortRule,
  GraphTableFilterOperator,
  GraphTableSortDirection,
} from '@/features/graph-table/ui/graphTableViewState'
import type { GraphTableViewMode } from '@/features/graph-table/ui/graphTableViewMode'

export function GraphTableWorkspaceLeft(props: {
  panelTypography: PanelTypography
  activeTableId: GraphTableId
  setActiveTableId: (next: GraphTableId) => void
  viewMode: GraphTableViewMode
  setViewMode: (next: GraphTableViewMode) => void
  geospatialViewEnabled: boolean
  setGeospatialViewEnabled: (next: boolean) => void
  tableToGraphRenderingEnabled: boolean
  setTableToGraphRenderingEnabled: (next: boolean) => void
  rowCountLabel: string
  orderedColumns: Array<{ columnId: string; name: string }>
  inspectorOpen: boolean
  setInspectorOpen: (next: boolean) => void
  canvasPreviewAvailable: boolean
  canvasPreviewCollapsed: boolean
  setCanvasPreviewCollapsed: (next: boolean) => void
  columnVisibilityById: GraphTableColumnVisibilityById
  setColumnVisibilityById: (next: GraphTableColumnVisibilityById) => void
  filterMatch: GraphTableFilterMatch
  setFilterMatch: (next: GraphTableFilterMatch) => void
  filterClauses: GraphTableFilterClause[]
  setFilterClauses: (next: GraphTableFilterClause[]) => void
  groupBy: string
  setGroupBy: (next: string) => void
  sortRules: GraphTableSortRule[]
  setSortRules: (next: GraphTableSortRule[]) => void
  rowHeightPreset: GraphTableRowHeightPreset
  setRowHeightPreset: (next: GraphTableRowHeightPreset) => void
  columnWidthsPxById: GraphTableColumnWidthsPxById
  resetColumnWidths: () => void
  onAddRow: () => void
  onDeleteSelected: () => void
  hasSelection: boolean
  syncNowVisible?: boolean
  syncNowDisabled?: boolean
  onSyncNow?: () => void
  onClose: () => void

  columns: GraphColumnDoc[]
  rows: GraphTableGridRow[]
  selectedRowIds: string[]
  inspectorRowId: string | null
  selectionSource: string
  setSelectedRowIds: (next: string[]) => void
  setInspectorRowId: (next: string | null) => void
  showInspector: boolean
  inspectorWidthPx: number
  setInspectorDragHandleEl: (el: HTMLHRElement | null) => void
  selectedRow: GraphTableInspectorRow | null

  onColumnWidthChanged: (columnId: string, widthPx: number) => void
  onRequestReorderColumn: (fromColumnId: string, toColumnId: string, side: 'left' | 'right') => void
  onCellValueChanged: (rowId: string, columnId: string, next: unknown) => void
  onColumnKindChanged: (columnId: string, kind: GraphColumnDoc['kind']) => void
  onHideColumnInView: (columnId: string) => void
  onUpsertColumnFilter: (args: { columnId: string; operator: GraphTableFilterOperator; value: string }) => void
  onSetSingleColumnSort: (args: { columnId: string; direction: GraphTableSortDirection }) => void
  onRowClicked: (rowId: string) => void

  columnOrderIds: string[] | undefined
}) {
  const handleSelectionChanged = React.useCallback((ids: string[]) => {
    props.setSelectedRowIds(ids)
    props.setInspectorRowId(ids[0] || null)
  }, [props.setInspectorRowId, props.setSelectedRowIds])

  const handleInspectorDeleteRow = React.useCallback(() => {
    const rowId = props.selectedRow?.rowId
    if (!rowId) return
    props.setSelectedRowIds([rowId])
    props.onDeleteSelected()
  }, [props.onDeleteSelected, props.selectedRow, props.setSelectedRowIds])

  return (
    <section className={`flex-1 min-h-0 overflow-hidden flex flex-col ${UI_THEME_TOKENS.text.primary}`} aria-label="Graph Data Table">
      <GraphTableWorkspaceHeader
        panelTypography={props.panelTypography}
        activeTableId={props.activeTableId}
        setActiveTableId={props.setActiveTableId}
        viewMode={props.viewMode}
        setViewMode={props.setViewMode}
        geospatialViewEnabled={props.geospatialViewEnabled}
        setGeospatialViewEnabled={props.setGeospatialViewEnabled}
        tableToGraphRenderingEnabled={props.tableToGraphRenderingEnabled}
        setTableToGraphRenderingEnabled={props.setTableToGraphRenderingEnabled}
        rowCountLabel={props.rowCountLabel}
        orderedColumns={props.orderedColumns}
        inspectorOpen={props.inspectorOpen}
        setInspectorOpen={props.setInspectorOpen}
        canvasPreviewAvailable={props.canvasPreviewAvailable}
        canvasPreviewCollapsed={props.canvasPreviewCollapsed}
        setCanvasPreviewCollapsed={props.setCanvasPreviewCollapsed}
        columnVisibilityById={props.columnVisibilityById}
        setColumnVisibilityById={props.setColumnVisibilityById}
        filterMatch={props.filterMatch}
        setFilterMatch={props.setFilterMatch}
        filterClauses={props.filterClauses}
        setFilterClauses={props.setFilterClauses}
        groupBy={props.groupBy}
        setGroupBy={props.setGroupBy}
        sortRules={props.sortRules}
        setSortRules={props.setSortRules}
        rowHeightPreset={props.rowHeightPreset}
        setRowHeightPreset={props.setRowHeightPreset}
        columnWidthsPxById={props.columnWidthsPxById}
        resetColumnWidths={props.resetColumnWidths}
        onAddRow={props.onAddRow}
        onDeleteSelected={props.onDeleteSelected}
        hasSelection={props.hasSelection}
        syncNowVisible={props.syncNowVisible}
        syncNowDisabled={props.syncNowDisabled}
        onSyncNow={props.onSyncNow}
        onClose={props.onClose}
      />

      <section className="flex-1 min-h-0 overflow-hidden flex" aria-label="Table workspace">
        <section className="flex-1 min-w-0 min-h-0 overflow-hidden flex" aria-label="Table and inspector">
          {props.viewMode === 'kanban' ? (
            <GraphTableKanbanView
              tableId={props.activeTableId}
              columns={props.columns}
              rows={props.rows}
              columnVisibilityById={props.columnVisibilityById}
              filterMatch={props.filterMatch}
              filterClauses={props.filterClauses}
              groupBy={props.groupBy}
              sortRules={props.sortRules}
              columnOrderIds={props.columnOrderIds}
              selectedRowIds={props.selectedRowIds}
              onRowClicked={props.onRowClicked}
            />
          ) : (
            <GraphTableDomTableView
              tableId={props.activeTableId}
              panelTypography={props.panelTypography}
              columns={props.columns}
              rows={props.rows}
              selectedRowIds={props.selectedRowIds}
              columnVisibilityById={props.columnVisibilityById}
              filterMatch={props.filterMatch}
              filterClauses={props.filterClauses}
              groupBy={props.groupBy}
              sortRules={props.sortRules}
              rowHeightPreset={props.rowHeightPreset}
              columnWidthsPxById={props.columnWidthsPxById}
              columnOrderIds={props.columnOrderIds}
              onRowClicked={props.onRowClicked}
              onSelectionChanged={handleSelectionChanged}
            />
          )}

          {props.showInspector && (
            <>
              <VerticalResizeSeparatorHr
                ref={el => {
                  props.setInspectorDragHandleEl(el)
                }}
                ariaLabel="Resize inspector"
              />
              <GraphTableInspector
                widthPx={props.inspectorWidthPx}
                columns={props.columns}
                row={props.selectedRow}
                onClose={() => props.setInspectorRowId(null)}
                onChangeCell={(columnId, next) => {
                  const rowId = props.selectedRow?.rowId
                  if (!rowId) return
                  props.onCellValueChanged(rowId, columnId, next)
                }}
                onDeleteRow={handleInspectorDeleteRow}
              />
            </>
          )}
        </section>
      </section>
    </section>
  )
}
