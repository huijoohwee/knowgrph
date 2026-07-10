import { buildGraphNodeCanonicalTextPatch } from '@/lib/cards/graphNodeCardFields'
import type { GraphNode, JSONValue } from '@/lib/graph/types'

export const commitStoryboardCardCanonicalText2d = (args: {
  addHistory: (label: string) => void
  canonicalKey: string
  cardId: string
  currentProperties: Record<string, unknown>
  historyLabel: string
  nextValue: string
  preserveFormatting?: boolean
  propertyKeys: readonly string[]
  updateNode: (id: string, patch: Partial<GraphNode>) => void
}): void => {
  const nextProperties = buildGraphNodeCanonicalTextPatch({
    currentProperties: args.currentProperties,
    propertyKeys: args.propertyKeys,
    canonicalKey: args.canonicalKey,
    nextValue: args.nextValue,
    preserveFormatting: args.preserveFormatting,
  }) as Record<string, JSONValue>
  args.updateNode(args.cardId, { properties: nextProperties })
  args.addHistory(args.historyLabel)
}
