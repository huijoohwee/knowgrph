import { applyStoryboardCardMediaDropGraph } from '@/components/StoryboardWidgetCanvas/storyboardCardMediaDropGraph'
import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph'
import { FLOW_WIDGET_FORM_ID_KEY, FLOW_WIDGET_TYPE_ID_KEY } from '@/features/storyboard-widget-manager/resolveWidgetRegistry'
import { upsertFrontmatterFlowMarkdownText } from '@/hooks/store/graph-data-slice/graphDataFrontmatterFlowSync'
import {
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_STORYBOARD_ELEMENT_FORM_ID,
  FLOW_STORYBOARD_ELEMENT_NODE_TYPE_ID,
  FLOW_STORYBOARD_ELEMENT_WIDGET_TYPE_ID,
} from '@/lib/config.storyboard-widget'
import { FLOW_EDGE_SOURCE_PORT_KEY, FLOW_EDGE_TARGET_PORT_KEY } from '@/lib/graph/flowPorts'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { MediaDragPayload } from '@/lib/ui/mediaDragPayload'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export function testStoryboardCardMediaDropFrontmatterRoundTripPreservesPanelEdge() {
  const card: GraphNode = {
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
  }
  const initialGraphData: GraphData = { type: 'Graph', nodes: [card], edges: [] }
  const initialMarkdown = upsertFrontmatterFlowMarkdownText('# Storyboard\n', initialGraphData)
  const imagePayload: MediaDragPayload = {
    kind: 'image',
    url: 'https://example.com/story-reference.png',
    label: 'Story reference image',
    sourceKey: 'floating-media:story-reference-image',
  }
  const result = applyStoryboardCardMediaDropGraph({
    cardId: 'story-card',
    cardProperties: card.properties as Record<string, unknown>,
    graphData: initialGraphData,
    media: imagePayload,
  })
  assert(result, 'expected media drop graph result')
  const parsed = tryParseMarkdownFrontmatterFlowGraph(
    'storyboard.md',
    upsertFrontmatterFlowMarkdownText(initialMarkdown, result.graphData),
  )
  assert(parsed, 'expected materialized media topology to remain parseable from frontmatter')
  const panel = parsed.graphData.nodes.find(node => String(node.id || '') === result.panelId)
  assert(panel?.type === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID, 'expected Rich Media Panel to survive the frontmatter source round trip')
  const edge = parsed.graphData.edges.find(candidate => String(candidate.id || '') === result.edgeId)
  assert(edge?.source === result.panelId && edge.target === 'story-card', 'expected Rich Media Panel edge to survive the frontmatter source round trip')
  assert((edge.properties as Record<string, unknown>)[FLOW_EDGE_SOURCE_PORT_KEY] === 'imageUrl', 'expected source port ownership to survive the frontmatter source round trip')
  assert((edge.properties as Record<string, unknown>)[FLOW_EDGE_TARGET_PORT_KEY] === 'mediaUrl', 'expected target port ownership to survive the frontmatter source round trip')
}
