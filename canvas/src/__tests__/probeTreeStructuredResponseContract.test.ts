import { buildProbeTreeCardFromGraphNode } from '@/components/StoryboardCanvas/storyboardProbeTreeInvocationAction'
import { materializeStoryboardWidgetProbeTreeStructuredResponse } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetProbeTreeStructuredResponse'
import {
  buildProbeTreeStructuredResponse,
  areProbeTreeContinuationChoicesSuggested,
  areProbeTreeCardsMutuallyDistinct,
  collectProbeTreeContextKeywords,
  extractProbeTreeUserInputText,
  isProbeTreeCardUserInputRelevant,
  PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION,
} from '@/features/agent-ready/probeTreeContract.mjs'
import { KNOWGRPH_PROBE_TREE_INVOCATION_TOKENS } from '@/features/agentic-os/probeTreePromptPreset'
import { extractChatResponseStructuredSurface } from '@/features/chat/chatResponseStructuredContent'
import { buildAgenticOsRuntimeInvocationSystemPrompt } from '@/features/chat/chatRuntimeInvocationProfile'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID, FLOW_TEXT_GENERATION_NODE_TYPE_ID } from '@/lib/config.storyboard-widget'
import type { GraphData, GraphNode } from '@/lib/graph/types'

export function testProbeTreeLlmResponseContractProjectsEditableBranches() {
  const prompt = buildAgenticOsRuntimeInvocationSystemPrompt(
    'knowgrph.probe.generate Identify the next evidence question for the selected SME care-agent card.',
  )
  for (const expected of [
    PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION,
    '2-4 concrete, context-specific next questions',
    'evidenceNeeded',
    'probeTreeCardVariant: probe-tree-type-2',
    '2-4 selectionOptions',
    'allowOther: true',
    'parentNodeId as the lineage SSOT',
    'local no-model MCP path never synthesizes clarification cards or restates the source query',
    'configured chat LLM',
    'Never copy or paraphrase the active request as a card question',
    'named entities and alternatives already supplied by the user',
    'different request-specific decision variable',
    'reused choice labels',
    'suggested clarification answer',
    'selected child card and its committed multi-selection own the next topic',
    'contextAnchors',
    'knowgrph.agentic_canvas_os.docs.invoke',
    'result.structuredContent.response.structuredContent',
    'card renders it as Summary',
    'leave output empty for the user-owned selection',
    'Reject every canned wrapper',
    'pairwise relationship questions',
    'imperative generation request',
    'do not continue Probe-Tree',
  ]) {
    if (!prompt.includes(expected)) {
      throw new Error(`expected Probe-Tree LLM prompt to include ${expected}, got ${prompt}`)
    }
  }
  if (prompt.includes('at most one clarification card')) {
    throw new Error(`expected the 2-4-card contract to avoid contradictory one-card guidance, got ${prompt}`)
  }
  for (const token of KNOWGRPH_PROBE_TREE_INVOCATION_TOKENS) {
    const aliasPrompt = buildAgenticOsRuntimeInvocationSystemPrompt(`${token} Generate the next evidence branches.`)
    if (!aliasPrompt.includes(PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION) || !aliasPrompt.includes('knowgrph.probe.generate once')) {
      throw new Error(`expected ${token} to activate the shared Probe-Tree MCP response contract, got ${aliasPrompt}`)
    }
  }

  const question = 'Which member risk tier or care-plan handoff should guide the next branch?'
  const surface = extractChatResponseStructuredSurface([
    '```yaml',
    'response:',
    '  structuredContent:',
    `    contractVersion: ${PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION}`,
    '    cards:',
    '      - id: source-authority',
    '        label: Verify source authority',
    '        kind: text',
    '        parentNodeId: care_source',
    '        candidateOptionId: verify-source-authority',
    `        question: "${question}"`,
    '        output: ""',
    '        probeTreeCardVariant: probe-tree-type-2',
    '        selectionMode: multiple',
    '        selectionOptions:',
    '          - id: risk-tier',
    '            label: member risk tier',
    '          - id: care-plan-handoff',
    '            label: care-plan handoff',
    '        contextAnchors:',
    '          - member risk tier',
    '          - care-plan handoff',
    '        allowOther: true',
    '        rationale: Keeps the next branch within the authored care priorities.',
    '        evidenceNeeded: User selection among the authored priorities',
    '        confidence: medium',
    '        probeTreeDepth: 2',
    '        nextAction: knowgrph.probe.select',
    '```',
  ].join('\n'))

  const node = surface?.nodes[0]
  if (!node) throw new Error(`expected one projected Probe-Tree card, got ${JSON.stringify(surface)}`)
  const expectedProperties = {
    'chat:structuredRole': 'card',
    cardTypeLabel: 'Probe-Tree Card',
    lane: 'PROBE',
    summary: question,
    output: '',
    responseContractVersion: PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION,
    probeTreeResponseMode: 'llm-contract',
    parentNodeId: 'care_source',
    probeTreeCandidateKey: 'verify-source-authority',
    evidenceNeeded: 'User selection among the authored priorities',
    confidence: 'medium',
    nextAction: 'knowgrph.probe.select',
    probeTreeCardVariant: 'probe-tree-type-2',
    selectionMode: 'multiple',
    allowOther: true,
  } as const
  for (const [key, expected] of Object.entries(expectedProperties)) {
    if (node.properties[key] !== expected) {
      throw new Error(`expected projected Probe-Tree property ${key}=${expected}, got ${JSON.stringify(node.properties)}`)
    }
  }
  if (
    JSON.stringify(node.properties.contextAnchors) !== JSON.stringify(['member risk tier', 'care-plan handoff'])
    || JSON.stringify(node.properties.probeTreeUserInputAnchors) !== JSON.stringify(['member risk tier', 'care-plan handoff'])
    || node.nodeTypeId !== FLOW_TEXT_GENERATION_NODE_TYPE_ID
    || node.targetHandle !== 'prompt_in'
    || !String(node.properties.prompt || '').startsWith('/knowgrph.probe-tree')
  ) {
    throw new Error(`expected an editable TextGeneration Probe-Tree card, got ${JSON.stringify(node)}`)
  }

  const candidateEdge = surface?.edges.find(edge => (
    edge.source === 'care_source'
    && edge.target === node.id
    && edge.label === 'candidateOption'
    && edge.targetHandle === 'prompt_in'
  ))
  if (!candidateEdge) {
    throw new Error(`expected parentNodeId to infer one candidateOption edge, got ${JSON.stringify(surface?.edges || [])}`)
  }

  const card = buildProbeTreeCardFromGraphNode({
    id: node.id,
    label: node.label,
    type: node.nodeTypeId,
    properties: node.properties,
  } as GraphNode)
  if (
    card.typeLabel !== 'Probe-Tree Card'
    || card.lane !== 'PROBE'
    || card.summary !== question
    || card.output !== ''
    || !card.action.includes('User selection')
  ) {
    throw new Error(`expected structured output to render as a visible Probe-Tree card, got ${JSON.stringify(card)}`)
  }
}

