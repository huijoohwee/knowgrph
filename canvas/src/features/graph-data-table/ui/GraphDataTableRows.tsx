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
  columnLabelByKey: Map<GraphDataTableColumnKey, string>
  propertyFieldSettingsByColumnKey: Map<GraphDataTableColumnKey, GraphFieldSettingsResolved>
  rowDensity: GraphDataTableRowDensity
  isEmpty: boolean
  bodyCellBaseClassName: string
  indexColumnWidthClassName: string
  textInputClassName: string
  monoTextInputClassName: string
  textareaClassName: string
  uiPanelKeyValueTextSizeClass: string
  uiPanelMonospaceTextClass: string
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
}

export function GraphDataTableRows({
  listItems,
  startIndex,
  endIndex,
  topSpacerHeight,
  bottomSpacerHeight,
  effectiveColumnCount,
  orderedVisibleColumnKeys,
  columnLabelByKey,
  propertyFieldSettingsByColumnKey,
  rowDensity,
  isEmpty,
  bodyCellBaseClassName,
  indexColumnWidthClassName,
  textInputClassName,
  monoTextInputClassName,
  textareaClassName,
  uiPanelKeyValueTextSizeClass,
  uiPanelMonospaceTextClass,
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
}: GraphDataTableRowsProps) {
  return (
    <>
      {topSpacerHeight > 0 && (
        <tr aria-hidden="true">
          <td
            colSpan={effectiveColumnCount}
            style={{ height: topSpacerHeight, padding: 0, border: 0 }}
          />
        </tr>
      )}
      {listItems.slice(startIndex, endIndex + 1).map((item, index) => {
        const itemIndex = startIndex + index

        if (item.kind === 'group') {
          return (
            <tr key={`group:${itemIndex}:${item.id}`} className="bg-gray-50">
              <td
                className={`${bodyCellBaseClassName} font-medium text-gray-700 border-gray-200`}
                colSpan={effectiveColumnCount}
              >
                {item.label} ({item.rows.length.toLocaleString()})
              </td>
            </tr>
          )
        }
        if (item.kind === 'aggregate') {
          return (
            <tr key={`aggregate:${itemIndex}:${item.groupId}`} className="bg-gray-50">
              <td
                className={`${bodyCellBaseClassName} ${uiPanelKeyValueTextSizeClass} text-gray-500 border-gray-200`}
                colSpan={effectiveColumnCount}
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
                      className={`flex items-center gap-1 ${uiPanelKeyValueTextSizeClass} text-gray-500`}
                    >
                      <span className="text-gray-300">•</span>
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
                        className={`${uiPanelKeyValueTextSizeClass} text-gray-400 hover:text-gray-600 ml-2`}
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
          isNodeRow && nodeScopeBorderColor
            ? nodeScopeBorderColor
            : isEdgeRow && edgeScopeBorderColor
              ? edgeScopeBorderColor
              : null

        const selectionClassName =
          isActive
            ? 'bg-blue-100'
            : isRelated
              ? 'bg-blue-50'
              : rowIndex % 2 === 0
                ? 'bg-white'
                : 'bg-gray-50/50'
        return (
          <tr
            key={`row:${itemIndex}:${row.id}`}
            className={`cursor-default border-b border-gray-100 hover:bg-blue-50/40 ${selectionClassName}`}
            onClick={() => onRowClick(row)}
            onDoubleClick={() => onRowDoubleClick(row)}
          >
            <th
              scope="row"
              className={`group p-0 border-b border-gray-200 border-r border-gray-200 sticky left-0 z-10 ${indexColumnWidthClassName} bg-gray-100 text-xs font-normal text-gray-400 text-center align-top`}
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
                <span className={`${uiPanelMonospaceTextClass} tabular-nums text-gray-500 transition-opacity ${isActive ? 'opacity-0' : 'group-hover:opacity-0'}`}>
                  {rowIndex}
                </span>
                <input
                  type="checkbox"
                  className={`absolute h-4 w-4 rounded border-gray-300 text-blue-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 transition-opacity ${
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
                textareaClassName={textareaClassName}
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
              />
            ))}
          </tr>
        )
      })}
      {bottomSpacerHeight > 0 && (
        <tr aria-hidden="true">
          <td
            colSpan={effectiveColumnCount}
            style={{ height: bottomSpacerHeight, padding: 0, border: 0 }}
          />
        </tr>
      )}
      {isEmpty && (
        <tr>
          <td className="px-2 py-10 text-gray-500 text-center" colSpan={effectiveColumnCount}>
            {UI_COPY.graphDataTableNoRowsMatch}
          </td>
        </tr>
      )}
    </>
  )
}

