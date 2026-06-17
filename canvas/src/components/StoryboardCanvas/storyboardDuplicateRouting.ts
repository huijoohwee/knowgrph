import type { GraphNode } from '@/lib/graph/types'

const readStoryboardScalar = (value: unknown): string => String(value ?? '').replace(/\s+/g, ' ').trim()

const readStoryboardNodeProperties = (node: GraphNode | null | undefined): Record<string, unknown> => {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return {}
  const properties = (node as { properties?: unknown }).properties
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return {}
  return properties as Record<string, unknown>
}

export function canUseStrybldrStoryboardDuplicatePath(args: {
  hasStrybldrStoryboardDuplicatePath: boolean
  sourceNode: GraphNode | null | undefined
  resolvedCardNodeId?: string | null
  cardId?: string | null
  currentPropertiesByCardId?: ReadonlyMap<string, Record<string, unknown>> | null
}): boolean {
  if (!args.hasStrybldrStoryboardDuplicatePath) return false
  const sourceId = String(
    readStoryboardScalar(args.sourceNode?.id)
    || readStoryboardScalar(args.resolvedCardNodeId)
    || readStoryboardScalar(args.cardId)
    || ''
  ).trim()
  const sourceProperties = (sourceId && args.currentPropertiesByCardId?.get(sourceId))
    || readStoryboardNodeProperties(args.sourceNode)
  const strybldrRunId = readStoryboardScalar(sourceProperties.strybldrRunId)
  const strybldrSourceUnitId = readStoryboardScalar(sourceProperties.strybldrSourceUnitId)
  const strybldrElementId = readStoryboardScalar(sourceProperties.strybldrElementId)
  return Boolean(strybldrRunId && (strybldrSourceUnitId || strybldrElementId))
}