export function testProbeTreeMcpResponseAdapterBoundsWidgetCardsAndPanel() {
  const contextText = 'Authored request: Prioritize care evidence across member risk tier, CRM authority, claims freshness, care-plan handoff, consent status, escalation owner, review deadline, and approval state. Selected Widget id: care-source'
  const optionSets = [
    ['member risk tier', 'CRM authority'],
    ['member risk tier', 'CRM authority'],
    ['claims freshness', 'care-plan handoff'],
    ['consent status', 'escalation owner'],
    ['review deadline', 'approval state'],
  ]
  const response = buildProbeTreeStructuredResponse({
    threadRootId: 'care-agent',
    currentNodeId: 'care-source',
    contextText,
    optionCount: 9,
    probeTreeDepth: 99,
    options: optionSets.map((selectionOptions, index) => ({
      id: `care-option-${index + 1}`,
      text: `Which ${selectionOptions[0]} and ${selectionOptions[1]} priority should care evidence use?`,
      rationale: `Keeps branch ${index + 1} source-backed.`,
      evidenceNeeded: 'User selection among the authored care evidence priorities.',
      selectionOptions,
      contextAnchors: selectionOptions,
    })),
  })
  const structured = response.structuredContent
  if (
    structured.contractVersion !== PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION
    || structured.widgets.length !== 1
    || structured.cards.length !== 4
    || structured.panels.length !== 1
    || structured.cards.some(card => card.parentNodeId !== 'care-source' || card.probeTreeDepth !== 8)
    || structured.cards.some(card => card.output !== '' || !card.question)
    || structured.cards.some(card => card.probeTreeCardVariant !== 'probe-tree-type-2' || card.selectionMode !== 'multiple' || card.allowOther !== true)
    || structured.cards.some(card => !Array.isArray(card.selectionOptions) || card.selectionOptions.length < 2 || card.selectionOptions.length > 4)
  ) {
    throw new Error(`expected the shared MCP adapter to emit one Widget, four bounded cards, and one panel, got ${JSON.stringify(response)}`)
  }

  const surface = extractChatResponseStructuredSurface(JSON.stringify({
    jsonrpc: '2.0',
    id: 'probe-tree-call',
    result: { structuredContent: { ok: true, response } },
  }, null, 2))
  const source = surface?.nodes.find(node => node.id === 'mcp-response-care-source')
  const panel = surface?.nodes.find(node => node.id === 'mcp-response-probe-tree-branches-care-source')
  const cards = surface?.nodes.filter(node => node.properties.cardTypeLabel === 'Probe-Tree Card') || []
  const candidateEdges = surface?.edges.filter(edge => edge.label === 'candidateOption') || []
  if (
    source?.nodeTypeId !== FLOW_TEXT_GENERATION_NODE_TYPE_ID
    || panel?.nodeTypeId !== FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
    || cards.length !== 4
    || cards.map(card => card.properties.index).join(',') !== 'P1,P2,P3,P4'
    || cards.some(card => card.properties.output !== '' || !card.properties.summary)
    || cards.some(card => card.properties.probeTreeCardVariant !== 'probe-tree-type-2' || card.properties.selectionMode !== 'multiple' || card.properties.allowOther !== true)
    || cards.some(card => !Array.isArray(card.properties.selectionOptions) || card.properties.selectionOptions.length < 2)
    || candidateEdges.length !== 4
    || candidateEdges.some(edge => edge.source !== source.id || !cards.some(card => card.id === edge.target))
  ) {
    throw new Error(`expected literal MCP structured response to project a visible Widget/Card/Panel tree, got ${JSON.stringify(surface)}`)
  }
}

