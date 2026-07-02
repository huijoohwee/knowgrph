import { useGraphStore } from '@/hooks/useGraphStore'
import { isStoryboardCanvas2dRenderer } from '@/lib/config.render'
import { hashGraphDataForPreviewSync } from '@/hooks/store/graphDataSliceUtils'
import { hashSchemaForPreviewSync } from '@/features/canvas/canvasSyncHashes'

type StringRef = { current: string }

type CanvasPreviewSyncPayload = {
  graphData?: unknown
  schema?: unknown
  canvasRenderMode?: unknown
  canvas3dMode?: unknown
  canvas2dRenderer?: unknown
  selectedNodeId?: unknown
  selectedEdgeId?: unknown
  selectedGroupId?: unknown
}

export function applyCanvasPreviewSyncPayload(args: {
  payload: CanvasPreviewSyncPayload
  lastInboundPreviewSelectionKeyRef: StringRef
  lastInboundPreviewGraphHashRef: StringRef
  lastInboundPreviewSchemaHashRef: StringRef
}): void {
  const {
    payload,
    lastInboundPreviewSelectionKeyRef,
    lastInboundPreviewGraphHashRef,
    lastInboundPreviewSchemaHashRef,
  } = args
  const store = useGraphStore.getState()
  const lockRenderer = store.canvasRenderMode === '2d' && isStoryboardCanvas2dRenderer(store.canvas2dRenderer)

  if (!lockRenderer && payload.canvasRenderMode && payload.canvasRenderMode !== store.canvasRenderMode) {
    try {
      const setCanvasRenderMode = store.setCanvasRenderMode
      if (typeof setCanvasRenderMode === 'function') setCanvasRenderMode(payload.canvasRenderMode as never)
    } catch {
      void 0
    }
  }
  if (!lockRenderer && payload.canvas2dRenderer && payload.canvas2dRenderer !== store.canvas2dRenderer) {
    try {
      const setCanvas2dRenderer = store.setCanvas2dRenderer
      if (typeof setCanvas2dRenderer === 'function') setCanvas2dRenderer(payload.canvas2dRenderer as never)
    } catch {
      void 0
    }
  }
  if (!lockRenderer && payload.canvas3dMode && payload.canvas3dMode !== store.canvas3dMode) {
    try {
      const setCanvas3dMode = store.setCanvas3dMode
      if (typeof setCanvas3dMode === 'function') setCanvas3dMode(payload.canvas3dMode as never)
    } catch {
      void 0
    }
  }
  if (payload.schema) {
    try {
      const nextSchemaHash = hashSchemaForPreviewSync(payload.schema)
      const alreadyApplied = nextSchemaHash === lastInboundPreviewSchemaHashRef.current
      if (!alreadyApplied) {
        lastInboundPreviewSchemaHashRef.current = nextSchemaHash
        const currentSchemaHash = hashSchemaForPreviewSync(store.schema)
        if (nextSchemaHash !== currentSchemaHash) {
          const applySchema = store.setSchema
          if (typeof applySchema === 'function') applySchema(payload.schema as never)
        }
      }
    } catch {
      void 0
    }
  }
  if (payload.graphData) {
    try {
      const setGraphData = store.setGraphData
      const nextGraphHash = hashGraphDataForPreviewSync(payload.graphData)
      if (!nextGraphHash || nextGraphHash !== lastInboundPreviewGraphHashRef.current) {
        if (typeof setGraphData === 'function') setGraphData(payload.graphData as never)
      }
      if (nextGraphHash) lastInboundPreviewGraphHashRef.current = nextGraphHash
    } catch {
      void 0
    }
  }

  const hasSelectionPayload =
    Object.prototype.hasOwnProperty.call(payload, 'selectedNodeId') ||
    Object.prototype.hasOwnProperty.call(payload, 'selectedEdgeId') ||
    Object.prototype.hasOwnProperty.call(payload, 'selectedGroupId')

  if (!hasSelectionPayload) return

  const nextSelectedNodeId = typeof payload.selectedNodeId === 'string' ? payload.selectedNodeId : ''
  const nextSelectedEdgeId = typeof payload.selectedEdgeId === 'string' ? payload.selectedEdgeId : ''
  const nextSelectedGroupId = typeof payload.selectedGroupId === 'string' ? payload.selectedGroupId : ''
  const nextSelectionKey = `${nextSelectedNodeId}:${nextSelectedEdgeId}:${nextSelectedGroupId}`
  const prevSelectionKey = lastInboundPreviewSelectionKeyRef.current
  lastInboundPreviewSelectionKeyRef.current = nextSelectionKey
  if (nextSelectionKey === prevSelectionKey) return
  try {
    useGraphStore.setState({
      selectionSource: 'editor',
      selectedNodeId: nextSelectedNodeId || null,
      selectedEdgeId: nextSelectedEdgeId || null,
      selectedGroupId: nextSelectedGroupId || null,
      selectedNodeIds: nextSelectedNodeId ? [nextSelectedNodeId] : [],
      selectedEdgeIds: nextSelectedEdgeId ? [nextSelectedEdgeId] : [],
      selectedGroupIds: nextSelectedGroupId ? [nextSelectedGroupId] : [],
    })
  } catch {
    void 0
  }
}
