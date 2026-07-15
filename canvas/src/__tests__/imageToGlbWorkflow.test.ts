import {
  IMAGE_TO_GLB_BINDING_TOKEN,
  IMAGE_TO_GLB_COMMAND_TOKEN,
  IMAGE_TO_GLB_OUTPUT_PANEL_PROPERTY,
  IMAGE_TO_GLB_SEMANTIC_TOKEN,
  isImageToGlbOutputPanel,
  resolveImageToGlbRunInput,
} from '@/features/image-to-glb/imageToGlbContract'
import { buildImageToGlbPromptPreset } from '@/features/image-to-glb/imageToGlbPromptPreset'
import { createReviewedImageToGlbScene } from '@/features/image-to-glb/imageToGlbSceneFactory'
import type { ImageReferencePixels } from '@/features/image-to-threejs/imageReferencePixels'
import { getNodeMediaSpec } from '@/lib/canvas/graph-elements/mediaSpec'
import { listMediaOverlayNodes } from '@/lib/render/mediaOverlayPool'
import { buildRichMediaPanelOverlayState } from '@/lib/render/richMediaPanelState'
import { buildRichMediaPanelPreviewSpec } from '@/lib/render/richMediaPreview'
import { runStoryboardWidgetMediaWorkflowNode } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowMediaRunHandlers'
import { createStoryboardWidgetWorkflowRichMediaPublishers } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowRichMediaPublication'
import {
  IMAGE_TO_GLB_OUTPUT_EDGE_PROPERTY,
} from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowRichMediaPanel'
import { materializeStoryboardWidgetWorkflowOutputEdgeInCanonicalGraph } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowOutputEdgeMaterialization'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { withGlbExporterFileReader } from '@/tests/lib/glbExporterFileReaderHarness'

const SOURCE_URL = 'workspace:/media/procedural-reference.png'

function buildWorkflowReferencePixels(): ImageReferencePixels {
  const width = 48
  const height = 48
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 7; y <= 40; y += 1) {
    const inset = y < 18 ? 5 : y < 33 ? 13 : 9
    for (let x = inset; x < width - inset; x += 1) {
      if (y >= 18 && y < 33 && x > 19 && x < 28) continue
      const index = (y * width + x) * 4
      data[index] = 190
      data[index + 1] = 158
      data[index + 2] = 116
      data[index + 3] = 255
    }
  }
  return { data, height, sourceHeight: height, sourceWidth: width, width }
}

function buildImageToGlbCard(prompt: string): GraphNode {
  return {
    id: 'image-to-glb-source-card',
    type: 'TextGeneration',
    label: 'Widget Card',
    x: 140,
    y: 260,
    properties: {
      prompt,
      storyboardMediaItems: [{ kind: 'image', url: SOURCE_URL }],
    },
  } as GraphNode
}

export function testImageToGlbEverySharedTokenResolvesTheSameInput() {
  for (const token of [IMAGE_TO_GLB_COMMAND_TOKEN, IMAGE_TO_GLB_BINDING_TOKEN, IMAGE_TO_GLB_SEMANTIC_TOKEN]) {
    const input = resolveImageToGlbRunInput({ node: buildImageToGlbCard(`${token} build a reviewed procedural asset`) })
    if (!input || input.sourceUrl !== SOURCE_URL || input.invocationTokens.length !== 1 || input.invocationTokens[0] !== token) {
      throw new Error(`expected ${token} to resolve the shared image source, got ${JSON.stringify(input)}`)
    }
  }
}

