import * as d3 from 'd3'
import { GraphNode, GraphEdge } from '@/lib/graph/types'
import { GraphSchema } from '@/lib/graph/schema'
import {
  buildAdjacencyMap,
} from '../simulation'

type RadialClusterNode = {
  id: string
  children?: RadialClusterNode[]
}

export const applyRadialClusterLayout = (
  nodes: GraphNode[],
  edgesForSim: GraphEdge[],
  width: number,
  height: number,
  schema: GraphSchema,
) => {
  if (!nodes.length) return
  const graphLike = { nodes, edges: edgesForSim }
  const adj = buildAdjacencyMap(graphLike)
  const idToNode = new Map<string, GraphNode>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    idToNode.set(String(n.id), n)
  }
  const visited = new Set<string>()
  const components: RadialClusterNode[] = []
  const buildComponent = (rootId: string) => {
    const root: RadialClusterNode = { id: rootId, children: [] }
    const queue: RadialClusterNode[] = [root]
    visited.add(rootId)
    while (queue.length > 0) {
      const current = queue.shift() as RadialClusterNode
      const neighbors = adj.get(current.id) || new Set<string>()
      const children: RadialClusterNode[] = []
      neighbors.forEach(neighborId => {
        const id = String(neighborId)
        if (!id || visited.has(id)) return
        if (!idToNode.has(id)) return
        visited.add(id)
        const child: RadialClusterNode = { id, children: [] }
        children.push(child)
        queue.push(child)
      })
      if (children.length > 0) {
        current.children = children
      }
    }
    return root
  }
  for (let i = 0; i < nodes.length; i += 1) {
    const id = String(nodes[i].id)
    if (!id || visited.has(id)) continue
    components.push(buildComponent(id))
  }
  if (!components.length) return
  const treeRoot: RadialClusterNode =
    components.length === 1 ? components[0] : { id: '__root__', children: components }
  const size = Math.max(1, Math.min(width, height))
  const padding = schema.layout?.fitPadding ?? 80
  const maxRadius = Math.max(10, size / 2 - Math.max(0, padding))
  if (!Number.isFinite(maxRadius) || maxRadius <= 0) return
  const centerX = Math.max(1, width) / 2
  const centerY = Math.max(1, height) / 2
  const root = d3.hierarchy<RadialClusterNode>(treeRoot)
  const cluster = d3.cluster<RadialClusterNode>().size([2 * Math.PI, maxRadius])
  cluster(root)
  const positions = new Map<string, { x: number; y: number }>()
  root.descendants().forEach(node => {
    const id = node.data.id
    if (!idToNode.has(id)) return
    const angleRaw = node.x
    const radiusRaw = node.y
    if (typeof angleRaw !== 'number' || typeof radiusRaw !== 'number') return
    const angle = angleRaw - Math.PI / 2
    const radius = radiusRaw
    const x = centerX + radius * Math.cos(angle)
    const y = centerY + radius * Math.sin(angle)
    positions.set(id, { x, y })
  })
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const id = String(node.id)
    const p = positions.get(id)
    if (!p) continue
    node.x = p.x
    node.y = p.y
  }
}
