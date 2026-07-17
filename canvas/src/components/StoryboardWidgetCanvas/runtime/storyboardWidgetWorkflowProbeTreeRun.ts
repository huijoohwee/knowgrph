import { materializeProbeTreeBranchCardsFromGraphNode, type ProbeTreeBranchCardMaterializationResult } from '@/components/StoryboardCanvas/storyboardProbeTreeInvocationAction'
import {
  STORYBOARD_ACTION_PROPERTY_KEYS,
  STORYBOARD_OUTPUT_PROPERTY_KEYS,
  STORYBOARD_PROMPT_PROPERTY_KEYS,
  STORYBOARD_SUMMARY_PROPERTY_KEYS,
} from '@/components/StoryboardCanvas/storyboardModel'
import type { StoryboardWidgetTextRunOutputPublisher } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowRichMediaPublication'
import { resolveStoryboardWidgetTextThinkingOptions } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowTextThinking'
import {
  materializeStoryboardWidgetProbeTreeStructuredResponse,
  type StoryboardWidgetProbeTreeStructuredMaterialization,
} from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetProbeTreeStructuredResponse'
import {
  buildStoryboardWidgetProbeTreeOutputGroupId,
  normalizeStoryboardWidgetProbeTreeOutputLayout,
  PROBE_TREE_OUTPUT_KEY,
  PROBE_TREE_OUTPUT_LAYOUT_VERSION,
} from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetProbeTreeLayout'
import {
  KNOWGRPH_PROBE_TREE_DOC_INVOCATION,
  KNOWGRPH_PROBE_TREE_INVOCATION_TOKENS,
} from '@/features/agentic-os/probeTreePromptPreset'
import {
  KNOWGRPH_PROBE_TREE_CONTRACT_VERSION,
  PROBE_TREE_DEFAULTS,
  PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION,
} from '@/features/agent-ready/probeTreeContract.mjs'
import { invokeProbeTreeMcpBridge } from '@/features/agent-ready/probeTreeMcpClient'
import type { ProbeTreeMcpBridgeSuccess } from '@/features/agent-ready/probeTreeMcpBridgeContract'
import { generateRunMarkdownWithProvider } from '@/features/chat/byteplusRunGeneration'
import { buildRichMediaTextMarkdownDocument } from '@/features/rich-media/richMediaTextMarkdownContract.mjs'
import { buildAgenticOsRuntimeInvocationSystemPrompt, buildRuntimeInvocationRoutingSystemPrompt } from '@/features/chat/chatRuntimeInvocationProfile'
import {
  readGraphNodeCanonicalTextProperty,
  readGraphNodeCardTitle,
  readGraphNodeProperties,
} from '@/lib/cards/graphNodeCardFields'
import { unwrapGraphCellValue } from '@/lib/graph/nodeProperties'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { StoryboardWidgetWorkflowNodeResolutionContext } from './storyboardWidgetRenderGraph'
import { buildStoryboardWidgetProbeTreeContextText } from './storyboardWidgetProbeTreeContext'
import {
  isStoryboardWidgetProbeTreeContinuationNode,
  reconcileStoryboardWidgetProbeTreeSelectedRunNode,
  resolveStoryboardWidgetProbeTreeSelectedRunNodeFromContext,
} from './storyboardWidgetProbeTreeRunNode'
import {
  runStoryboardWidgetProbeTreeTerminalGeneration,
} from './storyboardWidgetProbeTreeTerminalGeneration'

