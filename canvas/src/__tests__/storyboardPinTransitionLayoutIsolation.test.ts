import { applyFixedStoryboardCardPlacementsToGraphData2d, type StoryboardCardPlacement } from '@/components/StoryboardWidgetCanvas/storyboardCardPlacements2d'
import { reconcileStableStoryboardCardPlacements2d } from '@/components/StoryboardWidgetCanvas/useStableStoryboardCardPlacements2d'
import type { GraphData } from '@/lib/graph/types'

const readPositions = (graphData: GraphData | null): Map<string, StoryboardCardPlacement> => new Map(
  (graphData?.nodes || []).flatMap(node => (
    typeof node.x === 'number' && typeof node.y === 'number'
      ? [[String(node.id), { x: node.x, y: node.y }] as const]
      : []
  )),
)

export function testStoryboardPinTransitionDoesNotMutateSiblingLayout() {
  const source = {
    type: 'application/json',
    nodes: ['alpha', 'beta', 'gamma'].map((id, order) => ({
      id,
      type: 'storyboard',
      label: id,
      x: order * 10,
      y: order * 10,
      properties: { lane: 'Elements', order, summary: id },
    })),
    edges: [],
  } as GraphData
  const pinnedById = Object.fromEntries(source.nodes.map(node => [String(node.id), true]))
  const initial = applyFixedStoryboardCardPlacementsToGraphData2d({
    aspectRatioMode: '16:9',
    flowWidgetPinnedByNodeId: pinnedById,
    graphData: source,
    graphRevision: 1,
    schema: null,
  })
  const stablePlacements = readPositions(initial)
  const targetId = 'beta'
  const targetPlacement = stablePlacements.get(targetId)
  if (!targetPlacement) throw new Error('expected initial fixed layout to materialize the target placement')

  const unpinnedSource = {
    ...initial!,
    nodes: initial!.nodes.map(node => node.id === targetId
      ? { ...node, x: targetPlacement.x + 700, y: targetPlacement.y + 300 }
      : node),
  }
  const unpinned = applyFixedStoryboardCardPlacementsToGraphData2d({
    aspectRatioMode: '16:9',
    flowWidgetPinnedByNodeId: { ...pinnedById, [targetId]: false },
    graphData: unpinnedSource,
    graphRevision: 2,
    referencePlacements: stablePlacements,
    schema: null,
  })
  const unpinnedPositions = readPositions(unpinned)
  for (const [id, placement] of stablePlacements) {
    const actual = unpinnedPositions.get(id)
    if (!actual) throw new Error(`expected unpin transition to retain ${id}`)
    if (id === targetId) {
      if (actual.x === placement.x && actual.y === placement.y) throw new Error('expected the unpinned target to retain its independent position')
    } else if (actual.x !== placement.x || actual.y !== placement.y) {
      throw new Error(`expected unpin transition not to mutate sibling ${id}`)
    }
  }

  const repinned = applyFixedStoryboardCardPlacementsToGraphData2d({
    aspectRatioMode: '16:9',
    flowWidgetPinnedByNodeId: pinnedById,
    graphData: unpinned!,
    graphRevision: 3,
    referencePlacements: stablePlacements,
    schema: null,
  })
  const repinnedPositions = readPositions(repinned)
  for (const [id, placement] of stablePlacements) {
    const actual = repinnedPositions.get(id)
    if (!actual || actual.x !== placement.x || actual.y !== placement.y) {
      throw new Error(`expected pin transition to restore only the target slot without mutating ${id}`)
    }
  }

  const shiftedCandidate = new Map([...stablePlacements].map(([id, placement]) => [id, { x: placement.x + 50, y: placement.y + 50 }]))
  const reconciled = reconcileStableStoryboardCardPlacements2d(stablePlacements, shiftedCandidate)
  if (reconciled !== stablePlacements) throw new Error('expected an unchanged card set to reuse the stable placement map without re-render churn')
}
