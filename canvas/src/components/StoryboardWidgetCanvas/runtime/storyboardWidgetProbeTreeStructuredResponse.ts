import { buildProbeTreeStoryboardMermaidFlowchart, PROBE_TREE_STORYBOARD_MERMAID_FLOWCHART_KIND } from '@/components/StoryboardCanvas/storyboardProbeTreeMermaidFlowchart'
import { hashText } from '@/features/parsers/hash'
import { extractChatResponseStructuredSurface, type ChatResponseSurfaceNode } from '@/features/chat/chatResponseStructuredContent'
import { KNOWGRPH_PROBE_TREE_MAX_DEPTH } from '@/features/agentic-os/probeTreePromptPreset'
import {
  PROBE_TREE_CARD_VARIANTS,
  PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION,
  isProbeTreeCardUserInputRelevant,
  normalizeProbeTreeContextAnchors,
  normalizeProbeTreeSelectionOptions,
} from '@/features/agent-ready/probeTreeContract.mjs'
import type { ProbeTreeMcpInvocationResolution } from '@/features/agent-ready/probeTreeMcpBridgeContract'
import { resolveStoryboardWidgetProbeTreeBranchPositions } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetProbeTreeLayout'
import { readGraphNodeProperties } from '@/lib/cards/graphNodeCardFields'
import { FLOW_TEXT_GENERATION_NODE_TYPE_ID } from '@/lib/config.storyboard-widget'
import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'
import { unwrapGraphCellValue } from '@/lib/graph/nodeProperties'
import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'

const GENERIC_PROBE_CARD_PATTERN = /^(?:clarify probe|generate branches|select handoff)(?::|$)/i

export type StoryboardWidgetProbeTreeInputDerivedOption = {
  id?: string
  text?: string
  question?: string
  rationale?: string
  evidenceNeeded?: string
  selectionOptions?: readonly (string | { id?: string; label?: string; text?: string })[]
  contextAnchors?: readonly string[]
}

const readString = (value: unknown): string => String(unwrapGraphCellValue(value) ?? '').trim()

const readNodeId = (node?: GraphNode | null): string => readString(node?.id)

const readProbeTreeDepth = (properties: Record<string, unknown>): number => {
  const value = Number(unwrapGraphCellValue(properties.probeTreeDepth))
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(KNOWGRPH_PROBE_TREE_MAX_DEPTH, Math.floor(value)))
}

const isProbeTreeCardForAnchor = (node: GraphNode, anchorNodeId: string): boolean => {
  const properties = readGraphNodeProperties(node)
  const parentNodeId = readString(properties.parentNodeId || properties.parentGraphNodeId)
  return parentNodeId === anchorNodeId && readString(properties.cardTypeLabel) === 'Probe-Tree Card'
}

const collectReplacedProbeTreeNodeIds = (graphData: GraphData, anchorNodeId: string): Set<string> => {
  const removedNodeIds = new Set(
    (graphData.nodes || [])
      .filter(node => isProbeTreeCardForAnchor(node, anchorNodeId))
      .map(readNodeId)
      .filter(Boolean),
  )
  let changed = true
  while (changed) {
    changed = false
    for (const node of graphData.nodes || []) {
      const nodeId = readNodeId(node)
      if (!nodeId || removedNodeIds.has(nodeId)) continue
      const properties = readGraphNodeProperties(node)
      const parentNodeId = readString(properties.parentNodeId || properties.parentGraphNodeId)
      if (!removedNodeIds.has(parentNodeId) || readString(properties.cardTypeLabel) !== 'Probe-Tree Card') continue
      removedNodeIds.add(nodeId)
      changed = true
    }
  }
  return removedNodeIds
}

const isStructuredProbeCard = (node: ChatResponseSurfaceNode): boolean => (
  node.nodeTypeId === FLOW_TEXT_GENERATION_NODE_TYPE_ID
  && node.properties.probeTreeResponseMode === 'llm-contract'
  && node.properties.cardTypeLabel === 'Probe-Tree Card'
  && node.properties.probeTreeCardVariant === PROBE_TREE_CARD_VARIANTS.boundedMultiSelect
  && node.properties.selectionMode === 'multiple'
  && normalizeProbeTreeSelectionOptions(node.properties.selectionOptions).length >= 2
  && normalizeProbeTreeContextAnchors(node.properties.contextAnchors || node.properties.probeTreeUserInputAnchors).length >= 2
  && node.properties.allowOther === true
  && !GENERIC_PROBE_CARD_PATTERN.test(String(node.label || '').trim())
)

