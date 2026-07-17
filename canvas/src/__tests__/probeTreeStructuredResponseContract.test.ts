import { buildProbeTreeCardFromGraphNode } from '@/components/StoryboardCanvas/storyboardProbeTreeInvocationAction'
import { materializeStoryboardWidgetProbeTreeStructuredResponse } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetProbeTreeStructuredResponse'
import {
  buildProbeTreeStructuredResponse,
  buildProbeTreeInputDerivedOptions,
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
    'at most one clarification card',
    'parentNodeId as the lineage SSOT',
    'never substitute canned response content or fixtures',
    'contextAnchors',
    'knowgrph.agentic_canvas_os.docs.invoke',
    'result.structuredContent.response.structuredContent',
    'card renders it as Summary',
    'leave output empty for the user-owned selection',
  ]) {
    if (!prompt.includes(expected)) {
      throw new Error(`expected Probe-Tree LLM prompt to include ${expected}, got ${prompt}`)
    }
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
  const contextText = 'Authored request: Prioritize care evidence across member risk tier, CRM authority, claims freshness, and care-plan handoff. Selected Widget id: care-source'
  const selectionOptions = ['member risk tier', 'CRM authority', 'claims freshness', 'care-plan handoff']
  const response = buildProbeTreeStructuredResponse({
    threadRootId: 'care-agent',
    currentNodeId: 'care-source',
    contextText,
    optionCount: 9,
    probeTreeDepth: 99,
    options: Array.from({ length: 6 }, (_, index) => ({
      id: `care-option-${index + 1}`,
      text: `Which member risk tier and CRM authority priority should care evidence branch ${index + 1} use?`,
      rationale: `Keeps branch ${index + 1} source-backed.`,
      evidenceNeeded: 'User selection among the authored care evidence priorities.',
      selectionOptions,
      contextAnchors: ['member risk tier', 'CRM authority'],
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

export function testProbeTreeInputDerivedCardsProjectWithoutStructuredTextParsing() {
  const anchorNode: GraphNode = {
    id: { key: 'id', type: 'string', value: 'sme-source' },
    type: { key: 'type', type: 'string', value: 'TextGeneration' },
    label: { key: 'label', type: 'string', value: 'SME coverage review' },
    properties: {},
  } as unknown as GraphNode
  const graphData: GraphData = { type: 'Graph', nodes: [anchorNode], edges: [] }
  const contextText = [
    'Authored request:',
    'Assess SME exposure across cyber, supply-chain, physical-asset, and growth-stage risks.',
    'Keep exposure, current coverage, apparent gaps, and unknown risks distinct.',
    'Produce provider-neutral guidance, evidence-needed fields, rationale, and adviser handoff.',
    'Selected Widget id: sme-source',
  ].join('\n')
  const inputDerivedOptions = buildProbeTreeInputDerivedOptions(contextText)
  const result = materializeStoryboardWidgetProbeTreeStructuredResponse({
    graphData,
    anchorNode,
    responseText: 'unstructured upstream output',
    contextText,
    responseSource: 'input-derived',
    model: 'knowgrph-probe-tree-input-derived',
    mcpInvoked: false,
    invocationTokens: ['/knowgrph.probe-tree'],
    inputDerivedOptions,
  })
  const cards = result?.graphData.nodes.filter(node => node.properties.probeTreeResponseMode === 'llm-contract') || []
  if (
    result?.responseSource !== 'input-derived'
    || cards.length !== 3
    || cards.some(card => card.properties.parentNodeId !== 'sme-source')
    || cards.some(card => card.properties.output !== '' || !card.properties.summary)
    || cards.some(card => card.properties.probeTreeCardVariant !== 'probe-tree-type-2' || card.properties.selectionMode !== 'multiple' || card.properties.allowOther !== true)
    || !result.panelOutput.includes('SME')
  ) {
    throw new Error(`expected direct user-input-derived cards without generic response parsing, got ${JSON.stringify(result)}`)
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
  const options = buildProbeTreeInputDerivedOptions(contextText)
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
  const continuationOptions = buildProbeTreeInputDerivedOptions(continuationContext)
  const questionOnlyContinuationContext = [
    'Selected continuation question:',
    'Which requested items should guide the next branch: coverage authority, claims freshness, adviser handoff?',
  ].join('\n')
  const questionOnlyContinuationInput = extractProbeTreeUserInputText(questionOnlyContinuationContext)
  const firstOption = options[0]
  if (
    forbiddenMetadata.some(keyword => keywords.includes(keyword))
    || !['sme', 'cyber', 'supply-chain', 'physical-asset', 'growth-stage'].every(keyword => keywords.includes(keyword))
    || !firstOption
    || !isProbeTreeCardUserInputRelevant({ contextText, question: firstOption.text, selectionOptions: firstOption.selectionOptions, contextAnchors: firstOption.contextAnchors })
    || continuationInput !== 'provider-neutral protection guidance, a review-ready licensed-adviser handoff, evidence confidence and urgency'
    || !['protection', 'licensed-adviser', 'evidence', 'confidence', 'urgency'].every(keyword => continuationKeywords.includes(keyword))
    || continuationOptions.length < 2
    || continuationOptions.some(option => option.text.includes('Which requested items should guide the next branch: Which requested items'))
    || questionOnlyContinuationInput !== 'coverage authority, claims freshness, adviser handoff'
    || JSON.stringify(options).includes('Current primary source for')
    || JSON.stringify(options).includes('Verified system-of-record fact for')
  ) {
    throw new Error(`expected invocation scaffolding to yield only user-input-derived choices, got ${JSON.stringify({ keywords, continuationInput, continuationKeywords, continuationOptions, questionOnlyContinuationInput, options })}`)
  }
}
