import type { PerDocumentUiState } from '@/lib/persistence/perDocumentUiState'

export type SavedDocumentUiViewState = {
  pinned: boolean
  zoomToSelectionMode: boolean
  fitToScreenMode: boolean
}

export type SavedDocumentUiSelectionState = {
  nodeIds: string[]
  edgeIds: string[]
  groupIds: string[]
  activeNodeId: string | null
  hasSelection: boolean
}

export function buildSavedDocumentUiViewState(saved: PerDocumentUiState): SavedDocumentUiViewState {
  const pinned = saved.viewPinned === true
  const zoomToSelectionMode = !pinned && saved.zoomToSelectionMode === true
  const fitToScreenMode = !pinned && !zoomToSelectionMode && saved.fitToScreenMode === true
  return {
    pinned,
    zoomToSelectionMode,
    fitToScreenMode,
  }
}

export function buildSavedDocumentUiSelectionState(saved: PerDocumentUiState): SavedDocumentUiSelectionState {
  const nodeIds = Array.isArray(saved.selectedNodeIds) ? saved.selectedNodeIds : []
  const edgeIds = Array.isArray(saved.selectedEdgeIds) ? saved.selectedEdgeIds : []
  const groupIds = Array.isArray(saved.selectedGroupIds) ? saved.selectedGroupIds : []
  return {
    nodeIds,
    edgeIds,
    groupIds,
    activeNodeId: typeof saved.selectedNodeId === 'string' ? saved.selectedNodeId : null,
    hasSelection: nodeIds.length > 0 || edgeIds.length > 0 || groupIds.length > 0,
  }
}