export function testImageToGlbFrontmatterTypedCellsRetainTheModelProjection() {
  const modelUrl = 'data:model/gltf-binary;base64,Z2xURgIAAAA='
  const cell = (key: string, value: unknown, type = typeof value): Record<string, unknown> => ({ key, type, value })
  const outputPanel = {
    id: 'typed-image-to-glb-output',
    type: 'RichMediaPanel',
    label: 'GLB Rich Media Panel',
    properties: {
      imageGlbOutputPanel: cell('imageGlbOutputPanel', true, 'boolean'),
      imageGlbOutputAnchorNodeId: cell('imageGlbOutputAnchorNodeId', 'source-card', 'string'),
      media_kind: cell('media_kind', 'model', 'string'),
      mediaUrl: cell('mediaUrl', modelUrl, 'string'),
      modelUrl: cell('modelUrl', modelUrl, 'string'),
      media_interactive: cell('media_interactive', true, 'boolean'),
      richMediaActiveTab: cell('richMediaActiveTab', 'model', 'string'),
    },
  } as GraphNode

  if (!isImageToGlbOutputPanel(outputPanel.properties)) {
    throw new Error('expected a frontmatter typed-cell marker to retain GLB output ownership')
  }
  const mediaSpec = getNodeMediaSpec(outputPanel)
  if (mediaSpec?.kind !== 'model' || mediaSpec.url !== modelUrl || mediaSpec.interactive !== true) {
    throw new Error(`expected typed model fields to retain the GLB media spec, got ${JSON.stringify(mediaSpec)}`)
  }
  const panel = buildRichMediaPanelOverlayState({ node: outputPanel })
  if (!panel || panel.activeTab !== 'model' || !panel.hasModel) {
    throw new Error(`expected typed model fields to retain the model panel state, got ${JSON.stringify(panel)}`)
  }
  const preview = buildRichMediaPanelPreviewSpec({ node: outputPanel, panel })
  if (preview?.kind !== 'model' || preview.url !== modelUrl || preview.openUrl !== modelUrl) {
    throw new Error(`expected typed model fields to retain the loadable GLB preview URL, got ${JSON.stringify(preview)}`)
  }
}

