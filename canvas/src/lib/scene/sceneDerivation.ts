import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import { createLayoutGroupKeyOfNode, selectLayoutGroups } from '@/components/GraphCanvas/layout/layoutGroupKey'
import { getDisplayEdges, getDisplayNodes } from '@/components/GraphCanvas/displayFilter'
import { LRUCache } from '@/lib/cache/LRUCache'
import { buildGraphMetaKey } from '@/lib/graph/graphMetaKey'

export type SceneGroupsDerivation = {
  key: string
  allGroups: GraphGroup[]
  layoutGroups: GraphGroup[]
  layoutGroupKeyByNodeId: Record<string, string>
}

export type SceneDisplayGraphDerivation = {
  graphData: GraphData
  displayGraphData: GraphData
  displayNodes: GraphNode[]
  displayEdges: GraphEdge[]
  displayNodeIdSet: Set<string>
  nodeIndexById: Map<string, number>
  edgeIndexById: Map<string, number>
  nodeById: Map<string, GraphNode>
}

const cache = new LRUCache<string, SceneGroupsDerivation>(128)

type DisplayNodesDerivation = {
  displayNodes: GraphNode[]
  displayNodeIdSet: Set<string>
  nodeIndexById: Map<string, number>
  nodeById: Map<string, GraphNode>
  edgesCache: WeakMap<GraphEdge[], { displayEdges: GraphEdge[]; edgeIndexById: Map<string, number>; displayGraphData: GraphData }>
}

const displayNodesCache = new WeakMap<object, DisplayNodesDerivation>()

const buildKey = (args: {
  graphData: GraphData
  graphDataRevision: number
  schema: GraphSchema
  documentSemanticMode: string
  frontmatterModeEnabled: boolean
}): string => {
  const g = args.graphData
  const nodesLen = Array.isArray(g.nodes) ? g.nodes.length : 0
  const edgesLen = Array.isArray(g.edges) ? g.edges.length : 0
  const metaKey = buildGraphMetaKey(g)
  const schemaGroupsKey = JSON.stringify(args.schema?.layout?.groups || null)
  return [
    `rev:${String(args.graphDataRevision || 0)}`,
    `meta:${metaKey}`,
    `n:${String(nodesLen)}`,
    `e:${String(edgesLen)}`,
    `sem:${String(args.documentSemanticMode || '')}`,
    `fm:${args.frontmatterModeEnabled ? 1 : 0}`,
    `groups:${schemaGroupsKey}`,
  ].join('|')
}

export const deriveSceneGroups = (args: {
  graphData: GraphData | null
  graphDataRevision: number
  schema: GraphSchema
  documentSemanticMode: string
  frontmatterModeEnabled: boolean
}): SceneGroupsDerivation | null => {
  const g = args.graphData
  if (!g) return null
  const key = buildKey({
    graphData: g,
    graphDataRevision: args.graphDataRevision,
    schema: args.schema,
    documentSemanticMode: args.documentSemanticMode,
    frontmatterModeEnabled: args.frontmatterModeEnabled,
  })
  const cached = cache.get(key)
  if (cached) return cached

  const allGroups = deriveGraphGroups(g)
  const layoutGroups = selectLayoutGroups({ graphData: g, schema: args.schema, groups: allGroups })
  const keyOfNode = createLayoutGroupKeyOfNode({ graphData: g, schema: args.schema, groups: allGroups })

  const nodes = Array.isArray(g.nodes) ? (g.nodes as GraphNode[]) : ([] as GraphNode[])
  const byId: Record<string, string> = {}
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const id = String(n?.id || '').trim()
    if (!id) continue
    const k = keyOfNode(n)
    if (k) byId[id] = k
  }

  const derived: SceneGroupsDerivation = {
    key,
    allGroups,
    layoutGroups,
    layoutGroupKeyByNodeId: byId,
  }
  cache.set(key, derived)
  return derived
}

const getDisplayNodesDerivation = (graphData: GraphData): DisplayNodesDerivation => {
  const cached = displayNodesCache.get(graphData as unknown as object)
  if (cached) return cached

  const displayNodes = getDisplayNodes(graphData)
  const displayNodeIdSet = new Set<string>()
  const nodeIndexById = new Map<string, number>()
  const nodeById = new Map<string, GraphNode>()
  for (let i = 0; i < displayNodes.length; i += 1) {
    const n = displayNodes[i]
    const id = String(n?.id || '').trim()
    if (!id) continue
    displayNodeIdSet.add(id)
    if (!nodeIndexById.has(id)) nodeIndexById.set(id, i)
    if (!nodeById.has(id)) nodeById.set(id, n)
  }

  const derived: DisplayNodesDerivation = {
    displayNodes,
    displayNodeIdSet,
    nodeIndexById,
    nodeById,
    edgesCache: new WeakMap(),
  }
  displayNodesCache.set(graphData as unknown as object, derived)
  return derived
}

const deriveDisplayEdgesForSource = (args: {
  displayNodeIdSet: Set<string>
  edgesSource: GraphEdge[]
  graphData: GraphData
  displayNodes: GraphNode[]
}): { displayEdges: GraphEdge[]; edgeIndexById: Map<string, number>; displayGraphData: GraphData } => {
  const displayEdges = getDisplayEdges({ edges: args.edgesSource, displayNodeIdSet: args.displayNodeIdSet })
  const edgeIndexById = new Map<string, number>()
  for (let i = 0; i < displayEdges.length; i += 1) {
    const e = displayEdges[i] as unknown as { id?: unknown }
    const id = typeof e?.id === 'string' ? e.id.trim() : String(e?.id || '').trim()
    if (!id) continue
    if (!edgeIndexById.has(id)) edgeIndexById.set(id, i)
  }

  const displayGraphData: GraphData = {
    ...args.graphData,
    nodes: args.displayNodes,
    edges: displayEdges,
  }

  return { displayEdges, edgeIndexById, displayGraphData }
}

export const deriveSceneDisplayGraph = (args: {
  graphData: GraphData | null
  edges?: GraphEdge[] | null
}): SceneDisplayGraphDerivation | null => {
  const graphData = args.graphData
  if (!graphData) return null

  const nodesDerived = getDisplayNodesDerivation(graphData)

  const edgesSource = Array.isArray(args.edges)
    ? (args.edges as GraphEdge[])
    : Array.isArray(graphData.edges)
      ? (graphData.edges as GraphEdge[])
      : ([] as GraphEdge[])

  const edgesCached = nodesDerived.edgesCache.get(edgesSource as unknown as GraphEdge[])
  const edgesDerived =
    edgesCached ||
    deriveDisplayEdgesForSource({
      graphData,
      displayNodes: nodesDerived.displayNodes,
      displayNodeIdSet: nodesDerived.displayNodeIdSet,
      edgesSource,
    })
  if (!edgesCached) nodesDerived.edgesCache.set(edgesSource as unknown as GraphEdge[], edgesDerived)

  const displayGraphData = edgesDerived.displayGraphData

  return {
    graphData,
    displayGraphData,
    displayNodes: nodesDerived.displayNodes,
    displayEdges: edgesDerived.displayEdges,
    displayNodeIdSet: nodesDerived.displayNodeIdSet,
    nodeIndexById: nodesDerived.nodeIndexById,
    edgeIndexById: edgesDerived.edgeIndexById,
    nodeById: nodesDerived.nodeById,
  }
}
