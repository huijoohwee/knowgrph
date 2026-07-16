import {
  materializeProbeTreeBranchCardsFromGraphNode,
  type ProbeTreeBranchCardMaterializationResult,
} from '@/components/StoryboardCanvas/storyboardProbeTreeInvocationAction'
import {
  STORYBOARD_ACTION_PROPERTY_KEYS,
  STORYBOARD_PROMPT_PROPERTY_KEYS,
  STORYBOARD_SUMMARY_PROPERTY_KEYS,
} from '@/components/StoryboardCanvas/storyboardModel'
import type { StoryboardWidgetTextRunOutputPublisher } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowRichMediaPublication'
import {
  KNOWGRPH_PROBE_TREE_DOC_INVOCATION,
  KNOWGRPH_PROBE_TREE_INVOCATION_TOKENS,
} from '@/features/agentic-os/probeTreePromptPreset'
import {
  readGraphNodeCanonicalTextProperty,
  readGraphNodeCardTitle,
  readGraphNodeProperties,
} from '@/lib/cards/graphNodeCardFields'
import type { GraphData, GraphNode } from '@/lib/graph/types'

const INVOCATION_TOKEN_PATTERN = /(^|\s)([/#@][A-Za-z0-9_.-]+)/g
const PROBE_TREE_INVOCATION_TOKENS = new Set<string>(
  KNOWGRPH_PROBE_TREE_INVOCATION_TOKENS.map(token => token.toLowerCase()),
)
const PROBE_TREE_RICH_MEDIA_OUTPUT_KEY = 'probe-tree-branches'
const PROBE_TREE_RICH_MEDIA_PANEL_LABEL = 'Probe-Tree Branches'
const PROBE_TREE_LOCAL_MODEL = 'knowgrph-probe-tree-local-fallback'

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

export function readStoryboardWidgetProbeTreeInvocationText(node: GraphNode): string {
  const properties = readGraphNodeProperties(node)
  return [
    readGraphNodeCanonicalTextProperty(properties, STORYBOARD_PROMPT_PROPERTY_KEYS),
    readGraphNodeCanonicalTextProperty(properties, STORYBOARD_SUMMARY_PROPERTY_KEYS),
    readGraphNodeCanonicalTextProperty(properties, STORYBOARD_ACTION_PROPERTY_KEYS),
  ].filter(Boolean).join('\n')
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
  return [
    '# Probe-Tree Branches',
    '',
    `Invocation: ${KNOWGRPH_PROBE_TREE_INVOCATION_TOKENS.join(' ')}`,
    `Source: ${KNOWGRPH_PROBE_TREE_DOC_INVOCATION.sourcePath}`,
    'Mode: deterministic local fallback; select or edit a branch card before the next bounded turn.',
    'Cost: 0 prompt tokens, 0 completion tokens, $0 estimated cost.',
    '',
    ...(branchLines.length > 0 ? branchLines : [`- ${materialized.message}`]),
  ].join('\n')
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

export function publishStoryboardWidgetProbeTreeInvocation(args: {
  prompt: string
  graphData: GraphData | null | undefined
  nodeIds: readonly string[]
  fallbackNode: GraphNode
  commitGraphData: (current: GraphData, next: GraphData) => void
  onMaterialized: (nodeIds: readonly string[]) => void
}): StoryboardWidgetProbeTreeMaterializationResult | null {
  const current = args.graphData
  if (!current) return null
  const nodeIds = new Set(args.nodeIds.map(id => String(id || '')).filter(Boolean))
  const node = current.nodes.find(candidate => nodeIds.has(String(candidate?.id || ''))) || args.fallbackNode
  const materialized = materializeStoryboardWidgetProbeTreeInvocation({ prompt: args.prompt, graphData: current, node })
  if (materialized?.changed && materialized.graphData) {
    args.commitGraphData(current, materialized.graphData)
  }
  if (materialized && materialized.materializedNodeIds.length > 0) args.onMaterialized(materialized.materializedNodeIds)
  return materialized
}

export function runStoryboardWidgetProbeTreeInvocation(args: {
  graphForRun: GraphData | null | undefined
  nodeIds: readonly string[]
  fallbackNode: GraphNode
  commitGraphData: (current: GraphData, next: GraphData) => void
  onMaterialized: (nodeIds: readonly string[]) => void
  publishOutput: StoryboardWidgetTextRunOutputPublisher
}): StoryboardWidgetProbeTreeMaterializationResult | null {
  const prompt = readStoryboardWidgetProbeTreeInvocationText(args.fallbackNode)
  const materialized = publishStoryboardWidgetProbeTreeInvocation({
    prompt,
    graphData: args.graphForRun,
    nodeIds: args.nodeIds,
    fallbackNode: args.fallbackNode,
    commitGraphData: args.commitGraphData,
    onMaterialized: args.onMaterialized,
  })
  if (!materialized) return null
  args.publishOutput({
    anchorNode: args.fallbackNode,
    baseGraphData: materialized.graphData,
    outputText: buildStoryboardWidgetProbeTreeRichMediaMarkdown(materialized),
    title: PROBE_TREE_RICH_MEDIA_PANEL_LABEL,
    model: PROBE_TREE_LOCAL_MODEL,
    loading: false,
    outputKey: PROBE_TREE_RICH_MEDIA_OUTPUT_KEY,
    panelLabel: PROBE_TREE_RICH_MEDIA_PANEL_LABEL,
  })
  return materialized
}
