import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import type {
  GraphDataTableColumnKey,
  GraphDataTableListItem,
  GraphDataTableRowDensity,
  GraphDataTableSortDir,
  GraphDataTableSortRule,
  UnifiedRow,
} from '@/features/graph-data-table/graphDataTable'
import type { GraphFieldSettingsResolved } from '@/features/graph-fields/graphFields'
import type { BottomPanelCuratorContentViewModel } from '@/components/BottomPanel/BottomPanelCuratorContent'

export function buildBottomPanelCuratorTableModel(params: {
  listItems: GraphDataTableListItem[]
  orderedVisibleColumnKeys: GraphDataTableColumnKey[]
  visibleRows: UnifiedRow[]
  columnLabelByKey: Map<GraphDataTableColumnKey, string>
  propertyFieldSettingsByColumnKey: Map<GraphDataTableColumnKey, GraphFieldSettingsResolved>
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
  graphDataTableSortRules: ReadonlyArray<GraphDataTableSortRule>
  addGraphDataTableFilterForColumn: (key: GraphDataTableColumnKey) => void
  requestGroupByColumn: (key: GraphDataTableColumnKey | '') => void
  requestHideColumn: (key: GraphDataTableColumnKey) => void
  requestSortByColumn: (key: GraphDataTableColumnKey, dir: GraphDataTableSortDir) => void
  rowDensity: GraphDataTableRowDensity
  isAutoScrollDisabled: boolean
  freezeFirstDataColumn: 'none' | 'label' | 'id'
  setFreezeFirstDataColumn: (value: 'none' | 'label' | 'id') => void
}): BottomPanelCuratorContentViewModel['table'] {
  return {
    listItems: params.listItems,
    orderedVisibleColumnKeys: params.orderedVisibleColumnKeys,
    visibleRows: params.visibleRows,
    columnLabelByKey: params.columnLabelByKey,
    propertyFieldSettingsByColumnKey: params.propertyFieldSettingsByColumnKey,
    selectedNodeId: params.selectedNodeId,
    selectedEdgeId: params.selectedEdgeId,
    selectedNodeIds: params.selectedNodeIds,
    selectedEdgeIds: params.selectedEdgeIds,
    nodeById: params.nodeById,
    edgeById: params.edgeById,
    updateNode: params.updateNode,
    updateEdge: params.updateEdge,
    onRowClick: params.onRowClick,
    onRowDoubleClick: params.onRowDoubleClick,
    onRowContextMenu: params.onRowContextMenu,
    sortRules: params.graphDataTableSortRules,
    onRequestAddFilter: params.addGraphDataTableFilterForColumn,
    onRequestGroupBy: params.requestGroupByColumn,
    onRequestHideColumn: params.requestHideColumn,
    onRequestSortByColumn: params.requestSortByColumn,
    rowDensity: params.rowDensity,
    isAutoScrollDisabled: params.isAutoScrollDisabled,
    freezeFirstDataColumn: params.freezeFirstDataColumn,
    setFreezeFirstDataColumn: params.setFreezeFirstDataColumn,
  }
}
