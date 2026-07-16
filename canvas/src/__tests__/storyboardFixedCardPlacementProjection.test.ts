import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { applyFixedStoryboardCardPlacementsToGraphData2d } from '@/components/StoryboardWidgetCanvas/storyboardCardPlacements2d'
import type { GraphData } from '@/lib/graph/types'
import {
  PROBE_TREE_BALANCED_LAYOUT_MODE,
  PROBE_TREE_BALANCED_LAYOUT_VERSION,
  PROBE_TREE_LAYOUT_MODE_PROPERTY,
  PROBE_TREE_LAYOUT_VERSION_PROPERTY,
} from '@/lib/storyboardWidget/probeTreeLayoutContract'

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

export function testStoryboardFixedCardPlacementPreservesProbeTreeAuthoredCoordinates() {
  const layoutProperties = {
    lane: 'PROBE',
    cardTypeLabel: 'Probe-Tree Card',
    summary: 'Generated probe',
    [PROBE_TREE_LAYOUT_MODE_PROPERTY]: PROBE_TREE_BALANCED_LAYOUT_MODE,
    [PROBE_TREE_LAYOUT_VERSION_PROPERTY]: PROBE_TREE_BALANCED_LAYOUT_VERSION,
  }
  const graphData = {
    type: 'application/json',
    nodes: [
      { id: 'probe-a', type: 'TextGeneration', label: 'Probe A', x: 440, y: -260, properties: { ...layoutProperties, order: 1 } },
      { id: 'probe-b', type: 'TextGeneration', label: 'Probe B', x: 860, y: 140, properties: { ...layoutProperties, order: 2 } },
      { id: 'ordinary', type: 'TextGeneration', label: 'Ordinary', x: 1000, y: 1000, properties: { lane: 'OTHER', summary: 'Ordinary card', order: 3 } },
    ],
    edges: [],
  } as GraphData
  const projected = applyFixedStoryboardCardPlacementsToGraphData2d({
    aspectRatioMode: '16:9',
    flowWidgetPinnedByNodeId: { 'probe-a': true, 'probe-b': true, ordinary: true },
    graphData,
    graphRevision: 1,
    referencePlacements: new Map([
      ['probe-a', { x: 0, y: 0 }],
      ['probe-b', { x: 0, y: 260 }],
      ['ordinary', { x: 40, y: 40 }],
    ]),
    schema: null,
  })
  const projectedById = new Map((projected?.nodes || []).map(node => [String(node.id), node]))
  const probeA = projectedById.get('probe-a')
  const probeB = projectedById.get('probe-b')
  const ordinary = projectedById.get('ordinary')
  if (probeA?.x !== 440 || probeA.y !== -260) {
    throw new Error(`expected fixed projection to preserve authored Probe A coordinates, got ${String(probeA?.x)},${String(probeA?.y)}`)
  }
  if (probeB?.x !== 860 || probeB.y !== 140) {
    throw new Error(`expected fixed projection to preserve authored Probe B coordinates, got ${String(probeB?.x)},${String(probeB?.y)}`)
  }
  if (ordinary?.x !== 40 || ordinary.y !== 40) {
    throw new Error(`expected non-Probe cards to keep using fixed reference placement, got ${String(ordinary?.x)},${String(ordinary?.y)}`)
  }
  if (graphData.nodes[0]?.x !== 440 || graphData.nodes[1]?.x !== 860) {
    throw new Error('expected fixed projection to leave authored Probe source nodes immutable')
  }

  const transientGraphData = {
    ...graphData,
    nodes: [
      ...graphData.nodes,
      { id: 'probe-pending-center', type: 'TextGeneration', label: 'Pending Probe', properties: { ...layoutProperties, order: 4 } },
    ],
  } as GraphData
  const transientProjected = applyFixedStoryboardCardPlacementsToGraphData2d({
    aspectRatioMode: '16:9',
    flowWidgetPinnedByNodeId: { 'probe-a': true, 'probe-b': true, ordinary: true, 'probe-pending-center': true },
    graphData: transientGraphData,
    graphRevision: 2,
    schema: null,
  })
  const pendingProbe = transientProjected?.nodes.find(node => node.id === 'probe-pending-center')
  if (!Number.isFinite(pendingProbe?.x) || !Number.isFinite(pendingProbe?.y)) {
    throw new Error('expected a layout-owned Probe card with a transiently missing authored center to receive a finite fallback placement')
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