const buildCandidateEdge = (source: string, target: string, candidateOptionId: string): GraphEdge => ({
  id: `probe-tree:edge:${hashText(`${source}:candidateOption:${target}`).slice(0, 12)}`,
  source,
  target,
  label: 'candidateOption',
  properties: {
    evidenceKind: 'mcp-structured-response',
    confidence: 'medium',
    candidateOptionId,
  },
})

const buildInputDerivedCards = (
  options: readonly StoryboardWidgetProbeTreeInputDerivedOption[],
  anchorNodeId: string,
  contextText: string,
): ChatResponseSurfaceNode[] => options.slice(0, 4).map((option, index) => {
  const question = readString(option.text || option.question)
  const candidateOptionId = readString(option.id) || `input-derived-${hashText(question).slice(0, 12)}`
  const selectionOptions = normalizeProbeTreeSelectionOptions(option.selectionOptions)
  const contextAnchors = normalizeProbeTreeContextAnchors(option.contextAnchors)
  return {
    id: `probe-tree:${candidateOptionId}`,
    label: question,
    nodeTypeId: FLOW_TEXT_GENERATION_NODE_TYPE_ID,
    kind: 'text' as const,
    sourceHandle: 'text_out',
    targetHandle: 'prompt_in',
    properties: {
      'chat:structuredContent': true,
      'chat:structuredRole': 'card',
      cardTypeLabel: 'Probe-Tree Card',
      probeTreeTypeLabel: 'Probe-Tree Type 2',
      probeTreeCardVariant: PROBE_TREE_CARD_VARIANTS.boundedMultiSelect,
      selectionMode: 'multiple',
      selectionOptions,
      contextAnchors,
      probeTreeUserInputAnchors: contextAnchors,
      allowOther: true,
      probeTreeResponseMode: 'llm-contract',
      responseContractVersion: PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION,
      parentNodeId: anchorNodeId,
      parentGraphNodeId: anchorNodeId,
      probeTreeCandidateKey: candidateOptionId,
      probeTreeTool: 'knowgrph.probe.select',
      nextAction: 'knowgrph.probe.select',
      summary: question,
      question,
      output: '',
      rationale: readString(option.rationale),
      evidenceNeeded: readString(option.evidenceNeeded),
      confidence: 'low',
      index: `P${index + 1}`,
      tags: ['probe-tree', 'candidateOption', 'input-derived'],
    },
  }
}).filter(card => Boolean(card.label) && isProbeTreeCardUserInputRelevant({
  contextText,
  question: card.properties.question,
  selectionOptions: card.properties.selectionOptions,
  contextAnchors: card.properties.contextAnchors,
}))

