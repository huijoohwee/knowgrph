import * as d3 from 'd3'

import { useGraphStore } from '@/hooks/useGraphStore'
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import type { ZoomRequest } from '@/lib/zoom/requests'
import type { GraphData } from '@/lib/graph/types'
import { setFlowNativeTransform, type FlowNativeRuntime } from '@/components/FlowCanvas/nativeRuntime'
import { easeOutCubic01, lerpNumber } from '@/lib/canvas/zoom-smoothing'
import { getFlowAutoMinScale, setFlowAutoMinScale } from '@/components/FlowCanvas/flowScaleExtentOverride'
import { DEFAULT_TOOLBAR_ZOOM_CONFIG } from '@/lib/zoom/toolbarZoom'
import { resolveZoomRequest2d } from '@/lib/zoom/resolveZoomRequest2d'

const FLOW_ZOOM_MAX_VISUAL_CAP = 24

const FLOW_ZOOM_REQUEST_ANIMS = new WeakMap<FlowNativeRuntime, { rafId: number | null; token: number }>()

export const cancelFlowZoomRequestAnim = (runtime: FlowNativeRuntime) => {
  const prev = FLOW_ZOOM_REQUEST_ANIMS.get(runtime)
  if (!prev) return
  if (prev.rafId != null) {
    try {
      cancelAnimationFrame(prev.rafId)
    } catch {
      void 0
    }
  }
  FLOW_ZOOM_REQUEST_ANIMS.set(runtime, { rafId: null, token: prev.token + 1 })
}

export const applyZoomRequestNative = (args: {
  zoomRequest: ZoomRequest
  runtime: FlowNativeRuntime
  graphData: GraphData | null
  width: number
  height: number
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedGroupId?: string | null
  selectedNodeIds?: string[]
  selectedEdgeIds?: string[]
  selectedGroupIds?: string[]
  onFrame?: () => void
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
  if (!schema) {
    clear()
    return
  }
  const t0 = args.runtime.transform || d3.zoomIdentity
  const [schemaMinK, schemaMaxK] = readZoomScaleExtent(schema)
  const flowMinK = Math.min(schemaMinK, 0.000001)
  const flowMaxK = Math.min(schemaMaxK, FLOW_ZOOM_MAX_VISUAL_CAP)
  const autoMinK = getFlowAutoMinScale(args.runtime)
  const resolved = resolveZoomRequest2d({
    zoomRequest: args.zoomRequest,
    graphData: args.graphData,
    schema,
    documentSemanticMode: (state.documentSemanticMode as 'document' | 'keyword' | undefined) ?? undefined,
    graphDataRevision: state.graphDataRevision || 0,
    viewportW: Math.max(1, Math.floor(args.width)),
    viewportH: Math.max(1, Math.floor(args.height)),
    viewPinned: state.viewPinned === true,
    durations: { fitMs: state.zoomDurationFitMs, selectionMs: state.zoomDurationSelectionMs },
    toolbarZoom: DEFAULT_TOOLBAR_ZOOM_CONFIG,
    selectedNodeId: args.selectedNodeId,
    selectedEdgeId: args.selectedEdgeId,
    selectedGroupId: args.selectedGroupId,
    selectedNodeIds: args.selectedNodeIds,
    selectedEdgeIds: args.selectedEdgeIds,
    selectedGroupIds: args.selectedGroupIds,
    currentTransform: t0,
    schemaExtent: { minK: flowMinK, maxK: flowMaxK },
    currentExtent: { minK: autoMinK ?? flowMinK, maxK: flowMaxK },
    cacheKeyBase: '2d',
  })
  if (!resolved) {
    clear()
    return
  }
  const nextMinScale = resolved.nextMinScale
  if (typeof nextMinScale === 'number' && Number.isFinite(nextMinScale) && nextMinScale < flowMinK) {
    const prev = getFlowAutoMinScale(args.runtime)
    const combined = prev == null ? nextMinScale : Math.min(prev, nextMinScale)
    setFlowAutoMinScale(args.runtime, combined)
  }
  clear()
  const durationMs = Math.max(0, Math.floor(resolved.durationMs))
  if (durationMs === 0) {
    cancelFlowZoomRequestAnim(args.runtime)
    setFlowNativeTransform(args.runtime, resolved.nextTransform)
    args.onFrame?.()
    return
  }
  cancelFlowZoomRequestAnim(args.runtime)
  const prev = FLOW_ZOOM_REQUEST_ANIMS.get(args.runtime)
  const token = (prev?.token || 0) + 1
  FLOW_ZOOM_REQUEST_ANIMS.set(args.runtime, { rafId: null, token })
  const start = performance.now()
  const from = t0
  const to = resolved.nextTransform
  const tick = (now: number) => {
    const st = FLOW_ZOOM_REQUEST_ANIMS.get(args.runtime)
    if (!st || st.token !== token) return
    const raw01 = durationMs > 0 ? (now - start) / durationMs : 1
    const eased = easeOutCubic01(raw01)
    const k = lerpNumber(from.k, to.k, eased)
    const x = lerpNumber(from.x, to.x, eased)
    const y = lerpNumber(from.y, to.y, eased)
    setFlowNativeTransform(args.runtime, d3.zoomIdentity.translate(x, y).scale(k))
    args.onFrame?.()
    if (!(raw01 < 1)) {
      FLOW_ZOOM_REQUEST_ANIMS.set(args.runtime, { rafId: null, token })
      return
    }
    const rafId = requestAnimationFrame(tick)
    FLOW_ZOOM_REQUEST_ANIMS.set(args.runtime, { rafId, token })
  }
  const rafId = requestAnimationFrame(tick)
  FLOW_ZOOM_REQUEST_ANIMS.set(args.runtime, { rafId, token })
  try {
    useGraphStore.getState().setLifecycleStage('zoomUpdate')
  } catch {
    void 0
  }
}
