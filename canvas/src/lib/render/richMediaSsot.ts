import type { GraphNode } from '@/lib/graph/types'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import {
  FLOW_RICH_MEDIA_PANEL_NODE_LABEL,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
} from '@/lib/config.flow-editor'
import { listMediaOverlayNodes, type MediaOverlayNode } from '@/lib/render/mediaOverlayPool'
import {
  type RichMediaPanelTab,
  type RichMediaPanelOverlayState,
  buildRichMediaPanelOverlayState,
  resolveRichMediaPanelRenderNode,
} from '@/lib/render/richMediaPanelState'
export { buildRichMediaPanelOverlayState, resolveRichMediaPanelRenderNode } from '@/lib/render/richMediaPanelState'
export type { RichMediaPanelTab } from '@/lib/render/richMediaPanelState'

export type RichMediaDisplayMode = 'circle-only' | 'panel-only'
export type RichMediaPanelDensity = 'default' | 'compact'
export type RichMediaPanelMode = 'snapshot' | 'embed'
export type RichMediaPanelChange = {
  activeTab: RichMediaPanelOverlayState['activeTab']
  freezeConnectedOutput: boolean
  text?: string
}

export const RICH_MEDIA_DISPLAY_COPY = {
  toggleTitle: 'Rich Media',
  tooltip: 'Rich Media: shows or hides media overlays on media-capable nodes without reloading.',
  viewLabel: 'Media view',
  circleOnly: 'Circle-only',
  panelOnly: 'Panel-only',
  densityLabel: 'Panel layout',
  densityDefault: 'Standard',
  densityCompact: 'Compact',
  opacityLabel: 'Opacity',
} as const

export const RICH_MEDIA_PANEL_CONNECT_VIEW_LABEL = 'Rich Media Panel (Connect media to render)' as const
export const RICH_MEDIA_PANEL_KTV_VIEW_LABEL = FLOW_RICH_MEDIA_PANEL_NODE_LABEL as const
export const RICH_MEDIA_PANEL_MEDIA_SELECTOR_LABEL = 'Media Selector' as const

export function isRichMediaPanelDisplayEnabled(renderMediaAsNodes: unknown): boolean {
  return renderMediaAsNodes === true
}

export function readRichMediaDisplayMode(renderMediaAsNodes: unknown): RichMediaDisplayMode {
  return isRichMediaPanelDisplayEnabled(renderMediaAsNodes) ? 'panel-only' : 'circle-only'
}

export function normalizeRichMediaPanelDensity(value: unknown): RichMediaPanelDensity {
  return value === 'compact' ? 'compact' : 'default'
}

export function normalizeRichMediaPanelMode(value: unknown): RichMediaPanelMode {
  return value === 'embed' ? 'embed' : 'snapshot'
}

export function coerceRichMediaPanelSizePx(args: {
  width: unknown
  height: unknown
  viewportW?: unknown
  viewportH?: unknown
  minWidthPx?: number
  minHeightPx?: number
  maxViewportWidthRatio?: number
  maxViewportHeightRatio?: number
}): { width: number; height: number } {
  const minWidthPx =
    typeof args.minWidthPx === 'number' && Number.isFinite(args.minWidthPx) ? Math.max(1, Math.floor(args.minWidthPx)) : 220
  const minHeightPx =
    typeof args.minHeightPx === 'number' && Number.isFinite(args.minHeightPx) ? Math.max(1, Math.floor(args.minHeightPx)) : 160

  const rawW = typeof args.width === 'number' && Number.isFinite(args.width) ? args.width : Number(args.width)
  const rawH = typeof args.height === 'number' && Number.isFinite(args.height) ? args.height : Number(args.height)
  const w0 = Number.isFinite(rawW) && rawW > 0 ? rawW : minWidthPx
  const h0 = Number.isFinite(rawH) && rawH > 0 ? rawH : minHeightPx

  const vwRaw = typeof args.viewportW === 'number' && Number.isFinite(args.viewportW) ? args.viewportW : Number(args.viewportW)
  const vhRaw = typeof args.viewportH === 'number' && Number.isFinite(args.viewportH) ? args.viewportH : Number(args.viewportH)
  const vw = Number.isFinite(vwRaw) && vwRaw > 0 ? vwRaw : null
  const vh = Number.isFinite(vhRaw) && vhRaw > 0 ? vhRaw : null

  const maxViewportWidthRatio =
    typeof args.maxViewportWidthRatio === 'number' && Number.isFinite(args.maxViewportWidthRatio)
      ? Math.max(0.2, Math.min(0.98, args.maxViewportWidthRatio))
      : 0.92
  const maxViewportHeightRatio =
    typeof args.maxViewportHeightRatio === 'number' && Number.isFinite(args.maxViewportHeightRatio)
      ? Math.max(0.2, Math.min(0.98, args.maxViewportHeightRatio))
      : 0.92

  let maxW = Infinity
  let maxH = Infinity
  if (vw != null) maxW = Math.max(minWidthPx, Math.floor(vw * maxViewportWidthRatio))
  if (vh != null) maxH = Math.max(minHeightPx, Math.floor(vh * maxViewportHeightRatio))

  const downscale = Math.min(1, maxW / w0, maxH / h0)
  const w1 = Math.max(minWidthPx, Math.floor(w0 * downscale))
  const h1 = Math.max(minHeightPx, Math.floor(h0 * downscale))
  return { width: w1, height: h1 }
}

