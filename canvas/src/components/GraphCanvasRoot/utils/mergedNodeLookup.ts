import type { MutableRefObject } from 'react'

import { getCachedGraphLookup } from '@/lib/graph/lookupCache'
import type { GraphData, GraphNode } from '@/lib/graph/types'

type GraphNodeSimulation = {
  nodes: () => GraphNode[]
}

export type MergedGraphNodeLookupCache = {
  graphData: GraphData | null
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
}): Map<string, GraphNode> {
  const graphData = args.graphData || null
  const sim = args.simulation || null
  const rev = typeof args.graphRevision === 'number' && Number.isFinite(args.graphRevision) ? Math.floor(args.graphRevision) : 0
  const cached = args.cacheRef.current
  if (cached.graphData !== graphData || cached.rev !== rev || cached.sim !== sim) {
    const baseLookup = getCachedGraphLookup({
      cacheScope: args.cacheScope,
      graphData,
      graphRevision: rev,
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
    args.cacheRef.current = { graphData, rev, sim, map }
  }
  return args.cacheRef.current.map
}
