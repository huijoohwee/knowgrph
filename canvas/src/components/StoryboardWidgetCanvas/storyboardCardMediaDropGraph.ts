import { finalizeEdgeAuthoring } from '@/features/edge-creation/authoring'
import { STORYBOARD_CANVAS_RICH_MEDIA_PANEL_PROPERTY } from '@/components/StoryboardCanvas/storyboardModel'
import { FLOW_EDGE_SOURCE_PORT_KEY, FLOW_EDGE_TARGET_PORT_KEY, readFlowEdgePortKey } from '@/lib/graph/flowPorts'
import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { createUniqueId } from '@/lib/ids'
import { buildInlineMediaUrlIdentityKey } from '@/lib/command-menu/inlineMediaUrlIdentity'
import { hashString32 } from '@/lib/hash/stringHash'
import { RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE } from '@/lib/render/richMediaPanelDefaults'
import { buildRichMediaPanelDroppedMediaProperties, buildRichMediaPanelNode, isRichMediaPanelNode } from '@/lib/render/richMediaPanelNode'
import type { MediaDragPayload } from '@/lib/ui/mediaDragPayload'
import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'

export const CARD_MEDIA_DROP_EDGE_TARGET_PORT = 'mediaUrl'
const CARD_MEDIA_DROP_EDGE_LABEL = 'linksTo'
const CARD_MEDIA_DROP_SOURCE_KEY = 'storyboard-card-media-drop'
const CARD_MEDIA_DROP_EDGE_KEY = 'storyboardCardMediaDropEdge'
const CARD_MEDIA_DROP_TARGET_KEY = 'storyboardCardMediaTargetId'
const CARD_MEDIA_DROP_SEMANTIC_KEY = 'storyboardCardMediaSemanticKey'
const CARD_MEDIA_DROP_SOURCE_KIND_KEY = 'storyboardCardMediaSourceKind'
const CARD_MEDIA_DROP_PANEL_X_OFFSET = Math.round(RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE.width / 3)
const CARD_MEDIA_DROP_PANEL_HORIZONTAL_GAP = Math.round(RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE.width / 10)
const CARD_MEDIA_DROP_PANEL_VERTICAL_GAP = Math.round(RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE.height / 6)

export type StoryboardCardMediaDropGraphResult = {
  createdEdge: boolean
  createdPanel: boolean
  edgeId: string
  graphData: GraphData
  panelId: string
}

const clean = (value: unknown): string => String(value || '').trim()

const readSourcePortForMedia = (kind: MediaDragPayload['kind']): string => {
  if (kind === 'video') return 'videoUrl'
  if (kind === 'audio') return 'audioUrl'
  return 'imageUrl'
}

const readSourcePortForPanelProperties = (props: Record<string, unknown>): string => {
  const kind = clean(props[CARD_MEDIA_DROP_SOURCE_KIND_KEY])
  if (kind === 'video' || kind === 'audio' || kind === 'image') return readSourcePortForMedia(kind)
  if (clean(props.videoUrl)) return 'videoUrl'
  if (clean(props.audioUrl)) return 'audioUrl'
  return 'imageUrl'
}

const readFiniteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const readCardMediaDropPanelPlacement = (anchor: GraphNode, slotIndex: number): {
  x: number
  xOffset: number
  y: number
  yOffset: number
} => {
  const anchorX = readFiniteNumber(anchor.x) ?? 0
  const anchorY = readFiniteNumber(anchor.y) ?? 0
  const safeSlotIndex = Number.isFinite(slotIndex) ? Math.max(0, Math.floor(slotIndex)) : 0
  const xOffset = CARD_MEDIA_DROP_PANEL_X_OFFSET
    + safeSlotIndex * (RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE.width + CARD_MEDIA_DROP_PANEL_HORIZONTAL_GAP)
  const belowOffset = RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE.height + CARD_MEDIA_DROP_PANEL_VERTICAL_GAP
  const aboveOffset = -belowOffset
  const yOffset = anchorY + aboveOffset >= 0 ? aboveOffset : belowOffset
  return {
    x: anchorX + xOffset,
    y: anchorY + yOffset,
    xOffset,
    yOffset,
  }
}

type CardMediaDropPanelNodeLike = { properties?: unknown; type?: unknown } | null | undefined

const readNodeProperties = (node: { properties?: unknown } | null | undefined): Record<string, unknown> =>
  node?.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)
    ? node.properties as Record<string, unknown>
    : {}

const isDropOwnedPanelNode = (node: CardMediaDropPanelNodeLike): boolean => {
  if (!isRichMediaPanelNode(node)) return false
  const props = readNodeProperties(node)
  return clean(props.mediaSource) === CARD_MEDIA_DROP_SOURCE_KEY
}

const buildMediaSemanticKey = (media: MediaDragPayload): string =>
  buildInlineMediaUrlIdentityKey(media.url) || clean(media.sourceKey)