const buildPanelMarkdown = (args: {
  anchorNodeId: string
  cards: ChatResponseSurfaceNode[]
  invocationTokens: readonly string[]
  invocationResolutions: readonly ProbeTreeMcpInvocationResolution[]
  mcpInvoked: boolean
  responseSource: 'provider' | 'mcp' | 'input-derived'
  model: string
}): string => {
  const resolutionByToken = new Map(args.invocationResolutions.map(item => [item.token.toLowerCase(), item]))
  const grammarLine = args.invocationTokens.length > 0
    ? args.invocationTokens.map(token => {
        const resolved = resolutionByToken.get(token.toLowerCase())
        if (!resolved) return token
        return `${token} (${resolved.ok ? 'resolved' : 'forwarded; docs unavailable'})`
      }).join(' ')
    : '(none)'
  const responseMode = args.responseSource === 'provider'
    ? 'provider refinement over the literal MCP result'
    : args.responseSource === 'mcp'
      ? 'literal local MCP structured response'
      : args.mcpInvoked
        ? 'bounded user-input-derived fallback after response-contract validation'
        : 'bounded user-input-derived fallback; MCP was unavailable'
  return [
    '# Probe-Tree Branches',
    '',
    `Source node: ${args.anchorNodeId}`,
    `Contract: ${PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION}`,
    `MCP: ${args.mcpInvoked ? 'knowgrph.probe.generate invoked' : 'not invoked'}`,
    `Response mode: ${responseMode}`,
    `Model: ${args.model || 'unknown'}`,
    `Invocation grammar: ${grammarLine}`,
    '',
    ...args.cards.flatMap((card, index) => {
      const question = readString(card.properties.summary || card.properties.question) || card.label
      const rationale = readString(card.properties.rationale)
      const evidence = readString(card.properties.evidenceNeeded)
      const selectionOptions = normalizeProbeTreeSelectionOptions(card.properties.selectionOptions)
      return [
        `${index + 1}. **${card.label}** — ${question}`,
        ...selectionOptions.map((option, optionIndex) => `   ${optionIndex + 1}. ${option.label}`),
        ...(card.properties.allowOther === true ? ['   - Other (author a different answer)'] : []),
        ...(rationale ? [`   - Why: ${rationale}`] : []),
        ...(evidence ? [`   - Evidence: ${evidence}`] : []),
      ]
    }),
  ].join('\n')
}

export type StoryboardWidgetProbeTreeStructuredMaterialization = {
  graphData: GraphData
  materializedNodeIds: string[]
  panelOutput: string
  responseSource: 'provider' | 'mcp' | 'input-derived'
  model: string
}

