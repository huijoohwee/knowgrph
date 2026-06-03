import React from 'react'
import type { GraphTableId } from '@/features/graph-table-db/graphTableDb'
import type { PanelTypography } from '@/lib/ui/panelTypography'
import { UI_LABELS } from '@/lib/config'
import { MARKDOWN_DATA_VIEW_COPY } from '@/lib/config-copy/markdownDataViewCopy'
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
import type { WorkspaceTableViewMode } from '@/features/workspace-table/workspaceEditorMode'
import { WorkspaceModeSelect } from '@/features/markdown-workspace/WorkspaceModeSelect'
import { UI_TEXT_TRUNCATE, UI_TEXT_TRUNCATE_CHIP } from '@/lib/ui/textLayout'
import { UI_RESPONSIVE_INLINE_ELEMENT_ROW_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { uiToolbarRowScrollClassName, uiToolbarRowScrollJustifyEndClassName } from '@/features/toolbar/ui/toolbarStyles'
import { WORKSPACE_TABLE_VIEW_MODE_SELECT_OPTIONS } from '@/features/workspace-table/workspaceEditorModePresentation'

export function GraphTableWorkspaceHeader(props: {
  panelTypography: PanelTypography
  activeTableId: GraphTableId
  setActiveTableId: (next: GraphTableId) => void
  viewMode: WorkspaceTableViewMode
  setViewMode: (next: WorkspaceTableViewMode) => void
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
}) {
  return (
    <WorkspaceHeader ariaLabel={MARKDOWN_DATA_VIEW_COPY.headerAriaLabel} border="divider">
      <WorkspaceHeaderRow className="kg-graph-table-header kg-toolbar min-h-[var(--kg-control-height,28px)] py-0" ariaLabel={MARKDOWN_DATA_VIEW_COPY.headerRowAriaLabel}>
        <section className={`kg-graph-table-nav kg-toolbar ${uiToolbarRowScrollClassName} gap-2`} aria-label={MARKDOWN_DATA_VIEW_COPY.navigationAriaLabel}>
          <span className="sr-only">{UI_LABELS.graphDataTable}</span>

          <nav className={`kg-toolbar ${uiToolbarRowScrollClassName} gap-1.5`} aria-label="Dataset selector">
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

            <WorkspaceModeSelect<WorkspaceTableViewMode>
              ariaLabel={MARKDOWN_DATA_VIEW_COPY.viewSelectAriaLabel}
              value={props.viewMode}
              options={WORKSPACE_TABLE_VIEW_MODE_SELECT_OPTIONS}
              isActive={props.viewMode !== 'table'}
              onChange={props.setViewMode}
            />
            <label className={`${UI_RESPONSIVE_INLINE_ELEMENT_ROW_CLASSNAME} gap-1.5 text-[10px]`}>
              <input
                type="checkbox"
                className="shrink-0 rounded"
                checked={props.geospatialViewEnabled}
                onChange={e => props.setGeospatialViewEnabled(e.target.checked)}
              />
              <span className={UI_TEXT_TRUNCATE}>{MARKDOWN_DATA_VIEW_COPY.geospatialViewLabel}</span>
            </label>
            <label className={`${UI_RESPONSIVE_INLINE_ELEMENT_ROW_CLASSNAME} gap-1.5 text-[10px]`}>
              <input
                type="checkbox"
                className="shrink-0 rounded"
                checked={props.tableToGraphRenderingEnabled}
                onChange={e => props.setTableToGraphRenderingEnabled(e.target.checked)}
              />
              <span className={UI_TEXT_TRUNCATE}>{MARKDOWN_DATA_VIEW_COPY.graphRenderingToggleLabel}</span>
            </label>
          </nav>

          <output className={`${UI_TEXT_TRUNCATE_CHIP} ${props.panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.tertiary}`}>{props.rowCountLabel}</output>
        </section>

        <section className="flex min-w-0 max-w-full flex-1 justify-center overflow-hidden" aria-label={MARKDOWN_DATA_VIEW_COPY.toolbarAriaLabel}>
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

        <nav className={`kg-graph-table-actions kg-toolbar ${uiToolbarRowScrollJustifyEndClassName} gap-1.5`} aria-label={MARKDOWN_DATA_VIEW_COPY.actionsAriaLabel}>
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
