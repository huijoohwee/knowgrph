import {
  IMAGE_TO_THREEJS_COMMAND_TOKEN,
  IMAGE_TO_THREEJS_OUTPUT_PANEL_ANCHOR_ID_PROPERTY,
  IMAGE_TO_THREEJS_OUTPUT_PANEL_PROPERTY,
  IMAGE_TO_THREEJS_RENDER_MODE,
  buildImageToThreeJsConversion,
  resolveImageToThreeJsRunInput,
} from '@/features/image-to-threejs/imageToThreeJsContract'
import { buildImageToThreeJsPromptPreset } from '@/features/image-to-threejs/imageToThreeJsPromptPreset'
import { runStoryboardWidgetMediaWorkflowNode } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowMediaRunHandlers'
import { createStoryboardWidgetWorkflowRichMediaPublishers } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowRichMediaPublication'
import { IMAGE_TO_THREEJS_OUTPUT_EDGE_PROPERTY } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowRichMediaPanel'
import {
  isStoryboardWidgetWorkflowOutputEdgeMaterialized,
  materializeStoryboardWidgetWorkflowOutputEdgeInCanonicalGraph,
} from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowOutputEdgeMaterialization'
import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph'
import { upsertFrontmatterFlowMarkdownText } from '@/hooks/store/graph-data-slice/graphDataFrontmatterFlowSync'
import type { GraphData, GraphNode } from '@/lib/graph/types'

