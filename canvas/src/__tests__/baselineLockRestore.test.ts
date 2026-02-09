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
  api.setSelectionSource('toolbar')
  api.selectNode('node-1')
  api.selectEdge('edge-1')
  api.selectGroup('group-1')

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
    selectedNodeId: before.selectedNodeId,
    selectedEdgeId: before.selectedEdgeId,
    selectedGroupId: before.selectedGroupId,
    selectedNodeIds: before.selectedNodeIds,
    selectedEdgeIds: before.selectedEdgeIds,
    selectedGroupIds: before.selectedGroupIds,
  }

  api.setDocumentStructureBaselineLock(true)
  const locked = useGraphStore.getState()
  if (locked.documentStructureBaselineLock !== true) throw new Error('expected baseline lock enabled')
  if (locked.documentSemanticMode !== 'document') throw new Error('expected baseline to force document semantic mode')
  if (locked.frontmatterModeEnabled !== false) throw new Error('expected baseline to force frontmatter off')
  if (locked.canvasRenderMode !== '2d') throw new Error('expected baseline to force 2d render mode')
  if (locked.canvas2dRenderer !== 'd3') throw new Error('expected baseline to force default 2d renderer')
  if (locked.viewPinned !== false) throw new Error('expected baseline to force view unpinned')
  if (locked.fitToScreenMode !== true) throw new Error('expected baseline to force fit-to-screen on')
  if (locked.zoomToSelectionMode !== false) throw new Error('expected baseline to force zoom-to-selection off')
  if (locked.selectedNodeId != null) throw new Error('expected baseline to clear selectedNodeId')
  if (locked.selectedEdgeId != null) throw new Error('expected baseline to clear selectedEdgeId')
  if (locked.selectedGroupId != null) throw new Error('expected baseline to clear selectedGroupId')

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
}
