import { isStoryboardWidgetProbeTreeProviderRefinementApproved, PROBE_TREE_PROVIDER_REFINEMENT_APPROVAL_PROPERTY, readStoryboardWidgetProbeTreeInvocationText, resolveStoryboardWidgetProbeTreeInvocationTokenForNode, runStoryboardWidgetProbeTreeMcpInvocation } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowProbeTreeRun'
import { resolveStoryboardWidgetProbeTreeSelectedRunNode } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetProbeTreeRunNode'
import { buildProbeTreeInputDerivedOptions, buildProbeTreeStructuredResponse, KNOWGRPH_PROBE_TREE_TOOL_NAMES, PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION } from '@/features/agent-ready/probeTreeContract.mjs'
import type { ProbeTreeMcpBridgeSuccess } from '@/features/agent-ready/probeTreeMcpBridgeContract'
import type { GraphData, GraphNode } from '@/lib/graph/types'

const prompt = [
  '/sme-care-agent @source.frontmatter @source.body @local-harness #runtime-ready #approval-gate',
  '/knowgrph.probe-tree',
  'Assess SME cyber and ICT supply-chain risk, current coverage gaps, unresolved unknowns, and the adviser handoff.',
].join('\n')
const mcpContextText = ['Authored request:', prompt, 'Selected Widget id: n1'].join('\n')

export function testProbeTreeProviderRefinementRequiresExplicitCardApproval() {
  if (isStoryboardWidgetProbeTreeProviderRefinementApproved({})
    || isStoryboardWidgetProbeTreeProviderRefinementApproved({ [PROBE_TREE_PROVIDER_REFINEMENT_APPROVAL_PROPERTY]: false })
    || isStoryboardWidgetProbeTreeProviderRefinementApproved({ [PROBE_TREE_PROVIDER_REFINEMENT_APPROVAL_PROPERTY]: 'true' })
    || isStoryboardWidgetProbeTreeProviderRefinementApproved({ [PROBE_TREE_PROVIDER_REFINEMENT_APPROVAL_PROPERTY]: 1 })
    || !isStoryboardWidgetProbeTreeProviderRefinementApproved({ [PROBE_TREE_PROVIDER_REFINEMENT_APPROVAL_PROPERTY]: true })) {
    throw new Error('expected Probe-Tree provider refinement to remain disabled unless the card explicitly approves it')
  }
}

const makeGraph = (): GraphData => ({
  type: 'Graph',
  nodes: [
    { id: 'n1', type: 'TextGeneration', label: 'Widget Card', x: 100, y: 200, properties: { prompt } },
    { id: 'old-clarify', type: 'TextGeneration', label: 'Clarify probe: Widget Card', x: 500, y: 20, properties: { cardTypeLabel: 'Probe-Tree Card', parentNodeId: 'n1', parentGraphNodeId: 'n1' } },
    { id: 'old-generate', type: 'TextGeneration', label: 'Generate branches: Widget Card', x: 500, y: 200, properties: { cardTypeLabel: 'Probe-Tree Card', parentNodeId: 'n1', parentGraphNodeId: 'n1' } },
    { id: 'old-select', type: 'TextGeneration', label: 'Select handoff: Widget Card', x: 500, y: 380, properties: { cardTypeLabel: 'Probe-Tree Card', parentNodeId: 'n1', parentGraphNodeId: 'n1' } },
    { id: 'n2', type: 'RichMediaPanel', label: 'Probe-Tree Branches', x: 920, y: 200, properties: { workflowOutputAnchorNodeId: 'n1', workflowOutputKey: 'probe-tree-branches' } },
  ],
  edges: [
    { id: 'old-edge-1', source: 'n1', target: 'old-clarify', label: 'candidateOption', properties: {} },
    { id: 'old-edge-2', source: 'n1', target: 'old-generate', label: 'candidateOption', properties: {} },
    { id: 'old-edge-3', source: 'n1', target: 'old-select', label: 'candidateOption', properties: {} },
    { id: 'panel-edge', source: 'n1', target: 'n2', label: 'probe-tree-branches', properties: {} },
  ],
})

