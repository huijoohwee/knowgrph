import type { MutableRefObject } from 'react'

import { getCachedGraphLookup } from '@/lib/graph/lookupCache'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import type { GraphData, GraphNode } from '@/lib/graph/types'

type GraphNodeSimulation = {
  nodes: () => GraphNode[]
}

export type MergedGraphNodeLookupCache = {
  graphSemanticKey: string
  rev: number
  sim: GraphNodeSimulation | null
  map: Map<string, GraphNode>
}

export function readMergedGraphNodeLookup(args: {
  cacheRef: MutableRefObject<MergedGraphNodeLookupCache>
  cacheScope: string
  graphData: GraphData | null
  graphRevision: number
  simulation: GraphNodeSimulation | null | undefined
  graphSemanticKey?: string | null
}): Map<string, GraphNode> {
  const graphData = args.graphData || null
  const sim = args.simulation || null
  const rev = typeof args.graphRevision === 'number' && Number.isFinite(args.graphRevision) ? Math.floor(args.graphRevision) : 0
  const graphSemanticKey = buildScopedGraphSemanticKey(args.cacheScope, {
    graphData,
    graphRevision: rev,
    graphSemanticKey: args.graphSemanticKey,
  })
  const cached = args.cacheRef.current
  if (cached.graphSemanticKey !== graphSemanticKey || cached.rev !== rev || cached.sim !== sim) {
    const baseLookup = getCachedGraphLookup({
      cacheScope: args.cacheScope,
      graphData,
      graphRevision: rev,
      graphSemanticKey,
      preferCurrentGraphDataRefs: true,
    })
    const map = new Map<string, GraphNode>(baseLookup?.nodeById || [])
    const simNodes = sim ? sim.nodes() : []
    for (let i = 0; i < simNodes.length; i += 1) {
      const node = simNodes[i]
      const id = String(node?.id || '').trim()
      if (!id) continue
      map.set(id, node)
    }
    args.cacheRef.current = { graphSemanticKey, rev, sim, map }
  }
  return args.cacheRef.current.map
}
