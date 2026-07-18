import { finalizeEdgeAuthoring } from '@/features/edge-creation/authoring'
import { createStoryboardWidgetWorkflowRichMediaPublishers } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowRichMediaPublication'
import { resolveStoryboardWidgetWorkflowDownstreamRunTargetIds } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowDownstreamRunTargets'
import {
  WORKFLOW_OUTPUT_EDGE_MODE_MANUAL,
  WORKFLOW_OUTPUT_EDGE_MODE_PROPERTY,
} from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowRichMediaPanel'
import type { GraphData, GraphNode } from '@/lib/graph/types'

function createTextOutputHarness(
  initialGraph: GraphData,
  storeGraph: GraphData = initialGraph,
  allowCreateRichMediaPanel = true,
  options: { commitPublishedGraphData?: boolean } = {},
) {
  let draft = initialGraph
  const resolveNode = (nodeId: string) => draft.nodes.find(node => String(node.id) === nodeId)
    || storeGraph.nodes.find(node => String(node.id) === nodeId)
    || null
  const publishers = createStoryboardWidgetWorkflowRichMediaPublishers({
    context: {
      draftGraph: initialGraph,
      renderGraph: initialGraph,
      baseGraph: initialGraph,
      storeGraph,
      draftNodes: initialGraph.nodes,
      renderNodes: initialGraph.nodes,
      baseNodes: initialGraph.nodes,
      storeNodes: storeGraph.nodes,
      draftNodeById: new Map(initialGraph.nodes.map(node => [String(node.id), node])),
      renderNodeById: new Map(initialGraph.nodes.map(node => [String(node.id), node])),
      baseNodeById: new Map(initialGraph.nodes.map(node => [String(node.id), node])),
      storeNodeById: new Map(storeGraph.nodes.map(node => [String(node.id), node])),
    } as never,
    graphForRun: initialGraph,
    allowCreateRichMediaPanel,
    withRunLayoutMutationGuard: run => run(),
    scheduleWorkflowOutputEdgeRefresh: () => undefined,
    readLiveDraftGraphData: () => draft,
    appendDraftNode: () => { throw new Error('text publication must use its atomic transaction') },
    commitDraftGraphDataUpdate: (_current, next) => { draft = next },
    ...(options.commitPublishedGraphData === false ? {} : { commitPublishedGraphData: (next: GraphData) => { draft = next } }),
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

export function testSelectedChildRunRestoresExplicitTargetFromCanonicalGraph() {
  const root: GraphNode = { id: 'n1', type: 'TextGeneration', label: 'Root', properties: {} }
  const selectedChild: GraphNode = {
    id: 'mcp-response-n1-qa1',
    type: 'TextGeneration',
    label: 'Selected Probe child',
    properties: { parentNodeId: 'n1', probeTreeThreadRootId: 'n1', cardTypeLabel: 'Probe-Tree Card' },
  }
  const generatedPanel: GraphNode = {
    id: 'generated-result',
    type: 'RichMediaPanel',
    label: 'Generated Result',
    properties: {
      workflowOutputAnchorNodeId: 'n1',
      workflowOutputKey: 'probe-tree-branches',
      workflowOutputGroupId: 'probe-tree:n1',
      [WORKFLOW_OUTPUT_EDGE_MODE_PROPERTY]: WORKFLOW_OUTPUT_EDGE_MODE_MANUAL,
    },
  }
  const systemPanel: GraphNode = {
    id: 'system-result',
    type: 'RichMediaPanel',
    label: 'System result',
    properties: { workflowOutputAnchorNodeId: 'mcp-response-n1-qa1', workflowOutputKey: 'probe-tree-generated-result' },
  }
  const runGraph: GraphData = {
    type: 'Graph',
    nodes: [root, selectedChild],
    edges: [{ id: 'candidate', source: 'n1', target: 'mcp-response-n1-qa1', label: 'candidateOption', properties: {} }],
  }
  const canonicalGraph: GraphData = {
    ...runGraph,
    nodes: [...runGraph.nodes, generatedPanel, systemPanel],
    edges: [
      ...runGraph.edges,
      { id: 'explicit-output', source: 'mcp-response-n1-qa1', target: 'generated-result', label: 'output', properties: {} },
      {
        id: 'system-output',
        source: 'mcp-response-n1-qa1',
        target: 'system-result',
        label: 'probe-tree-generated-result',
        properties: { value: { workflowOutputEdge: true } } as never,
      },
    ],
  }
  const harness = createTextOutputHarness(runGraph, canonicalGraph)

  harness.publishers.publishTextRunOutputToRichMediaPanel({
    anchorNode: selectedChild,
    baseGraphData: runGraph,
    outputText: '# Generated result\n\nOwned by the selected child.',
    title: 'Generated Result',
    model: 'test-model',
    outputKey: 'probe-tree-generated-result',
    outputGroupId: 'probe-tree:n1',
    panelProperties: { probeTreeTerminalGeneration: true },
  })

  const published = harness.readGraph()
  const panel = published.nodes.find(node => node.id === 'generated-result')
  const explicitEdge = published.edges.find(edge => edge.id === 'explicit-output')
  if (
    published.nodes.length !== 3
    || published.edges.length !== 2
    || explicitEdge?.source !== 'mcp-response-n1-qa1'
    || explicitEdge?.target !== 'generated-result'
    || panel?.properties.output !== '# Generated result\n\nOwned by the selected child.'
    || panel?.properties.workflowOutputAnchorNodeId
    || panel?.properties.workflowOutputKey
    || panel?.properties[WORKFLOW_OUTPUT_EDGE_MODE_PROPERTY]
  ) {
    throw new Error(`expected Run to restore only the selected child's explicit target edge, got ${JSON.stringify(published)}`)
  }
}

export function testSelectedGenerationCreatesStandaloneResultDuringRunAll() {
  const selectedChild: GraphNode = {
    id: 'mcp-response-n1-qa1',
    type: 'TextGeneration',
    label: 'Selected Probe child',
    properties: { parentNodeId: 'n1', probeTreeThreadRootId: 'n1', cardTypeLabel: 'Probe-Tree Card' },
  }
  const graph: GraphData = { type: 'Graph', nodes: [selectedChild], edges: [] }
  const harness = createTextOutputHarness(graph, graph, false)

  const published = harness.publishers.publishTextRunOutputToRichMediaPanel({
    anchorNode: selectedChild,
    baseGraphData: graph,
    outputText: '# Generated result\n\nStandalone until the user wires it.',
    title: 'Generated Result',
    model: 'test-model',
    outputKey: 'probe-tree-generated-result',
    outputGroupId: 'probe-tree:n1',
    panelLabel: 'Generated Result',
    panelProperties: { probeTreeTerminalGeneration: true },
    allowCreateStandaloneOutput: true,
  })

  const resultPanel = published?.nodes.find(node => node.label === 'Generated Result')
  if (
    !published
    || published.nodes.length !== 2
    || published.edges.length !== 0
    || resultPanel?.properties.output !== '# Generated result\n\nStandalone until the user wires it.'
    || resultPanel?.properties.workflowOutputAnchorNodeId !== 'mcp-response-n1-qa1'
    || resultPanel?.properties.workflowOutputKey !== 'probe-tree-generated-result'
    || resultPanel?.properties[WORKFLOW_OUTPUT_EDGE_MODE_PROPERTY] !== WORKFLOW_OUTPUT_EDGE_MODE_MANUAL
  ) {
    throw new Error(`expected Run All terminal generation to publish one standalone manual result, got ${JSON.stringify(published)}`)
  }
}

export function testRunAllReconcilesTypedPersistedStandaloneResult() {
  const selectedChild: GraphNode = {
    id: 'mcp-response-card-01',
    type: 'TextGeneration',
    label: 'Selected Probe child',
    properties: { parentNodeId: 'n2', probeTreeThreadRootId: 'n2', cardTypeLabel: 'Probe-Tree Card' },
  }
  const persistedResult: GraphNode = {
    id: 'persisted-generated-result',
    type: 'RichMediaPanel',
    label: 'Generated Result',
    properties: {
      key: 'properties',
      type: 'object',
      value: {
        media_interactive: true,
        output: '# Previous generated result',
        workflowOutputAnchorNodeId: 'mcp-response-card-01',
        workflowOutputKey: 'probe-tree-generated-result',
        workflowOutputGroupId: 'probe-tree:n2',
        [WORKFLOW_OUTPUT_EDGE_MODE_PROPERTY]: WORKFLOW_OUTPUT_EDGE_MODE_MANUAL,
      },
    } as never,
  }
  const runGraph: GraphData = { type: 'Graph', nodes: [selectedChild], edges: [] }
  const canonicalGraph: GraphData = { type: 'Graph', nodes: [selectedChild, persistedResult], edges: [] }
  const harness = createTextOutputHarness(runGraph, canonicalGraph, false, { commitPublishedGraphData: false })

  const published = harness.publishers.publishTextRunOutputToRichMediaPanel({
    anchorNode: selectedChild,
    baseGraphData: runGraph,
    outputText: '# Refreshed generated result',
    title: 'Generated Result',
    model: 'test-model',
    outputKey: 'probe-tree-generated-result',
    outputGroupId: 'probe-tree:n2',
    panelLabel: 'Generated Result',
    panelProperties: { probeTreeTerminalGeneration: true },
    allowCreateStandaloneOutput: true,
  })

  const resultPanels = published?.nodes.filter(node => node.label === 'Generated Result') || []
  const resultProperties = resultPanels[0]?.properties as unknown as {
    key?: unknown
    type?: unknown
    value?: Record<string, unknown>
  }
  if (
    !published
    || published.nodes.length !== 2
    || published.edges.length !== 0
    || resultPanels.length !== 1
    || resultPanels[0]?.id !== 'persisted-generated-result'
    || resultProperties.key !== 'properties'
    || resultProperties.type !== 'object'
    || resultProperties.value?.output !== '# Refreshed generated result'
    || resultProperties.value?.workflowOutputAnchorNodeId !== 'mcp-response-card-01'
  ) {
    throw new Error(`expected Run All to atomically reuse the typed persisted standalone result, got ${JSON.stringify(published)}`)
  }
}
