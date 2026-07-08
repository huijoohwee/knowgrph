import { applyFixedStoryboardCardPlacementsToGraphData2d } from '@/components/StoryboardWidgetCanvas/storyboardCardPlacements2d'
import type { GraphData } from '@/lib/graph/types'

type MutableNodeRecord = {
  id: string
  type: string
  label: string
  x?: number
  y?: number
  fx?: number
  fy?: number
  vx?: number
  vy?: number
  properties: Record<string, unknown>
}

export function testStoryboardFixedCardPlacementProjectionAvoidsForceLayoutMutationFields() {
  const nodes: MutableNodeRecord[] = [
    { id: 'source-card', type: 'storyboard', label: 'Source', properties: { lane: 'Source', summary: 'A', order: 0 } },
    { id: 'runtime-card', type: 'storyboard', label: 'Runtime', properties: { lane: 'Runtime', summary: 'B', order: 1 } },
  ]
  const graphData = {
    type: 'application/json',
    nodes,
    edges: [{ id: 'edge-a', source: 'source-card', target: 'runtime-card', label: 'flow' }],
  } as GraphData
  const projected = applyFixedStoryboardCardPlacementsToGraphData2d({
    aspectRatioMode: '16:9',
    graphData,
    graphRevision: 1,
    schema: null,
  })
  for (const node of nodes) {
    for (const key of ['x', 'y', 'fx', 'fy', 'vx', 'vy'] as const) {
      if (Object.prototype.hasOwnProperty.call(node, key)) throw new Error(`expected source graph node ${node.id} not to be mutated with ${key}`)
    }
  }
  const projectedNodes = Array.isArray(projected?.nodes) ? projected.nodes : []
  for (const node of projectedNodes) {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) throw new Error(`expected projected Storyboard card ${String(node.id || '')} to receive finite renderer coordinates`)
    for (const key of ['fx', 'fy', 'vx', 'vy'] as const) {
      if (Object.prototype.hasOwnProperty.call(node, key)) throw new Error(`expected projected Storyboard card ${String(node.id || '')} not to leak force-layout field ${key}`)
    }
  }
}