const mcpCallResult = (): Record<string, unknown> => ({
  isError: false,
  content: [{ type: 'text', text: 'Canvas-ready Probe-Tree response.' }],
  structuredContent: {
    contractVersion: 'knowgrph-probe-tree/v0.1',
    ok: true,
    response: buildProbeTreeStructuredResponse({
      threadRootId: 'n1',
      currentNodeId: 'n1',
      contextText: mcpContextText,
      options: buildProbeTreeInputDerivedOptions(mcpContextText),
    }),
    degraded: false,
    cost_log: { model: 'probe-tree-input-derived', prompt_tokens: 41, completion_tokens: 96, cache_hits: 0, estimated_cost_usd: 0 },
  },
})

const bridgeResult = (): ProbeTreeMcpBridgeSuccess => ({
  ok: true,
  tool: KNOWGRPH_PROBE_TREE_TOOL_NAMES.generate,
  mcpInvoked: true,
  invocationResolutions: [
    { token: '/sme-care-agent', ok: true, kind: 'command', label: 'SME Care Agent' },
    { token: '@source.frontmatter', ok: true, kind: 'binding', label: 'Source frontmatter' },
    { token: '#runtime-ready', ok: true, kind: 'semantic', label: 'Runtime ready' },
  ],
  result: mcpCallResult(),
})

const providerStructuredText = (cards: Array<Record<string, unknown>>): string => [
  '```yaml',
  JSON.stringify({
    response: {
      structuredContent: {
        contractVersion: PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION,
        widgets: [{ id: 'n1', label: 'Widget Card', kind: 'text', prompt, output: prompt, probeTreeCurrentNodeId: 'n1' }],
        cards: cards.map((card, index) => ({
          ...card,
          probeTreeCardVariant: 'probe-tree-type-2',
          selectionMode: 'multiple',
          selectionOptions: card.selectionOptions || [
            { id: `cyber-${index + 1}`, label: 'SME cyber' },
            { id: `supply-chain-${index + 1}`, label: 'ICT supply-chain risk' },
            { id: `coverage-${index + 1}`, label: 'current coverage gaps' },
          ],
          contextAnchors: card.contextAnchors || ['SME cyber', 'ICT supply-chain risk', 'current coverage gaps'],
          allowOther: true,
        })),
        panels: [{ id: 'provider-probe-tree-branches', label: 'Probe-Tree Branches', kind: 'text', output: '# Probe-Tree Branches' }],
      },
    },
  }, null, 2),
  '```',
].join('\n')

