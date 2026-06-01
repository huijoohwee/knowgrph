import type { GraphData, GraphNode } from '@/lib/graph/types'
import { computeFlowConnectedValuesBySchemaPath, type FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import {
  FLOW_RICH_MEDIA_PANEL_NODE_LABEL,
} from '@/lib/flowEditor/richMediaPanelConfig'
import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'
import { isFlowEditorFrontmatterDocumentModeRequested } from '@/lib/graph/frontmatterMode'
import { listMediaOverlayNodes, type MediaOverlayNode } from '@/lib/render/mediaOverlayPool'
import {
  type RichMediaPanelTab,
  type RichMediaPanelOverlayState,
  buildStaticRichMediaPanelOverlayState,
  buildRichMediaPanelOverlayState,
  resolveRichMediaPanelRenderNode,
} from '@/lib/render/richMediaPanelState'
import { getNodeMediaSpec } from '@/lib/canvas/graph-elements/mediaSpec'
import { normalizeRichMediaPanelInlineSrcDoc } from '@/lib/render/richMediaPanelSrcDoc'
import {
  getRichMediaPanelNodeLabel,
  isRichMediaPanelNode,
  resolvePreferredRichMediaPanelNodeId,
} from '@/lib/render/richMediaPanelNode'
export { buildRichMediaPanelOverlayState, buildStaticRichMediaPanelOverlayState, resolveRichMediaPanelRenderNode } from '@/lib/render/richMediaPanelState'
export type { RichMediaPanelTab } from '@/lib/render/richMediaPanelState'
export { getRichMediaPanelNodeLabel, isRichMediaPanelNode, resolvePreferredRichMediaPanelNodeId } from '@/lib/render/richMediaPanelNode'

export type RichMediaDisplayMode = 'circle-only' | 'panel-only'
export type RichMediaPanelDensity = 'default' | 'compact'
export type RichMediaPanelMode = 'snapshot' | 'embed'
export type RichMediaPanelChange = {
  activeTab: RichMediaPanelOverlayState['activeTab']
  freezeConnectedOutput: boolean
  text?: string
}
export type RichMediaPanelPreviewSpec =
  | {
      kind: 'image'
      url: string
      openUrl?: string
      srcDoc?: undefined
      interactive: boolean
    }
  | {
      kind: 'video'
      url: string
      openUrl?: string
      srcDoc?: undefined
      interactive: boolean
    }
  | {
      kind: 'iframe'
      url: string
      openUrl?: string
      srcDoc?: string
      interactive: boolean
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
export const RICH_MEDIA_PANEL_KTV_VIEW_LABEL = FLOW_RICH_MEDIA_PANEL_NODE_LABEL
export const RICH_MEDIA_PANEL_MEDIA_SELECTOR_LABEL = 'Media Selector' as const

export type ResolvedRichMediaPanelTab = Exclude<RichMediaPanelTab, 'auto'>
export type RichMediaPanelAspectSelection = '16:9' | '9:16'

export type RichMediaPanelDisplayArgs = {
  renderMediaAsNodes: unknown
  canvas2dRenderer?: unknown
  frontmatterModeEnabled?: unknown
  documentSemanticMode?: unknown
}

function normalizeRichMediaPanelDisplayArgs(args: unknown): RichMediaPanelDisplayArgs {
  if (args && typeof args === 'object' && !Array.isArray(args) && 'renderMediaAsNodes' in args) {
    return args as RichMediaPanelDisplayArgs
  }
  return { renderMediaAsNodes: args }
}

export function isRichMediaPanelDisplayEnabled(args: unknown): boolean {
  const normalized = normalizeRichMediaPanelDisplayArgs(args)
  if (normalized.renderMediaAsNodes === true) return true
  return isFlowEditorFrontmatterDocumentModeRequested({
    canvas2dRenderer: String(normalized.canvas2dRenderer || ''),
    frontmatterModeEnabled: normalized.frontmatterModeEnabled === true,
    documentSemanticMode: String(normalized.documentSemanticMode || ''),
  })
}

export function readRichMediaDisplayMode(args: unknown): RichMediaDisplayMode {
  return isRichMediaPanelDisplayEnabled(args) ? 'panel-only' : 'circle-only'
}

export function normalizeRichMediaPanelDensity(value: unknown): RichMediaPanelDensity {
  return value === 'compact' ? 'compact' : 'default'
}

export function normalizeRichMediaPanelMode(value: unknown): RichMediaPanelMode {
  return value === 'embed' ? 'embed' : 'snapshot'
}

export function normalizeRichMediaPanelTab(value: unknown): RichMediaPanelTab {
  const raw = String(value || '').trim().toLowerCase()
  return raw === 'text' || raw === 'image' || raw === 'video' || raw === 'poi' || raw === 'auto'
    ? raw as RichMediaPanelTab
    : 'auto'
}

export function resolveRichMediaPanelSelectedTab(args: {
  activeTab: unknown
  hasText?: unknown
  hasImage?: unknown
  hasVideo?: unknown
  hasPoi?: unknown
  renderKind?: unknown
  hasRenderableUrl?: unknown
  hasInlineSrcDoc?: unknown
}): ResolvedRichMediaPanelTab | null {
  const activeTab = normalizeRichMediaPanelTab(args.activeTab)
  if (activeTab !== 'auto') return activeTab
  const hasText = args.hasText === true
  const hasImage = args.hasImage === true
  const hasVideo = args.hasVideo === true
  const hasPoi = args.hasPoi === true
  const renderKind = String(args.renderKind || '').trim().toLowerCase()
  const hasRenderableUrl = args.hasRenderableUrl === true
  const hasInlineSrcDoc = args.hasInlineSrcDoc === true
  if (renderKind === 'video') return 'video'
  if (renderKind === 'image' || renderKind === 'svg') return 'image'
  if (renderKind === 'iframe' && !hasRenderableUrl && hasPoi && hasInlineSrcDoc) return 'poi'
  if (renderKind === 'iframe' && !hasRenderableUrl) return 'text'
  if (hasVideo) return 'video'
  if (hasImage) return 'image'
  if (hasPoi) return 'poi'
  if (hasText) return 'text'
  return null
}

export function shouldShowRichMediaFloatingToolbar(args: {
  hasPanelState: unknown
  hasMultiKinds?: unknown
  selectedTab?: unknown
  safeOpenUrl?: unknown
}): boolean {
  const hasPanelState = args.hasPanelState === true
  const selectedTab = String(args.selectedTab || '').trim().toLowerCase()
  const hasOpenUrl = !!String(args.safeOpenUrl || '').trim()
  return hasPanelState || args.hasMultiKinds === true || selectedTab === 'text' || hasOpenUrl
}

export function buildRichMediaPanelPreviewSpec(args: {
  node: GraphNode
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
  panel?: RichMediaPanelOverlayState | null
}): RichMediaPanelPreviewSpec | null {
  const panel = args.panel
  if (!panel) return null
  const renderNode = resolveRichMediaPanelRenderNode({
    node: args.node,
    connectedValuesBySchemaPath: args.connectedValuesBySchemaPath,
  })
  const props = (renderNode.properties || {}) as Record<string, unknown>
  const rawImageUrl = typeof props.imageUrl === 'string' ? props.imageUrl.trim() : ''
  const rawVideoUrl = typeof props.videoUrl === 'string' ? props.videoUrl.trim() : ''
  const rawMediaUrl = typeof props.media_url === 'string' ? props.media_url.trim() : ''
  const rawOpenUrl = rawImageUrl || rawVideoUrl || rawMediaUrl
  const rawOutputSrcDoc = typeof props.outputSrcDoc === 'string' ? props.outputSrcDoc : ''
  const outputSrcDoc = normalizeRichMediaPanelInlineSrcDoc({
    srcDoc: rawOutputSrcDoc,
    title: String(args.node.label || args.node.id || '').trim() || FLOW_RICH_MEDIA_PANEL_NODE_LABEL,
  })
  const renderSpec = getNodeMediaSpec(renderNode)
  const selectedTab = resolveRichMediaPanelSelectedTab({
    activeTab: panel.activeTab,
    hasText: panel.hasText,
    hasImage: panel.hasImage,
    hasVideo: panel.hasVideo,
    hasPoi: panel.hasPoi,
    renderKind: renderSpec?.kind,
    hasRenderableUrl: !!String(renderSpec?.url || '').trim(),
    hasInlineSrcDoc: !!String(renderSpec?.srcDoc || rawOutputSrcDoc || '').trim(),
  }) || 'text'
  if (selectedTab === 'video') {
    return {
      kind: 'video',
      url: rawVideoUrl || String(renderSpec?.url || ''),
      openUrl: rawVideoUrl || rawOpenUrl || String(renderSpec?.url || ''),
      interactive: renderSpec?.interactive !== false,
    }
  }
  if (selectedTab === 'image') {
    return {
      kind: 'image',
      url: rawImageUrl || String(renderSpec?.url || ''),
      openUrl: rawImageUrl || rawOpenUrl || String(renderSpec?.url || ''),
      interactive: renderSpec?.interactive === true,
    }
  }
  return {
    kind: 'iframe',
    url: rawOpenUrl || String(renderSpec?.url || ''),
    openUrl: rawOpenUrl || String(renderSpec?.url || ''),
    srcDoc: String(renderSpec?.srcDoc || outputSrcDoc || '') || undefined,
    interactive: renderSpec?.interactive !== false,
  }
}

export function resolveRichMediaAspectSelection(args: {
  width: unknown
  height: unknown
}): RichMediaPanelAspectSelection | null {
  const width = typeof args.width === 'number' && Number.isFinite(args.width) ? args.width : Number(args.width)
  const height = typeof args.height === 'number' && Number.isFinite(args.height) ? args.height : Number(args.height)
  if (!(Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0)) return null
  const ratio = width / height
  const horizontal = 16 / 9
  const vertical = 9 / 16
  return Math.abs(ratio - horizontal) <= Math.abs(ratio - vertical) ? '16:9' : '9:16'
}

export function resolveToggledRichMediaAspectSize(args: {
  width: unknown
  height: unknown
  selected?: RichMediaPanelAspectSelection | null
  minWidthPx?: number
  minHeightPx?: number
  defaultWidthPx?: number
  defaultHeightPx?: number
}): {
  selected: RichMediaPanelAspectSelection
  width: number
  height: number
} {
  const minWidthPx =
    typeof args.minWidthPx === 'number' && Number.isFinite(args.minWidthPx) ? Math.max(1, Math.floor(args.minWidthPx)) : 220
  const minHeightPx =
    typeof args.minHeightPx === 'number' && Number.isFinite(args.minHeightPx) ? Math.max(1, Math.floor(args.minHeightPx)) : 160
  const defaultWidthPx =
    typeof args.defaultWidthPx === 'number' && Number.isFinite(args.defaultWidthPx)
      ? Math.max(minWidthPx, Math.floor(args.defaultWidthPx))
      : 280
  const defaultHeightPx =
    typeof args.defaultHeightPx === 'number' && Number.isFinite(args.defaultHeightPx)
      ? Math.max(minHeightPx, Math.floor(args.defaultHeightPx))
      : 180
  const width0 = typeof args.width === 'number' && Number.isFinite(args.width) ? args.width : Number(args.width)
  const height0 = typeof args.height === 'number' && Number.isFinite(args.height) ? args.height : Number(args.height)
  const widthBase = Number.isFinite(width0) && width0 > 0 ? width0 : defaultWidthPx
  const heightBase = Number.isFinite(height0) && height0 > 0 ? height0 : defaultHeightPx
  const area = Math.max(minWidthPx * minHeightPx, widthBase * heightBase)
  const selected = args.selected === '9:16' ? '9:16' : args.selected === '16:9' ? '16:9' : resolveRichMediaAspectSelection(args)
  const next = selected === '9:16' ? '16:9' : '9:16'
  const target = next === '16:9' ? (16 / 9) : (9 / 16)
  let nextHeight = Math.sqrt(area / target)
  let nextWidth = target * nextHeight
  if (nextWidth < minWidthPx) {
    nextWidth = minWidthPx
    nextHeight = nextWidth / target
  }
  if (nextHeight < minHeightPx) {
    nextHeight = minHeightPx
    nextWidth = nextHeight * target
  }
  return {
    selected: next,
    width: Math.round(nextWidth),
    height: Math.round(nextHeight),
  }
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

  const aspect = Math.max(0.05, Math.min(20, w0 / Math.max(1, h0)))
  const minScale = Math.max(minWidthPx / w0, minHeightPx / h0)
  const maxScale = Math.min(maxW / w0, maxH / h0)
  const scale = minScale > maxScale
    ? minScale
    : Math.max(minScale, Math.min(1, maxScale))

  let width = Math.max(1, Math.round(w0 * scale))
  let height = Math.max(1, Math.round(h0 * scale))
  if (width < minWidthPx) {
    width = minWidthPx
    height = Math.max(1, Math.round(width / aspect))
  }
  if (height < minHeightPx) {
    height = minHeightPx
    width = Math.max(1, Math.round(height * aspect))
  }
  if (width > maxW) {
    width = Math.max(1, Math.floor(maxW))
    height = Math.max(1, Math.round(width / aspect))
  }
  if (height > maxH) {
    height = Math.max(1, Math.floor(maxH))
    width = Math.max(1, Math.round(height * aspect))
  }
  if (width < minWidthPx) {
    width = minWidthPx
    height = Math.max(1, Math.round(width / aspect))
  }
  if (height < minHeightPx) {
    height = minHeightPx
    width = Math.max(1, Math.round(height * aspect))
  }
  return { width, height }
}

export function computeRichMediaPanelAspectResizeSizePx(args: {
  startWidth: unknown
  startHeight: unknown
  dx: unknown
  dy: unknown
}): { width: number; height: number } {
  const rawW = typeof args.startWidth === 'number' && Number.isFinite(args.startWidth) ? args.startWidth : Number(args.startWidth)
  const rawH = typeof args.startHeight === 'number' && Number.isFinite(args.startHeight) ? args.startHeight : Number(args.startHeight)
  const startWidth = Number.isFinite(rawW) && rawW > 0 ? rawW : 1
  const startHeight = Number.isFinite(rawH) && rawH > 0 ? rawH : 1
  const dx = typeof args.dx === 'number' && Number.isFinite(args.dx) ? args.dx : Number(args.dx)
  const dy = typeof args.dy === 'number' && Number.isFinite(args.dy) ? args.dy : Number(args.dy)
  const deltaX = Number.isFinite(dx) ? dx : 0
  const deltaY = Number.isFinite(dy) ? dy : 0
  const aspect = Math.max(0.05, Math.min(20, startWidth / Math.max(1, startHeight)))
  if (Math.abs(deltaY) > Math.abs(deltaX)) {
    const height = Math.max(1, Math.round(startHeight + deltaY))
    return {
      width: Math.max(1, Math.round(height * aspect)),
      height,
    }
  }
  const width = Math.max(1, Math.round(startWidth + deltaX))
  return {
    width,
    height: Math.max(1, Math.round(width / aspect)),
  }
}

export function coerceRichMediaPanelChromeSizePx(args: {
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
  const maxW = vw != null ? Math.max(minWidthPx, Math.floor(vw * maxViewportWidthRatio)) : Infinity
  const maxH = vh != null ? Math.max(minHeightPx, Math.floor(vh * maxViewportHeightRatio)) : Infinity
  return {
    width: Math.max(minWidthPx, Math.min(maxW, Math.round(w0))),
    height: Math.max(minHeightPx, Math.min(maxH, Math.round(h0))),
  }
}

export function resolveRichMediaPanelInteractive(args: {
  nodeInteractive: unknown
  renderMediaAsNodes: unknown
  infiniteCanvasInteractionMode: unknown
  canvas2dRenderer?: unknown
  frontmatterModeEnabled?: unknown
  documentSemanticMode?: unknown
}): boolean {
  if (String(args.infiniteCanvasInteractionMode || '').trim().toLowerCase() === 'interactive') return true
  if (!isRichMediaPanelDisplayEnabled(args)) return false
  return args.nodeInteractive === true
}

export function listDisplayRichMediaOverlayNodes(args: {
  renderMediaAsNodes: unknown
  canvas2dRenderer?: unknown
  frontmatterModeEnabled?: unknown
  documentSemanticMode?: unknown
  nodes: GraphNode[]
  poolMax: unknown
  preferredNodeIds?: readonly string[]
  excludeNodeIdSet?: Set<string>
  connectedValuesByNodeId?: ReadonlyMap<string, FlowConnectedValuesBySchemaPath>
  nodeById?: ReadonlyMap<string, GraphNode>
}): MediaOverlayNode[] {
  const poolMaxRaw = typeof args.poolMax === 'number' && Number.isFinite(args.poolMax) ? args.poolMax : 0
  const poolMax = poolMaxRaw > 0 ? Math.floor(poolMaxRaw) : 24
  return listMediaOverlayNodes({
    enabled: isRichMediaPanelDisplayEnabled(args),
    nodes: Array.isArray(args.nodes) ? args.nodes : [],
    poolMax,
    preferredNodeIds: args.preferredNodeIds,
    excludeNodeIdSet: args.excludeNodeIdSet,
    connectedValuesByNodeId: args.connectedValuesByNodeId,
    nodeById: args.nodeById,
  })
}

export function computeRichMediaOverlayConnectedValuesByNodeId(args: {
  graphData: GraphData | null | undefined
  registry: ReadonlyArray<WidgetRegistryEntry> | null | undefined
  graphRevision?: number
  graphSemanticKey?: string
  extraNodeIds?: ReadonlyArray<string> | ReadonlySet<string> | null | undefined
  includeMediaSpecNodes?: boolean
}): ReadonlyMap<string, FlowConnectedValuesBySchemaPath> {
  const graphData = args.graphData
  const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : []
  if (!graphData || nodes.length === 0) return new Map()
  const targetNodeIds = buildRichMediaConnectedValueTargetNodeIdSet({
    nodes,
    extraNodeIds: args.extraNodeIds,
    includeMediaSpecNodes: args.includeMediaSpecNodes === true,
  })
  if (targetNodeIds.size === 0) return new Map()
  return computeFlowConnectedValuesBySchemaPath({
    graphData,
    registry: Array.isArray(args.registry) ? args.registry : [],
    targetNodeIds,
    graphRevision: args.graphRevision,
    graphSemanticKey: args.graphSemanticKey,
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

export function isRichMediaConnectedValueTargetNode(args: {
  node: GraphNode | null | undefined
  includeMediaSpecNodes?: boolean
}): boolean {
  const node = args.node
  if (!node) return false
  if (isRichMediaPanelNode(node)) return true
  return args.includeMediaSpecNodes === true && !!getNodeMediaSpec(node)
}

export function buildRichMediaConnectedValueTargetNodeIdSet(args: {
  nodes: ReadonlyArray<GraphNode> | null | undefined
  extraNodeIds?: ReadonlyArray<string> | ReadonlySet<string> | null | undefined
  includeMediaSpecNodes?: boolean
}): Set<string> {
  const out = new Set<string>()
  const extraNodeIds = args.extraNodeIds
  if (Array.isArray(extraNodeIds)) {
    for (let i = 0; i < extraNodeIds.length; i += 1) {
      const id = String(extraNodeIds[i] || '').trim()
      if (id) out.add(id)
    }
  } else if (extraNodeIds instanceof Set) {
    for (const rawId of extraNodeIds) {
      const id = String(rawId || '').trim()
      if (id) out.add(id)
    }
  }

  const nodes = Array.isArray(args.nodes) ? args.nodes : []
  const includeMediaSpecNodes = args.includeMediaSpecNodes === true
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const id = String(node?.id || '').trim()
    if (!id) continue
    if (isRichMediaConnectedValueTargetNode({ node, includeMediaSpecNodes })) out.add(id)
  }
  return out
}

export function buildRichMediaPanelOverlayExcludeNodeIdSet(args: {
  graphData: GraphData | null | undefined
  nodeById?: ReadonlyMap<string, GraphNode> | null | undefined
  candidateRawIds?: ReadonlyArray<string> | null | undefined
  excludeAllRichMediaPanelNodes?: boolean
}): Set<string> {
  const out = new Set<string>()
  const nodes = Array.isArray(args.graphData?.nodes) ? args.graphData.nodes : []
  if (args.excludeAllRichMediaPanelNodes === true) {
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]
      const id = String(node?.id || '').trim()
      if (!id || !isRichMediaPanelNode(node)) continue
      out.add(id)
    }
  }

  const candidateRawIds = Array.isArray(args.candidateRawIds) ? args.candidateRawIds : []
  const nodeById = args.nodeById || null
  for (let i = 0; i < candidateRawIds.length; i += 1) {
    const rawId = candidateRawIds[i]
    const id = String(resolveGraphNodeByCanonicalId(args.graphData, rawId)?.id || rawId || '').trim()
    if (!id || !isRichMediaPanelNode(nodeById?.get(id))) continue
    out.add(id)
  }
  return out
}
