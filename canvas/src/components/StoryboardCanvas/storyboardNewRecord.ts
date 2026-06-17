import { createUniqueId } from '@/lib/ids'
import type { GraphNode } from '@/lib/graph/types'
import { parseComposedId } from '@/hooks/store/graph-data-slice/graphDataComposedSource'

export function createStoryboardNewRecordId(nodes: readonly GraphNode[]): string {
  const usedIds = new Set<string>()
  for (const node of nodes) {
    const id = String(node.id || '').trim()
    if (!id) continue
    usedIds.add(id)
    const parsed = parseComposedId(id)
    if (parsed?.innerId) usedIds.add(parsed.innerId)
  }
  return createUniqueId('storyboard-card-', usedIds)
}