export async function testProbeTreeWidgetRunInvokesMcpAndProjectsRelevantProviderCards() {
  const graphData = makeGraph()
  let mcpRequest: Record<string, unknown> | null = null
  let providerPrompt = ''
  let published: Parameters<Parameters<typeof runStoryboardWidgetProbeTreeMcpInvocation>[0]['publishOutput']>[0] | null = null
  const result = await runStoryboardWidgetProbeTreeMcpInvocation({
    graphForRun: graphData,
    nodeIds: ['n1'],
    fallbackNode: graphData.nodes[0],
    invokeMcp: async request => {
      mcpRequest = request as unknown as Record<string, unknown>
      return bridgeResult()
    },
    generateProviderResponse: async refinementPrompt => {
      providerPrompt = refinementPrompt
      // Deliberately duplicate provider output to prove the user-owned answer field is cleared at ingestion.
      return providerStructuredText([
        { id: 'confirm-cyber-coverage', label: 'Which SME cyber coverage gaps should guide the next branch?', kind: 'text', parentNodeId: 'n1', candidateOptionId: 'confirm-cyber-coverage', question: 'Which SME cyber coverage gaps should guide the next branch?', output: 'duplicate provider text must be cleared', rationale: 'Uses the authored SME cyber scope.', evidenceNeeded: 'User selection', selectionOptions: [{ id: 'sme-cyber', label: 'SME cyber' }, { id: 'coverage-gaps', label: 'current coverage gaps' }], contextAnchors: ['SME cyber', 'current coverage gaps'], confidence: 'medium', probeTreeDepth: 1, nextAction: 'knowgrph.probe.select' },
        { id: 'map-supply-chain-risk', label: 'Which ICT supply-chain risk remains unresolved?', kind: 'text', parentNodeId: 'n1', candidateOptionId: 'map-supply-chain-risk', question: 'Which ICT supply-chain risk remains unresolved?', output: 'duplicate provider text must be cleared', rationale: 'Uses the authored ICT supply-chain scope.', evidenceNeeded: 'User selection', selectionOptions: [{ id: 'supply-chain', label: 'ICT supply-chain risk' }, { id: 'unknowns', label: 'unresolved unknowns' }], contextAnchors: ['ICT supply-chain risk', 'unresolved unknowns'], confidence: 'medium', probeTreeDepth: 1, nextAction: 'knowgrph.probe.select' },
        { id: 'connect-adviser-handoff', label: 'Which coverage gaps belong in the adviser handoff?', kind: 'text', parentNodeId: 'n1', candidateOptionId: 'connect-adviser-handoff', question: 'Which coverage gaps belong in the adviser handoff?', output: 'duplicate provider text must be cleared', rationale: 'Uses the authored coverage and adviser scope.', evidenceNeeded: 'User selection', selectionOptions: [{ id: 'coverage', label: 'current coverage gaps' }, { id: 'handoff', label: 'the adviser handoff' }], contextAnchors: ['current coverage gaps', 'the adviser handoff'], confidence: 'medium', probeTreeDepth: 1, nextAction: 'knowgrph.probe.select' },
      ])
    },
    providerModel: 'test-provider',
    onMaterialized: () => undefined,
    publishOutput: output => { published = output; return output.baseGraphData || null },
  })
  const finalGraph = result?.graphData
  const cards = (finalGraph?.nodes || []).filter(node => node.properties.probeTreeResponseMode === 'llm-contract')
  const edges = (finalGraph?.edges || []).filter(edge => edge.source === 'n1' && edge.label === 'candidateOption')
  if (
    !result?.mcpInvoked
    || !result.providerAccepted
    || result.responseSource !== 'provider'
    || !mcpRequest
    || !String(mcpRequest.contextText || '').includes('SME cyber')
    || !Array.isArray(mcpRequest.invocationTokens)
    || !['/sme-care-agent', '@source.frontmatter', '#runtime-ready', '/knowgrph.probe-tree'].every(token => (mcpRequest!.invocationTokens as string[]).includes(token))
    || !providerPrompt.includes('Literal MCP CallToolResult')
    || !providerPrompt.includes('knowgrph.probe.generate')
    || !providerPrompt.includes('set output exactly to an empty string')
    || !providerPrompt.includes('2-6 contextAnchors copied verbatim')
    || !providerPrompt.includes('Do not emit stock evidence')
    || cards.length !== 3
    || edges.length !== 3
    || cards.some(card => card.properties.output !== '' || !card.properties.summary)
    || cards.some(card => /Clarify probe|Generate branches|Select handoff/i.test(card.label))
    || (finalGraph?.nodes || []).some(node => String(node.id).startsWith('old-'))
    || published?.baseGraphData !== finalGraph
    || !published.outputText.includes('SME')
    || !published.outputText.includes('MCP: knowgrph.probe.generate invoked')
  ) {
    throw new Error(`expected MCP-first relevant provider cards to replace deterministic fallbacks, got ${JSON.stringify({ result, mcpRequest, providerPrompt, published })}`)
  }
}

