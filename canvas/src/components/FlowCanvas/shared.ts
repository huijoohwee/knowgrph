import type React from 'react'

import type { FlowNativeDrawArgs, FlowNativeRuntime } from '@/components/FlowCanvas/nativeRuntime'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphData } from '@/lib/graph/types'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import { filterGraphToFlowWidgetEligible } from '@/lib/graph/flowWidgetEligibility'

export const EMPTY_WIDGET_REGISTRY: WidgetRegistryEntry[] = []
export const EMPTY_STRING_ARRAY: string[] = []
export const EMPTY_BOOL_RECORD: Record<string, boolean> = {}
export const EMPTY_POS_RECORD: Record<string, { x: number; y: number }> = {}
export const FLOW_RESET_ZOOM_FLOOR_CACHE_EVENT = 'kg:flow:resetZoomFloorCache'

export function emitFlowResetZoomFloorCache(): void {
  if (typeof window === 'undefined') return
  try {
    const CustomEventCtor = typeof window.CustomEvent === 'function' ? window.CustomEvent : CustomEvent
    window.dispatchEvent(new CustomEventCtor(FLOW_RESET_ZOOM_FLOOR_CACHE_EVENT))
  } catch {
    void 0
  }
}

export function subscribeFlowResetZoomFloorCache(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => void 0
  const handle = () => {
    listener()
  }
  window.addEventListener(FLOW_RESET_ZOOM_FLOOR_CACHE_EVENT, handle as EventListener)
  return () => {
    window.removeEventListener(FLOW_RESET_ZOOM_FLOOR_CACHE_EVENT, handle as EventListener)
  }
}

export type FlowCanvasProps = {
  active?: boolean
  graphDataOverride?: GraphData | null
  graphDataRevisionOverride?: number
  collisionDuringDrag?: boolean
  allowNodeDragOverride?: boolean
  exposeRuntimeRef?: (ref: React.MutableRefObject<FlowNativeRuntime | null>) => void
  onInteractionFrame?: () => void
  hideSelectedNodeGlyph?: boolean
  hideSelectedNodePortHandles?: boolean
  hideNodeIds?: string[]
  hidePortHandleNodeIds?: string[]
  excludeRichMediaOverlayNodeIds?: string[]
  flowEditorSurfaceId?: string
  renderEdges?: boolean
  renderGroups?: boolean
  renderNodes?: boolean
  forbidCircleNodes?: boolean
}

export type FlowCanvasInteractionRuntimeProps = {
  active: boolean
  flowEditorSurfaceId?: string
  allowMutations: boolean
  schema: GraphSchema | null
  runtimeRef: React.MutableRefObject<FlowNativeRuntime | null>
  positionsDirtySinceCommitRef: React.MutableRefObject<boolean>
  selectedNodeIdsRef: React.MutableRefObject<string[]>
  selectedEdgeIdsRef: React.MutableRefObject<string[]>
  drawArgsRef: React.MutableRefObject<FlowNativeDrawArgs>
  scheduleFlowDraw: () => void
  requestCommit: () => void
  handleInteractionFrame: () => void
  canvas2dRenderer: string
  graphDataForZoomRequests: GraphData | null
  viewportW: number
  viewportH: number
  flowEditorReservedW: number
}

export function clampFinite(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo
  return Math.max(lo, Math.min(hi, v))
}

export function pickGraphDataForFlowRenderer(args: {
  graphData: GraphData | null
  effectiveFrontmatter: boolean
  canvas2dRenderer?: string
}): GraphData | null {
  if (!args.graphData) return null
  const flowEditorFrontmatterFlowMode =
    String(args.canvas2dRenderer || '').trim() === 'flowEditor'
    && isFrontmatterFlowGraph(args.graphData)
  if (flowEditorFrontmatterFlowMode) {
    return filterGraphToFlowWidgetEligible(args.graphData)
  }
  return args.graphData
}