export function testProbeTreeCrossCardDiversityRejectsRepeatedAndSubsetChoiceSets() {
  const distinctCards = [
    { question: 'Which member risk tier needs follow-up?', selectionOptions: ['member risk', 'risk tier'] },
    { question: 'Which claims freshness needs follow-up?', selectionOptions: ['claims', 'freshness'] },
  ]
  const repeatedQuestionCards = [
    distinctCards[0],
    { question: distinctCards[0].question, selectionOptions: ['care plan', 'handoff'] },
  ]
  const subsetChoiceCards = [
    { question: 'Which care priorities need follow-up?', selectionOptions: ['member risk tier', 'CRM authority', 'claims freshness'] },
    { question: 'Which care authority needs follow-up?', selectionOptions: ['member risk tier', 'CRM authority'] },
  ]
  const overlappingChoiceCards = [
    { question: 'Which risk tier needs follow-up?', selectionOptions: ['member risk tier', 'CRM authority'] },
    { question: 'Which handoff needs follow-up?', selectionOptions: ['member risk tier', 'care-plan handoff'] },
  ]
  if (
    !areProbeTreeCardsMutuallyDistinct(distinctCards)
    || areProbeTreeCardsMutuallyDistinct(repeatedQuestionCards)
    || areProbeTreeCardsMutuallyDistinct(subsetChoiceCards)
    || areProbeTreeCardsMutuallyDistinct(overlappingChoiceCards)
  ) {
    throw new Error('expected Probe-Tree batch diversity to reject repeated questions and reused choice labels')
  }
}