export async function testProbeTreeWidgetRunRejectsUnrelatedProviderCardsAndUsesMcpResult() {
  const graphData = makeGraph()
  const result = await runStoryboardWidgetProbeTreeMcpInvocation({
    graphForRun: graphData,
    nodeIds: ['n1'],
    fallbackNode: graphData.nodes[0],
    invokeMcp: async () => bridgeResult(),
    generateProviderResponse: async () => providerStructuredText([
      { id: 'camera-lens', label: 'Choose camera lens', kind: 'text', parentNodeId: 'n1', candidateOptionId: 'camera-lens', question: 'Which cinema camera lens should frame the hero shot?', output: 'Which cinema camera lens should frame the hero shot?', rationale: 'Improves cinematic framing.', evidenceNeeded: 'Storyboard image', confidence: 'medium', probeTreeDepth: 1, nextAction: 'knowgrph.probe.select' },
      { id: 'music-tempo', label: 'Select music tempo', kind: 'text', parentNodeId: 'n1', candidateOptionId: 'music-tempo', question: 'Which music tempo should drive the edit?', output: 'Which music tempo should drive the edit?', rationale: 'Controls pacing.', evidenceNeeded: 'Audio reference', confidence: 'medium', probeTreeDepth: 1, nextAction: 'knowgrph.probe.select' },
    ]),
    providerModel: 'irrelevant-provider',
    onMaterialized: () => undefined,
    publishOutput: output => output.baseGraphData || null,
  })
  const labels = (result?.graphData.nodes || [])
    .filter(node => node.properties.probeTreeResponseMode === 'llm-contract')
    .map(node => node.label)
    .join(' ')
  const cards = (result?.graphData.nodes || []).filter(node => node.properties.probeTreeResponseMode === 'llm-contract')
  if (
    !result?.mcpInvoked
    || result.providerAccepted
    || result.responseSource !== 'mcp'
    || /camera|music/i.test(labels)
    || !/SME|cyber|supply-chain|coverage|adviser/i.test(labels)
    || cards.some(card => card.properties.output !== '' || !card.properties.summary)
  ) {
    throw new Error(`expected unrelated provider output to be rejected in favour of the literal MCP result, got ${JSON.stringify(result)}`)
  }
}

export async function testProbeTreeWidgetRunRejectsOverboundedProviderCardsAndUsesMcpResult() {
  const graphData = makeGraph()
  const result = await runStoryboardWidgetProbeTreeMcpInvocation({
    graphForRun: graphData,
    nodeIds: ['n1'],
    fallbackNode: graphData.nodes[0],
    invokeMcp: async () => bridgeResult(),
    generateProviderResponse: async () => providerStructuredText(Array.from({ length: 5 }, (_, index) => ({
      id: `provider-card-${index + 1}`,
      label: `Assess SME cyber evidence ${index + 1}`,
      kind: 'text',
      parentNodeId: 'n1',
      candidateOptionId: `provider-card-${index + 1}`,
      question: `Which SME cyber coverage source confirms supply-chain risk ${index + 1}?`,
      output: `Which SME cyber coverage source confirms supply-chain risk ${index + 1}?`,
      rationale: 'Keeps the SME cyber finding source-backed.',
      evidenceNeeded: 'Current coverage and supply-chain evidence',
      confidence: 'medium',
      probeTreeDepth: 1,
      nextAction: 'knowgrph.probe.select',
    }))),
    providerModel: 'overbounded-provider',
    onMaterialized: () => undefined,
    publishOutput: output => output.baseGraphData || null,
  })
  const cards = (result?.graphData.nodes || []).filter(node => node.properties.probeTreeResponseMode === 'llm-contract')
  if (
    !result?.mcpInvoked
    || result.providerAccepted
    || result.responseSource !== 'mcp'
    || cards.length !== 3
    || cards.some(card => card.properties.output !== '' || !card.properties.summary)
    || cards.some(card => /^Assess SME cyber evidence/i.test(card.label))
  ) {
    throw new Error(`expected a five-card provider envelope to be rejected in favour of the bounded MCP result, got ${JSON.stringify(result)}`)
  }
}

