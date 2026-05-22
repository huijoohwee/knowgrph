export type CanvasTabSyncStoreSnapshot = {
  graphId: string | null
  tabId: string | null
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectNode: (nodeId: string | null) => void
  selectEdge: (edgeId: string | null) => void
  schema: unknown
  setSchema: (schema: never) => void
}

export function selectCanvasTabSyncStoreSnapshot(state: {
  graphId: string | null
  tabId: string | null
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectNode: (nodeId: string | null) => void
  selectEdge: (edgeId: string | null) => void
  schema: unknown
  setSchema: (schema: never) => void
}): CanvasTabSyncStoreSnapshot {
  return {
    graphId: state.graphId,
    tabId: state.tabId,
    selectedNodeId: state.selectedNodeId,
    selectedEdgeId: state.selectedEdgeId,
    selectNode: state.selectNode,
    selectEdge: state.selectEdge,
    schema: state.schema,
    setSchema: state.setSchema,
  }
}
