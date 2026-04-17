import { useGraphStore } from '@/hooks/useGraphStore'

export const testDocumentStructureBaselineLockRestoresPriorState = () => {
  const api = useGraphStore.getState()
  api.resetAll()

  api.setDocumentStructureBaselineLock(false)
  api.setDocumentSemanticMode('keyword')
  api.setFrontmatterModeEnabled(true)
  api.setCanvasRenderMode('3d')
  api.setCanvas2dRenderer('flowEditor')
  api.setViewPinned(true)
  api.setFitToScreenMode(false)
  api.setZoomToSelectionMode(true)
  api.setZoomState({ k: 1.25, x: 10, y: -20, graphDataRevision: 123, viewportW: 900, viewportH: 700 })
  api.setZoomStateForKey('test-key', { k: 0.75, x: 30, y: 40, graphDataRevision: 456, viewportW: 800, viewportH: 600 })
  api.setSelectionSource('toolbar')
  api.selectNode('node-1')
  api.selectEdge('edge-1')
  api.selectGroup('group-1')
  api.setCollapsedGroupIds(['group-a', 'group-b'])

  const before = useGraphStore.getState()
  const expected = {
    documentSemanticMode: before.documentSemanticMode,
    frontmatterModeEnabled: before.frontmatterModeEnabled,
    canvasRenderMode: before.canvasRenderMode,
    canvas2dRenderer: before.canvas2dRenderer,
    canvasRenderModeLastFree: before.canvasRenderModeLastFree,
    canvasRenderModeIsAuto: before.canvasRenderModeIsAuto,
    viewPinned: before.viewPinned,
    fitToScreenMode: before.fitToScreenMode,
    zoomToSelectionMode: before.zoomToSelectionMode,
    zoomState: before.zoomState,
    zoomStateByKey: before.zoomStateByKey,
    selectedNodeId: before.selectedNodeId,
    selectedEdgeId: before.selectedEdgeId,
    selectedGroupId: before.selectedGroupId,
    selectedNodeIds: before.selectedNodeIds,
    selectedEdgeIds: before.selectedEdgeIds,
    selectedGroupIds: before.selectedGroupIds,
    collapsedGroupIds: before.collapsedGroupIds,
  }

  api.setDocumentStructureBaselineLock(true)
  const locked = useGraphStore.getState()
  if (locked.documentStructureBaselineLock !== true) throw new Error('expected baseline lock enabled')
  if (locked.documentSemanticMode !== expected.documentSemanticMode) throw new Error('expected lock toggle to preserve semantic mode')
  if (locked.frontmatterModeEnabled !== expected.frontmatterModeEnabled) throw new Error('expected lock toggle to preserve frontmatter mode')
  if (locked.canvasRenderMode !== expected.canvasRenderMode) throw new Error('expected lock toggle to preserve canvas render mode')
  if (locked.canvas2dRenderer !== expected.canvas2dRenderer) throw new Error('expected lock toggle to preserve 2d renderer')
  if (locked.viewPinned !== expected.viewPinned) throw new Error('expected lock toggle to preserve viewPinned')
  if (locked.fitToScreenMode !== expected.fitToScreenMode) throw new Error('expected lock toggle to preserve fitToScreenMode')
  if (locked.zoomToSelectionMode !== expected.zoomToSelectionMode) throw new Error('expected lock toggle to preserve zoomToSelectionMode')
  if (JSON.stringify(locked.zoomState) !== JSON.stringify(expected.zoomState)) throw new Error('expected lock toggle to preserve zoomState')
  if (locked.selectedNodeId !== expected.selectedNodeId) throw new Error('expected lock toggle to preserve selectedNodeId')
  if (locked.selectedEdgeId !== expected.selectedEdgeId) throw new Error('expected lock toggle to preserve selectedEdgeId')
  if (locked.selectedGroupId !== expected.selectedGroupId) throw new Error('expected lock toggle to preserve selectedGroupId')
  if ((locked.collapsedGroupIds || []).join('|') !== (expected.collapsedGroupIds || []).join('|')) {
    throw new Error('expected lock toggle to preserve collapsed groups')
  }

  api.setDocumentStructureBaselineLock(false)
  const restored = useGraphStore.getState()
  if (restored.documentStructureBaselineLock !== false) throw new Error('expected baseline lock disabled')
  if (restored.documentSemanticMode !== expected.documentSemanticMode) throw new Error('expected semantic mode restored')
  if (restored.frontmatterModeEnabled !== expected.frontmatterModeEnabled) throw new Error('expected frontmatter restored')
  if (restored.canvasRenderMode !== expected.canvasRenderMode) throw new Error('expected canvas render mode restored')
  if (restored.canvas2dRenderer !== expected.canvas2dRenderer) throw new Error('expected 2d renderer restored')
  if (restored.canvasRenderModeLastFree !== expected.canvasRenderModeLastFree) throw new Error('expected last free render mode restored')
  if (restored.canvasRenderModeIsAuto !== expected.canvasRenderModeIsAuto) throw new Error('expected auto render mode restored')
  if (restored.viewPinned !== expected.viewPinned) throw new Error('expected viewPinned restored')
  if (restored.fitToScreenMode !== expected.fitToScreenMode) throw new Error('expected fitToScreenMode restored')
  if (restored.zoomToSelectionMode !== expected.zoomToSelectionMode) throw new Error('expected zoomToSelectionMode restored')
  if (JSON.stringify(restored.zoomState) !== JSON.stringify(expected.zoomState)) throw new Error('expected zoomState restored')
  if (JSON.stringify(restored.zoomStateByKey) !== JSON.stringify(expected.zoomStateByKey)) throw new Error('expected zoomStateByKey restored')
  if (restored.selectedNodeId !== expected.selectedNodeId) throw new Error('expected selectedNodeId restored')
  if (restored.selectedEdgeId !== expected.selectedEdgeId) throw new Error('expected selectedEdgeId restored')
  if (restored.selectedGroupId !== expected.selectedGroupId) throw new Error('expected selectedGroupId restored')
  if ((restored.selectedNodeIds || []).join('|') !== (expected.selectedNodeIds || []).join('|')) {
    throw new Error('expected selectedNodeIds restored')
  }
  if ((restored.selectedEdgeIds || []).join('|') !== (expected.selectedEdgeIds || []).join('|')) {
    throw new Error('expected selectedEdgeIds restored')
  }
  if ((restored.selectedGroupIds || []).join('|') !== (expected.selectedGroupIds || []).join('|')) {
    throw new Error('expected selectedGroupIds restored')
  }
  if ((restored.collapsedGroupIds || []).join('|') !== (expected.collapsedGroupIds || []).join('|')) {
    throw new Error('expected collapsedGroupIds restored')
  }
}