const readPanelMediaSemanticKey = (node: CardMediaDropPanelNodeLike): string => {
  if (!isRichMediaPanelNode(node)) return ''
  const props = readNodeProperties(node)
  return clean(props[CARD_MEDIA_DROP_SEMANTIC_KEY])
    || buildInlineMediaUrlIdentityKey(props.videoUrl || props.audioUrl || props.imageUrl || props.mediaUrl || props.src)
}

export const readStoryboardCardMediaDropPanelSourcePortKey = (
  node: CardMediaDropPanelNodeLike,
): string => {
  if (!isRichMediaPanelNode(node)) return ''
  const props = readNodeProperties(node)
  if (clean(props.mediaSource) !== CARD_MEDIA_DROP_SOURCE_KEY) return ''
  return readSourcePortForPanelProperties(props)
}

export const buildStoryboardCardMediaDropOverlayEdgeId = (panelId: string, cardId: string): string => {
  const source = clean(panelId).replace(/[^a-zA-Z0-9_.:-]+/g, '-').replace(/^-+|-+$/g, '') || 'rich-media-panel'
  const target = clean(cardId).replace(/[^a-zA-Z0-9_.:-]+/g, '-').replace(/^-+|-+$/g, '') || 'storyboard-card'
  return `storyboard-card-media-drop:${source}->${target}`
}

export const isStoryboardCardMediaDropEdge = (
  edge: Pick<GraphEdge, 'target' | 'properties'> | null | undefined,
  cardId: string,
): boolean => {
  const normalizedCardId = clean(cardId)
  if (!normalizedCardId || clean(edge?.target) !== normalizedCardId) return false
  const props = edge?.properties && typeof edge.properties === 'object' && !Array.isArray(edge.properties)
    ? edge.properties as Record<string, unknown>
    : {}
  return readFlowEdgePortKey(edge, 'target') === CARD_MEDIA_DROP_EDGE_TARGET_PORT
    && (props[CARD_MEDIA_DROP_EDGE_KEY] === true || clean(props[CARD_MEDIA_DROP_TARGET_KEY]) === normalizedCardId)
}

export const isStoryboardCardMediaDropOverlayEdge = (
  edge: Pick<GraphEdge, 'target' | 'properties'> | null | undefined,
  sourceNode: CardMediaDropPanelNodeLike,
  cardId: string,
): boolean => {
  const normalizedCardId = clean(cardId)
  if (!normalizedCardId || clean(edge?.target) !== normalizedCardId) return false
  return isStoryboardCardMediaDropEdge(edge, normalizedCardId) && isDropOwnedPanelNode(sourceNode)
}

const isCardMediaTargetEdge = (edge: GraphEdge, cardId: string): boolean =>
  clean(edge.target) === cardId && readFlowEdgePortKey(edge, 'target') === CARD_MEDIA_DROP_EDGE_TARGET_PORT

const findReusableMediaPanelNode = (nodes: readonly GraphNode[], mediaSemanticKey: string): GraphNode | null =>
  nodes.find(node => readPanelMediaSemanticKey(node) === mediaSemanticKey) || null

const countCardMediaPanelSources = (edges: readonly GraphEdge[], cardId: string): number =>
  new Set(edges
    .filter(edge => isStoryboardCardMediaDropEdge(edge, cardId))
    .map(edge => clean(edge.source))
    .filter(Boolean)).size

const buildPanelId = (mediaSemanticKey: string, usedIds: ReadonlySet<string>): string => {
  const base = `media-panel-${hashString32(mediaSemanticKey).toString(16).padStart(8, '0')}`
  if (!usedIds.has(base)) return base
  return createUniqueId(`${base}-`, new Set(usedIds))
}

const buildEdgeProperties = (args: {
  cardId: string
  existing?: GraphEdge | null
  media: MediaDragPayload
  sourcePort: string
}): Record<string, JSONValue> => {
  const existing = args.existing?.properties && typeof args.existing.properties === 'object' && !Array.isArray(args.existing.properties)
    ? args.existing.properties as Record<string, JSONValue>
    : {}
  return {
    ...existing,
    [FLOW_EDGE_SOURCE_PORT_KEY]: args.sourcePort,
    [FLOW_EDGE_TARGET_PORT_KEY]: CARD_MEDIA_DROP_EDGE_TARGET_PORT,
    [CARD_MEDIA_DROP_EDGE_KEY]: true,
    [CARD_MEDIA_DROP_TARGET_KEY]: args.cardId,
    [CARD_MEDIA_DROP_SOURCE_KIND_KEY]: args.media.kind,
    ...(args.media.sourceKey ? { mediaSourceKey: args.media.sourceKey } : {}),
  }
}

