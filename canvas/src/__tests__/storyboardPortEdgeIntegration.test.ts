import { buildStoryboardBoardModel } from '@/components/StoryboardCanvas/storyboardModel'
import { finalizeEdgeAuthoring } from '@/features/edge-creation/authoring'
import { buildRichMediaPanelRegistryDraft } from '@/features/flow-editor-manager/richMediaPanelRegistryDraft'
import { buildStoryboardElementRegistryDraft } from '@/features/flow-editor-manager/storyboardElementRegistryDraft'
import { FLOW_WIDGET_FORM_ID_KEY, FLOW_WIDGET_TYPE_ID_KEY } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import { computeRichMediaOverlayConnectedValuesByNodeId } from '@/lib/render/richMediaSsot'
import {
  FLOW_RICH_MEDIA_PANEL_FORM_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_WIDGET_TYPE_ID,
  FLOW_STORYBOARD_ELEMENT_FORM_ID,
  FLOW_STORYBOARD_ELEMENT_NODE_TYPE_ID,
  FLOW_STORYBOARD_ELEMENT_WIDGET_TYPE_ID,
} from '@/lib/config.flow-editor'
import type { GraphData } from '@/lib/graph/types'

const buildTestImageDataUri = (semanticId: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><title>${semanticId}</title></svg>`)}`

export function testStoryboardRichMediaPortEdgeProjectsReferenceImageIntoCard() {
  const imageUrl = buildTestImageDataUri('media-source')
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [
      {
        id: 'media-source',
        type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
        label: 'Reference media',
        properties: {
          [FLOW_WIDGET_TYPE_ID_KEY]: FLOW_RICH_MEDIA_PANEL_WIDGET_TYPE_ID,
          [FLOW_WIDGET_FORM_ID_KEY]: FLOW_RICH_MEDIA_PANEL_FORM_ID,
          imageUrl,
        },
      },
      {
        id: 'storyboard-target',
        type: FLOW_STORYBOARD_ELEMENT_NODE_TYPE_ID,
        label: 'Target card',
        properties: {
          [FLOW_WIDGET_TYPE_ID_KEY]: FLOW_STORYBOARD_ELEMENT_WIDGET_TYPE_ID,
          [FLOW_WIDGET_FORM_ID_KEY]: FLOW_STORYBOARD_ELEMENT_FORM_ID,
          lane: 'Storyboard',
        },
      },
    ],
    edges: [],
  }
  const authored = finalizeEdgeAuthoring({
    mode: 'create',
    data: graphData,
    schema: null,
    label: 'linksTo',
    selectedEdgeId: null,
    from: { nodeId: 'media-source', portKey: 'imageUrl' },
    to: { nodeId: 'storyboard-target', portKey: 'imageUrl' },
  })
  if (authored.kind !== 'create') throw new Error(`expected a typed Rich Media to Storyboard edge, got ${authored.kind}`)

  const registry = [
    { ...buildRichMediaPanelRegistryDraft(), id: 'rich-media', updatedAt: '2026-06-27T00:00:00.000Z' },
    { ...buildStoryboardElementRegistryDraft(), id: 'storyboard', updatedAt: '2026-06-27T00:00:00.000Z' },
  ]
  const board = buildStoryboardBoardModel({
    graphData: { ...graphData, edges: [authored.edge] },
    graphRevision: 1,
    widgetRegistry: registry,
  })
  const targetCard = board.lanes.flatMap(lane => lane.cards).find(card => card.id === 'storyboard-target')
  if (targetCard?.media?.url !== imageUrl || (targetCard.media.kind !== 'image' && targetCard.media.kind !== 'svg')) {
    throw new Error(`expected connected reference image in target card, got ${JSON.stringify(targetCard?.media)}`)
  }
}

export function testStoryboardCardPortEdgeProjectsImageOutputIntoRichMediaPanel() {
  const imageUrl = buildTestImageDataUri('storyboard-source')
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [
      {
        id: 'storyboard-source',
        type: FLOW_STORYBOARD_ELEMENT_NODE_TYPE_ID,
        label: 'Source card',
        properties: {
          [FLOW_WIDGET_TYPE_ID_KEY]: FLOW_STORYBOARD_ELEMENT_WIDGET_TYPE_ID,
          [FLOW_WIDGET_FORM_ID_KEY]: FLOW_STORYBOARD_ELEMENT_FORM_ID,
          lane: 'Storyboard',
          imageUrl,
        },
      },
      {
        id: 'media-target',
        type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
        label: 'Output media',
        properties: {
          [FLOW_WIDGET_TYPE_ID_KEY]: FLOW_RICH_MEDIA_PANEL_WIDGET_TYPE_ID,
          [FLOW_WIDGET_FORM_ID_KEY]: FLOW_RICH_MEDIA_PANEL_FORM_ID,
          imageUrl: '',
        },
      },
    ],
    edges: [],
  }
  const authored = finalizeEdgeAuthoring({
    mode: 'create',
    data: graphData,
    schema: null,
    label: 'linksTo',
    selectedEdgeId: null,
    from: { nodeId: 'storyboard-source', portKey: 'imageUrl' },
    to: { nodeId: 'media-target', portKey: 'imageUrl' },
  })
  if (authored.kind !== 'create') throw new Error(`expected typed Storyboard to Rich Media edge, got ${authored.kind}`)

  const registry = [
    { ...buildRichMediaPanelRegistryDraft(), id: 'rich-media', updatedAt: '2026-06-27T00:00:00.000Z' },
    { ...buildStoryboardElementRegistryDraft(), id: 'storyboard', updatedAt: '2026-06-27T00:00:00.000Z' },
  ]
  const connectedValues = computeRichMediaOverlayConnectedValuesByNodeId({
    graphData: { ...graphData, edges: [authored.edge] },
    graphRevision: 1,
    registry,
    includeMediaSpecNodes: true,
  })
  const imageValue = connectedValues.get('media-target')?.['properties.imageUrl']?.value
  if (imageValue !== imageUrl) {
    throw new Error(`expected Card image output in Rich Media Panel target, got ${JSON.stringify(imageValue)}`)
  }
}