export async function testProbeTreeWidgetRunIncludesUserOutputInMcpAndProviderContext() {
  const userAnswer = 'Require current policy, regulator, and licensed-adviser evidence for Singapore and Malaysia cyber and supply-chain coverage gaps.'
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [
      {
        id: 'probe-root',
        type: 'TextGeneration',
        label: 'SME risk review',
        properties: {
          summary: '/knowgrph.probe-tree Assess SME cyber and supply-chain coverage.',
          probeTreeDepth: 0,
        },
      },
      {
        id: 'probe-answer',
        type: 'TextGeneration',
        label: 'Which cyber schedule is authoritative?',
        properties: {
          cardTypeLabel: 'Probe-Tree Card',
          summary: 'Which cyber schedule is authoritative?',
          output: userAnswer,
          action: 'Use the answer to generate the next bounded branch.',
          parentNodeId: 'probe-root',
          probeTreeResponseMode: 'llm-contract',
          probeTreeDepth: 3,
        },
      },
    ],
    edges: [{ id: 'probe-root-answer', source: 'probe-root', target: 'probe-answer', label: 'candidateOption', properties: {} }],
  }
  let mcpRequest: Record<string, unknown> | null = null
  let providerPrompt = ''
  const result = await runStoryboardWidgetProbeTreeMcpInvocation({
    graphForRun: graphData,
    nodeIds: ['probe-root', 'probe-answer'],
    fallbackNode: graphData.nodes[1],
    invokeMcp: async request => {
      mcpRequest = request as unknown as Record<string, unknown>
      throw new Error('exercise bounded local fallback')
    },
    generateProviderResponse: async promptText => {
      providerPrompt = promptText
      return null
    },
    onMaterialized: () => undefined,
    publishOutput: output => output.baseGraphData || null,
  })
  const childCards = (result?.graphData.nodes || []).filter(node => node.properties.parentNodeId === 'probe-answer')
  const childCardContent = JSON.stringify(childCards.map(card => ({
    label: card.label,
    options: card.properties.selectionOptions,
    anchors: card.properties.probeTreeUserInputAnchors,
  }))).toLowerCase().replace(/-/g, ' ')
  const expectedOutputTopics = ['singapore', 'malaysia', 'cyber', 'supply chain', 'coverage', 'gaps']
  if (
    !result
    || !String(mcpRequest?.contextText || '').includes(userAnswer)
    || !String(mcpRequest?.contextText || '').startsWith(`Authored request:\n${userAnswer}`)
    || mcpRequest?.threadRootId !== 'probe-root'
    || mcpRequest?.currentNodeId !== 'probe-answer'
    || mcpRequest?.probeTreeDepth !== 4
    || mcpRequest?.recallTopK !== 0
    || !providerPrompt.includes(userAnswer)
    || !providerPrompt.includes('set every probeTreeDepth to 4')
    || childCards.length < 2
    || childCards.some(card => card.properties.parentNodeId !== 'probe-answer')
    || childCards.some(card => card.properties.probeTreeThreadRootId !== 'probe-root')
    || childCards.some(card => card.properties.probeTreeDepth !== 4)
    || expectedOutputTopics.some(topic => !childCardContent.includes(topic))
    || childCards.some(card => !Array.isArray(card.properties.selectionOptions) || card.properties.selectionOptions.length < 2)
    || childCards.some(card => !Array.isArray(card.properties.probeTreeUserInputAnchors) || card.properties.probeTreeUserInputAnchors.length < 2)
    || /current primary source for|verified system-of-record fact for/i.test(childCardContent)
  ) {
    throw new Error(`expected Output -> Run to preserve thread root, increment depth, and materialize child branches, got ${JSON.stringify({ result, mcpRequest, providerPrompt })}`)
  }
}

export function testProbeTreeContinuationMetadataRoutesWithoutVisibleSlashToken() {
  const node: GraphNode = {
    id: 'probe-answer',
    type: 'TextGeneration',
    label: 'Which cyber schedule is authoritative?',
    properties: {
      summary: 'Which cyber schedule is authoritative?',
      output: 'The endorsed schedule is authoritative.',
      parentNodeId: 'probe-root',
      cardTypeLabel: 'Probe-Tree Card',
    },
  }
  const invocationText = readStoryboardWidgetProbeTreeInvocationText(node)
  if (invocationText.includes('/knowgrph.probe-tree') || resolveStoryboardWidgetProbeTreeInvocationTokenForNode(node, invocationText) !== '/knowgrph.probe-tree') {
    throw new Error(`expected generated Probe-Tree metadata to route continuation without exposing a slash token, got ${invocationText}`)
  }
}

