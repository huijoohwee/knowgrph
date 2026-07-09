import { buildStoryboardBoardModel } from '@/components/StoryboardCanvas/storyboardModel'
import {
  applyStoryboardCardMediaDropGraph,
  isStoryboardCardMediaDropEdge,
  isStoryboardCardMediaDropOverlayEdge,
  isStoryboardCardMediaDropPanelNodeForCard,
} from '@/components/StoryboardWidgetCanvas/storyboardCardMediaDropGraph'
import {
  buildStoryboardOverlayEdgePathD,
  buildStoryboardOutputCardLeftSidePath,
  readStoryboardOutputCardLeftSideAnchors,
} from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetOverlayEdgeAnchors'
import { buildRichMediaPanelRegistryDraft } from '@/features/storyboard-widget-manager/richMediaPanelRegistryDraft'
import { buildStoryboardElementRegistryDraft } from '@/features/storyboard-widget-manager/storyboardElementRegistryDraft'
import { FLOW_WIDGET_FORM_ID_KEY, FLOW_WIDGET_TYPE_ID_KEY } from '@/features/storyboard-widget-manager/resolveWidgetRegistry'
import { FLOW_EDGE_SOURCE_PORT_KEY, FLOW_EDGE_TARGET_PORT_KEY } from '@/lib/graph/flowPorts'
import { buildGraphFlowOrderIndexByNodeId, resolveGraphEdgeFlowOrderDirection } from '@/lib/graph/flowOrder'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import {
  FLOW_RICH_MEDIA_PANEL_FORM_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_LABEL,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_WIDGET_TYPE_ID,
  FLOW_STORYBOARD_ELEMENT_FORM_ID,
  FLOW_STORYBOARD_ELEMENT_NODE_TYPE_ID,
  FLOW_STORYBOARD_ELEMENT_WIDGET_TYPE_ID,
} from '@/lib/config.storyboard-widget'
import type { MediaDragPayload } from '@/lib/ui/mediaDragPayload'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const readNode = (graphData: GraphData, id: string): GraphNode | null =>
  (graphData.nodes || []).find(node => String(node.id || '') === id) || null

const buildCardNode = (): GraphNode => ({
  id: 'story-card',
  type: FLOW_STORYBOARD_ELEMENT_NODE_TYPE_ID,
  label: 'Story card',
  x: 120,
  y: 260,
  properties: {
    [FLOW_WIDGET_TYPE_ID_KEY]: FLOW_STORYBOARD_ELEMENT_WIDGET_TYPE_ID,
    [FLOW_WIDGET_FORM_ID_KEY]: FLOW_STORYBOARD_ELEMENT_FORM_ID,
    lane: 'Storyboard',
  },
})

const registry = [
  { ...buildRichMediaPanelRegistryDraft(), id: 'rich-media', updatedAt: '2026-07-08T00:00:00.000Z' },
  { ...buildStoryboardElementRegistryDraft(), id: 'storyboard', updatedAt: '2026-07-08T00:00:00.000Z' },
]

const videoPayload: MediaDragPayload = {
  kind: 'video',
  url: 'https://example.com/story-reference.mp4',
  label: 'Story reference video',
  sourceKey: 'floating-media:story-reference',
  thumbnailUrl: 'https://example.com/story-reference.jpg',
}

