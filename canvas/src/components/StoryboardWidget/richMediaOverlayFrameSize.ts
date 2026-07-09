import { RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE } from '@/lib/render/richMediaPanelDefaults'
import {
  coerceRichMediaPanelSizePx,
  resolveRichMediaAspectRatioValue,
  resolveRichMediaAspectSelection,
} from '@/lib/render/richMediaSsot'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/storyboardWidget/richMediaPanelConfig'

export function readRichMediaOverlayFrameSize(node: { type?: unknown; properties?: unknown } | null | undefined): { width: number; height: number } | null {
  if (!node || String(node.type || '').trim() !== FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) return null
  const props = node.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)
    ? node.properties as Record<string, unknown>
    : null
  if (!props) return null
  const width = Number(props['visual:width'])
  const height = Number(props['visual:height'])
  if (!(Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0)) return RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE
  return coerceRichMediaPanelSizePx({ width, height, minWidthPx: 1, minHeightPx: 1, targetAspect: resolveRichMediaAspectRatioValue(resolveRichMediaAspectSelection({ width, height })) })
}
