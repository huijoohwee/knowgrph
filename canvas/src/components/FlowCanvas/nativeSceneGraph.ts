import { filterGraphByExcludedNodeIds } from '@/lib/graph/filterByNodeIds'
import type { GraphData } from '@/lib/graph/types'

export function deriveFlowCanvasNativeSceneGraph(args: {
  sceneGraphData: GraphData | null
  overlayNodes: ReadonlyArray<{ id?: unknown }>
  excludedNodeIds?: ReadonlyArray<string> | null
}): GraphData | null {
  const excludedNodeIds = new Set<string>()
  for (const rawId of args.excludedNodeIds || []) {
    const id = String(rawId || '').trim()
    if (id) excludedNodeIds.add(id)
  }
  for (const node of args.overlayNodes) {
    const id = String(node.id || '').trim()
    if (id) excludedNodeIds.add(id)
  }
  return filterGraphByExcludedNodeIds({
    graphData: args.sceneGraphData,
    excludedNodeIds: Array.from(excludedNodeIds),
  })
}