export function testStoryboardCardMediaDropCreatesInboundRichMediaPanelEdge() {
  const card = buildCardNode()
  const graphData: GraphData = { type: 'Graph', nodes: [card], edges: [] }
  const result = applyStoryboardCardMediaDropGraph({
    cardId: 'story-card',
    cardProperties: {
      ...card.properties,
      mediaKind: videoPayload.kind,
      mediaUrl: videoPayload.url,
      thumbnailUrl: videoPayload.thumbnailUrl,
    },
    graphData,
    media: videoPayload,
  })
  assert(result?.createdPanel === true, 'expected card media drop to create a source Rich Media Panel node')
  assert(result.createdEdge === true, 'expected card media drop to create an inbound Rich Media Panel edge')
  const panel = readNode(result.graphData, result.panelId)
  assert(panel?.type === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID, `expected source panel node, got ${JSON.stringify(panel)}`)
  const panelProperties = panel.properties as Record<string, unknown>
  assert(panelProperties[FLOW_WIDGET_TYPE_ID_KEY] === FLOW_RICH_MEDIA_PANEL_WIDGET_TYPE_ID, 'expected source panel widget type metadata')
  assert(panelProperties[FLOW_WIDGET_FORM_ID_KEY] === FLOW_RICH_MEDIA_PANEL_FORM_ID, 'expected source panel form metadata')
  assert(panelProperties.storyboardCanvasRichMediaPanel === true, 'expected source panel to stay on the Storyboard Rich Media overlay path')
  assert(panelProperties.videoUrl === videoPayload.url && panelProperties.mediaSourceKey === videoPayload.sourceKey, 'expected source panel to own dropped video media')
  assert(panel.x === 240 && panel.fx === 240 && panel.y === 23 && panel.fy === 23, `expected source panel to be visibly placed near the card, got ${JSON.stringify({ x: panel.x, y: panel.y, fx: panel.fx, fy: panel.fy })}`)
  const edge = result.graphData.edges.find(candidate => String(candidate.id || '') === result.edgeId)
  assert(edge?.source === result.panelId && edge.target === 'story-card', `expected inbound panel -> card edge, got ${JSON.stringify(edge)}`)
  const edgeProperties = edge.properties as Record<string, unknown>
  assert(edgeProperties[FLOW_EDGE_SOURCE_PORT_KEY] === 'videoUrl', 'expected edge to source the Rich Media Panel video port')
  assert(edgeProperties[FLOW_EDGE_TARGET_PORT_KEY] === 'mediaUrl', 'expected edge to target the card media port')
  assert(edgeProperties.storyboardCardMediaDropEdge === true, 'expected edge to be marked as card media-drop owned')
  assert(isStoryboardCardMediaDropEdge(edge, 'story-card'), 'expected generated edge to be recognized by the shared card media-drop edge helper')
  assert(isStoryboardCardMediaDropPanelNodeForCard(panel, 'story-card'), 'expected generated Rich Media Panel source node to be recognized as card media-drop owned')
  assert(isStoryboardCardMediaDropOverlayEdge(edge, panel, 'story-card'), 'expected overlay edge helper to recognize generated panel -> card media edges')
  const overlayAnchors = readStoryboardOutputCardLeftSideAnchors({
    outputCardRect: { left: 387, top: 655, right: 608.4, bottom: 779.8, width: 221.4, height: 124.8 },
    sourceCardRect: { left: 98.1, top: 376.3, right: 319.5, bottom: 501.1, width: 221.4, height: 124.8 },
  })
  assert(overlayAnchors?.source.side === 'right', `expected generated media output edge to leave the source card side nearest the output, got ${JSON.stringify(overlayAnchors)}`)
  assert(overlayAnchors.target.side === 'left', `expected generated media output edge to enter the output card left side, got ${JSON.stringify(overlayAnchors)}`)
  const outputPath = buildStoryboardOutputCardLeftSidePath({ source: overlayAnchors.source, target: overlayAnchors.target })
  assert(outputPath.startsWith('M319.5,438.7'), `expected generated media output path to start at source card side, got ${outputPath}`)
  assert(outputPath.endsWith('L387,717.4'), `expected generated media output path to terminate on output card left side, got ${outputPath}`)

  const connectedOnlyGraph = {
    ...result.graphData,
    nodes: result.graphData.nodes.map(node => String(node.id || '') === 'story-card' ? card : node),
  }
  const board = buildStoryboardBoardModel({ graphData: connectedOnlyGraph, graphRevision: 1, widgetRegistry: registry })
  const targetCard = board.lanes.flatMap(lane => lane.cards).find(item => item.id === 'story-card')
  assert(targetCard?.media?.url === videoPayload.url && targetCard.media.kind === 'video', `expected inbound Rich Media edge to project card media, got ${JSON.stringify(targetCard?.media)}`)
}

