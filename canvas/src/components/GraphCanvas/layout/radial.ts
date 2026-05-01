import * as d3 from 'd3'
import { GraphNode, GraphEdge } from '@/lib/graph/types'
import { GraphSchema } from '@/lib/graph/schema'
import { getAdjacencyMap } from '../adjacency'
import { relaxNodesWithCollision } from './relax'
import type { GroupKeyOfNode } from './grouping'
import { readFitPadding } from '@/lib/graph/layoutDefaults'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { postFitNodesToViewport } from '@/components/GraphCanvas/layout/postFit'
import { buildConnectedNodeIdComponents } from '@/components/GraphCanvas/layout/graphConnectivity'
import { computeRadarGalaxyPositions2d } from '@/lib/graph/radarGalaxyLayout'

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
  groupKeyOf?: GroupKeyOfNode,
  groups?: GraphGroup[],
) => {
  if (!nodes.length) return
  const graphLike = { nodes, edges: edgesForSim }
  const adj = getAdjacencyMap(graphLike)
  const idToNode = new Map<string, GraphNode>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    idToNode.set(String(n.id), n)
  }
  const buildComponent = (componentNodeIds: string[]) => {
    const rootId = componentNodeIds[0] || ''
    if (!rootId) return null
    const componentNodeIdSet = new Set(componentNodeIds)
    const visited = new Set<string>([rootId])
    const root: RadialClusterNode = { id: rootId, children: [] }
    const queue: RadialClusterNode[] = [root]
    while (queue.length > 0) {
      const current = queue.shift() as RadialClusterNode
      const neighbors = adj.get(current.id) || new Set<string>()
      const children: RadialClusterNode[] = []
      neighbors.forEach(neighborId => {
        const id = String(neighborId)
        if (!id || visited.has(id)) return
        if (!componentNodeIdSet.has(id)) return
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
  const componentNodeIds = buildConnectedNodeIdComponents({
    nodeIds: nodes.map(node => String(node.id || '')),
    adjacencyByNodeId: adj,
  })
  const components: RadialClusterNode[] = []
  for (let i = 0; i < componentNodeIds.length; i += 1) {
    const component = buildComponent(componentNodeIds[i])
    if (component) components.push(component)
  }
  if (!components.length) return
  const treeRoot: RadialClusterNode =
    components.length === 1 ? components[0] : { id: '__root__', children: components }
  const viewW = Math.max(1, width)
  const viewH = Math.max(1, height)
  const padding = readFitPadding(schema)
  const halfW = Math.max(1, viewW / 2 - Math.max(0, padding))
  const halfH = Math.max(1, viewH / 2 - Math.max(0, padding))
  if (!Number.isFinite(halfW) || !Number.isFinite(halfH) || halfW <= 0 || halfH <= 0) return
  const centerX = viewW / 2
  const centerY = viewH / 2
  const positions = new Map<string, { x: number; y: number }>()
  const radarPositions = computeRadarGalaxyPositions2d({
    nodes,
    edges: edgesForSim,
    width: viewW,
    height: viewH,
    centerX,
    centerY,
    paddingPx: padding,
  })
  if (radarPositions) {
    const radarIds = Object.keys(radarPositions)
    for (let i = 0; i < radarIds.length; i += 1) {
      const id = radarIds[i]!
      const p = radarPositions[id]
      if (!p) continue
      positions.set(id, p)
    }
  } else {
    const root = d3.hierarchy<RadialClusterNode>(treeRoot)
    const cluster = d3.cluster<RadialClusterNode>().size([2 * Math.PI, 1])
    cluster(root)
    root.descendants().forEach(node => {
      const id = node.data.id
      if (!idToNode.has(id)) return
      const angleRaw = node.x
      const radiusRaw = node.y
      if (typeof angleRaw !== 'number' || typeof radiusRaw !== 'number') return
      const angle = angleRaw - Math.PI / 2
      const rNorm = Math.max(0, Math.min(1, radiusRaw))
      const x = centerX + rNorm * halfW * Math.cos(angle)
      const y = centerY + rNorm * halfH * Math.sin(angle)
      positions.set(id, { x, y })
    })
  }
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const id = String(node.id)
    const p = positions.get(id)
    if (!p) continue
    node.x = p.x
    node.y = p.y
  }

  relaxNodesWithCollision({ nodes, edges: edgesForSim, schema, defaultSteps: 6, groupKeyOf, groups })
  if (schema.layout?.forces?.postFitForce === true) {
    postFitNodesToViewport({ nodes, width: viewW, height: viewH, paddingPx: Math.max(24, Math.floor(padding)) })
  }
}
