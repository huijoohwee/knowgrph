
import { GraphNode, GraphEdge } from '@/lib/graph/types'
import { GraphSchema } from '@/lib/graph/schema'
import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'
import { getCachedGraphLookup } from '@/lib/graph/lookupCache'
import { hashScopedStringArraySignature } from '@/lib/hash/signature'
import {
  computeBalancedSpreadLayout,
  computeBalancedSpreadSpacingPx,
  computeBalancedSpreadViewportMargins,
} from '@/lib/ui/overlayBalancedSpread'
import { buildNodeAdjacencyFromIncidentEdges, deriveConnectivityComponents } from '@/components/GraphCanvas/layout/graphConnectivity'

export const applyCollectiveGraphLayout = (args: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  width: number
  height: number
  schema: GraphSchema
  padding?: number
}) => {
  const { nodes, edges, width, height, schema, padding = 80 } = args
  if (nodes.length < 2) return

  const graphLookup = getCachedGraphLookup({
    cacheScope: 'graph-canvas-collective-fit',
    graphData: { type: 'application/json', nodes, edges },
    graphSemanticKey: hashScopedStringArraySignature(
      'graph-canvas-collective-fit',
      [
        ...nodes.map(node => `${String(node?.id || '').trim()}:${String(node?.type || '').trim()}`),
        ...edges.map(edge => {
          const { src: sourceId, tgt: targetId } = readGraphEdgeEndpoints(edge)
          return `${String(edge?.id || '').trim()}:${sourceId}:${targetId}`
        }),
      ],
    ),
  })
  const nodeById = graphLookup?.nodeById || new Map<string, GraphNode>()
  const adjacencyByNodeId = buildNodeAdjacencyFromIncidentEdges({
    nodes,
    nodeById,
    incidentEdgesByNodeId: graphLookup?.incidentEdgesByNodeId || new Map<string, GraphEdge[]>(),
  })
  const components = deriveConnectivityComponents({
    nodes,
    nodeById,
    adjacencyByNodeId,
    schema,
  })

  if (components.length === 0) return

  // If only 1 component, just center it
  if (components.length === 1) {
    const comp = components[0]
    const dx = (width / 2) - comp.bbox.cx
    const dy = (height / 2) - comp.bbox.cy
    for (const n of comp.nodes) {
      if (typeof n.x === 'number') n.x += dx
      if (typeof n.y === 'number') n.y += dy
      n.vx = 0
      n.vy = 0
    }
    return
  }

  components.sort((a, b) => b.bbox.height - a.bbox.height)

  let maxComponentWidth = 1
  let maxComponentHeight = 1
  for (let i = 0; i < components.length; i += 1) {
    const comp = components[i]!
    if (comp.bbox.width > maxComponentWidth) maxComponentWidth = comp.bbox.width
    if (comp.bbox.height > maxComponentHeight) maxComponentHeight = comp.bbox.height
  }

  const gapPx = computeBalancedSpreadSpacingPx({
    baseGapPx: padding,
    zoomK: 1,
    count: components.length,
  })
  const spreadMargins = computeBalancedSpreadViewportMargins({
    viewportW: width,
    viewportH: height,
    preset: 'widgetCanvas',
    minLeftPx: Math.max(20, Math.floor(padding * 0.25)),
    minRightPx: Math.max(20, Math.floor(padding * 0.25)),
    minTopPx: Math.max(24, Math.floor(padding * 0.3)),
    minBottomPx: Math.max(20, Math.floor(padding * 0.25)),
  })
  const usableW = Math.max(1, width - spreadMargins.left - spreadMargins.right)
  const usableH = Math.max(1, height - spreadMargins.top - spreadMargins.bottom)
  const slotWidth = Math.max(1, maxComponentWidth)
  const slotHeight = Math.max(1, maxComponentHeight)
  const balancedLayout = computeBalancedSpreadLayout({
    count: components.length,
    viewportW: width,
    viewportH: height,
    cellW: slotWidth + gapPx,
    cellH: slotHeight + gapPx,
    gapPx,
    zoomK: 1,
    marginLeftPx: spreadMargins.left,
    marginRightPx: spreadMargins.right,
    marginTopPx: spreadMargins.top,
    marginBottomPx: spreadMargins.bottom,
    snapPx: 1,
  })
  const usableCenterX = spreadMargins.left + usableW / 2
  const usableCenterY = spreadMargins.top + usableH / 2
  const centeredCells = [...balancedLayout.cells].sort((left, right) => {
    const leftCenterX = left.left + slotWidth / 2
    const leftCenterY = left.top + slotHeight / 2
    const rightCenterX = right.left + slotWidth / 2
    const rightCenterY = right.top + slotHeight / 2
    const leftDistance = Math.hypot(leftCenterX - usableCenterX, leftCenterY - usableCenterY)
    const rightDistance = Math.hypot(rightCenterX - usableCenterX, rightCenterY - usableCenterY)
    if (Math.abs(leftDistance - rightDistance) > 0.001) return leftDistance - rightDistance
    if (left.row !== right.row) return left.row - right.row
    return left.col - right.col
  })

  for (let i = 0; i < components.length; i += 1) {
    const comp = components[i]!
    const cell = centeredCells[i] || centeredCells[centeredCells.length - 1]
    if (!cell) continue
    const targetX = cell.left + Math.max(0, (slotWidth - comp.bbox.width) / 2)
    const targetY = cell.top + Math.max(0, (slotHeight - comp.bbox.height) / 2)
    const dx = targetX - comp.bbox.minX
    const dy = targetY - comp.bbox.minY

    for (const n of comp.nodes) {
      if (typeof n.x === 'number' && Number.isFinite(n.x)) n.x += dx
      if (typeof n.y === 'number' && Number.isFinite(n.y)) n.y += dy
      n.vx = 0
      n.vy = 0
    }
  }
}
