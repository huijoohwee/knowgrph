import { useGraphStore } from '@/hooks/useGraphStore'
import type { SavedDocumentUiModeState } from '@/features/canvas/graphStoreDocumentUiRestorePlan'
import type {
  SavedDocumentUiSelectionState,
  SavedDocumentUiViewState,
} from '@/features/canvas/graphStoreDocumentUiRestoreState'

type GraphStoreApi = ReturnType<typeof useGraphStore.getState>

export function applySavedDocumentUiModeStateWrites(api: GraphStoreApi, modeState: SavedDocumentUiModeState): void {
  if (modeState.documentSemanticMode) api.setDocumentSemanticMode(modeState.documentSemanticMode)
  if (typeof modeState.frontmatterModeEnabled === 'boolean') api.setFrontmatterModeEnabled(modeState.frontmatterModeEnabled)
  if (typeof modeState.multiDimTableModeEnabled === 'boolean') api.setMultiDimTableModeEnabled(modeState.multiDimTableModeEnabled)
  if (modeState.canvasRenderMode) api.setCanvasRenderMode(modeState.canvasRenderMode)
  if (modeState.canvas3dMode) api.setCanvas3dMode(modeState.canvas3dMode)
  if (modeState.canvas2dRenderer) api.setCanvas2dRenderer(modeState.canvas2dRenderer)
}

export function applySavedDocumentUiViewStateWrites(api: GraphStoreApi, viewState: SavedDocumentUiViewState): void {
  api.setViewPinned(viewState.pinned)
  if (!viewState.pinned) {
    api.setZoomToSelectionMode(viewState.zoomToSelectionMode)
    api.setFitToScreenMode(viewState.fitToScreenMode)
    if (!viewState.zoomToSelectionMode && !viewState.fitToScreenMode) {
      api.setZoomToSelectionMode(false)
      api.setFitToScreenMode(false)
    }
  }
}

export function applySavedDocumentUiSelectionStateWrites(api: GraphStoreApi, selectionState: SavedDocumentUiSelectionState): void {
  if (selectionState.hasSelection) {
    api.setSelectionSource('canvas')
    api.selectNodesExpanded({
      nodeIds: selectionState.nodeIds,
      edgeIds: selectionState.edgeIds,
      groupIds: selectionState.groupIds,
      activeNodeId: selectionState.activeNodeId,
    })
    return
  }
  api.selectNode(null)
}
