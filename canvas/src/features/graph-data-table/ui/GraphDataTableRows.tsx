import React from 'react'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphFieldSettingsResolved } from '@/features/graph-fields/graphFields'
import {
  type GraphDataTableAggregateVizMode,
  type GraphDataTableColumnKey,
  type GraphDataTableListItem,
  type GraphDataTableRowDensity,
  type UnifiedRow,
} from '@/features/graph-data-table/graphDataTable'
import { UI_COPY } from '@/lib/config'
import {
  AggregateRowBarVisualization,
  AggregateRowSparklineVisualization,
  AggregateRowVisualization,
} from '@/features/graph-data-table/ui/GraphDataTableAggregateViz'
import { BodyCell } from './GraphDataTableBody'
import { FROZEN_DATA_COLUMN_LEFT } from './GraphDataTableHeader'
import { useGraphStore } from '@/hooks/useGraphStore'
import { uiPrimaryIconActiveClassName } from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { MVP_COLOR_PALETTE } from '@/lib/graph/schema'
import type { PanelTypography } from '@/lib/ui/panelTypography'

type SelectionSets = {
  selectedNodeIdSet: Set<string>
  selectedEdgeIdSet: Set<string>
}

export type GraphDataTableRowsProps = {
  listItems: GraphDataTableListItem[]
  startIndex: number
  endIndex: number
  topSpacerHeight: number
  bottomSpacerHeight: number
  effectiveColumnCount: number
  orderedVisibleColumnKeys: GraphDataTableColumnKey[]
  columnWidths: Partial<Record<GraphDataTableColumnKey, number>>
  selectedColumnKey: GraphDataTableColumnKey | null
  columnLabelByKey: Map<GraphDataTableColumnKey, string>
  propertyFieldSettingsByColumnKey: Map<GraphDataTableColumnKey, GraphFieldSettingsResolved>
  rowDensity: GraphDataTableRowDensity
  isEmpty: boolean
  bodyCellBaseClassName: string
  indexColumnWidthClassName: string
  textInputClassName: string
  monoTextInputClassName: string
  uiPanelKeyValueTextSizeClass: string
  uiPanelMonospaceTextClass: string
  panelTypography: PanelTypography
  aggregateVizMode: GraphDataTableAggregateVizMode
  setAggregateVizMode: React.Dispatch<React.SetStateAction<GraphDataTableAggregateVizMode>>
  groupSelectionById: Map<string, boolean>
  selectionSets: SelectionSets
  neighborIds: Set<string>
  incidentEdgeIds: Set<string>
  edgeEndpointNodeIds: Set<string>
  nodeById: Map<string, GraphNode>
  edgeById: Map<string, GraphEdge>
  dataRowIndexByItemIndex: Record<number, number>
  nodeScopeBorderColor: string
  edgeScopeBorderColor: string
  frozenBoundaryColumnKey: GraphDataTableColumnKey | null
  freezeFirstDataColumn: 'none' | 'label' | 'id'
  onStartFrozenAreaDrag: (clientX: number) => void
  expandedCellRowId: string | null
  expandedCellColumnKey: GraphDataTableColumnKey | null
  onToggleExpandCell: (columnKey: GraphDataTableColumnKey, rowId: string) => void
  updateNode: (id: string, patch: Partial<GraphNode>) => void
  updateEdge: (id: string, patch: Partial<GraphEdge>) => void
  onRowClick: (row: UnifiedRow) => void
  onRowDoubleClick: (row: UnifiedRow) => void
  onRowContextMenu?: (event: React.MouseEvent, row: UnifiedRow) => void
  flashSelectionId?: string | null
}

