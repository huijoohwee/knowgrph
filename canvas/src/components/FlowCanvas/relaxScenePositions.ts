import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'

import { relaxFlowPositionsWithCollision } from '@/components/FlowCanvas/relaxPositions'

export function relaxFlowSceneNodePositions(args: {
  graphData: GraphData
  sceneNodes: ReadonlyArray<{ id: string; x: number; y: number }>
  groups: GraphGroup[]
  schema: GraphSchema
  nodeSize: { widthPx: number; heightPx: number }
  portHandles: { enabled: boolean; sizePx: number; offsetPx: number }
  steps: number
}): Record<string, { x: number; y: number }> | null {
  const currentPositions: Record<string, { x: number; y: number }> = {}
  let count = 0
  for (let i = 0; i < args.sceneNodes.length; i += 1) {
    const n = args.sceneNodes[i]
    if (!n?.id) continue
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) continue
    currentPositions[n.id] = { x: n.x, y: n.y }
    count += 1
  }
  if (count === 0) return null

  const relaxed = relaxFlowPositionsWithCollision({
    graphData: args.graphData,
    groups: args.groups,
    positions: currentPositions,
    schema: args.schema,
    nodeSize: args.nodeSize,
    portHandles: args.portHandles,
    defaultSteps: Math.max(0, Math.floor(args.steps)),
  })

  return relaxed || currentPositions
}
