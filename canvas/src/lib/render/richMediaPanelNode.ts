import type { GraphData, GraphNode } from '@/lib/graph/types'
import { FLOW_RICH_MEDIA_PANEL_FORM_ID, FLOW_RICH_MEDIA_PANEL_NODE_LABEL, FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID, FLOW_RICH_MEDIA_PANEL_WIDGET_TYPE_ID } from '@/lib/storyboardWidget/richMediaPanelConfig'
import { FLOW_WIDGET_FORM_ID_KEY, FLOW_WIDGET_TYPE_ID_KEY } from '@/features/storyboard-widget-manager/resolveWidgetRegistry'
import { buildNodeMediaProperties } from '@/lib/canvas/graph-elements/mediaProperties'
import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'
import type { MediaDragPayload } from '@/lib/ui/mediaDragPayload'

export function isRichMediaPanelNode(node: GraphNode | null | undefined): boolean {
  return String(node?.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
}

export function buildRichMediaPanelNode(args: {
  id: string
  anchor?: GraphNode | null
  xOffset?: number
  yOffset?: number
  label?: string | null
}): GraphNode {
  const id = String(args.id || '').trim()
  const anchorX = Number.isFinite(args.anchor?.x) ? (args.anchor!.x as number) : 0
  const anchorY = Number.isFinite(args.anchor?.y) ? (args.anchor!.y as number) : 0
  const xOffset = Number.isFinite(args.xOffset) ? (args.xOffset as number) : 520
  const yOffset = Number.isFinite(args.yOffset) ? (args.yOffset as number) : 0
  return {
    id,
    type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
    label: String(args.label ?? FLOW_RICH_MEDIA_PANEL_NODE_LABEL).trim() || FLOW_RICH_MEDIA_PANEL_NODE_LABEL,
    x: anchorX + xOffset,
    y: anchorY + yOffset,
    properties: { media_interactive: true },
  }
}

export function buildRichMediaPanelDroppedMediaProperties(payload: MediaDragPayload): Record<string, unknown> {
  const mediaUrl = String(payload.url || '').trim()
  const activeTab = payload.kind === 'audio' ? 'audio' : payload.kind === 'video' ? 'video' : 'image'
  const properties = buildNodeMediaProperties({
    kind: payload.kind,
    url: mediaUrl,
    interactive: payload.kind !== 'image',
    includeCamelGeneric: true,
    extra: {
      [FLOW_WIDGET_TYPE_ID_KEY]: FLOW_RICH_MEDIA_PANEL_WIDGET_TYPE_ID,
      [FLOW_WIDGET_FORM_ID_KEY]: FLOW_RICH_MEDIA_PANEL_FORM_ID,
      richMediaActiveTab: activeTab,
      output: '',
      outputSrcDoc: '',
      ...(payload.thumbnailUrl ? { thumbnailUrl: payload.thumbnailUrl } : {}),
      ...(payload.sourceKey ? { mediaSourceKey: payload.sourceKey } : {}),
    },
  })
  if (payload.kind === 'image') properties.imageUrl = mediaUrl
  if (payload.kind === 'video') properties.videoUrl = mediaUrl
  if (payload.kind === 'audio') properties.audioUrl = mediaUrl
  return properties
}

export function resolvePreferredRichMediaPanelNodeId(args: {
  graphData: GraphData | null | undefined
  selectedNodeId?: string | null
  selectedNodeIds?: readonly string[]
  openWidgetNodeIds?: readonly string[]
  storyboardWidgetOpenWidgetNodeIds?: readonly string[]
  nodeById?: ReadonlyMap<string, GraphNode> | null | undefined
}): string {
  const graphData = args.graphData
  const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : []
  if (nodes.length === 0) return ''
  const nodeById = args.nodeById || new Map(nodes.map(node => [String(node?.id || '').trim(), node] as const))

  const pickFromIds = (ids: readonly string[] | null | undefined): string => {
    if (!Array.isArray(ids) || ids.length === 0) return ''
    for (let i = 0; i < ids.length; i += 1) {
      const id = String(resolveGraphNodeByCanonicalId(graphData, ids[i])?.id || ids[i] || '').trim()
      if (!id) continue
      if (isRichMediaPanelNode(nodeById.get(id))) return id
    }
    return ''
  }

  const selectedPrimary = String(resolveGraphNodeByCanonicalId(graphData, args.selectedNodeId)?.id || args.selectedNodeId || '').trim()
  if (selectedPrimary && isRichMediaPanelNode(nodeById.get(selectedPrimary))) return selectedPrimary

  const selectedMulti = pickFromIds(args.selectedNodeIds)
  if (selectedMulti) return selectedMulti

  const storyboardWidgetOpenWidget = pickFromIds(args.storyboardWidgetOpenWidgetNodeIds)
  if (storyboardWidgetOpenWidget) return storyboardWidgetOpenWidget

  const openWidget = pickFromIds(args.openWidgetNodeIds)
  if (openWidget) return openWidget

  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    if (!isRichMediaPanelNode(node)) continue
    const id = String(node?.id || '').trim()
    if (id) return id
  }
  return ''
}

export function getRichMediaPanelNodeLabel(): string {
  return FLOW_RICH_MEDIA_PANEL_NODE_LABEL
}
