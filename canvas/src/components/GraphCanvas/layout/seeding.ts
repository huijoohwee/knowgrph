import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { applyMermaidSeedLayout } from '@/components/GraphCanvas/layout/mermaidSeed'
import { applyMarkdownHeadingSeedLayout } from '@/components/GraphCanvas/layout/markdownHeadingSeed'
import { applyClusterAwareHeuristicSeedLayout } from '@/components/GraphCanvas/layout/heuristic-cluster'
import { applyIndexGridSeedLayout } from '@/components/GraphCanvas/layout/indexGridSeed'
import { applyGroupGeometrySeedLayout } from '@/components/GraphCanvas/layout/groupGeometrySeed'

export function applyForceModeSeeds(args: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  width: number
  height: number
  schema: GraphSchema
  groupKeyOf?: (n: GraphNode) => string | null
  groupsForBboxCollide?: GraphGroup[]
}) {
  applyGroupGeometrySeedLayout({
    nodes: args.nodes,
    groups: Array.isArray(args.groupsForBboxCollide) ? args.groupsForBboxCollide : [],
    width: args.width,
    height: args.height,
    schema: args.schema,
  })
  applyMermaidSeedLayout({ nodes: args.nodes, edges: args.edges, width: args.width, height: args.height, schema: args.schema })
  applyMarkdownHeadingSeedLayout({ nodes: args.nodes, edges: args.edges, width: args.width, height: args.height, schema: args.schema })
  applyClusterAwareHeuristicSeedLayout({
    nodes: args.nodes,
    width: args.width,
    height: args.height,
    schema: args.schema,
    groupKeyOf: args.groupKeyOf,
  })
  applyIndexGridSeedLayout({ nodes: args.nodes, width: args.width, height: args.height, schema: args.schema })
}