export function testProbeTreeNoModelCardsFailClosed() {
  const anchorNode: GraphNode = {
    id: { key: 'id', type: 'string', value: 'sme-source' },
    type: { key: 'type', type: 'string', value: 'TextGeneration' },
    label: { key: 'label', type: 'string', value: 'SME coverage review' },
    properties: {},
  } as unknown as GraphNode
  const graphData: GraphData = { type: 'Graph', nodes: [anchorNode], edges: [] }
  const contextText = ['Authored request:', '/knowgrph.probe-tree invest in China, India, SE Asia?', 'Selected Widget id: sme-source'].join('\n')
  const result = materializeStoryboardWidgetProbeTreeStructuredResponse({
    graphData,
    anchorNode,
    responseText: 'unstructured upstream output',
    contextText,
    responseSource: 'mcp',
    model: 'none',
    mcpInvoked: false,
    invocationTokens: ['/knowgrph.probe-tree'],
  })
  if (result !== null) {
    throw new Error(`expected the no-model path to fail closed without generic or hardcoded cards, got ${JSON.stringify(result)}`)
  }
}

export function testProbeTreeRestatedSourceQueryIsRejected() {
  const authoredRequest = '/knowgrph.probe-tree recommend invest in India, China, or SE Asia'
  const contextText = ['Authored request:', authoredRequest, 'Selected Widget id: investment-root'].join('\n')
  const restatedQuestionAccepted = isProbeTreeCardUserInputRelevant({
    contextText,
    question: 'recommend invest in India, China, or SE Asia',
    selectionOptions: ['India', 'China', 'SE Asia'],
    contextAnchors: ['India', 'China', 'SE Asia'],
  })
  const entityListParaphraseAccepted = isProbeTreeCardUserInputRelevant({
    contextText,
    question: 'Which of India, China, or SE Asia should the user invest in?',
    selectionOptions: ['India', 'China', 'SE Asia'],
    contextAnchors: ['India', 'China', 'SE Asia'],
  })
  const querySpecificQuestionAccepted = isProbeTreeCardUserInputRelevant({
    contextText,
    question: 'Which investment objective should drive the India, China, or SE Asia recommendation?',
    selectionOptions: ['Long-term capital growth', 'Recurring income yield', 'Strategic market access'],
    contextAnchors: ['India', 'China', 'SE Asia'],
  })
  if (
    restatedQuestionAccepted
    || entityListParaphraseAccepted
    || !querySpecificQuestionAccepted
  ) {
    throw new Error(`expected source-query echoes to fail while a new investment decision variable passes, got ${JSON.stringify({ restatedQuestionAccepted, entityListParaphraseAccepted, querySpecificQuestionAccepted })}`)
  }
}

