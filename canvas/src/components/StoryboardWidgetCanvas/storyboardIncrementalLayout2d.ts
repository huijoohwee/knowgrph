import { readStoryboardCardCenter2d, type StoryboardCardPlacement } from '@/components/StoryboardWidgetCanvas/storyboardCardPlacements2d'
import type { GraphNode } from '@/lib/graph/types'

export const applyAuthoredPlacementsForNewStoryboardCards2d = (args: {
  candidate: ReadonlyMap<string, StoryboardCardPlacement>
  nodeById: ReadonlyMap<string, GraphNode>
  previous: ReadonlyMap<string, StoryboardCardPlacement> | null
}): Map<string, StoryboardCardPlacement> => {
  const next = new Map(args.candidate)
  if (!args.previous) return next
  for (const id of args.candidate.keys()) {
    if (args.previous.has(id)) continue
    const authoredPlacement = readStoryboardCardCenter2d(args.nodeById.get(id))
    if (authoredPlacement) next.set(id, authoredPlacement)
  }
  return next
}

export const resolveIncrementalStoryboardCardMovableIds2d = (args: {
  currentCardIds: ReadonlyArray<string>
  previousCardIds: ReadonlyArray<string>
}): ReadonlySet<string> => {
  const currentIds = Array.from(new Set(args.currentCardIds.map(id => String(id || '').trim()).filter(Boolean)))
  const previousIds = Array.from(new Set(args.previousCardIds.map(id => String(id || '').trim()).filter(Boolean)))
  const currentIdSet = new Set(currentIds)
  const previousIdSet = new Set(previousIds)
  const isIncrementalGrowth = previousIds.length > 0
    && currentIds.length > previousIds.length
    && previousIds.every(id => currentIdSet.has(id))
  return new Set(isIncrementalGrowth ? currentIds.filter(id => !previousIdSet.has(id)) : currentIds)
}