export function testStoryboardCardMediaDropReusesInboundRichMediaPanelEdge() {
  const card = buildCardNode()
  const first = applyStoryboardCardMediaDropGraph({
    cardId: 'story-card',
    cardProperties: { ...card.properties, mediaKind: videoPayload.kind, mediaUrl: videoPayload.url },
    graphData: { type: 'Graph', nodes: [card], edges: [] },
    media: videoPayload,
  })
  assert(first, 'expected initial media drop graph result')
  const imagePayload: MediaDragPayload = {
    kind: 'image',
    url: 'https://example.com/replacement.png',
    label: 'Replacement image',
    sourceKey: 'floating-media:replacement',
  }
  const second = applyStoryboardCardMediaDropGraph({
    cardId: 'story-card',
    cardProperties: { ...card.properties, mediaKind: imagePayload.kind, mediaUrl: imagePayload.url },
    graphData: first.graphData,
    media: imagePayload,
  })
  assert(second, 'expected replacement media drop graph result')
  assert(second.panelId === first.panelId, `expected replacement drop to reuse panel ${first.panelId}, got ${second.panelId}`)
  assert(second.edgeId === first.edgeId, `expected replacement drop to reuse edge ${first.edgeId}, got ${second.edgeId}`)
  assert(second.graphData.nodes.length === first.graphData.nodes.length, 'expected replacement drop not to duplicate Rich Media Panels')
  assert(second.graphData.edges.length === first.graphData.edges.length, 'expected replacement drop not to duplicate inbound edges')
  const panelProperties = readNode(second.graphData, second.panelId)?.properties as Record<string, unknown>
  assert(panelProperties.imageUrl === imagePayload.url && !panelProperties.videoUrl, `expected reused panel to replace stale video media, got ${JSON.stringify(panelProperties)}`)
  const edgeProperties = second.graphData.edges.find(edge => String(edge.id || '') === second.edgeId)?.properties as Record<string, unknown>
  assert(edgeProperties[FLOW_EDGE_SOURCE_PORT_KEY] === 'imageUrl' && edgeProperties[FLOW_EDGE_TARGET_PORT_KEY] === 'mediaUrl', `expected reused edge to retarget imageUrl -> mediaUrl, got ${JSON.stringify(edgeProperties)}`)
}

