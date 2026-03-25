import React from 'react'
import type { GraphTableId } from '@/features/graph-table-db/graphTableDb'
import type { PanelTypography } from '@/lib/ui/panelTypography'
import { UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type {
  GraphTableColumnVisibilityById,
  GraphTableColumnWidthsPxById,
  GraphTableFilterClause,
  GraphTableFilterMatch,
  GraphTableRowHeightPreset,
  GraphTableSortRule,
} from '@/features/graph-table/ui/graphTableViewState'
import { WorkspaceHeader, WorkspaceHeaderRow } from '@/components/ui/WorkspaceHeader'
import { GraphTableToolbar } from '@/features/graph-table/ui/GraphTableToolbar'
import type { GraphTableViewMode } from '@/features/graph-table/ui/graphTableViewMode'
import { WorkspaceModeSelect } from '@/components/BottomPanel/markdownWorkspace/WorkspaceModeSelect'
import { UI_COPY } from '@/lib/config'

const GRAPH_TABLE_VIEW_MODE_OPTIONS: Array<{ value: GraphTableViewMode; label: string }> = [
  { value: 'kanban', label: UI_COPY.markdownDataViewKanbanViewLabel },
  { value: 'table', label: UI_COPY.markdownDataViewTableViewLabel },
]

export function GraphTableWorkspaceHeader(props: {
  panelTypography: PanelTypography
  activeTableId: GraphTableId
  setActiveTableId: (next: GraphTableId) => void
  viewMode: GraphTableViewMode
  setViewMode: (next: GraphTableViewMode) => void
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
}) {
  return (
    <WorkspaceHeader ariaLabel="Table header" border="divider">
      <WorkspaceHeaderRow ariaLabel="Table header row">
        <section className="kg-toolbar min-w-0 flex items-center gap-3" aria-label="Table navigation">
          <h1 className="font-semibold">{UI_LABELS.graphDataTable}</h1>

          <nav className="kg-toolbar flex items-center gap-2" aria-label="Dataset selector">
            <button
              type="button"
              className={`App-toolbar__btn ${props.panelTypography.microLabelClass} ${props.activeTableId === 'nodes' ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}`}
              onClick={() => props.setActiveTableId('nodes')}
            >
              Nodes
            </button>
            <button
              type="button"
              className={`App-toolbar__btn ${props.panelTypography.microLabelClass} ${props.activeTableId === 'edges' ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}`}
              onClick={() => props.setActiveTableId('edges')}
            >
              Edges
            </button>

            <WorkspaceModeSelect<GraphTableViewMode>
              ariaLabel="Graph Data Table view"
              value={props.viewMode}
              options={GRAPH_TABLE_VIEW_MODE_OPTIONS}
              isActive={props.viewMode === 'kanban'}
              onChange={props.setViewMode}
            />
          </nav>

          <output className={`${props.panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.tertiary}`}>{props.rowCountLabel}</output>
        </section>

        <section className="flex-1 min-w-0 flex justify-center" aria-label="Table toolbar">
          <GraphTableToolbar
            panelTypography={props.panelTypography}
            columns={props.orderedColumns}
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
          />
        </section>

        <nav className="kg-toolbar flex items-center gap-2" aria-label="Table actions">
          {props.syncNowVisible ? (
            <button
              type="button"
              className={`App-toolbar__btn ${props.panelTypography.microLabelClass} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
              onClick={props.onSyncNow}
              disabled={props.syncNowDisabled}
            >
              {UI_LABELS.syncNow}
            </button>
          ) : null}
          <button
            type="button"
            className={`App-toolbar__btn ${props.panelTypography.microLabelClass} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
            onClick={props.onAddRow}
          >
            + Row
          </button>
          <button
            type="button"
            className={`App-toolbar__btn ${props.panelTypography.microLabelClass} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
            onClick={props.onDeleteSelected}
            disabled={!props.hasSelection}
          >
            Delete
          </button>
          <button
            type="button"
            className={`App-toolbar__btn ${props.panelTypography.microLabelClass} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
            onClick={props.onClose}
          >
            {UI_LABELS.close}
          </button>
        </nav>
      </WorkspaceHeaderRow>
    </WorkspaceHeader>
  )
}
