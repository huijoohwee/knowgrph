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