export function testStoryboardCardMediaDropCreatesVisiblePanelInsteadOfReusingUnownedEdge() {
  const card = buildCardNode()
  const distantPanel: GraphNode = {
    id: 'preauthored-panel',
    type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
    label: FLOW_RICH_MEDIA_PANEL_NODE_LABEL,
    x: 860,
    y: 260,
    properties: {
      [FLOW_WIDGET_TYPE_ID_KEY]: FLOW_RICH_MEDIA_PANEL_WIDGET_TYPE_ID,
      [FLOW_WIDGET_FORM_ID_KEY]: FLOW_RICH_MEDIA_PANEL_FORM_ID,
      imageUrl: 'https://example.com/preauthored.png',
    },
  }
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [card, distantPanel],
    edges: [{
      id: 'preauthored-edge',
      label: 'preauthored',
      source: 'preauthored-panel',
      target: 'story-card',
      properties: {
        [FLOW_EDGE_SOURCE_PORT_KEY]: 'imageUrl',
        [FLOW_EDGE_TARGET_PORT_KEY]: 'mediaUrl',
      },
    }],
  }
  const result = applyStoryboardCardMediaDropGraph({
    cardId: 'story-card',
    cardProperties: { ...card.properties, mediaKind: videoPayload.kind, mediaUrl: videoPayload.url },
    graphData,
    media: videoPayload,
  })
  assert(result, 'expected media drop graph result')
  assert(result.panelId !== 'preauthored-panel', 'expected card media drop not to reuse a non-drop-owned Rich Media Panel')
  assert(result.edgeId !== 'preauthored-edge', 'expected card media drop not to reuse a non-drop-owned Rich Media Panel edge')
  const panel = readNode(result.graphData, result.panelId)
  assert(panel?.x === 240 && panel.fx === 240 && panel.y === 23 && panel.fy === 23, `expected generated panel to use visible card-adjacent placement, got ${JSON.stringify(panel)}`)
  const sourceEdge = result.graphData.edges.find(edge => String(edge.id || '') === result.edgeId)
  assert(sourceEdge?.source === result.panelId && sourceEdge.target === 'story-card', `expected generated panel to own the inbound card-media edge, got ${JSON.stringify(sourceEdge)}`)
  const board = buildStoryboardBoardModel({ graphData: result.graphData, graphRevision: 1, widgetRegistry: registry })
  const targetCard = board.lanes.flatMap(lane => lane.cards).find(item => item.id === 'story-card')
  assert(targetCard?.media?.url === videoPayload.url, `expected generated inbound edge to supply visible card media, got ${JSON.stringify(targetCard?.media)}`)
}

