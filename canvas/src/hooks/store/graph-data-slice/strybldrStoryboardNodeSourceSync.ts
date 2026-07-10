import type { GraphNode } from '@/lib/graph/types'
import {
  appendStrybldrStoryboardMarkdownElement,
  buildStrybldrCardOverridePatchFromGraphNodeChange,
} from '@/features/strybldr/strybldrStoryboard'

export function appendStrybldrStoryboardNodeSource(text: string, node: GraphNode): string {
  const properties = (node.properties || {}) as Record<string, unknown>
  const cardPatch = buildStrybldrCardOverridePatchFromGraphNodeChange({ nextNode: node })
  return appendStrybldrStoryboardMarkdownElement({
    text,
    nodeId: String(node.id || '').trim(),
    sourceUnitId: String(properties.strybldrSourceUnitId || '').trim(),
    title: cardPatch.title,
    type: cardPatch.type,
    lane: cardPatch.lane,
    order: cardPatch.order,
    summary: cardPatch.summary,
    action: cardPatch.action,
    prompt: cardPatch.prompt,
  }) || text
}

export function isStrybldrStoryboardNodeSourceOwned(node: GraphNode | null | undefined): boolean {
  const properties = (node?.properties || {}) as Record<string, unknown>
  return !!String(properties.strybldrElementId || '').trim()
}