export function applyStoryboardCardMediaDropGraph(args: {
  cardId: string
  cardProperties: Record<string, unknown>
  graphData: GraphData
  media: MediaDragPayload
}): StoryboardCardMediaDropGraphResult | null {
  const requestedCardId = clean(args.cardId)
  const mediaUrl = clean(args.media.url)
  const mediaSemanticKey = buildMediaSemanticKey(args.media)
  if (!requestedCardId || !mediaUrl || !mediaSemanticKey) return null
  const nodes = Array.isArray(args.graphData.nodes) ? args.graphData.nodes : []
  const edges = Array.isArray(args.graphData.edges) ? args.graphData.edges : []
  const cardNode = resolveGraphNodeByCanonicalId(args.graphData, requestedCardId)
  if (!cardNode) return null
  const cardId = clean(cardNode.id)
  if (!cardId) return null

  const reusablePanel = findReusableMediaPanelNode(nodes, mediaSemanticKey)
  const usedIds = new Set(nodes.map(node => clean(node?.id)).filter(Boolean))
  const panelId = clean(reusablePanel?.id) || buildPanelId(mediaSemanticKey, usedIds)
  const reusableEdge = edges.find(edge => isStoryboardCardMediaDropEdge(edge, cardId) && clean(edge.source) === panelId) || null
  const sourcePort = readSourcePortForMedia(args.media.kind)
  const panelLabel = clean(args.media.label) || clean(cardNode.label) || 'Card media'
  const panelPlacement = readCardMediaDropPanelPlacement(cardNode, reusablePanel ? 0 : countCardMediaPanelSources(edges, cardId))
  const panelNode = reusablePanel || buildRichMediaPanelNode({
    id: panelId,
    anchor: cardNode,
    label: panelLabel,
    xOffset: panelPlacement.xOffset,
    yOffset: panelPlacement.yOffset,
  })
  const panelProperties = {
    ...readNodeProperties(reusablePanel),
    ...buildRichMediaPanelDroppedMediaProperties({ ...args.media, url: mediaUrl, label: panelLabel }),
    [CARD_MEDIA_DROP_SEMANTIC_KEY]: mediaSemanticKey,
    [CARD_MEDIA_DROP_SOURCE_KIND_KEY]: args.media.kind,
    [STORYBOARD_CANVAS_RICH_MEDIA_PANEL_PROPERTY]: true,
    ...(!reusablePanel || isDropOwnedPanelNode(reusablePanel) ? { mediaSource: CARD_MEDIA_DROP_SOURCE_KEY } : {}),
  }
  const shouldApplyPanelPlacement = !reusablePanel
    || (isDropOwnedPanelNode(reusablePanel) && readFiniteNumber(reusablePanel.fx) == null && readFiniteNumber(reusablePanel.fy) == null)
  const nextPanelNode = {
    ...panelNode,
    label: panelLabel,
    ...(shouldApplyPanelPlacement ? { x: panelPlacement.x, y: panelPlacement.y, fx: panelPlacement.x, fy: panelPlacement.y, vx: 0, vy: 0 } : {}),
    properties: panelProperties as never,
  }
  const nextCardNode = {
    ...cardNode,
    properties: args.cardProperties as never,
  }
  const supersededSingleSourceEdgeIds = new Set(edges
    .filter(edge => isCardMediaTargetEdge(edge, cardId) && !isStoryboardCardMediaDropEdge(edge, cardId))
    .map(edge => clean(edge.id))
    .filter(Boolean))
  const nextNodes = nodes.map(node => {
    const id = clean(node?.id)
    if (id === cardId) return nextCardNode
    if (id === panelId) return nextPanelNode
    return node
  })
  if (!reusablePanel) nextNodes.push(nextPanelNode)

  let createdEdge = false
  let edgeId = clean(reusableEdge?.id)
  let nextEdges = edges.filter(edge => !supersededSingleSourceEdgeIds.has(clean(edge.id)))
  if (reusableEdge && edgeId) {
    nextEdges = nextEdges.map(edge => clean(edge.id) === edgeId
      ? { ...edge, source: panelId, target: cardId, label: CARD_MEDIA_DROP_EDGE_LABEL, properties: buildEdgeProperties({ cardId, existing: edge, media: args.media, sourcePort }) as never }
      : edge)
  } else {
    const authored = finalizeEdgeAuthoring({
      mode: 'create',
      data: { ...args.graphData, nodes: nextNodes, edges: nextEdges },
      schema: null,
      label: CARD_MEDIA_DROP_EDGE_LABEL,
      selectedEdgeId: null,
      from: { nodeId: panelId, portKey: sourcePort },
      to: { nodeId: cardId, portKey: CARD_MEDIA_DROP_EDGE_TARGET_PORT },
    })
    if (authored.kind === 'create') {
      edgeId = clean(authored.edge.id)
      createdEdge = true
      nextEdges = [...nextEdges, { ...authored.edge, properties: buildEdgeProperties({ cardId, existing: authored.edge, media: args.media, sourcePort }) as never }]
    } else if (authored.kind === 'select-existing') {
      edgeId = clean(authored.edgeId)
      nextEdges = nextEdges.map(edge => clean(edge.id) === edgeId
        ? { ...edge, properties: buildEdgeProperties({ cardId, existing: edge, media: args.media, sourcePort }) as never }
        : edge)
    }
  }

  return {
    createdEdge,
    createdPanel: !reusablePanel,
    edgeId,
    graphData: { ...args.graphData, nodes: nextNodes, edges: nextEdges },
    panelId,
  }
}