export async function testProbeTreeSelectedChildOwnsContinuationOverRootAlias() {
  const userAnswer = 'Compare selected Singapore cyber exclusions across policy wording, endorsed schedule, adviser review, and coverage gap.'
  const typedCell = (key: string, type: string, value: unknown) => ({ key, type, value })
  const rootNode: GraphNode = {
    id: 'probe-root',
    type: 'TextGeneration',
    label: 'SME risk review',
    properties: { summary: '/knowgrph.probe-tree Assess the root SME risk scope.' },
  }
  const selectedChild: GraphNode = {
    id: typedCell('id', 'string', 'probe-child') as unknown as string,
    type: typedCell('type', 'string', 'TextGeneration') as unknown as string,
    label: typedCell('label', 'string', 'Which Singapore cyber exclusions remain?') as unknown as string,
    x: 520,
    y: 180,
    properties: typedCell('properties', 'object', {
      cardTypeLabel: 'Probe-Tree Card',
      probeTreeResponseMode: 'llm-contract',
      probeTreeThreadRootId: 'probe-root',
      probeTreeDepth: 2,
      parentNodeId: 'probe-root',
      summary: 'Which Singapore cyber exclusions remain?',
      output: userAnswer,
    }) as unknown as GraphNode['properties'],
  }
  const staleChildAlias: GraphNode = {
    id: 'probe-child',
    type: 'TextGeneration',
    label: 'Root writeback alias',
    properties: {
      summary: 'Root alias should not own the continuation.',
      output: 'stale alias output',
    },
  }
  const selectedRunNode = resolveStoryboardWidgetProbeTreeSelectedRunNode({
    requestedNodeId: 'probe-child',
    fallbackNode: staleChildAlias,
    candidates: [staleChildAlias, selectedChild],
  })
  const rootAliasGraph: GraphData = { type: 'Graph', nodes: [rootNode, staleChildAlias], edges: [] }
  let mcpRequest: Record<string, unknown> | null = null
  let providerPrompt = ''
  const result = await runStoryboardWidgetProbeTreeMcpInvocation({
    graphForRun: rootAliasGraph,
    nodeIds: ['probe-root', 'probe-child'],
    fallbackNode: selectedRunNode,
    invokeMcp: async request => {
      mcpRequest = request as unknown as Record<string, unknown>
      throw new Error('exercise selected-child fallback')
    },
    generateProviderResponse: async promptText => {
      providerPrompt = promptText
      return null
    },
    onMaterialized: () => undefined,
    publishOutput: output => output.baseGraphData || null,
  })
  const nodes = result?.graphData.nodes || []
  const continuationCards = nodes.filter(node => node.properties.parentNodeId === 'probe-child')
  if (
    mcpRequest?.currentNodeId !== 'probe-child'
    || mcpRequest?.threadRootId !== 'probe-root'
    || mcpRequest?.recallTopK !== 0
    || !String(mcpRequest?.contextText || '').startsWith(`Authored request:\n${userAnswer}`)
    || !String(mcpRequest?.contextText || '').includes('Selected continuation question: Which Singapore cyber exclusions remain?')
    || !String(mcpRequest?.contextText || '').includes(`Selected continuation answer: ${userAnswer}`)
    || !providerPrompt.includes('selected child card and its user-authored output own the next topic')
    || !nodes.some(node => String(node.id) === 'probe-child')
    || continuationCards.length < 2
    || continuationCards.some(node => node.properties.probeTreeDepth !== 3)
  ) {
    throw new Error(`expected selected child to own continuation while root remains lineage only, got ${JSON.stringify({ mcpRequest, providerPrompt, nodes })}`)
  }
}

export async function testProbeTreeWidgetRunStopsBeforeMcpAtDepthLimit() {
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [{
      id: 'probe-depth-eight',
      type: 'TextGeneration',
      label: 'Depth-limited Probe-Tree Card',
      properties: {
        cardTypeLabel: 'Probe-Tree Card',
        prompt: '/knowgrph.probe-tree',
        summary: 'What remains unresolved?',
        output: 'The final bounded answer.',
        probeTreeDepth: 8,
        probeTreeThreadRootId: 'probe-root',
      },
    }],
    edges: [],
  }
  let mcpCalls = 0
  let providerCalls = 0
  const result = await runStoryboardWidgetProbeTreeMcpInvocation({
    graphForRun: graphData,
    nodeIds: ['probe-depth-eight'],
    fallbackNode: graphData.nodes[0],
    invokeMcp: async () => { mcpCalls += 1; return bridgeResult() },
    generateProviderResponse: async () => { providerCalls += 1; return null },
    onMaterialized: () => undefined,
    publishOutput: output => output.baseGraphData || null,
  })
  if (result?.kind !== 'warning' || !result.message.includes('8-branch depth limit') || mcpCalls !== 0 || providerCalls !== 0 || result.materializedNodeIds.length !== 0) {
    throw new Error(`expected depth 8 to stop visibly before MCP/provider spend, got ${JSON.stringify({ result, mcpCalls, providerCalls })}`)
  }
}
