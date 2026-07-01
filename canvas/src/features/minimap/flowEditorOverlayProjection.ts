import { computeDefaultWidgetFloatingPos } from '@/components/FlowEditor/widgetLayout'
import { computeWidgetScale, WIDGET_BASE_SIZE } from '@/lib/canvas/overlayWidgetZoom'
import { isFlowEditorCanvas2dRenderer, type Canvas2dRendererId } from '@/lib/config.render'
import { defaultSchema } from '@/lib/graph/schema'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import { DEFAULT_FLOW_NODE_WIDTH_PX, DEFAULT_ZOOM_MIN_SCALE_HARD_CAP, readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import { readFlowWidgetPinnedInCanvas } from '@/lib/flowEditor/flowWidgetPinnedState'
import { getCachedGraphLookup } from '@/lib/graph/lookupCache'
import type { GraphSchema } from '@/lib/graph/schemaTypes'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'

type ZoomTransformLike = { k?: unknown; x?: unknown; y?: unknown }
type CanvasDimensionsLike = { w?: unknown; h?: unknown }
type ScreenPositionMap = Record<string, { left?: unknown; top?: unknown }>
type WorldPositionMap = Record<string, { x?: unknown; y?: unknown }>
type PinStateMap = Record<string, unknown>

const readFiniteNumber = (value: unknown, fallback: number): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

const readPositiveFiniteNumber = (value: unknown, fallback: number): number => {
  const n = readFiniteNumber(value, fallback)
  return n > 0 ? n : fallback
}

export const buildMinimapFlowEditorOverlayNodeById = (args: {
  canvas2dRenderer: Canvas2dRendererId | null | undefined
  nodes: GraphNode[]
}): Map<string, GraphNode> | null => {
  const { canvas2dRenderer, nodes } = args
  if (!canvas2dRenderer || !isFlowEditorCanvas2dRenderer(canvas2dRenderer) || nodes.length === 0) return null
  const graphData = { type: 'application/json', nodes, edges: [] as GraphEdge[] }
  const graphSemanticKey = buildScopedGraphSemanticKey('minimap-flow-editor-overlay-subset', {
    graphData,
    graphSemanticKey: nodes.map(node => {
      const id = String(node?.id || '').trim()
      const type = String(node?.type || '').trim()
      const x = readFiniteNumber(node?.x, 0)
      const y = readFiniteNumber(node?.y, 0)
      return `${id}:${type}:${Math.round(x * 10)}:${Math.round(y * 10)}`
    }).join('\n'),
  })
  const lookup = getCachedGraphLookup({
    cacheScope: 'minimap-flow-editor-overlay-subset',
    graphData,
    graphSemanticKey,
  })
  return lookup?.nodeById || new Map<string, GraphNode>()
}

export const buildMinimapFlowEditorOverlaySubset = (args: {
  canvas2dRenderer: Canvas2dRendererId | null | undefined
  canvasDims: CanvasDimensionsLike
  edges: GraphEdge[]
  flowEditorOverlayNodeById: Map<string, GraphNode> | null
  flowWidgetPinnedByNodeId?: PinStateMap | null
  flowWidgetPosByNodeId?: ScreenPositionMap | null
  flowWidgetWorldPosByNodeId?: WorldPositionMap | null
  openWidgetNodeIds?: unknown[] | null
  schema?: GraphSchema | null
  zoomState?: ZoomTransformLike | null
}): { nodes: GraphNode[]; edges: GraphEdge[] } | null => {
  const ids = Array.isArray(args.openWidgetNodeIds) ? args.openWidgetNodeIds.map(v => String(v || '').trim()).filter(Boolean) : []
  if (!args.canvas2dRenderer || !isFlowEditorCanvas2dRenderer(args.canvas2dRenderer) || ids.length === 0) return null
  const zoom = args.zoomState || { k: 1, x: 0, y: 0 }
  const k = readPositiveFiniteNumber(zoom.k, 1)
  const tx = readFiniteNumber(zoom.x, 0)
  const ty = readFiniteNumber(zoom.y, 0)
  const nodeById = args.flowEditorOverlayNodeById || new Map<string, GraphNode>()
  const port = args.schema?.behavior?.portHandles || null
  const portEnabled = Boolean((port as { enabled?: unknown } | null)?.enabled)
  const portSizePx = Math.max(0, readFiniteNumber((port as { size?: unknown } | null)?.size, 4))
  const portOffsetPx = Math.max(0, readFiniteNumber((port as { offset?: unknown } | null)?.offset, 2))
  const portExtraPadScreenPx = portEnabled ? portSizePx + portOffsetPx + 8 : 0
  const [schemaMinK, schemaMaxK] = readZoomScaleExtent(args.schema || defaultSchema)
  const extent = { minK: Math.min(schemaMinK, DEFAULT_ZOOM_MIN_SCALE_HARD_CAP), maxK: schemaMaxK }
  const posById = args.flowWidgetPosByNodeId || {}
  const worldById = args.flowWidgetWorldPosByNodeId || {}
  const overlayNodes: GraphNode[] = []
  const idSet = new Set(ids)
  for (let stackIndex = 0; stackIndex < ids.length; stackIndex += 1) {
    const id = ids[stackIndex]!
    const node = nodeById.get(id)
    if (!node) continue
    const pinnedInCanvas = readFlowWidgetPinnedInCanvas(args.flowWidgetPinnedByNodeId as Record<string, boolean> | null | undefined, id)
    const panelScale = computeWidgetScale(k, extent, { mode: 'pinnedInCanvas' })
    const wPx = WIDGET_BASE_SIZE.width * panelScale
    const hPx = WIDGET_BASE_SIZE.height * panelScale
    const stackCol = stackIndex % 3
    const stackRow = Math.floor(stackIndex / 3)
    const stackTopPx = stackIndex <= 0 ? 0 : stackRow * 54 + stackCol * 8
    const stackLeftPx = stackIndex <= 0 ? 0 : stackCol * 54
    const leftTopPx = !pinnedInCanvas
      ? readFloatingOverlayTopLeft(id, stackIndex, posById, args.canvasDims)
      : readPinnedOverlayTopLeft(id, node, worldById, { k, tx, ty, stackLeftPx, stackTopPx, portExtraPadScreenPx })
    overlayNodes.push({
      id: `__qe:${id}`,
      type: 'FlowWidget' as unknown as string,
      x: (leftTopPx.left - tx) / k,
      y: (leftTopPx.top - ty) / k,
      width: wPx / k,
      height: hPx / k,
      label: '',
    } as unknown as GraphNode)
  }
  return { nodes: overlayNodes, edges: remapOverlayEdges(args.edges, idSet) }
}

const readFloatingOverlayTopLeft = (
  id: string,
  stackIndex: number,
  posById: ScreenPositionMap,
  canvasDims: CanvasDimensionsLike,
): { left: number; top: number } => {
  const stored = posById[id]
  const fallback = computeDefaultWidgetFloatingPos({
    stackIndex,
    viewportW: readFiniteNumber(canvasDims.w, 0),
    viewportH: readFiniteNumber(canvasDims.h, 0),
  })
  return {
    left: readFiniteNumber(stored?.left, fallback.left),
    top: readFiniteNumber(stored?.top, fallback.top),
  }
}

const readPinnedOverlayTopLeft = (
  id: string,
  node: GraphNode,
  worldById: WorldPositionMap,
  context: { k: number; tx: number; ty: number; stackLeftPx: number; stackTopPx: number; portExtraPadScreenPx: number },
): { left: number; top: number } => {
  const stored = worldById[id]
  const x = typeof stored?.x === 'number' && Number.isFinite(stored.x) ? stored.x : null
  const y = typeof stored?.y === 'number' && Number.isFinite(stored.y) ? stored.y : null
  if (x != null && y != null) return { left: context.tx + x * context.k, top: context.ty + y * context.k }
  const nodeLeftPx = context.tx + readFiniteNumber(node.x, 0) * context.k
  const nodeTopPx = context.ty + readFiniteNumber(node.y, 0) * context.k
  return {
    left: nodeLeftPx + DEFAULT_FLOW_NODE_WIDTH_PX * context.k + 16 + context.portExtraPadScreenPx + context.stackLeftPx,
    top: nodeTopPx - 12 + context.stackTopPx,
  }
}

const remapOverlayEdges = (edges: GraphEdge[], idSet: Set<string>): GraphEdge[] => {
  const overlayEdges: GraphEdge[] = []
  for (let i = 0; i < edges.length; i += 1) {
    const edge = edges[i]
    const source = String(edge?.source || '').trim()
    const target = String(edge?.target || '').trim()
    if (!source || !target || !idSet.has(source) || !idSet.has(target)) continue
    overlayEdges.push({ ...edge, source: `__qe:${source}`, target: `__qe:${target}` })
  }
  return overlayEdges
}