const INVOCATION_TOKEN_PATTERN = /(^|\s)([/#@][A-Za-z0-9_.-]+)/g
const PROBE_TREE_INVOCATION_TOKENS = new Set<string>(
  KNOWGRPH_PROBE_TREE_INVOCATION_TOKENS.map(token => token.toLowerCase()),
)
const PROBE_TREE_RICH_MEDIA_PANEL_LABEL = 'Probe-Tree Branches'
const PROBE_TREE_GRAPH_PROJECTION_MODEL = 'knowgrph-probe-tree-graph-projection'

const readGraphIdentity = (value: unknown): string => String(unwrapGraphCellValue(value) ?? '').trim()

const readProbeTreeDepth = (properties: Record<string, unknown>): number => {
  const value = Number(unwrapGraphCellValue(properties.probeTreeDepth))
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(PROBE_TREE_DEFAULTS.maxDepth, Math.floor(value)))
}

export type StoryboardWidgetProbeTreeMaterializationResult = ProbeTreeBranchCardMaterializationResult & {
  invocationToken: string
}

export function resolveStoryboardWidgetProbeTreeInvocationToken(prompt: string): string {
  const text = String(prompt || '')
  for (const match of text.matchAll(INVOCATION_TOKEN_PATTERN)) {
    const token = String(match[2] || '')
    if (PROBE_TREE_INVOCATION_TOKENS.has(token.toLowerCase())) return token
  }
  return ''
}

const resolveStoryboardWidgetProbeTreeThreadRootId = (graphData: GraphData, node: GraphNode): string => {
  const properties = readGraphNodeProperties(node)
  const explicitRootId = readGraphIdentity(properties.probeTreeThreadRootId)
  if (explicitRootId) return explicitRootId
  const nodeById = new Map((graphData.nodes || []).map(candidate => [readGraphIdentity(candidate.id), candidate]))
  const seen = new Set<string>([readGraphIdentity(node.id)])
  let parentNodeId = readGraphIdentity(properties.parentNodeId || properties.parentGraphNodeId)
  let rootNodeId = parentNodeId || readGraphIdentity(node.id)
  while (parentNodeId && !seen.has(parentNodeId) && seen.size <= PROBE_TREE_DEFAULTS.maxDepth) {
    seen.add(parentNodeId)
    rootNodeId = parentNodeId
    const parentNode = nodeById.get(parentNodeId)
    if (!parentNode) break
    const parentProperties = readGraphNodeProperties(parentNode)
    const parentExplicitRootId = readGraphIdentity(parentProperties.probeTreeThreadRootId)
    if (parentExplicitRootId) return parentExplicitRootId
    parentNodeId = readGraphIdentity(parentProperties.parentNodeId || parentProperties.parentGraphNodeId)
  }
  return rootNodeId
}

export function resolveStoryboardWidgetProbeTreeInvocationTokenForNode(node: GraphNode, invocationText: string): string {
  return resolveStoryboardWidgetProbeTreeInvocationToken(invocationText)
    || (isStoryboardWidgetProbeTreeContinuationNode(node) ? KNOWGRPH_PROBE_TREE_DOC_INVOCATION.slashCommand : '')
}

export function readStoryboardWidgetProbeTreeInvocationText(node: GraphNode): string {
  const properties = readGraphNodeProperties(node)
  const prompt = readGraphNodeCanonicalTextProperty(properties, STORYBOARD_PROMPT_PROPERTY_KEYS)
  const summary = readGraphNodeCanonicalTextProperty(properties, STORYBOARD_SUMMARY_PROPERTY_KEYS)
  const output = readGraphNodeCanonicalTextProperty(properties, STORYBOARD_OUTPUT_PROPERTY_KEYS)
  const action = readGraphNodeCanonicalTextProperty(properties, STORYBOARD_ACTION_PROPERTY_KEYS)
  return (isStoryboardWidgetProbeTreeContinuationNode(node) && output
    ? [output, summary, prompt, action]
    : [prompt, summary, output, action]
  ).filter(Boolean).join('\n')
}

export function buildStoryboardWidgetProbeTreeRichMediaMarkdown(
  materialized: StoryboardWidgetProbeTreeMaterializationResult,
): string {
  const graphNodes = materialized.graphData?.nodes || []
  const branches = materialized.materializedNodeIds
    .map(nodeId => graphNodes.find(node => String(node?.id || '') === nodeId))
    .filter((node): node is GraphNode => Boolean(node))
  const branchLines = branches.map((node, index) => {
    const properties = readGraphNodeProperties(node)
    const summary = readGraphNodeCanonicalTextProperty(properties, ['summary', 'action'])
    return `${index + 1}. **${readGraphNodeCardTitle(node)}**${summary ? ` — ${summary}` : ''}`
  })
  const body = [
    '# Probe-Tree Branches',
    '',
    `Invocation: ${KNOWGRPH_PROBE_TREE_INVOCATION_TOKENS.join(' ')}`,
    `Source: ${KNOWGRPH_PROBE_TREE_DOC_INVOCATION.sourcePath}`,
    'Mode: deterministic local fallback; select or edit a branch card before the next bounded turn.',
    'Cost: 0 prompt tokens, 0 completion tokens, $0 estimated cost.',
    '',
    ...(branchLines.length > 0 ? branchLines : [`- ${materialized.message}`]),
  ].join('\n')
  return buildRichMediaTextMarkdownDocument({
    body,
    title: PROBE_TREE_RICH_MEDIA_PANEL_LABEL,
    sourceContract: KNOWGRPH_PROBE_TREE_CONTRACT_VERSION,
  })
}

export function materializeStoryboardWidgetProbeTreeInvocation(args: {
  prompt: string
  graphData: GraphData | null | undefined
  node?: GraphNode | null
}): StoryboardWidgetProbeTreeMaterializationResult | null {
  const invocationToken = resolveStoryboardWidgetProbeTreeInvocationToken(args.prompt)
  if (!invocationToken) return null
  return {
    ...materializeProbeTreeBranchCardsFromGraphNode({
      graphData: args.graphData,
      node: args.node,
    }),
    invocationToken,
  }
}

export function runStoryboardWidgetProbeTreeInvocation(args: {
  graphForRun: GraphData | null | undefined
  nodeIds: readonly string[]
  fallbackNode: GraphNode
  onMaterialized: (nodeIds: readonly string[]) => void
  publishOutput: StoryboardWidgetTextRunOutputPublisher
}): StoryboardWidgetProbeTreeMaterializationResult | null {
  const current = args.graphForRun
  if (!current) return null
  const nodeIds = new Set(args.nodeIds.map(id => String(id || '')).filter(Boolean))
  const node = current.nodes.find(candidate => nodeIds.has(String(candidate?.id || ''))) || args.fallbackNode
  const prompt = readStoryboardWidgetProbeTreeInvocationText(args.fallbackNode)
  const materialized = materializeStoryboardWidgetProbeTreeInvocation({ prompt, graphData: current, node })
  if (!materialized) return null
  if (materialized.materializedNodeIds.length === 0) return materialized
  const threadRootId = resolveStoryboardWidgetProbeTreeThreadRootId(current, node)
  const outputGroupId = buildStoryboardWidgetProbeTreeOutputGroupId(threadRootId)
  const panelOutput = buildStoryboardWidgetProbeTreeRichMediaMarkdown(materialized)
  const graphData = normalizeStoryboardWidgetProbeTreeOutputLayout({ graphData: materialized.graphData, threadRootId })
  const publishedGraphData = args.publishOutput({
    anchorNode: node,
    baseGraphData: graphData || current,
    outputText: panelOutput,
    title: PROBE_TREE_RICH_MEDIA_PANEL_LABEL,
    model: PROBE_TREE_GRAPH_PROJECTION_MODEL,
    loading: false,
    outputKey: PROBE_TREE_OUTPUT_KEY,
    outputGroupId,
    outputThreadRootId: threadRootId,
    outputIndex: 1,
    panelLabel: PROBE_TREE_RICH_MEDIA_PANEL_LABEL,
    panelProperties: { probeTreeThreadLedger: true, probeTreeOutputLayoutVersion: PROBE_TREE_OUTPUT_LAYOUT_VERSION },
  })
  if (!publishedGraphData) throw new Error('Probe-Tree could not publish its Rich Media ledger.')
  if (materialized.materializedNodeIds.length > 0) args.onMaterialized(materialized.materializedNodeIds)
  return { ...materialized, graphData: publishedGraphData }
}

const collectInvocationTokens = (value: string): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const match of String(value || '').matchAll(INVOCATION_TOKEN_PATTERN)) {
    const token = String(match[2] || '').trim()
    const key = token.toLowerCase()
    if (!token || seen.has(key)) continue
    seen.add(key)
    out.push(token)
    if (out.length >= 24) break
  }
  return out
}

