import { buildProbeTreeCardFromGraphNode } from '@/components/StoryboardCanvas/storyboardProbeTreeInvocationAction'
import {
  buildProbeTreeStructuredResponse,
  PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION,
} from '@/features/agent-ready/probeTreeContract.mjs'
import { KNOWGRPH_PROBE_TREE_INVOCATION_TOKENS } from '@/features/agentic-os/probeTreePromptPreset'
import { extractChatResponseStructuredSurface } from '@/features/chat/chatResponseStructuredContent'
import { buildAgenticOsRuntimeInvocationSystemPrompt } from '@/features/chat/chatRuntimeInvocationProfile'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID, FLOW_TEXT_GENERATION_NODE_TYPE_ID } from '@/lib/config.storyboard-widget'
import type { GraphNode } from '@/lib/graph/types'

export function testProbeTreeLlmResponseContractProjectsEditableBranches() {
  const prompt = buildAgenticOsRuntimeInvocationSystemPrompt(
    'knowgrph.probe.generate Identify the next evidence question for the selected SME care-agent card.',
  )
  for (const expected of [
    PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION,
    '2-4 concrete, context-specific next questions',
    'evidenceNeeded',
    'at most one clarification card',
    'parentNodeId as the lineage SSOT',
    'deterministic fallback UI only',
    'knowgrph.agentic_canvas_os.docs.invoke',
    'result.structuredContent.response.structuredContent',
    'card renders it as Summary',
    'leave output empty for the editable user answer',
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

  const question = 'Which source system is authoritative for the member risk tier?'
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
    '        rationale: Prevents conflicting CRM and claims values from silently selecting the branch.',
    '        evidenceNeeded: Named system of record and freshness timestamp',
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
    evidenceNeeded: 'Named system of record and freshness timestamp',
    confidence: 'medium',
    nextAction: 'knowgrph.probe.select',
  } as const
  for (const [key, expected] of Object.entries(expectedProperties)) {
    if (node.properties[key] !== expected) {
      throw new Error(`expected projected Probe-Tree property ${key}=${expected}, got ${JSON.stringify(node.properties)}`)
    }
  }
  if (
    node.nodeTypeId !== FLOW_TEXT_GENERATION_NODE_TYPE_ID
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
    || !card.action.includes('Named system of record')
  ) {
    throw new Error(`expected structured output to render as a visible Probe-Tree card, got ${JSON.stringify(card)}`)
  }
}

export function testProbeTreeMcpResponseAdapterBoundsWidgetCardsAndPanel() {
  const response = buildProbeTreeStructuredResponse({
    threadRootId: 'care-agent',
    currentNodeId: 'care-source',
    contextText: 'The selected care source needs an authoritative risk-tier branch.',
    optionCount: 9,
    probeTreeDepth: 99,
    options: Array.from({ length: 6 }, (_, index) => ({
      id: `care-option-${index + 1}`,
      text: `Which care evidence source should branch ${index + 1} use?`,
      rationale: `Keeps branch ${index + 1} source-backed.`,
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
    || candidateEdges.length !== 4
    || candidateEdges.some(edge => edge.source !== source.id || !cards.some(card => card.id === edge.target))
  ) {
    throw new Error(`expected literal MCP structured response to project a visible Widget/Card/Panel tree, got ${JSON.stringify(surface)}`)
  }
}
