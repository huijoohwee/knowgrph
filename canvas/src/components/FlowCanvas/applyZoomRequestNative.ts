import * as d3 from 'd3'

import { useGraphStore } from '@/hooks/useGraphStore'
import { DEFAULT_ZOOM_MAX_SCALE_HARD_CAP, DEFAULT_ZOOM_MIN_SCALE_HARD_CAP, readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import type { ZoomRequest } from '@/lib/zoom/requests'
import { computeZoomTransformFromRequest } from '@/lib/zoom/actions'
import type { GraphData } from '@/lib/graph/types'
import { setFlowNativeTransform, type FlowNativeRuntime } from '@/components/FlowCanvas/nativeRuntime'
import { easeOutCubic01, lerpNumber } from '@/lib/canvas/zoom-smoothing'
import { getFlowAutoMinScale, setFlowAutoMinScale } from '@/components/FlowCanvas/flowScaleExtentOverride'

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
  const t0 = args.runtime.transform || d3.zoomIdentity
  const [minK, maxK] = readZoomScaleExtent(schema)
  const k0 = Number.isFinite(t0.k) ? t0.k : 1
  const minKSafe = minK
  const maxKSafe = maxK > minK + 1e-12
    ? maxK
    : Math.max(maxK, k0, DEFAULT_ZOOM_MAX_SCALE_HARD_CAP, Math.max(minK, k0, DEFAULT_ZOOM_MIN_SCALE_HARD_CAP) * 2)
  const res = computeZoomTransformFromRequest(args.zoomRequest, {
    graphData: args.graphData,
    schema,
    documentSemanticMode: (state.documentSemanticMode as 'document' | 'keyword' | undefined) ?? undefined,
    graphDataRevision: state.graphDataRevision || 0,
    viewportW: Math.max(1, Math.floor(args.width)),
    viewportH: Math.max(1, Math.floor(args.height)),
    pinned: state.viewPinned === true,
    durations: {
      fitMs: state.zoomDurationFitMs,
      selectionMs: state.zoomDurationSelectionMs,
    },
    selectedNodeId: args.selectedNodeId,
    selectedEdgeId: args.selectedEdgeId,
    selectedGroupId: args.selectedGroupId,
    selectedNodeIds: args.selectedNodeIds,
    selectedEdgeIds: args.selectedEdgeIds,
    selectedGroupIds: args.selectedGroupIds,
    currentTransform: t0,
    scaleExtent: { minK: minKSafe, maxK: maxKSafe },
    cacheKeyBase: '2d',
  })
  if (!res) {
    clear()
    return
  }
  const nextMinScale = res.nextMinScale
  if (typeof nextMinScale === 'number' && Number.isFinite(nextMinScale) && nextMinScale < minK) {
    const prev = getFlowAutoMinScale(args.runtime)
    const combined = prev == null ? nextMinScale : Math.min(prev, nextMinScale)
    setFlowAutoMinScale(args.runtime, combined)
  }
  clear()
  const durationMs = Math.max(0, Math.floor(res.durationMs))
  if (durationMs === 0) {
    cancelFlowZoomRequestAnim(args.runtime)
    setFlowNativeTransform(args.runtime, res.nextTransform)
    args.onFrame?.()
    return
  }
  cancelFlowZoomRequestAnim(args.runtime)
  const prev = FLOW_ZOOM_REQUEST_ANIMS.get(args.runtime)
  const token = (prev?.token || 0) + 1
  FLOW_ZOOM_REQUEST_ANIMS.set(args.runtime, { rafId: null, token })
  const start = performance.now()
  const from = t0
  const to = res.nextTransform
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
