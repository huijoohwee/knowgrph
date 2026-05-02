import { GraphEdge, GraphNode } from '@/lib/graph/types'
import { GraphSchema } from '@/lib/graph/schema'
import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'
import { getNodeHalfExtents2d } from '@/components/GraphCanvas/nodeSizing2d'

export type ConnectivityComponentBBox = {
  minX: number
  maxX: number
  minY: number
  maxY: number
  width: number
  height: number
  cx: number
  cy: number
}

export type ConnectivityComponent = {
  id: string
  nodes: GraphNode[]
  bbox: ConnectivityComponentBBox
}

type NodeNeighborCollection = ReadonlyArray<string> | ReadonlySet<string> | null | undefined

function getNodesBBox(nodes: GraphNode[], schema: GraphSchema): ConnectivityComponentBBox | null {
  if (nodes.length === 0) return null

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let valid = 0

  for (const node of nodes) {
    const x = typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : null
    const y = typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : null
    if (x == null || y == null) continue

    const { halfW, halfH } = getNodeHalfExtents2d(node, schema)
    const padding = 20
    const x0 = x - halfW - padding
    const x1 = x + halfW + padding
    const y0 = y - halfH - padding
    const y1 = y + halfH + padding

    if (x0 < minX) minX = x0
    if (x1 > maxX) maxX = x1
    if (y0 < minY) minY = y0
    if (y1 > maxY) maxY = y1
    valid += 1
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

function readIncidentNeighborId(
  edge: GraphEdge,
  nodeId: string,
  nodeById: ReadonlyMap<string, GraphNode>,
): string {
  const { src, tgt } = readGraphEdgeEndpoints(edge)
  const sourceId = src || ''
  const targetId = tgt || ''
  const neighborId = sourceId === nodeId ? targetId : targetId === nodeId ? sourceId : ''
  if (!neighborId || !nodeById.has(neighborId)) return ''
  return neighborId
}

export function buildNodeAdjacencyFromIncidentEdges(args: {
  nodes: GraphNode[]
  nodeById: ReadonlyMap<string, GraphNode>
  incidentEdgesByNodeId: ReadonlyMap<string, GraphEdge[]>
}): Map<string, string[]> {
  const adjacencyByNodeId = new Map<string, string[]>()
  for (let i = 0; i < args.nodes.length; i += 1) {
    adjacencyByNodeId.set(String(args.nodes[i]?.id || ''), [])
  }
  for (const [nodeId, incidentEdges] of args.incidentEdgesByNodeId.entries()) {
    const neighbors = adjacencyByNodeId.get(nodeId)
    if (!neighbors) continue
    for (let i = 0; i < incidentEdges.length; i += 1) {
      const edge = incidentEdges[i]
      const neighborId = readIncidentNeighborId(edge, nodeId, args.nodeById)
      if (!neighborId) continue
      neighbors.push(neighborId)
    }
  }
  return adjacencyByNodeId
}

export function buildNodeNeighborSetFromIncidentEdges(args: {
  nodes: GraphNode[]
  nodeById: ReadonlyMap<string, GraphNode>
  incidentEdgesByNodeId: ReadonlyMap<string, GraphEdge[]>
}): Map<string, Set<string>> {
  const neighborIdsByNodeId = new Map<string, Set<string>>()
  for (let i = 0; i < args.nodes.length; i += 1) {
    const nodeId = String(args.nodes[i]?.id || '').trim()
    if (!nodeId) continue
    neighborIdsByNodeId.set(nodeId, new Set<string>())
  }
  for (const [nodeId, incidentEdges] of args.incidentEdgesByNodeId.entries()) {
    const neighbors = neighborIdsByNodeId.get(nodeId)
    if (!neighbors) continue
    for (let i = 0; i < incidentEdges.length; i += 1) {
      const neighborId = readIncidentNeighborId(incidentEdges[i], nodeId, args.nodeById)
      if (!neighborId) continue
      neighbors.add(neighborId)
    }
  }
  return neighborIdsByNodeId
}

export function buildConnectedNodeIdComponents(args: {
  nodeIds: Iterable<string>
  adjacencyByNodeId: ReadonlyMap<string, NodeNeighborCollection>
}): string[][] {
  const visited = new Set<string>()
  const components: string[][] = []

  for (const rawNodeId of args.nodeIds) {
    const nodeId = String(rawNodeId || '').trim()
    if (!nodeId || visited.has(nodeId)) continue
    visited.add(nodeId)

    const componentNodeIds: string[] = []
    const stack = [nodeId]
    while (stack.length > 0) {
      const currentId = stack.pop()!
      componentNodeIds.push(currentId)
      const neighbors = args.adjacencyByNodeId.get(currentId)
      if (!neighbors) continue
      for (const rawNeighborId of neighbors) {
        const neighborId = String(rawNeighborId || '').trim()
        if (!neighborId || visited.has(neighborId)) continue
        visited.add(neighborId)
        stack.push(neighborId)
      }
    }

    if (componentNodeIds.length > 0) components.push(componentNodeIds)
  }

  return components
}

export function deriveConnectivityComponents(args: {
  nodes: GraphNode[]
  nodeById: ReadonlyMap<string, GraphNode>
  adjacencyByNodeId: ReadonlyMap<string, string[]>
  schema: GraphSchema
}): ConnectivityComponent[] {
  const componentNodeIds = buildConnectedNodeIdComponents({
    nodeIds: args.nodes.map(node => String(node?.id || '')),
    adjacencyByNodeId: args.adjacencyByNodeId,
  })
  const components: ConnectivityComponent[] = []

  for (let i = 0; i < componentNodeIds.length; i += 1) {
    const componentNodes: GraphNode[] = []
    for (let j = 0; j < componentNodeIds[i].length; j += 1) {
      const node = args.nodeById.get(componentNodeIds[i][j])
      if (node) componentNodes.push(node)
    }

    if (componentNodes.length === 0) continue
    const bbox = getNodesBBox(componentNodes, args.schema)
    if (!bbox) continue
    components.push({
      id: `comp-${components.length}`,
      nodes: componentNodes,
      bbox,
    })
  }

  return components
}
