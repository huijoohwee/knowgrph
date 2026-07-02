import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/config.storyboard-widget'
import type { GraphNode } from '@/lib/graph/types'

export function isStoryboardFixedCardOwnedNode(node: GraphNode | null | undefined): boolean {
  if (!node) return false
  return String(node.type || '').trim() !== FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
}