const readMcpModel = (result: Record<string, unknown>): string => {
  const structured = result.structuredContent && typeof result.structuredContent === 'object'
    ? result.structuredContent as Record<string, unknown>
    : {}
  const costLog = structured.cost_log && typeof structured.cost_log === 'object'
    ? structured.cost_log as Record<string, unknown>
    : {}
  return String(costLog.model || '').trim() || 'knowgrph.probe.generate'
}

export function buildStoryboardWidgetProbeTreeProviderPrompt(args: {
  authoredPrompt: string
  contextText: string
  currentNodeId: string
  mcpResult: Record<string, unknown>
  mcpInvoked: boolean
  probeTreeDepth: number
}): string {
  const literalMcpResult = JSON.stringify({ result: args.mcpResult }, null, 2).slice(0, 18_000)
  return [
    buildRuntimeInvocationRoutingSystemPrompt(args.authoredPrompt),
    buildAgenticOsRuntimeInvocationSystemPrompt(args.authoredPrompt),
    'Widget Card Probe-Tree provider task:',
    '- Use the selected Widget request below as the only topic. Do not substitute a stock workflow or unrelated domain.',
    `- The local knowgrph MCP ${args.mcpInvoked ? 'was invoked' : 'was unavailable'}; treat the literal result as bounded candidate evidence, not as permission to claim other tools ran.`,
    `- Return one fenced YAML block rooted at response.structuredContent using ${PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION}.`,
    `- Emit exactly 2-4 cards, set every parentNodeId to ${args.currentNodeId}, set every probeTreeDepth to ${args.probeTreeDepth}, and include candidateOptionId, question, output, rationale, evidenceNeeded, confidence, nextAction: knowgrph.probe.select, probeTreeCardVariant: probe-tree-type-2, selectionMode: multiple, 2-4 selectionOptions with unique id and label, 2-6 contextAnchors copied verbatim from the selected user input, and allowOther: true.`,
    '- Put each generated probe in question for the card Summary, make every numbered selection option a concise answer to that exact question, and set output exactly to an empty string for the user-owned multi-selection or Other response; never copy question or rationale into output.',
    '- Ground every question in the selected user input and copy 2-6 short context anchors verbatim. Suggested answers may introduce plausible user preferences for the new decision variable, but must never assert invented facts.',
    '- Never copy or paraphrase the selected request as a card question. Each card must introduce one concrete missing decision variable whose answer would materially change the requested result.',
    '- Treat named entities and alternatives already present in the request as subjects to clarify, not as a ready-made selectionOptions array. Never turn an extracted entity list into an echo card.',
    '- Give every card a different request-specific decision variable. Never reuse a choice label, another card\'s complete selection set, or a subset or superset of another card\'s choices.',
    '- Each selectionOptions array must contain suggested clarification answers for its question. Never split the selected focus or repeat its words as bare answer fragments.',
    '- For a continuation, the selected child card and its user-authored output own the next topic. Use the thread root only for lineage; never replace the selected child context with a root alias.',
    '- Every card must be a concrete next question relevant to the authored request and its question must reuse at least two substantive request terms.',
    '- Never emit generic process cards named Clarify probe, Generate branches, or Select handoff.',
    '- Reject every canned wrapper: scope/priority/constraint over the whole query, pairwise relationship questions, evidence/decision-basis/deliverable templates, and choices such as compare current evidence, resolve the dependency, or choose the decision order. Ask only about concrete missing parameters that materially change this request.',
    '- If 2-4 distinct query-specific cards cannot be produced without invented facts, return an empty cards array so the runtime fails closed; never fill the quota by restating the query or applying generic or hardcoded templates.',
    '- If the selected user input is an imperative generation request, fulfill that deliverable through normal generation. Do not emit clarification cards and do not continue Probe-Tree.',
    '- Do not add prose before or after the fenced YAML block.',
    '',
    'Selected Widget context:',
    args.contextText,
    '',
    'Literal MCP CallToolResult:',
    literalMcpResult,
  ].filter(Boolean).join('\n')
}
export type StoryboardWidgetProbeTreeMcpRunResult = StoryboardWidgetProbeTreeStructuredMaterialization & {
  invocationToken: string
  mcpInvoked: boolean
  providerAccepted: boolean
  kind: 'success' | 'warning'
  message: string
  mcpError?: string
  providerError?: string
}

