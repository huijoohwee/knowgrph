import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import { createLayoutGroupKeyOfNode, selectLayoutGroups } from '@/components/GraphCanvas/layout/layoutGroupKey'
import { LRUCache } from '@/lib/cache/LRUCache'
import { buildGraphMetaKey } from '@/lib/graph/graphMetaKey'

export type SceneGroupsDerivation = {
  key: string
  allGroups: GraphGroup[]
  layoutGroups: GraphGroup[]
  layoutGroupKeyByNodeId: Record<string, string>
}

const cache = new LRUCache<string, SceneGroupsDerivation>(128)

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

