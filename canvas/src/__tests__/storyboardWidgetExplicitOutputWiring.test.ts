import { finalizeEdgeAuthoring } from '@/features/edge-creation/authoring'
import { createStoryboardWidgetWorkflowRichMediaPublishers } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowRichMediaPublication'
import { resolveStoryboardWidgetWorkflowDownstreamRunTargetIds } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowDownstreamRunTargets'
import {
  WORKFLOW_OUTPUT_EDGE_MODE_MANUAL,
  WORKFLOW_OUTPUT_EDGE_MODE_PROPERTY,
} from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowRichMediaPanel'
import type { GraphData, GraphNode } from '@/lib/graph/types'

function createTextOutputHarness(initialGraph: GraphData) {
  let draft = initialGraph
  const resolveNode = (nodeId: string) => draft.nodes.find(node => String(node.id) === nodeId) || null
  const publishers = createStoryboardWidgetWorkflowRichMediaPublishers({
    context: {
      draftGraph: initialGraph,
      renderGraph: initialGraph,
      baseGraph: initialGraph,
      storeGraph: initialGraph,
      draftNodes: initialGraph.nodes,
      renderNodes: initialGraph.nodes,
      baseNodes: initialGraph.nodes,
      storeNodes: initialGraph.nodes,
      draftNodeById: new Map(initialGraph.nodes.map(node => [String(node.id), node])),
      renderNodeById: new Map(initialGraph.nodes.map(node => [String(node.id), node])),
      baseNodeById: new Map(initialGraph.nodes.map(node => [String(node.id), node])),
      storeNodeById: new Map(initialGraph.nodes.map(node => [String(node.id), node])),
    } as never,
    graphForRun: initialGraph,
    allowCreateRichMediaPanel: true,
    withRunLayoutMutationGuard: run => run(),
    scheduleWorkflowOutputEdgeRefresh: () => undefined,
    readLiveDraftGraphData: () => draft,
    appendDraftNode: () => { throw new Error('text publication must use its atomic transaction') },
    commitDraftGraphDataUpdate: (_current, next) => { draft = next },
    commitPublishedGraphData: next => { draft = next },
    updateNode: (id, patch) => {
      draft = { ...draft, nodes: draft.nodes.map(node => String(node.id) === id ? { ...node, ...patch } : node) }
    },
    resolveNodeByIdAcrossGraphs: resolveNode,
  })
  return { publishers, readGraph: () => draft }
}

export function testExplicitMultiEdgesTargetWidgetCardAndRichMediaPanels() {
  const source: GraphNode = { id: 'source', type: 'TextGeneration', label: 'Probe child', properties: {} }
  const widgetTarget: GraphNode = { id: 'widget-target', type: 'TextGeneration', label: 'Widget Card', properties: { prompt: 'Continue with the inputs.' } }
  const panelA: GraphNode = { id: 'panel-a', type: 'RichMediaPanel', label: 'Panel A', properties: { workflowOutputAnchorNodeId: 'stale' } }
  const panelB: GraphNode = { id: 'panel-b', type: 'RichMediaPanel', label: 'Panel B', properties: { workflowOutputAnchorNodeId: 'stale' } }
  let graph: GraphData = { type: 'Graph', nodes: [source, widgetTarget, panelA, panelB], edges: [] }

  for (const targetNodeId of ['widget-target', 'panel-a', 'panel-b']) {
    const authored = finalizeEdgeAuthoring({
      mode: 'create', data: graph, schema: null, label: 'linksTo', selectedEdgeId: null,
      from: { nodeId: 'source', portKey: null }, to: { nodeId: targetNodeId, portKey: null },
    })
    if (authored.kind !== 'create') throw new Error(`expected an independent authored edge to ${targetNodeId}, got ${JSON.stringify(authored)}`)
    graph = { ...graph, edges: [...graph.edges, authored.edge] }
  }

  const downstreamIds = resolveStoryboardWidgetWorkflowDownstreamRunTargetIds({ node: source, graphData: graph })
  if (downstreamIds.join(',') !== 'widget-target,panel-a,panel-b') {
    throw new Error(`expected all explicit targets to remain independently actionable, got ${JSON.stringify(downstreamIds)}`)
  }

  const harness = createTextOutputHarness(graph)
  harness.publishers.publishTextRunOutputToRichMediaPanel({
    anchorNode: source,
    outputText: '# Generated result\n\nUse this result for the next action.',
    title: 'Generated Result',
    model: 'test-model',
    outputKey: 'probe-tree-generated-result',
    panelProperties: { probeTreeTerminalGeneration: true },
  })
  const published = harness.readGraph()
  const publishedWidget = published.nodes.find(node => node.id === 'widget-target')
  const publishedPanels = published.nodes.filter(node => node.id === 'panel-a' || node.id === 'panel-b')
  if (
    published.nodes.length !== 4
    || published.edges.length !== 3
    || publishedWidget?.properties.output
    || publishedPanels.length !== 2
    || publishedPanels.some(panel => panel.properties.output !== '# Generated result\n\nUse this result for the next action.')
    || publishedPanels.some(panel => panel.properties.workflowOutputAnchorNodeId || panel.properties.workflowOutputKey)
  ) {
    throw new Error(`expected explicit Rich Media targets only, with the Widget Card retained for downstream action, got ${JSON.stringify(published)}`)
  }
}

export function testGeneratedOutputsStayStandaloneUntilExplicitlyWired() {
  const firstSource: GraphNode = { id: 'child-a', type: 'TextGeneration', label: 'Probe child A', properties: {} }
  const secondSource: GraphNode = { id: 'child-b', type: 'TextGeneration', label: 'Probe child B', properties: {} }
  const unrelatedPanel: GraphNode = { id: 'empty-panel', type: 'RichMediaPanel', label: 'Rich Media Panel', properties: {} }
  const harness = createTextOutputHarness({ type: 'Graph', nodes: [firstSource, secondSource, unrelatedPanel], edges: [] })

  harness.publishers.publishTextRunOutputToRichMediaPanel({
    anchorNode: firstSource, outputText: '# Result A', title: 'Generated Result', model: 'test-model',
    outputKey: 'probe-tree-generated-result', outputGroupId: 'shared-thread', panelLabel: 'Generated Result',
  })
  harness.publishers.publishTextRunOutputToRichMediaPanel({
    anchorNode: secondSource, outputText: '# Result B', title: 'Generated Result', model: 'test-model',
    outputKey: 'probe-tree-generated-result', outputGroupId: 'shared-thread', panelLabel: 'Generated Result',
  })

  const published = harness.readGraph()
  const generatedPanels = published.nodes.filter(node => node.label === 'Generated Result')
  const anchors = generatedPanels.map(panel => String(panel.properties.workflowOutputAnchorNodeId || '')).sort()
  if (
    published.edges.length !== 0
    || generatedPanels.length !== 2
    || anchors.join(',') !== 'child-a,child-b'
    || generatedPanels.some(panel => panel.properties[WORKFLOW_OUTPUT_EDGE_MODE_PROPERTY] !== WORKFLOW_OUTPUT_EDGE_MODE_MANUAL)
    || published.nodes.find(node => node.id === 'empty-panel')?.properties.output
  ) {
    throw new Error(`expected one standalone manual output per selected child, got ${JSON.stringify(published)}`)
  }
}
