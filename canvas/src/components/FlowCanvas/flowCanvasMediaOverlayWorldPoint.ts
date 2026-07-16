import { readNodeCenterWorld2d } from '@/lib/render/mediaAnchor'
import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { isProbeTreeLayoutOwnedNode } from '@/lib/storyboardWidget/probeTreeLayoutContract'
import { resolveEffectiveFlowWidgetPinnedInCanvas } from '@/lib/storyboardWidget/widgetPlacementAuthority'

type CanvasPointTransform = {
  invertX: (x: number) => number
  invertY: (y: number) => number
}

type WorldPoint = { x: number; y: number }

export function resolveFlowCanvasMediaOverlayGraphNode(
  graphData: GraphData | null | undefined,
  nodeId: string,
): GraphNode | null {
  return resolveGraphNodeByCanonicalId(graphData, nodeId)
}

export function resolveFlowCanvasMediaOverlayPinnedInCanvas(args: {
  graphMetaKind?: string | null
  node: GraphNode | null | undefined
  pinnedValue?: boolean | null
}): boolean {
  return resolveEffectiveFlowWidgetPinnedInCanvas(args)
}

export function resolveFlowCanvasMediaOverlayWorldTopLeft2d(args: {
  graphNode: GraphNode | null | undefined
  pinnedInCanvas: boolean
  interactionOverride?: WorldPoint | null
  storedWorldPosition?: WorldPoint | null
  mediaNode?: { x?: unknown; y?: unknown; fx?: unknown; fy?: unknown } | null
  runtimeNode?: { x?: unknown; y?: unknown; fx?: unknown; fy?: unknown } | null
}): WorldPoint | null {
  const graphWorldPosition = readNodeWorldTopLeft2d(args.graphNode)
  if (args.pinnedInCanvas && isProbeTreeLayoutOwnedNode(args.graphNode) && graphWorldPosition) {
    return graphWorldPosition
  }
  return args.interactionOverride
    || args.storedWorldPosition
    || readNodeWorldTopLeft2d(args.mediaNode)
    || graphWorldPosition
    || readNodeWorldTopLeft2d(args.runtimeNode)
}

export function readNodeWorldTopLeft2d(
  node: { x?: unknown; y?: unknown; fx?: unknown; fy?: unknown } | null | undefined,
): { x: number; y: number } | null {
  if (!node) return null
  const xRaw = node.x
  const yRaw = node.y
  const fxRaw = node.fx
  const fyRaw = node.fy
  const x = typeof xRaw === 'number' && Number.isFinite(xRaw)
    ? xRaw
    : typeof fxRaw === 'number' && Number.isFinite(fxRaw)
      ? fxRaw
      : null
  const y = typeof yRaw === 'number' && Number.isFinite(yRaw)
    ? yRaw
    : typeof fyRaw === 'number' && Number.isFinite(fyRaw)
      ? fyRaw
      : null
  return x == null || y == null ? null : { x, y }
}

export function readNodeWorldCenterFromTopLeft2d(
  node: { x?: unknown; y?: unknown; fx?: unknown; fy?: unknown; width?: unknown; height?: unknown } | null | undefined,
): { x: number; y: number } | null {
  return readNodeCenterWorld2d(node, { coords: 'topLeft' })
}

export function readElementWorldTopLeft2d(
  el: HTMLElement | null | undefined,
  transform: CanvasPointTransform | null | undefined,
): { x: number; y: number } | null {
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const parentRect = el.offsetParent instanceof Element ? el.offsetParent.getBoundingClientRect() : null
  const localX = rect.x - (parentRect?.x || 0)
  const localY = rect.y - (parentRect?.y || 0)
  if (!Number.isFinite(localX) || !Number.isFinite(localY)) return null
  if (!transform) return { x: localX, y: localY }
  return { x: transform.invertX(localX), y: transform.invertY(localY) }
}
