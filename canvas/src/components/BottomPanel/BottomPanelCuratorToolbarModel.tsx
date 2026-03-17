import type { GraphDataTablePanel } from '@/features/graph-data-table/ui/GraphDataTablePanelOverlay'
import type { GraphDataTableRowDensity } from '@/features/graph-data-table/graphDataTable'
import type { BottomPanelCuratorContentViewModel } from '@/components/BottomPanel/BottomPanelCuratorContent'
import type { GraphDataTableScope as HostGraphDataTableScope } from '@/hooks/store/types'

export type GraphDataTableScope = HostGraphDataTableScope

export function buildBottomPanelCuratorToolbarModel(params: {
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
}): BottomPanelCuratorContentViewModel['toolbar'] {
  return {
    graphDataTablePanel: params.graphDataTablePanel,
    setGraphDataTablePanel: params.setGraphDataTablePanel,
    graphDataTableScope: params.graphDataTableScope,
    setGraphDataTableScope: params.setGraphDataTableScope,
    viewMode: params.viewMode,
    setViewMode: params.setViewMode,
    selectedNodeId: params.selectedNodeId,
    selectedEdgeId: params.selectedEdgeId,
    onDeleteSelected: params.onDeleteSelected,
    onAddNode: params.onAddNode,
    onAddEdge: params.onAddEdge,
    nodesCount: params.nodesCount,
    fieldsMenuRef: params.fieldsMenuRef,
    filterMenuRef: params.filterMenuRef,
    sortMenuRef: params.sortMenuRef,
    groupMenuRef: params.groupMenuRef,
    resetToken: params.resetToken,
    rowDensity: params.rowDensity,
    setRowDensity: params.setRowDensity,
    isAutoScrollDisabled: params.isAutoScrollDisabled,
    setIsAutoScrollDisabled: params.setIsAutoScrollDisabled,
  }
}
