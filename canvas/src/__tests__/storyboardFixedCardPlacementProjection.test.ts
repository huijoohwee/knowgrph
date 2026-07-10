import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
  const interactions = readFileSync(resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas/storyboardCardOverlayInteractions2d.ts'), 'utf8')
  for (const stale of ['fx: next.point.x', 'fy: next.point.y', 'fx: snapped.x', 'fy: snapped.y', 'vx: 0', 'vy: 0']) {
    if (interactions.includes(stale)) throw new Error(`expected Storyboard card drag persistence not to leak D3 force-layout fields: ${stale}`)
  }
  if (interactions.includes('args.updateNode(next.id, { x: next.point.x, y: next.point.y })')
    || !interactions.includes('args.updateNode(id, { x: snapped.x, y: snapped.y })')) {
    throw new Error('expected Storyboard card drag persistence to commit renderer-neutral x/y coordinates once at drag end')
  }
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

export function testStoryboardCardModeEdgesUseFullGraphWhileD3UsesFilteredGraph() {
  const surface = readFileSync(resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas/runtime/StoryboardWidgetCanvasSurface.tsx'), 'utf8')
  if (!surface.includes('const storyboardEdgeGraphData = storyboardSharedSurfaceActive ? storyboardGraphData : flowCanvasGraphDataOverride')) {
    throw new Error('expected Card-mode port/edge ownership to use the full Storyboard graph, not the filtered FlowCanvas/D3 graph')
  }
  if (!surface.includes('useStoryboardEdgeCreationRequest({ active: storyboardCardsActive, beginEdge: props.beginAddEdgeFromNode, graphData: storyboardEdgeGraphData })')) {
    throw new Error('expected Card-mode edge creation requests to resolve fixed cards against the full Storyboard graph')
  }
  if (!surface.includes('graphData={storyboardEdgeGraphData}')) {
    throw new Error('expected Storyboard overlay port handles to resolve fixed cards against the full Storyboard graph')
  }
  if (!surface.includes('graphDataOverride={flowCanvasGraphDataOverride}')) {
    throw new Error('expected FlowCanvas/D3 rendering to stay on the filtered graph while Card edges use the full Storyboard graph')
  }
  if (surface.includes('useStoryboardEdgeCreationRequest({ active: storyboardCardsActive, beginEdge: props.beginAddEdgeFromNode, graphData: flowCanvasGraphDataOverride })')) {
    throw new Error('forbid Card-mode edge creation from resolving against the filtered FlowCanvas/D3 graph')
  }
}
