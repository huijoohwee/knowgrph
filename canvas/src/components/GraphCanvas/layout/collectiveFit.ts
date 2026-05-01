
import { GraphNode, GraphEdge } from '@/lib/graph/types'
import { GraphSchema } from '@/lib/graph/schema'
import { getCachedGraphLookup } from '@/lib/graph/lookupCache'
import { hashScopedStringArraySignature } from '@/lib/hash/signature'
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
          const sourceId = typeof edge?.source === 'object' ? String((edge.source as { id?: unknown })?.id || '').trim() : String(edge?.source || '').trim()
          const targetId = typeof edge?.target === 'object' ? String((edge.target as { id?: unknown })?.id || '').trim() : String(edge?.target || '').trim()
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

  const viewportAspect = width / Math.max(1, height)
  const totalArea = components.reduce((sum, c) => sum + (c.bbox.width + padding) * (c.bbox.height + padding), 0)
  const targetWidth = Math.max(width, Math.sqrt(totalArea * viewportAspect))
  
  let currentX = 0
  let currentY = 0
  let rowHeight = 0
  
  const placements: { compIndex: number, x: number, y: number }[] = []
  
  for (let i = 0; i < components.length; i++) {
    const comp = components[i]
    
    if (currentX + comp.bbox.width > targetWidth && currentX > 0) {
      // New row
      currentX = 0
      currentY += rowHeight + padding
      rowHeight = 0
    }
    
    placements.push({
      compIndex: i,
      x: currentX, // Top-left of component in arrangement
      y: currentY
    })
    
    rowHeight = Math.max(rowHeight, comp.bbox.height)
    currentX += comp.bbox.width + padding
  }

  // Calculate total bounds of the arrangement
  let arrMinX = Infinity, arrMaxX = -Infinity, arrMinY = Infinity, arrMaxY = -Infinity
  
  placements.forEach(p => {
    const comp = components[p.compIndex]
    arrMinX = Math.min(arrMinX, p.x)
    arrMaxX = Math.max(arrMaxX, p.x + comp.bbox.width)
    arrMinY = Math.min(arrMinY, p.y)
    arrMaxY = Math.max(arrMaxY, p.y + comp.bbox.height)
  })
  
  const arrW = arrMaxX - arrMinX
  const arrH = arrMaxY - arrMinY
  const arrCX = arrMinX + arrW / 2
  const arrCY = arrMinY + arrH / 2
  
  const targetCX = width / 2
  const targetCY = height / 2

  for (const p of placements) {
    const comp = components[p.compIndex]
    
    // Shift needed to move component to its placed position relative to arrangement origin
    // p.x, p.y is the top-left of where we want the component's bbox to be
    
    // Current component position:
    // Its nodes are relative to comp.bbox.minX, comp.bbox.minY
    
    // We want to move (comp.bbox.minX, comp.bbox.minY) to (p.x, p.y)
    // AND then shift the whole arrangement to be centered in viewport
    
    // Target position for component top-left:
    // targetX = p.x + (targetCX - arrCX)
    // targetY = p.y + (targetCY - arrCY)
    
    // Delta for nodes:
    // dx = targetX - comp.bbox.minX
    // dy = targetY - comp.bbox.minY
    
    const globalShiftX = targetCX - arrCX
    const globalShiftY = targetCY - arrCY
    
    const dx = (p.x + globalShiftX) - comp.bbox.minX
    const dy = (p.y + globalShiftY) - comp.bbox.minY
    
    for (const n of comp.nodes) {
      if (typeof n.x === 'number' && Number.isFinite(n.x)) n.x += dx
      if (typeof n.y === 'number' && Number.isFinite(n.y)) n.y += dy
      n.vx = 0
      n.vy = 0
    }
  }
}