export async function testImageToThreeJsMarkerOwnedOutputRecoversGenericCardRunAndEdge() {
  const sourceUrl = 'workspace:/media/recover-marker-owned-output.png'
  const conversion = buildImageToThreeJsConversion(sourceUrl)
  if (conversion.ok === false) throw new Error(conversion.reason)

  const sourceCard = {
    id: 'marker-owned-recovery-card',
    type: 'TextGeneration',
    label: 'Widget Card',
    properties: {
      prompt: 'Generate a text response for the active request.',
      storyboardMediaItems: [{ kind: 'image', url: sourceUrl }],
    },
  } as GraphNode
  const sourceMediaBefore = JSON.stringify(sourceCard.properties.storyboardMediaItems)
  const ordinaryCard = {
    id: 'ordinary-authored-card',
    type: 'TextGeneration',
    label: 'Widget Card',
    properties: { prompt: 'Keep this ordinary authored Card unchanged.' },
  } as GraphNode
  const ordinaryCardBefore = JSON.stringify(ordinaryCard.properties)
  const markerOutput = {
    id: 'marker-owned-recovery-output',
    type: 'RichMediaPanel',
    label: 'Three.js Rich Media Panel',
    properties: {
      ...conversion.patch,
      [IMAGE_TO_THREEJS_OUTPUT_PANEL_PROPERTY]: true,
      [IMAGE_TO_THREEJS_OUTPUT_PANEL_ANCHOR_ID_PROPERTY]: sourceCard.id,
      imageThreeJsInvocation: { kind: 'inline-command', tokens: [IMAGE_TO_THREEJS_COMMAND_TOKEN] },
    },
  } as GraphNode

  let draft = { type: 'Graph', nodes: [sourceCard, ordinaryCard, markerOutput], edges: [], metadata: {} } as GraphData
  let canonical = {
    ...draft,
    nodes: draft.nodes.map(node => ({ ...node, properties: { ...(node.properties || {}) } })),
  } as GraphData
  const resolveNode = (id: string) => draft.nodes.find(node => node.id === id) || null
  const context = {
    graphSemanticKey: 'image-to-threejs-marker-output-recovery',
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
    appendDraftNode: () => { throw new Error('expected the explicit marker output panel to be reused') },
    commitDraftGraphDataUpdate: (_current, next) => { draft = next },
    updateNode: (id, patch) => {
      canonical = {
        ...canonical,
        nodes: canonical.nodes.map(node => node.id === id ? { ...node, ...patch } : node),
      }
    },
    appendWorkflowOutputEdge: edge => { canonical = { ...canonical, edges: [...canonical.edges, edge] } },
    resolveNodeByIdAcrossGraphs: resolveNode,
  })

  if (resolveImageToThreeJsRunInput({ node: sourceCard })) {
    throw new Error('expected the generic source Card to need its explicitly owned output recovery record')
  }
  const recoveredInput = publishers.resolveImageToThreeJsOwnedOutputPanelRunInput(sourceCard)
  if (recoveredInput?.sourceUrl !== sourceUrl) {
    throw new Error(`expected the marker-owned output to recover the source image, got ${JSON.stringify(recoveredInput)}`)
  }
  if (publishers.resolveImageToThreeJsOwnedOutputPanelRunInput(ordinaryCard)) {
    throw new Error('expected an ordinary authored Widget Card to remain outside strict marker recovery')
  }

  let genericPublisherCalled = false
  let cardOutputWrites = 0
  const handled = await runStoryboardWidgetMediaWorkflowNode({
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
    updateRunOutputForKnownNodeIds: () => { cardOutputWrites += 1 },
    setRunLoadingStateForKnownNodeIds: () => undefined,
    publishMediaRunOutputToRichMediaPanel: () => { genericPublisherCalled = true },
    publishImageToThreeJsRunOutputToRichMediaPanel: publishers.publishImageToThreeJsRunOutputToRichMediaPanel,
    restoreImageToThreeJsInputProjection: publishers.restoreImageToThreeJsInputProjection,
    resolveImageToThreeJsOwnedOutputPanelRunInput: publishers.resolveImageToThreeJsOwnedOutputPanelRunInput,
    publishAnnotationRunOutputToRichMediaPanel: () => undefined,
    upsertUiToast: () => undefined,
  })

  if (!handled || genericPublisherCalled || cardOutputWrites !== 0) {
    throw new Error('expected marker recovery to run image-to-threejs without mutating the source Card output')
  }
  const restoredSource = resolveNode(sourceCard.id)
  const restoredProps = (restoredSource?.properties || {}) as Record<string, unknown>
  if (restoredProps.prompt !== buildImageToThreeJsPromptPreset()) {
    throw new Error(`expected the generic source prompt to recover the shared preset, got ${String(restoredProps.prompt)}`)
  }
  if (JSON.stringify(restoredProps.storyboardMediaItems) !== sourceMediaBefore || restoredProps.mediaRenderMode) {
    throw new Error(`expected source media to remain input-only, got ${JSON.stringify(restoredProps)}`)
  }
  if (JSON.stringify(resolveNode(ordinaryCard.id)?.properties) !== ordinaryCardBefore) {
    throw new Error('expected an unrelated authored Widget Card to remain unchanged')
  }
  const outputProps = (resolveNode(markerOutput.id)?.properties || {}) as Record<string, unknown>
  if (outputProps.mediaRenderMode !== IMAGE_TO_THREEJS_RENDER_MODE || outputProps[IMAGE_TO_THREEJS_OUTPUT_PANEL_PROPERTY] !== true) {
    throw new Error(`expected the marker-owned output panel to remain the Three.js projection, got ${JSON.stringify(outputProps)}`)
  }
  const outputEdges = draft.edges.filter(edge => edge.source === sourceCard.id && edge.target === markerOutput.id)
  if (outputEdges.length !== 1 || (outputEdges[0]?.properties as Record<string, unknown>)[IMAGE_TO_THREEJS_OUTPUT_EDGE_PROPERTY] !== true) {
    throw new Error(`expected one marker-owned output edge, got ${JSON.stringify(outputEdges)}`)
  }
  if (!isStoryboardWidgetWorkflowOutputEdgeMaterialized(canonical.edges, outputEdges[0]!) || canonical.edges.length !== 1) {
    throw new Error(`expected canonical edge materialization without duplicates, got ${JSON.stringify(canonical.edges)}`)
  }

  let canonicalPersisted: GraphData | null = null
  let canonicalAddCount = 0
  materializeStoryboardWidgetWorkflowOutputEdgeInCanonicalGraph({
    graphData: canonical,
    edge: outputEdges[0]!,
    addEdge: () => { canonicalAddCount += 1 },
    persistGraph: graphData => { canonicalPersisted = graphData },
  })
  if (canonicalAddCount !== 0 || canonicalPersisted !== canonical) {
    throw new Error('expected an already-materialized edge to persist the canonical source rather than add a duplicate')
  }
  const persistedMarkdown = upsertFrontmatterFlowMarkdownText('# Three.js workflow\n', canonicalPersisted)
  const reparsed = tryParseMarkdownFrontmatterFlowGraph('threejs-workflow.md', persistedMarkdown)
  const roundTrippedEdge = reparsed?.graphData.edges.find(edge => edge.source === sourceCard.id && edge.target === markerOutput.id)
  if (!roundTrippedEdge || reparsed?.graphData.edges.length !== 1) {
    throw new Error(`expected the persisted source to retain one output edge, got ${JSON.stringify(reparsed?.graphData.edges)}`)
  }
}
