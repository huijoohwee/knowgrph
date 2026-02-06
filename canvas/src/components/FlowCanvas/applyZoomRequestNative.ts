import * as d3 from 'd3'

import { useGraphStore } from '@/hooks/useGraphStore'
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import type { ZoomRequest } from '@/lib/zoom/requests'
import { computeZoomTransformFromRequest } from '@/lib/zoom/actions'
import type { GraphData } from '@/lib/graph/types'
import { setFlowNativeTransform, type FlowNativeRuntime } from '@/components/FlowCanvas/nativeRuntime'

export const applyZoomRequestNative = (args: {
  zoomRequest: ZoomRequest
  runtime: FlowNativeRuntime
  graphData: GraphData | null
  width: number
  height: number
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedNodeIds?: string[]
  selectedEdgeIds?: string[]
}) => {
  const clear = () => {
    try {
      useGraphStore.getState().clearZoomRequest()
    } catch {
      void 0
    }
  }
  const state = useGraphStore.getState()
  const schema = state.schema
  const t0 = args.runtime.transform || d3.zoomIdentity
  const [minK, maxK] = readZoomScaleExtent(schema)
  const res = computeZoomTransformFromRequest(args.zoomRequest, {
    graphData: args.graphData,
    schema,
    graphDataRevision: state.graphDataRevision || 0,
    viewportW: Math.max(1, Math.floor(args.width)),
    viewportH: Math.max(1, Math.floor(args.height)),
    pinned: state.viewPinned === true,
    selectedNodeId: args.selectedNodeId,
    selectedEdgeId: args.selectedEdgeId,
    selectedNodeIds: args.selectedNodeIds,
    selectedEdgeIds: args.selectedEdgeIds,
    currentTransform: t0,
    scaleExtent: { minK, maxK },
    cacheKeyBase: '2d',
  })
  if (!res) {
    clear()
    return
  }
  setFlowNativeTransform(args.runtime, res.nextTransform)
  try {
    useGraphStore.getState().setLifecycleStage('zoomUpdate')
  } catch {
    void 0
  }
  clear()
}