export function testProbeTreeContextKeywordsIgnoreInvocationMetadataCompounds() {
  const contextText = [
    'Authored request:',
    '/sme-care-agent @source.frontmatter @local-harness @cost-log @runtime-proof #token-economics #runtime-ready #approval-gate',
    '/knowgrph.probe-tree',
    'Generate 2-4 bounded editable next-question cards. Keep the source card unchanged, connect each candidate branch, and publish a separate Rich Media Panel.',
    'Run the zero-cost local fallback before generic provider generation; do not make a provider call unless separately approved.',
    'Assess the active SME workspace sources across cyber, supply-chain, physical-asset, growth-stage exposure, coverage gaps, and adviser handoff.',
    'Selected Widget title: Widget Card',
    'Selected Widget id: n1',
    'Invocation route: /knowgrph.probe-tree — Probe-Tree. Route summary: Generate bounded branches at depth 8.',
    'Agentic OS directives: @source.frontmatter — Source frontmatter | #runtime-ready — Runtime ready',
  ].join('\n')
  const keywords = collectProbeTreeContextKeywords(contextText, 8)
  const forbiddenMetadata = ['local-harness', 'cost-log', 'runtime-proof', 'token-economics', 'runtime-ready', 'approval-gate', 'probe-tree']
  const continuationContext = [
    'Authored request:',
    'Compare regulatory changes across Indonesia, Singapore, and Malaysia.',
    'Selected continuation question:',
    'Which requested items should guide the next branch: provider-neutral protection guidance, evidence-needed fields, rationale, a review-ready licensed-adviser handoff?',
    'Selected continuation answer:',
    '1. provider-neutral protection guidance',
    '4. a review-ready licensed-adviser handoff',
    'Other: evidence confidence and urgency',
  ].join('\n')
  const continuationInput = extractProbeTreeUserInputText(continuationContext)
  const continuationKeywords = collectProbeTreeContextKeywords(continuationInput, 12)
  const questionOnlyContinuationContext = [
    'Selected continuation question:',
    'Which requested items should guide the next branch: coverage authority, claims freshness, adviser handoff?',
  ].join('\n')
  const questionOnlyContinuationInput = extractProbeTreeUserInputText(questionOnlyContinuationContext)
  const investmentChoiceContext = ['Authored request:', '/knowgrph.probe-tree invest in China, India, SE Asia?'].join('\n')
  const relationshipWrapperAccepted = isProbeTreeCardUserInputRelevant({
    contextText: investmentChoiceContext,
    question: 'Which relationship between "India" and "SE Asia" should the next answer establish?',
    selectionOptions: [
      'Compare current evidence for India with SE Asia',
      'Resolve the dependency between India and SE Asia',
      'Choose the decision order for India and SE Asia',
    ],
    contextAnchors: ['India', 'SE Asia'],
  })
  const investmentReportAnswer = 'Generate report on China investment in SE Asia in USD trillion'
  const investmentReportContext = [
    'Authored request:',
    'Research cross-border investment activity.',
    'Selected continuation question:',
    'What report should be generated?',
    'Selected continuation answer:',
    investmentReportAnswer,
  ].join('\n')
  const genericWrapperAccepted = isProbeTreeCardUserInputRelevant({
    contextText: investmentReportContext,
    question: `Which scope choice should clarify "${investmentReportAnswer}"?`,
    selectionOptions: [
      `Define the exact boundary of ${investmentReportAnswer}`,
      `Identify adjacent concerns around ${investmentReportAnswer}`,
    ],
    contextAnchors: [investmentReportAnswer, 'China investment'],
  })
  const fragmentOnlyChoicesAccepted = areProbeTreeContinuationChoicesSuggested({
    contextText: continuationContext,
    question: 'Which parts of "provider-neutral protection guidance" need separate follow-up?',
    selectionOptions: ['provider-neutral', 'protection guidance'],
  })
  if (
    forbiddenMetadata.some(keyword => keywords.includes(keyword))
    || !['sme', 'cyber', 'supply-chain', 'physical-asset', 'growth-stage'].every(keyword => keywords.includes(keyword))
    || continuationInput !== 'provider-neutral protection guidance, a review-ready licensed-adviser handoff, evidence confidence and urgency'
    || !['protection', 'licensed-adviser', 'evidence', 'confidence', 'urgency'].every(keyword => continuationKeywords.includes(keyword))
    || fragmentOnlyChoicesAccepted
    || questionOnlyContinuationInput !== 'coverage authority, claims freshness, adviser handoff'
    || genericWrapperAccepted
    || relationshipWrapperAccepted
  ) {
    throw new Error(`expected relevance validation to reject canned wrappers while keeping the selected child input primary, got ${JSON.stringify({ keywords, continuationInput, continuationKeywords, questionOnlyContinuationInput })}`)
  }
}
