import { splitComposedNodeId } from '@/lib/graph/canonicalNodeIds'
import type { GraphNode } from '@/lib/graph/types'

function buildOverlayOrderKey(id: string): string {
  const canonicalId = splitComposedNodeId(id).inner || id
  return `${canonicalId}\u0000${id}`
}

export function orderStoryboardWidgetOverlayNodeIdsByRenderGraph(args: {
  ids: readonly string[]
  nodes: readonly GraphNode[] | null | undefined
  graphMetaKind?: string | null
}): string[] {
  const ids = Array.isArray(args.ids)
    ? args.ids.map(id => String(id || '').trim()).filter(Boolean)
    : []
  if (ids.length <= 1) return ids
  return ids.sort((aId, bId) => {
    const aKey = buildOverlayOrderKey(aId)
    const bKey = buildOverlayOrderKey(bId)
    if (aKey !== bKey) return aKey.localeCompare(bKey)
    return aId.localeCompare(bId)
  })
}