export function materializeStoryboardWidgetProbeTreeStructuredResponse(args: {
  graphData: GraphData | null | undefined
  anchorNode: GraphNode
  responseText: string
  contextText: string
  responseSource: 'provider' | 'mcp' | 'input-derived'
  model: string
  mcpInvoked: boolean
  threadRootId?: string
  invocationTokens: readonly string[]
  invocationResolutions?: readonly ProbeTreeMcpInvocationResolution[]
  inputDerivedOptions?: readonly StoryboardWidgetProbeTreeInputDerivedOption[]
}): StoryboardWidgetProbeTreeStructuredMaterialization | null {
  const graphData = args.graphData
  const anchorNodeId = readNodeId(args.anchorNode)
  if (!graphData || !anchorNodeId) return null
  const inputDerivedCards = buildInputDerivedCards(args.inputDerivedOptions || [], anchorNodeId, args.contextText)
  const surface = inputDerivedCards.length >= 2
    ? null
    : extractChatResponseStructuredSurface(String(args.responseText || ''))
  const surfaceNodes = surface?.nodes || []
  const sourceWidgets = surfaceNodes.filter(node => node.properties['chat:structuredRole'] === 'widget')
  const panels = surfaceNodes.filter(node => node.properties['chat:structuredRole'] === 'panel')
  const responseCards = surfaceNodes.filter(node => node.properties['chat:structuredRole'] === 'card')
  const cards = inputDerivedCards.length >= 2
    ? inputDerivedCards
    : responseCards.filter(isStructuredProbeCard)
  if (inputDerivedCards.length < 2 && (
    sourceWidgets.length !== 1
    || panels.length !== 1
    || readString(panels[0]?.label) !== 'Probe-Tree Branches'
    || responseCards.length < 2
    || responseCards.length > 4
    || cards.length !== responseCards.length
  )) return null
  if (!cards.every(card => isProbeTreeCardUserInputRelevant({
    contextText: args.contextText,
    question: card.properties.question || card.properties.summary || card.label,
    selectionOptions: card.properties.selectionOptions,
    contextAnchors: card.properties.contextAnchors || card.properties.probeTreeUserInputAnchors,
  }))) return null

  const removedNodeIds = collectReplacedProbeTreeNodeIds(graphData, anchorNodeId)
  const retainedNodes = (graphData.nodes || []).filter(node => !removedNodeIds.has(readNodeId(node)))
  const retainedNodeIds = new Set(retainedNodes.map(readNodeId).filter(Boolean))
  const priorNodeById = new Map((graphData.nodes || []).map(node => [readNodeId(node), node]))
  const anchorProperties = readGraphNodeProperties(args.anchorNode)
  const threadRootId = readString(args.threadRootId) || readString(anchorProperties.probeTreeThreadRootId) || anchorNodeId
  const nextProbeTreeDepth = Math.min(KNOWGRPH_PROBE_TREE_MAX_DEPTH, readProbeTreeDepth(anchorProperties) + 1)
  const projectedPositions = resolveStoryboardWidgetProbeTreeBranchPositions({
    graphData,
    anchorNode: args.anchorNode,
    removedNodeIds,
    count: cards.length,
  })
  const materializedNodeIds: string[] = []
  const projectedNodes: GraphNode[] = cards.map((card, index) => {
    let nodeId = card.id
    if (retainedNodeIds.has(nodeId) && nodeId !== anchorNodeId) {
      nodeId = `${nodeId}-${hashText(anchorNodeId).slice(0, 8)}`
    }
    materializedNodeIds.push(nodeId)
    const previous = priorNodeById.get(nodeId)
    const candidateOptionId = readString(card.properties.probeTreeCandidateKey) || `candidate-${index + 1}`
    const question = readString(card.properties.summary || card.properties.question) || card.label
    return {
      id: nodeId,
      type: FLOW_TEXT_GENERATION_NODE_TYPE_ID,
      label: String(card.label || question).trim().slice(0, 160),
      x: typeof previous?.x === 'number' && Number.isFinite(previous.x) ? previous.x : projectedPositions[index]!.x,
      y: typeof previous?.y === 'number' && Number.isFinite(previous.y) ? previous.y : projectedPositions[index]!.y,
      properties: {
        ...card.properties,
        title: String(card.label || question).trim().slice(0, 160),
        output: '',
        summary: question,
        index: `P${index + 1}`,
        parentNodeId: anchorNodeId,
        parentGraphNodeId: anchorNodeId,
        probeTreeCandidateKey: candidateOptionId,
        probeTreeResponseMode: 'llm-contract',
        probeTreeThreadRootId: threadRootId,
        probeTreeCurrentNodeId: nodeId,
        probeTreeDepth: nextProbeTreeDepth,
        responseContractVersion: PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION,
        responseSource: args.responseSource,
        mcpInvoked: args.mcpInvoked,
        outputModel: args.model,
      } as Record<string, JSONValue>,
    }
  })

  const retainedEdges = (graphData.edges || []).filter(edge => {
    const { src, tgt } = readGraphEdgeEndpoints(edge)
    const label = readString(edge.label)
    if ((src && removedNodeIds.has(src)) || (tgt && removedNodeIds.has(tgt))) return false
    return !(src === anchorNodeId && label === 'candidateOption')
  })
  const candidateEdges = projectedNodes.map((node, index) => buildCandidateEdge(
    anchorNodeId,
    node.id,
    readString(node.properties.probeTreeCandidateKey) || `candidate-${index + 1}`,
  ))
  let nextGraphData: GraphData = {
    ...graphData,
    nodes: [...retainedNodes, ...projectedNodes],
    edges: [...retainedEdges, ...candidateEdges],
    metadata: {
      ...(graphData.metadata || {}),
      probeTreeMaterializedAtMs: Date.now(),
      probeTreeInvocation: 'knowgrph.probe.generate',
      probeTreeResponseContractVersion: PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION,
      probeTreeMcpInvoked: args.mcpInvoked,
      probeTreeResponseSource: args.responseSource,
    },
  }
  nextGraphData = {
    ...nextGraphData,
    metadata: {
      ...(nextGraphData.metadata || {}),
      probeTreeMermaidFlowchart: buildProbeTreeStoryboardMermaidFlowchart({ graphData: nextGraphData, rootNodeId: anchorNodeId }),
      probeTreeMermaidFlowchartKind: PROBE_TREE_STORYBOARD_MERMAID_FLOWCHART_KIND,
    },
  }
  return {
    graphData: nextGraphData,
    materializedNodeIds,
    panelOutput: buildPanelMarkdown({
      anchorNodeId,
      cards,
      invocationTokens: args.invocationTokens,
      invocationResolutions: args.invocationResolutions || [],
      mcpInvoked: args.mcpInvoked,
      responseSource: args.responseSource,
      model: args.model,
    }),
    responseSource: args.responseSource,
    model: args.model,
  }
}