export async function testImageToGlbRunPublishesOnlySeparateModelOutputAndCanonicalEdge() {
  const sourceCard = buildImageToGlbCard(buildImageToGlbPromptPreset('Build a compact reconstructed object from the reference.'))
  const sourcePropertiesBefore = JSON.stringify(sourceCard.properties)
  let draft = {
    type: 'Graph',
    nodes: [sourceCard],
    edges: [],
    metadata: {},
  } as GraphData
  const staleStoreOnlyOutputPanel = {
    id: 'stale-store-only-glb-panel',
    type: 'RichMediaPanel',
    label: 'GLB Rich Media Panel',
    x: 660,
    y: 260,
    properties: {
      imageGlbOutputPanel: true,
      imageGlbOutputAnchorNodeId: sourceCard.id,
      media_kind: 'model',
      richMediaActiveTab: 'model',
    },
  } as GraphNode
  let canonical = {
    ...draft,
    nodes: [
      ...draft.nodes.map(node => ({
        ...node,
        properties: {
          prompt: 'Generate a text response for the active request.',
        },
      })),
      staleStoreOnlyOutputPanel,
    ],
  } as GraphData
  const publishedGraphs: GraphData[] = []
  const resolveNode = (id: string): GraphNode | null => draft.nodes.find(node => node.id === id) || null
  const context = {
    graphSemanticKey: 'image-to-glb-output-publication',
    draftGraph: draft,
    renderGraph: draft,
    baseGraph: draft,
    storeGraph: canonical,
    draftNodes: draft.nodes,
    renderNodes: draft.nodes,
    baseNodes: draft.nodes,
    storeNodes: canonical.nodes,
    draftNodeById: new Map(draft.nodes.map(node => [node.id, node])),
    renderNodeById: new Map(draft.nodes.map(node => [node.id, node])),
    baseNodeById: new Map(draft.nodes.map(node => [node.id, node])),
    storeNodeById: new Map(canonical.nodes.map(node => [node.id, node])),
  } as never
  const publishers = createStoryboardWidgetWorkflowRichMediaPublishers({
    context,
    graphForRun: draft,
    allowCreateRichMediaPanel: true,
    withRunLayoutMutationGuard: run => run(),
    scheduleWorkflowOutputEdgeRefresh: () => undefined,
    readLiveDraftGraphData: () => draft,
    appendDraftNode: () => { throw new Error('image-derived publication must not use the split global append path') },
    commitDraftGraphDataUpdate: (_current, next) => { draft = next },
    commitPublishedGraphData: next => {
      publishedGraphs.push(next)
      draft = next
      canonical = {
        ...next,
        nodes: next.nodes.map(node => ({ ...node, properties: { ...(node.properties || {}) } })),
        edges: next.edges.map(edge => ({ ...edge, properties: { ...(edge.properties || {}) } })),
      }
    },
    updateNode: (id, patch) => {
      canonical = {
        ...canonical,
        nodes: canonical.nodes.map(node => node.id === id ? { ...node, ...patch } : node),
      }
    },
    appendWorkflowOutputEdge: edge => materializeStoryboardWidgetWorkflowOutputEdgeInCanonicalGraph({
      graphData: canonical,
      edge,
      addEdge: next => { canonical = { ...canonical, edges: [...canonical.edges, next] } },
      persistGraph: next => { canonical = next },
    }),
    resolveNodeByIdAcrossGraphs: resolveNode,
  })

  let genericPublisherCalled = false
  let sourceCardOutputWrites = 0
  const generatedSourceUrls: string[] = []
  const run = async () => await runStoryboardWidgetMediaWorkflowNode({
    id: sourceCard.id,
    node: sourceCard,
    rawNodeProperties: sourceCard.properties as Record<string, unknown>,
    context,
    graphForRun: draft,
    writableNodeId: sourceCard.id,
    widgetRegistry: [],
    activeWorkspacePath: '',
    generationRuntime: {
      chatProvider: '', chatAuthMode: 'serverManaged', chatApiKey: '', chatEndpointUrl: '', chatModel: '', markdownDocumentText: '',
    },
    updateRunOutputForKnownNodeIds: () => { sourceCardOutputWrites += 1 },
    setRunLoadingStateForKnownNodeIds: () => undefined,
    publishMediaRunOutputToRichMediaPanel: () => { genericPublisherCalled = true },
    publishImageToThreeJsRunOutputToRichMediaPanel: () => { throw new Error('expected image-to-glb to bypass the image-to-threejs publisher') },
    publishImageToGlbRunOutputToRichMediaPanel: publishers.publishImageToGlbRunOutputToRichMediaPanel,
    generateImageToGlbScene: async ({ sourceUrl }) => {
      generatedSourceUrls.push(sourceUrl)
      return createReviewedImageToGlbScene({ pixels: buildWorkflowReferencePixels(), sourceUrl })
    },
    publishAnnotationRunOutputToRichMediaPanel: () => undefined,
    upsertUiToast: () => undefined,
  })

  const handled = await withGlbExporterFileReader(run)
  if (!handled || genericPublisherCalled || sourceCardOutputWrites !== 0) {
    throw new Error('expected the GLB run to bypass generic output and leave the source Card write-free')
  }
  if (generatedSourceUrls.length !== 1 || generatedSourceUrls[0] !== SOURCE_URL) {
    throw new Error(`expected the reviewed scene generator to receive the resolved source image, got ${JSON.stringify(generatedSourceUrls)}`)
  }
  if (JSON.stringify(resolveNode(sourceCard.id)?.properties) !== sourcePropertiesBefore) {
    throw new Error(`expected source Card and input media to remain unchanged, got ${JSON.stringify(resolveNode(sourceCard.id)?.properties)}`)
  }
  if (publishedGraphs.length !== 1 || JSON.stringify(publishedGraphs[0]?.nodes[0]?.properties) !== sourcePropertiesBefore) {
    throw new Error(`expected the atomic published graph to preserve the live-draft Card instead of stale canonical template text, got ${JSON.stringify(publishedGraphs)}`)
  }

  const outputPanels = draft.nodes.filter(node => isImageToGlbOutputPanel(node.properties))
  if (outputPanels.length !== 1) throw new Error(`expected one marker-owned GLB panel, got ${JSON.stringify(outputPanels)}`)
  const outputPanel = outputPanels[0]!
  const outputProperties = (outputPanel.properties || {}) as Record<string, unknown>
  if (
    outputProperties[IMAGE_TO_GLB_OUTPUT_PANEL_PROPERTY] !== true
    || outputProperties.media_kind !== 'model'
    || outputProperties.richMediaActiveTab !== 'model'
    || typeof outputProperties.modelUrl !== 'string'
    || !outputProperties.modelUrl.startsWith('data:model/gltf-binary;base64,')
    || outputProperties.imageUrl
  ) {
    throw new Error(`expected separate native model output without an image fallback, got ${JSON.stringify(outputProperties)}`)
  }
  const outputSpec = getNodeMediaSpec(outputPanel)
  if (outputSpec?.kind !== 'model' || outputSpec.url !== outputProperties.modelUrl) {
    throw new Error(`expected the GLB panel to retain a model media spec, got ${JSON.stringify(outputSpec)}`)
  }
  const renderProjectedOutputPanel = {
    ...outputPanel,
    properties: {
      ...outputProperties,
      mediaUrl: '',
      modelUrl: '',
    },
  } as GraphNode
  const overlays = listMediaOverlayNodes({
    enabled: true,
    nodes: draft.nodes.map(node => node.id === outputPanel.id ? renderProjectedOutputPanel : node),
    poolMax: 8,
    nodeById: new Map(draft.nodes.map(node => [node.id, node])),
    connectedValuesByNodeId: new Map([[
      outputPanel.id,
      {
        'properties.modelUrl': {
          value: SOURCE_URL,
          sources: [{ edgeId: 'provenance-edge', nodeId: sourceCard.id, portKey: 'output' }],
        },
      },
    ]]),
  })
  const outputOverlay = overlays.find(overlay => overlay.id === outputPanel.id)
  if (!outputOverlay || outputOverlay.kind !== 'model' || outputOverlay.url !== outputProperties.modelUrl || outputOverlay.openUrl !== outputProperties.modelUrl) {
    throw new Error(`expected the authored marker-owned output to survive stale render projection and connected input values, got ${JSON.stringify(outputOverlay)}`)
  }
  const outputEdges = draft.edges.filter(edge => edge.source === sourceCard.id && edge.target === outputPanel.id)
  if (outputEdges.length !== 1 || (outputEdges[0]?.properties as Record<string, unknown>)[IMAGE_TO_GLB_OUTPUT_EDGE_PROPERTY] !== true) {
    throw new Error(`expected exactly one canonical source-to-GLB edge, got ${JSON.stringify(outputEdges)}`)
  }
  if (canonical.nodes.filter(node => isImageToGlbOutputPanel(node.properties)).length !== 1 || canonical.edges.length !== 1) {
    throw new Error(`expected one materialized canonical GLB panel and edge, got nodes=${canonical.nodes.length} edges=${canonical.edges.length}`)
  }
  if (canonical.nodes.some(node => node.id === staleStoreOnlyOutputPanel.id)) {
    throw new Error('expected atomic publication to discard the store-only stale GLB panel instead of targeting a node absent from the live draft')
  }

  const rerunHandled = await withGlbExporterFileReader(run)
  if (!rerunHandled || draft.nodes.filter(node => isImageToGlbOutputPanel(node.properties)).length !== 1 || draft.edges.length !== 1 || canonical.edges.length !== 1) {
    throw new Error('expected rerunning image-to-glb to reuse the marker-owned panel and edge without duplicates')
  }
  if ([...generatedSourceUrls].length !== 2) throw new Error('expected rerun to re-analyze the current reference instead of reusing URL-hash geometry')
}