export function GraphDataTableRows({
  listItems,
  startIndex,
  endIndex,
  topSpacerHeight,
  bottomSpacerHeight,
  effectiveColumnCount,
  orderedVisibleColumnKeys,
  columnWidths,
  selectedColumnKey,
  columnLabelByKey,
  propertyFieldSettingsByColumnKey,
  rowDensity,
  isEmpty,
  bodyCellBaseClassName,
  indexColumnWidthClassName,
  textInputClassName,
  monoTextInputClassName,
  uiPanelKeyValueTextSizeClass,
  uiPanelMonospaceTextClass,
  panelTypography,
  aggregateVizMode,
  setAggregateVizMode,
  groupSelectionById,
  selectionSets,
  neighborIds,
  incidentEdgeIds,
  edgeEndpointNodeIds,
  nodeById,
  edgeById,
  dataRowIndexByItemIndex,
  nodeScopeBorderColor,
  edgeScopeBorderColor,
  frozenBoundaryColumnKey,
  freezeFirstDataColumn,
  onStartFrozenAreaDrag,
  expandedCellRowId,
  expandedCellColumnKey,
  onToggleExpandCell,
  updateNode,
  updateEdge,
  onRowClick,
  onRowDoubleClick,
  onRowContextMenu,
  flashSelectionId,
}: GraphDataTableRowsProps) {
  const mediaNodeOpacity = useGraphStore(s => s.mediaNodeOpacity)
  const selectionFlashOpacity = useGraphStore(s => s.selectionFlashOpacity || 0.18)
  const flashAlpha = Math.max(0, Math.min(1, selectionFlashOpacity * 1.7))
  const outlineThicknessClass =
    selectionFlashOpacity >= 0.8 ? 'ring-2' : selectionFlashOpacity >= 0.25 ? 'ring-1' : ''
  const selectionFlashColor = MVP_COLOR_PALETTE.nodes.pivot
  return (
    <>
      {topSpacerHeight > 0 && (
        <tr aria-hidden="true">
          <th
            scope="row"
            className={`p-0 border-0 sticky left-0 z-10 ${indexColumnWidthClassName} ${UI_THEME_TOKENS.table.headerBg}`}
          />
          <td colSpan={effectiveColumnCount - 1} style={{ height: topSpacerHeight, padding: 0, border: 0 }} />
        </tr>
      )}
      {listItems.slice(startIndex, endIndex + 1).map((item, index) => {
        const itemIndex = startIndex + index

        if (item.kind === 'group') {
          const showFrozen = freezeFirstDataColumn !== 'none'
          const restColSpan = Math.max(0, effectiveColumnCount - (showFrozen ? 2 : 1))
          return (
            <tr key={`group:${itemIndex}:${item.id}`} className={UI_THEME_TOKENS.table.headerBg}>
              <th
                scope="row"
                className={`p-0 border-b ${UI_THEME_TOKENS.table.cellBorder} border-r ${UI_THEME_TOKENS.table.cellBorder} sticky left-0 z-10 ${indexColumnWidthClassName} ${UI_THEME_TOKENS.table.headerBg}`}
              />
              {showFrozen && (
                <td
                  className={`${bodyCellBaseClassName} sticky z-0 ${UI_THEME_TOKENS.panel.bg}`}
                  style={{ left: FROZEN_DATA_COLUMN_LEFT }}
                />
              )}
              {restColSpan > 0 && (
                <td className={`${bodyCellBaseClassName} font-medium ${UI_THEME_TOKENS.table.text}`} colSpan={restColSpan}>
                  {item.label} ({item.rows.length.toLocaleString()})
                </td>
              )}
            </tr>
          )
        }
        if (item.kind === 'aggregate') {
          const showFrozen = freezeFirstDataColumn !== 'none'
          const restColSpan = Math.max(0, effectiveColumnCount - (showFrozen ? 2 : 1))
          return (
            <tr key={`aggregate:${itemIndex}:${item.groupId}`} className={UI_THEME_TOKENS.table.headerBg}>
              <th
                scope="row"
                className={`p-0 border-b ${UI_THEME_TOKENS.table.cellBorder} border-r ${UI_THEME_TOKENS.table.cellBorder} sticky left-0 z-10 ${indexColumnWidthClassName} ${UI_THEME_TOKENS.table.headerBg}`}
              />
              {showFrozen && (
                <td
                  className={`${bodyCellBaseClassName} sticky z-0 ${UI_THEME_TOKENS.panel.bg}`}
                  style={{ left: FROZEN_DATA_COLUMN_LEFT }}
                />
              )}
              <td
                className={`${bodyCellBaseClassName} ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.table.textSecondary}`}
                colSpan={showFrozen ? restColSpan : effectiveColumnCount - 1}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>
                    {item.count.toLocaleString()}{' '}
                    {item.count === 1
                      ? UI_COPY.graphDataTableRowsCountOne
                      : UI_COPY.graphDataTableRowsCountMany}
                  </span>
                  {item.numericSummaries.map((summary, summaryIndex) => (
                    <span
                      key={summary.key ?? `summary:${summaryIndex}`}
                      className={`flex items-center gap-1 ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.table.textSecondary}`}
                    >
                      <span className={UI_THEME_TOKENS.text.tertiary}>•</span>
                      <span className={uiPanelMonospaceTextClass}>
                        {columnLabelByKey.get(summary.key) ?? summary.key}
                        {': '}
                        {UI_COPY.graphDataTableSum} {summary.sum.toLocaleString()},{' '}
                        {UI_COPY.graphDataTableAvg} {summary.avg.toLocaleString()},{' '}
                        {UI_COPY.graphDataTableMin} {summary.min.toLocaleString()},{' '}
                        {UI_COPY.graphDataTableMax} {summary.max.toLocaleString()}
                      </span>
                    </span>
                  ))}
                  {item.numericSummaries.length > 0 && (
                    <div className="ml-auto flex items-center">
                      {aggregateVizMode === 'radial' && (
                        <AggregateRowVisualization
                          numericSummaries={item.numericSummaries}
                          width={120}
                          height={40}
                          isHighlighted={groupSelectionById.get(item.groupId) === true}
                        />
                      )}
                      {aggregateVizMode === 'bars' && (
                        <AggregateRowBarVisualization
                          numericSummaries={item.numericSummaries}
                          width={120}
                          height={40}
                          isHighlighted={groupSelectionById.get(item.groupId) === true}
                        />
                      )}
                      {aggregateVizMode === 'sparkline' && (
                        <AggregateRowSparklineVisualization
                          numericSummaries={item.numericSummaries}
                          width={120}
                          height={40}
                          isHighlighted={groupSelectionById.get(item.groupId) === true}
                        />
                      )}
                      <button
                        type="button"
                        className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary} hover:${UI_THEME_TOKENS.text.secondary} ml-2`}
                        onClick={() =>
                          setAggregateVizMode(prev => {
                            if (prev === 'none') return 'radial'
                            if (prev === 'radial') return 'bars'
                            if (prev === 'bars') return 'sparkline'
                            return 'none'
                          })
                        }
                      >
                        {aggregateVizMode === 'none' && UI_COPY.graphDataTableAggregateChartToggleOff}
                        {aggregateVizMode === 'radial' && UI_COPY.graphDataTableAggregateChartToggleRadial}
                        {aggregateVizMode === 'bars' && UI_COPY.graphDataTableAggregateChartToggleBars}
                        {aggregateVizMode === 'sparkline' && UI_COPY.graphDataTableAggregateChartToggleSparkline}
                      </button>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          )
        }

        const row = item.row
        const isNodeRow = row.kind === 'node'
        const isEdgeRow = row.kind === 'edge'
        const isActive =
          (isNodeRow && selectionSets.selectedNodeIdSet.has(row.id)) ||
          (isEdgeRow && selectionSets.selectedEdgeIdSet.has(row.id))
        const useFlash =
          !!flashSelectionId &&
          ((isNodeRow && row.id === flashSelectionId) || (isEdgeRow && row.id === flashSelectionId))
        const isRelated =
          isNodeRow
            ? selectionSets.selectedNodeIdSet.size > 0
              ? selectionSets.selectedNodeIdSet.has(row.id) || neighborIds.has(row.id)
              : selectionSets.selectedEdgeIdSet.size > 0
                ? edgeEndpointNodeIds.has(row.id)
                : false
            : isEdgeRow
              ? selectionSets.selectedNodeIdSet.size > 0
                ? incidentEdgeIds.has(row.id)
                : selectionSets.selectedEdgeIdSet.size > 0
                  ? selectionSets.selectedEdgeIdSet.has(row.id)
                  : false
              : false
        const activeNode = row.kind === 'node' ? nodeById.get(row.id) : undefined
        const activeEdge = row.kind === 'edge' ? edgeById.get(row.id) : undefined
        const rowIndex = dataRowIndexByItemIndex[itemIndex]

        const scopeBorderColor =
          isNodeRow
            ? (() => {
                const props = (activeNode?.properties || {}) as Record<string, unknown>
                const vf = typeof props['visual:fill'] === 'string' ? props['visual:fill'].trim() : ''
                if (vf) return vf
                const f = typeof props['fill'] === 'string' ? props['fill'].trim() : ''
                if (f) return f
                return nodeScopeBorderColor || null
              })()
            : isEdgeRow
              ? (() => {
                  const props = (activeEdge?.properties || {}) as Record<string, unknown>
                  const vs = typeof props['visual:stroke'] === 'string' ? props['visual:stroke'].trim() : ''
                  if (vs) return vs
                  const vc = typeof props['visual:color'] === 'string' ? props['visual:color'].trim() : ''
                  if (vc) return vc
                  return edgeScopeBorderColor || null
                })()
              : null

        const selectionClassName = isActive
    ? `${UI_THEME_TOKENS.table.rowSelected}`
    : isRelated
      ? UI_THEME_TOKENS.table.rowRelated
      : UI_THEME_TOKENS.table.rowBg
  const outlineClassName =
    useFlash && outlineThicknessClass
      ? `${outlineThicknessClass} ring-[color:${selectionFlashColor}]`
      : ''
  const flashStyle = useFlash
    ? {
        backgroundColor: `rgba(253,126,20,${flashAlpha})`,
      }
    : undefined
  const borderClass = isActive ? '' : `border-b ${UI_THEME_TOKENS.table.cellBorder}`
  return (
    <tr
      key={`row:${itemIndex}:${row.id}`}
      className={`cursor-default ${borderClass} ${UI_THEME_TOKENS.table.rowHoverAmber} ${selectionClassName} ${outlineClassName}`}
      style={{
        ...(mediaNodeOpacity < 1 ? { opacity: mediaNodeOpacity } : undefined),
        ...(flashStyle || {}),
      }}
      onClick={() => onRowClick(row)}
      onDoubleClick={() => onRowDoubleClick(row)}
      onContextMenu={(e) => onRowContextMenu && onRowContextMenu(e, row)}
    >
      <th
        scope="row"
        className={`group p-0 ${borderClass} border-r ${UI_THEME_TOKENS.table.cellBorder} sticky left-0 z-10 ${indexColumnWidthClassName} ${UI_THEME_TOKENS.table.headerBg} ${uiPanelKeyValueTextSizeClass} font-normal ${UI_THEME_TOKENS.table.textSecondary} text-center align-top`}
        data-row-index={rowIndex}
      >
              <div className="relative flex items-center justify-center h-8">
                {scopeBorderColor ? (
                  <svg
                    aria-hidden="true"
                    className="absolute left-0 top-0 h-full w-[3px]"
                    viewBox="0 0 3 24"
                  >
                    <rect x="0" y="0" width="3" height="24" fill={scopeBorderColor} />
                  </svg>
                ) : null}
                <span className={`${uiPanelMonospaceTextClass} tabular-nums ${UI_THEME_TOKENS.table.textSecondary} transition-opacity ${isActive ? 'opacity-0' : 'group-hover:opacity-0'}`}>
                  {rowIndex}
                </span>
                <input
                  type="checkbox"
                  className={`absolute h-4 w-4 rounded ${UI_THEME_TOKENS.input.border} ${uiPrimaryIconActiveClassName} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 transition-opacity ${
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  checked={isActive}
                  onChange={event => {
                    event.stopPropagation()
                    onRowClick(row)
                  }}
                  onClick={event => event.stopPropagation()}
                />
              </div>
            </th>
            {orderedVisibleColumnKeys.map(columnKey => (
              <BodyCell
                key={columnKey}
                columnKey={columnKey}
                row={row}
                isActive={isActive}
                rowDensity={rowDensity}
                bodyCellBaseClassName={bodyCellBaseClassName}
                textInputClassName={textInputClassName}
                monoTextInputClassName={monoTextInputClassName}
                activeNode={activeNode}
                activeEdge={activeEdge}
                updateNode={updateNode}
                updateEdge={updateEdge}
                fieldSettingsByColumnKey={propertyFieldSettingsByColumnKey}
                freezeFirstDataColumn={freezeFirstDataColumn}
                showFrozenResizeHandle={columnKey === frozenBoundaryColumnKey}
                onStartFrozenAreaDrag={onStartFrozenAreaDrag}
                expandedCellRowId={expandedCellRowId}
                expandedCellColumnKey={expandedCellColumnKey}
                onToggleExpandCell={onToggleExpandCell}
                uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
                panelTypography={panelTypography}
                width={columnWidths[columnKey]}
                isColumnSelected={selectedColumnKey === columnKey}
              />
            ))}
          </tr>
        )
      })}
      {bottomSpacerHeight > 0 && (
        <tr aria-hidden="true">
          <th
            scope="row"
            className={`p-0 border-0 sticky left-0 z-10 ${indexColumnWidthClassName} ${UI_THEME_TOKENS.table.headerBg}`}
          />
          <td colSpan={effectiveColumnCount - 1} style={{ height: bottomSpacerHeight, padding: 0, border: 0 }} />
        </tr>
      )}
      {isEmpty && (
        <tr>
          <th
            scope="row"
            className={`p-0 sticky left-0 z-10 ${indexColumnWidthClassName} ${UI_THEME_TOKENS.table.headerBg}`}
          />
          <td className={`px-2 py-10 ${UI_THEME_TOKENS.table.textSecondary} text-center`} colSpan={effectiveColumnCount - 1}>
            {UI_COPY.graphDataTableNoRowsMatch}
          </td>
        </tr>
      )}
    </>
  )
}
