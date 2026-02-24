
import { GraphNode, GraphEdge } from '@/lib/graph/types'
import { GraphSchema } from '@/lib/graph/schema'
import { getNodeHalfExtents2d } from '@/components/GraphCanvas/nodeSizing2d'

type BBox = {
  minX: number
  maxX: number
  minY: number
  maxY: number
  width: number
  height: number
  cx: number
  cy: number
}

type Component = {
  id: string
  nodes: GraphNode[]
  bbox: BBox
}

const getNodesBBox = (nodes: GraphNode[], schema: GraphSchema): BBox | null => {
  if (nodes.length === 0) return null

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let valid = 0

  for (const n of nodes) {
    const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
    const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
    if (x == null || y == null) continue

    const { halfW, halfH } = getNodeHalfExtents2d(n, schema)
    // Add some padding for the node itself
    const padding = 20
    const x0 = x - halfW - padding
    const x1 = x + halfW + padding
    const y0 = y - halfH - padding
    const y1 = y + halfH + padding

    if (x0 < minX) minX = x0
    if (x1 > maxX) maxX = x1
    if (y0 < minY) minY = y0
    if (y1 > maxY) maxY = y1
    valid++
  }

  if (valid === 0 || minX === Infinity) return null

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  }
}

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

  const nodeById = new Map<string, GraphNode>()
  const adj = new Map<string, string[]>()
  for (const n of nodes) {
    const id = String(n.id)
    nodeById.set(id, n)
    adj.set(id, [])
  }
  
  edges.forEach(e => {
    const s = typeof e.source === 'object' ? (e.source as { id: string }).id : e.source
    const t = typeof e.target === 'object' ? (e.target as { id: string }).id : e.target
    const sid = String(s)
    const tid = String(t)
    if (nodeById.has(sid) && nodeById.has(tid)) {
      adj.get(sid)?.push(tid)
      adj.get(tid)?.push(sid)
    }
  })

  const visited = new Set<string>()
  const components: Component[] = []
  
  for (const n of nodes) {
    const id = String(n.id)
    if (visited.has(id)) continue
    
    const componentNodes: GraphNode[] = []
    const stack = [id]
    visited.add(id)
    
    while (stack.length) {
      const curr = stack.pop()!
      const node = nodeById.get(curr)
      if (node) componentNodes.push(node)
      
      const neighbors = adj.get(curr) || []
      for (const neigh of neighbors) {
        if (!visited.has(neigh)) {
          visited.add(neigh)
          stack.push(neigh)
        }
      }
    }
    
    if (componentNodes.length > 0) {
      const bbox = getNodesBBox(componentNodes, schema)
      if (bbox) {
        components.push({
          id: `comp-${components.length}`,
          nodes: componentNodes,
          bbox,
        })
      }
    }
  }

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
