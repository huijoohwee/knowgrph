import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { applyMermaidSeedLayout } from '@/components/GraphCanvas/layout/mermaidSeed'
import { applyMarkdownHeadingSeedLayout } from '@/components/GraphCanvas/layout/markdownHeadingSeed'
import { applyClusterAwareHeuristicSeedLayout } from '@/components/GraphCanvas/layout/heuristic-cluster'

export function applyForceModeSeeds(args: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  width: number
  height: number
  schema: GraphSchema
}) {
  applyMermaidSeedLayout({ nodes: args.nodes, edges: args.edges, width: args.width, height: args.height, schema: args.schema })
  applyMarkdownHeadingSeedLayout({ nodes: args.nodes, edges: args.edges, width: args.width, height: args.height, schema: args.schema })
  applyClusterAwareHeuristicSeedLayout({ nodes: args.nodes, width: args.width, height: args.height, schema: args.schema })
}