type StoryboardWidgetProbeTreeProviderRuntimeProperties = {
  chatProvider?: unknown
  chatAuthMode?: unknown
  chatApiKey?: unknown
  chatEndpointUrl?: unknown
  chatModel?: unknown
  chatTemperature?: unknown
  chatMaxCompletionTokens?: unknown
  chatServiceTier?: unknown
  chatReasoningEffort?: unknown
  chatThinkingType?: unknown
  chatThinkingJson?: unknown
  chatFrequencyPenalty?: unknown
  chatPresencePenalty?: unknown
  chatTopP?: unknown
}

export async function runStoryboardWidgetProbeTreeMcpInvocation(args: {
  graphForRun: GraphData | null | undefined
  nodeIds: readonly string[]
  fallbackNode: GraphNode
  onMaterialized: (nodeIds: readonly string[]) => void
  publishOutput: StoryboardWidgetTextRunOutputPublisher
  providerModel?: string
  generateProviderResponse?: (prompt: string) => Promise<string | null>
  invokeMcp?: typeof invokeProbeTreeMcpBridge
}): Promise<StoryboardWidgetProbeTreeMcpRunResult | null> {
  const current = args.graphForRun
  if (!current) return null
  const nodeIds = new Set(args.nodeIds.map(id => String(id || '').trim()).filter(Boolean))
  const fallbackNodeId = readGraphIdentity(args.fallbackNode.id)
  const currentFallbackNode = current.nodes.find(candidate => readGraphIdentity(candidate?.id) === fallbackNodeId)
  const selectedContinuationNode = isStoryboardWidgetProbeTreeContinuationNode(args.fallbackNode)
    ? args.fallbackNode
    : null
  const node = selectedContinuationNode
    || currentFallbackNode
    || current.nodes.find(candidate => nodeIds.has(readGraphIdentity(candidate?.id)))
    || args.fallbackNode
  const prompt = readStoryboardWidgetProbeTreeInvocationText(args.fallbackNode)
  const invocationToken = resolveStoryboardWidgetProbeTreeInvocationTokenForNode(node, prompt)
  if (!invocationToken) return null

  const currentNodeId = readGraphIdentity(node.id) || readGraphIdentity(args.fallbackNode.id)
  const graphForInvocation = reconcileStoryboardWidgetProbeTreeSelectedRunNode({
    graphData: current,
    selectedNode: node,
  })
  const properties = readGraphNodeProperties(node)
  const threadRootId = resolveStoryboardWidgetProbeTreeThreadRootId(graphForInvocation, node)
  const contextText = buildStoryboardWidgetProbeTreeContextText({
    graphData: graphForInvocation,
    node,
    prompt,
  })
  const terminalGeneration = await runStoryboardWidgetProbeTreeTerminalGeneration({
    node,
    graphData: graphForInvocation,
    threadRootId,
    invocationToken,
    contextText,
    providerModel: args.providerModel,
    generateProviderResponse: args.generateProviderResponse,
    publishOutput: args.publishOutput,
    onMaterialized: args.onMaterialized,
  })
  if (terminalGeneration) return terminalGeneration
  const currentProbeTreeDepth = readProbeTreeDepth(properties)
  if (currentProbeTreeDepth >= PROBE_TREE_DEFAULTS.maxDepth) {
    return {
      graphData: graphForInvocation,
      materializedNodeIds: [],
      panelOutput: '',
      responseSource: 'runtime',
      model: 'none',
      invocationToken,
      mcpInvoked: false,
      providerAccepted: false,
      kind: 'warning',
      message: `Probe-Tree stopped at the ${PROBE_TREE_DEFAULTS.maxDepth}-branch depth limit.`,
    }
  }
  const nextProbeTreeDepth = currentProbeTreeDepth + 1
  const invocationTokens = collectInvocationTokens(prompt)
  let bridge: ProbeTreeMcpBridgeSuccess | null = null
  let mcpError = ''
  try {
    bridge = await (args.invokeMcp || invokeProbeTreeMcpBridge)({
      threadRootId,
      currentNodeId,
      contextText,
      invocationTokens,
      optionCount: 3,
      probeTreeDepth: nextProbeTreeDepth,
      recallTopK: isStoryboardWidgetProbeTreeContinuationNode(node) ? 0 : PROBE_TREE_DEFAULTS.recallTopK,
      tokenBudget: 1200,
    })
  } catch (error) {
    mcpError = error instanceof Error ? error.message : String(error || '')
  }

  const mcpResult = bridge?.result || {
    isError: true,
    content: [],
    structuredContent: {
      contractVersion: KNOWGRPH_PROBE_TREE_CONTRACT_VERSION,
      ok: false,
      degraded: true,
      degraded_reason: mcpError || 'mcp_unavailable',
    },
  }
  const mcpInvoked = bridge?.mcpInvoked === true
  let providerText = ''
  let providerError = ''
  if (args.generateProviderResponse) {
    try {
      providerText = String(await args.generateProviderResponse(buildStoryboardWidgetProbeTreeProviderPrompt({
        authoredPrompt: prompt,
        contextText,
        currentNodeId,
        mcpResult,
        mcpInvoked,
        probeTreeDepth: nextProbeTreeDepth,
      })) || '').trim()
    } catch (error) {
      providerError = error instanceof Error ? error.message : String(error || '')
    }
  }

  let providerAccepted = false
  let materialized = providerText
    ? materializeStoryboardWidgetProbeTreeStructuredResponse({
        graphData: graphForInvocation,
        anchorNode: node,
        responseText: providerText,
        contextText,
        responseSource: 'provider',
        model: String(args.providerModel || '').trim() || 'configured-provider',
        mcpInvoked,
        threadRootId,
        invocationTokens,
        invocationResolutions: bridge?.invocationResolutions,
      })
    : null
  if (materialized) providerAccepted = true

  if (!materialized && mcpInvoked) {
    materialized = materializeStoryboardWidgetProbeTreeStructuredResponse({
      graphData: graphForInvocation,
      anchorNode: node,
      responseText: JSON.stringify({ result: mcpResult }, null, 2),
      contextText,
      responseSource: 'mcp',
      model: readMcpModel(mcpResult),
      mcpInvoked,
      threadRootId,
      invocationTokens,
      invocationResolutions: bridge?.invocationResolutions,
    })
  }
  if (!materialized) throw new Error('Probe-Tree received no accepted 2-4 query-specific LLM cards. Check the configured chat model and ensure its questions introduce missing decision variables instead of restating the source query; the zero-model MCP path does not synthesize fallback cards.')

  const outputGroupId = buildStoryboardWidgetProbeTreeOutputGroupId(threadRootId)
  const normalizedGraphData = normalizeStoryboardWidgetProbeTreeOutputLayout({
    graphData: materialized.graphData,
    threadRootId,
  })
  materialized = { ...materialized, graphData: normalizedGraphData }
  const publishedGraphData = args.publishOutput({
    anchorNode: node,
    baseGraphData: normalizedGraphData,
    outputText: materialized.panelOutput,
    title: PROBE_TREE_RICH_MEDIA_PANEL_LABEL,
    model: materialized.model,
    loading: false,
    outputKey: PROBE_TREE_OUTPUT_KEY,
    outputGroupId,
    outputThreadRootId: threadRootId,
    outputIndex: 1,
    panelLabel: PROBE_TREE_RICH_MEDIA_PANEL_LABEL,
    panelProperties: { probeTreeThreadLedger: true, probeTreeOutputLayoutVersion: PROBE_TREE_OUTPUT_LAYOUT_VERSION },
  })
  if (!publishedGraphData) throw new Error('Probe-Tree could not publish its Rich Media ledger.')
  materialized = { ...materialized, graphData: publishedGraphData }
  args.onMaterialized(materialized.materializedNodeIds)
  const count = materialized.materializedNodeIds.length
  return {
    ...materialized,
    invocationToken,
    mcpInvoked,
    providerAccepted,
    kind: 'success',
    message: mcpInvoked
      ? `Generated ${count} context-specific Probe-Tree card${count === 1 ? '' : 's'} through knowgrph MCP.`
      : `Generated ${count} context-specific Probe-Tree card${count === 1 ? '' : 's'} through the explicitly approved provider; knowgrph MCP was unavailable.`,
    ...(mcpError ? { mcpError } : {}),
    ...(providerError ? { providerError } : {}),
  }
}