export function resolveRichMediaPanelInteractive(args: {
  nodeInteractive: unknown
  renderMediaAsNodes: unknown
  infiniteCanvasInteractionMode: unknown
}): boolean {
  if (String(args.infiniteCanvasInteractionMode || '').trim().toLowerCase() === 'interactive') return true
  if (!isRichMediaPanelDisplayEnabled(args.renderMediaAsNodes)) return false
  return args.nodeInteractive === true
}

export function listDisplayRichMediaOverlayNodes(args: {
  renderMediaAsNodes: unknown
  nodes: GraphNode[]
  poolMax: unknown
  preferredNodeIds?: readonly string[]
  excludeNodeIdSet?: Set<string>
  connectedValuesByNodeId?: ReadonlyMap<string, FlowConnectedValuesBySchemaPath>
}): MediaOverlayNode[] {
  const poolMaxRaw = typeof args.poolMax === 'number' && Number.isFinite(args.poolMax) ? args.poolMax : 0
  const poolMax = poolMaxRaw > 0 ? Math.floor(poolMaxRaw) : 24
  return listMediaOverlayNodes({
    enabled: isRichMediaPanelDisplayEnabled(args.renderMediaAsNodes),
    nodes: Array.isArray(args.nodes) ? args.nodes : [],
    poolMax,
    preferredNodeIds: args.preferredNodeIds,
    excludeNodeIdSet: args.excludeNodeIdSet,
    connectedValuesByNodeId: args.connectedValuesByNodeId,
  })
}

export function commitRichMediaPanelChange(args: {
  nodeId: string
  next: RichMediaPanelChange | null | undefined
  updateNode: (id: string, patch: { properties: Record<string, unknown> }) => void
}): void {
  const nodeId = String(args.nodeId || '').trim()
  const next = args.next
  if (!nodeId || !next) return
  const nextTab = String(next.activeTab || 'auto').trim().toLowerCase()
  const activeTab =
    nextTab === 'text' || nextTab === 'image' || nextTab === 'video' || nextTab === 'poi' || nextTab === 'auto'
      ? nextTab
      : 'auto'
  args.updateNode(nodeId, {
    properties: {
      richMediaActiveTab: activeTab,
      freezeConnectedOutput: Boolean(next.freezeConnectedOutput),
      ...(typeof next.text === 'string' ? { output: next.text } : {}),
    },
  })
}

export function getRichMediaPanelMediaSelectorOptions(): ReadonlyArray<{ value: RichMediaPanelTab; label: string }> {
  return [
    { value: 'auto', label: 'Auto-switch (Default)' },
    { value: 'text', label: 'Markdown Editor/Viewer' },
    { value: 'image', label: 'Image Viewer' },
    { value: 'video', label: 'Video Viewer' },
    { value: 'poi', label: 'POI Viewer' },
  ] as const
}

export function getRichMediaPanelViewLabel(hideFields: boolean): string {
  return hideFields ? RICH_MEDIA_PANEL_KTV_VIEW_LABEL : RICH_MEDIA_PANEL_CONNECT_VIEW_LABEL
}

export function getRichMediaPanelViewTitle(hideFields: boolean): string {
  return hideFields ? RICH_MEDIA_PANEL_CONNECT_VIEW_LABEL : RICH_MEDIA_PANEL_KTV_VIEW_LABEL
}

export function isRichMediaPanelNode(node: GraphNode | null | undefined): boolean {
  return String(node?.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
}

export function getRichMediaPanelNodeLabel(): string {
  return FLOW_RICH_MEDIA_PANEL_NODE_LABEL
}
