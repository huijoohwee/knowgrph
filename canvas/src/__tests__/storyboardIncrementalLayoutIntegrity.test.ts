import { applyAuthoredPlacementsForNewStoryboardCards2d, resolveIncrementalStoryboardCardMovableIds2d } from '@/components/StoryboardWidgetCanvas/storyboardIncrementalLayout2d'
import type { StoryboardCardPlacement } from '@/components/StoryboardWidgetCanvas/storyboardCardPlacements2d'
import { reconcileStableStoryboardCardPlacements2d } from '@/components/StoryboardWidgetCanvas/useStableStoryboardCardPlacements2d'
import type { GraphNode } from '@/lib/graph/types'

const node = (id: string, x: number, y: number): GraphNode => ({
  id,
  label: id,
  properties: {},
  type: 'TextGeneration',
  x,
  y,
})

export function testStoryboardIncrementalLayoutPreservesPointerAuthoredPlacement() {
  const previous = new Map<string, StoryboardCardPlacement>([['n1', { x: 100, y: 200 }]])
  const candidate = new Map<string, StoryboardCardPlacement>([
    ['n1', { x: -300, y: -200 }],
    ['n2', { x: 0, y: 0 }],
  ])
  const nodeById = new Map<string, GraphNode>([
    ['n1', node('n1', 900, 900)],
    ['n2', node('n2', 702, 287)],
  ])
  const authoredCandidate = applyAuthoredPlacementsForNewStoryboardCards2d({ candidate, nodeById, previous })
  const reconciled = reconcileStableStoryboardCardPlacements2d(previous, authoredCandidate)
  const existing = reconciled.get('n1')
  const added = reconciled.get('n2')
  if (existing?.x !== 100 || existing.y !== 200) throw new Error('expected the existing card endpoint to retain its stable placement')
  if (added?.x !== 702 || added.y !== 287) throw new Error('expected the new card to retain its pointer-authored world placement')
}

export function testStoryboardInitialLayoutRemainsLayoutAgnostic() {
  const candidate = new Map<string, StoryboardCardPlacement>([['n1', { x: 10, y: 20 }]])
  const nodeById = new Map<string, GraphNode>([['n1', node('n1', 700, 800)]])
  const initial = applyAuthoredPlacementsForNewStoryboardCards2d({ candidate, nodeById, previous: null })
  const placement = initial.get('n1')
  if (placement?.x !== 10 || placement.y !== 20) throw new Error('expected initial layout policy to remain authoritative')
}

export function testStoryboardIncrementalCollisionMovesOnlyAddedCards() {
  const movable = resolveIncrementalStoryboardCardMovableIds2d({
    currentCardIds: ['n1', 'n2', 'n3'],
    previousCardIds: ['n1', 'n2'],
  })
  if (movable.size !== 1 || !movable.has('n3')) throw new Error('expected only the added card to participate in collision settlement')

  const nonGrowthMovable = resolveIncrementalStoryboardCardMovableIds2d({
    currentCardIds: ['n2', 'n3'],
    previousCardIds: ['n1', 'n2'],
  })
  if (nonGrowthMovable.size !== 2) throw new Error('expected non-growth topology changes to retain the general collision policy')
}