export async function runStoryboardWidgetProbeTreeTextGenerationInvocation(args: {
  graphForRun: GraphData | null | undefined
  nodeIds: readonly string[]
  requestedNodeId?: string
  fallbackNode: GraphNode
  resolutionContext?: StoryboardWidgetWorkflowNodeResolutionContext
  textGeneration: {
    prompt: string
    formId: unknown
    localProperties: Record<string, unknown>
    resolvedProperties: Record<string, unknown>
    runtimeProperties: StoryboardWidgetProbeTreeProviderRuntimeProperties
  }
  onMaterialized: (nodeIds: readonly string[]) => void
  onInvocationStart?: () => void
  publishOutput: StoryboardWidgetTextRunOutputPublisher
  setLoading: (loading: boolean) => void
  invokeMcp?: typeof invokeProbeTreeMcpBridge
  generateProviderResponse?: (prompt: string) => Promise<string | null>
}): Promise<StoryboardWidgetProbeTreeMcpRunResult | null> {
  const fallbackNode = args.resolutionContext && args.requestedNodeId
    ? resolveStoryboardWidgetProbeTreeSelectedRunNodeFromContext({ context: args.resolutionContext, requestedNodeId: args.requestedNodeId, fallbackNode: args.fallbackNode })
    : args.fallbackNode
  const invocationText = readStoryboardWidgetProbeTreeInvocationText(fallbackNode)
  if (!resolveStoryboardWidgetProbeTreeInvocationTokenForNode(fallbackNode, invocationText)) return null
  args.onInvocationStart?.()
  const { prompt, formId, localProperties, resolvedProperties, runtimeProperties } = args.textGeneration
  const resolvedThinking = resolveStoryboardWidgetTextThinkingOptions({
    formId,
    localProperties,
    prompt: prompt || invocationText,
    resolvedMaxCompletionTokens: resolvedProperties.chatMaxCompletionTokens ?? runtimeProperties.chatMaxCompletionTokens,
    resolvedThinkingJson: resolvedProperties.chatThinkingJson ?? runtimeProperties.chatThinkingJson,
    resolvedThinkingType: resolvedProperties.chatThinkingType ?? runtimeProperties.chatThinkingType,
  })
  args.setLoading(true)
  let publicationCompleted = false
  const generateProviderResponse = args.generateProviderResponse || (refinementPrompt => generateRunMarkdownWithProvider({
    config: {
      provider: resolvedProperties.chatProvider || runtimeProperties.chatProvider,
      endpointUrl: resolvedProperties.chatEndpointUrl || runtimeProperties.chatEndpointUrl,
      apiKey: (resolvedProperties.chatAuthMode || runtimeProperties.chatAuthMode) === 'byok' ? runtimeProperties.chatApiKey : '',
      chatModel: resolvedProperties.chatModel || runtimeProperties.chatModel,
    },
    prompt: refinementPrompt,
    options: {
      chatTemperature: resolvedProperties.chatTemperature ?? runtimeProperties.chatTemperature,
      chatMaxCompletionTokens: resolvedThinking.chatMaxCompletionTokens,
      chatServiceTier: resolvedProperties.chatServiceTier ?? runtimeProperties.chatServiceTier,
      chatStream: false,
      chatReasoningEffort: resolvedProperties.chatReasoningEffort ?? runtimeProperties.chatReasoningEffort,
      chatThinkingType: resolvedThinking.chatThinkingType,
      chatThinkingJson: resolvedThinking.chatThinkingJson,
      chatFrequencyPenalty: resolvedProperties.chatFrequencyPenalty ?? runtimeProperties.chatFrequencyPenalty,
      chatPresencePenalty: resolvedProperties.chatPresencePenalty ?? runtimeProperties.chatPresencePenalty,
      chatTopP: resolvedProperties.chatTopP ?? runtimeProperties.chatTopP,
    },
  }))
  try {
    const result = await runStoryboardWidgetProbeTreeMcpInvocation({
      graphForRun: args.graphForRun,
      nodeIds: args.nodeIds,
      fallbackNode,
      onMaterialized: args.onMaterialized,
      publishOutput: args.publishOutput,
      providerModel: String(resolvedProperties.chatModel || runtimeProperties.chatModel || ''),
      invokeMcp: args.invokeMcp,
      generateProviderResponse,
    })
    if (!result) throw new Error('Probe-Tree did not recognize the Widget Card invocation.')
    publicationCompleted = true
    return result
  } finally {
    if (!publicationCompleted) args.setLoading(false)
  }
}