function readFirstLineX(pathD: string): number | null {
  const match = /^M[^L]+ L(-?\d+(?:\.\d+)?),/.exec(pathD)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

export function testStoryboardOverlayForwardTrackEdgeAvoidsReverseBacktrack() {
  const explicitOrderByNodeId = buildGraphFlowOrderIndexByNodeId([
    { id: 'care_canvas', properties: { 'visual:xIndex': 5 } },
    { id: 'care_validation', properties: { 'visual:xIndex': 6 } },
  ], { rankdir: 'LR' })
  const sourceOrderByNodeId = buildGraphFlowOrderIndexByNodeId([
    { id: 'care_canvas', properties: {} },
    { id: 'care_validation', properties: {} },
  ], { rankdir: 'LR' })
  const sourceMetadataOrderByNodeId = buildGraphFlowOrderIndexByNodeId([
    { id: 'blk:md:workspace-readme:li:215:1', metadata: { lineStart: 215 }, properties: {} },
    { id: 'blk:md:workspace-readme:list:215:11', metadata: { lineStart: 215 }, properties: {} },
    { id: 'blk:md:workspace-readme:p:210:10', metadata: { lineStart: 210 }, properties: {} },
  ], { rankdir: 'LR' })
  const markdownIdOrderByNodeId = buildGraphFlowOrderIndexByNodeId([
    { id: 'blk:md:workspace-readme:li:215:1', properties: {} },
    { id: 'blk:md:workspace-readme:list:215:11', properties: {} },
    { id: 'blk:md:workspace-readme:p:210:10', properties: {} },
  ], { rankdir: 'LR' })
  const explicitDirection = resolveGraphEdgeFlowOrderDirection({
    sourceId: 'care_canvas',
    targetId: 'care_validation',
    orderByNodeId: explicitOrderByNodeId,
  })
  const fallbackDirection = resolveGraphEdgeFlowOrderDirection({
    sourceId: 'care_canvas',
    targetId: 'care_validation',
    orderByNodeId: sourceOrderByNodeId,
  })
  const sourceMetadataDirection = resolveGraphEdgeFlowOrderDirection({
    sourceId: 'blk:md:workspace-readme:p:210:10',
    targetId: 'blk:md:workspace-readme:list:215:11',
    orderByNodeId: sourceMetadataOrderByNodeId,
  })
  const markdownIdDirection = resolveGraphEdgeFlowOrderDirection({
    sourceId: 'blk:md:workspace-readme:p:210:10',
    targetId: 'blk:md:workspace-readme:list:215:11',
    orderByNodeId: markdownIdOrderByNodeId,
  })
  const hasItemMetadataDirection = resolveGraphEdgeFlowOrderDirection({
    edgeLabel: 'hasItem',
    sourceId: 'blk:md:workspace-readme:list:215:11',
    targetId: 'blk:md:workspace-readme:li:215:1',
    orderByNodeId: sourceMetadataOrderByNodeId,
  })
  const hasItemMarkdownIdDirection = resolveGraphEdgeFlowOrderDirection({
    edgeLabel: 'hasItem',
    sourceId: 'blk:md:workspace-readme:list:215:11',
    targetId: 'blk:md:workspace-readme:li:215:1',
    orderByNodeId: markdownIdOrderByNodeId,
  })
  assert(explicitDirection === 'forward', `expected visual x-index metadata to mark the overlay edge as forward flow, got ${explicitDirection}`)
  assert(fallbackDirection === 'forward', `expected source node order to remain a deterministic forward fallback, got ${fallbackDirection}`)
  assert(sourceMetadataDirection === 'forward', `expected source metadata to mark markdown edges as forward even when rendered order is reversed, got ${sourceMetadataDirection}`)
  assert(markdownIdDirection === 'forward', `expected markdown block source ids to mark source-line edges as forward even when rendered order is reversed, got ${markdownIdDirection}`)
  assert(hasItemMetadataDirection === 'forward', `expected same-line markdown containment metadata to remain forward, got ${hasItemMetadataDirection}`)
  assert(hasItemMarkdownIdDirection === 'forward', `expected same-line markdown containment ids to remain forward despite list item ordinals, got ${hasItemMarkdownIdDirection}`)
  const sx = 533.06
  const sy = 495.34
  const tx = 97
  const ty = 273.41
  const backwardPath = buildStoryboardOverlayEdgePathD({
    edgeType: 'smoothstep',
    outputCardLeftSide: false,
    rankdir: 'LR',
    sx,
    sy,
    tx,
    ty,
  })
  const forwardPath = buildStoryboardOverlayEdgePathD({
    edgeType: 'smoothstep',
    outputCardLeftSide: false,
    flowForwardTrack: explicitDirection === 'forward',
    rankdir: 'LR',
    sx,
    sy,
    tx,
    ty,
  })
  const sourceLinePath = buildStoryboardOverlayEdgePathD({
    edgeType: 'smoothstep',
    outputCardLeftSide: false,
    flowForwardTrack: markdownIdDirection === 'forward',
    rankdir: 'LR',
    sx: 618.08,
    sy: 398.38,
    tx: 457,
    ty: 233.88,
  })
  const hasItemPath = buildStoryboardOverlayEdgePathD({
    edgeType: 'smoothstep',
    outputCardLeftSide: false,
    flowForwardTrack: hasItemMarkdownIdDirection === 'forward',
    rankdir: 'LR',
    sx: 531.08,
    sy: 218.96,
    tx: 369.5,
    ty: 123.88,
  })
  const backwardFirstX = readFirstLineX(backwardPath)
  const forwardFirstX = readFirstLineX(forwardPath)
  const sourceLineFirstX = readFirstLineX(sourceLinePath)
  const hasItemFirstX = readFirstLineX(hasItemPath)
  assert(backwardFirstX != null && backwardFirstX < sx, `expected baseline smoothstep to back-track first, got ${backwardPath}`)
  assert(forwardFirstX != null && forwardFirstX > sx, `expected forward-track path to move forward first, got ${forwardPath}`)
  assert(sourceLineFirstX != null && sourceLineFirstX > 618.08, `expected source-line forward edge to move forward before routing, got ${sourceLinePath}`)
  assert(hasItemFirstX != null && hasItemFirstX > 531.08, `expected same-line containment edge to move forward before routing, got ${hasItemPath}`)
}
