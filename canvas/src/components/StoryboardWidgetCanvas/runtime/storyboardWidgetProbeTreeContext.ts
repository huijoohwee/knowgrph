import {
  STORYBOARD_OUTPUT_PROPERTY_KEYS,
  STORYBOARD_SUMMARY_PROPERTY_KEYS,
} from '@/components/StoryboardCanvas/storyboardModel'
import { collectAgenticOsRuntimeInvocations } from '@/features/chat/chatRuntimeInvocationProfile'
import { resolveChatRuntimeInvocationQuery } from '@/features/chat/chatRuntimeInvocationQuery'
import {
  readGraphNodeCanonicalTextProperty,
  readGraphNodeCardTitle,
  readGraphNodeProperties,
} from '@/lib/cards/graphNodeCardFields'
import { unwrapGraphCellValue } from '@/lib/graph/nodeProperties'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { isStoryboardWidgetProbeTreeContinuationNode } from './storyboardWidgetProbeTreeRunNode'

const MAX_PROBE_TREE_LINEAGE_DEPTH = 8

const readGraphIdentity = (value: unknown): string => String(unwrapGraphCellValue(value) ?? '').trim()

const buildProbeTreeLineageContext = (graphData: GraphData, node: GraphNode): string => {
  if (!isStoryboardWidgetProbeTreeContinuationNode(node)) return ''
  const nodeById = new Map(graphData.nodes.map(candidate => [readGraphIdentity(candidate.id), candidate]))
  const seen = new Set<string>([readGraphIdentity(node.id)])
  const lineage: string[] = []
  let parentNodeId = readGraphIdentity(readGraphNodeProperties(node).parentNodeId)
  while (parentNodeId && !seen.has(parentNodeId) && lineage.length < MAX_PROBE_TREE_LINEAGE_DEPTH) {
    seen.add(parentNodeId)
    const parentNode = nodeById.get(parentNodeId)
    if (!parentNode) break
    const properties = readGraphNodeProperties(parentNode)
    const question = readGraphNodeCanonicalTextProperty(properties, STORYBOARD_SUMMARY_PROPERTY_KEYS)
    const answer = readGraphNodeCanonicalTextProperty(properties, STORYBOARD_OUTPUT_PROPERTY_KEYS)
    const detail = [question ? `question=${question}` : '', answer ? `answer=${answer}` : ''].filter(Boolean).join('; ')
    if (detail) lineage.push(`${parentNodeId}: ${detail}`)
    parentNodeId = readGraphIdentity(properties.parentNodeId || properties.parentGraphNodeId)
  }
  return lineage.join(' | ')
}

export function buildStoryboardWidgetProbeTreeContextText(args: {
  graphData: GraphData
  node: GraphNode
  prompt: string
}): string {
  const { graphData, node, prompt } = args
  const route = resolveChatRuntimeInvocationQuery(prompt).leadingRoute
  const agenticInvocations = collectAgenticOsRuntimeInvocations(prompt)
  const properties = readGraphNodeProperties(node)
  const isContinuation = isStoryboardWidgetProbeTreeContinuationNode(node)
  const continuationQuestion = isContinuation
    ? readGraphNodeCanonicalTextProperty(properties, STORYBOARD_SUMMARY_PROPERTY_KEYS)
    : ''
  const continuationAnswer = isContinuation
    ? readGraphNodeCanonicalTextProperty(properties, STORYBOARD_OUTPUT_PROPERTY_KEYS)
    : ''
  const lineageContext = buildProbeTreeLineageContext(graphData, node)
  return [
    'Authored request:',
    prompt,
    continuationQuestion ? `Selected continuation question: ${continuationQuestion}` : '',
    continuationAnswer ? `Selected continuation answer: ${continuationAnswer}` : '',
    lineageContext ? `Probe lineage context: ${lineageContext}` : '',
    `Selected Widget title: ${readGraphNodeCardTitle(node)}`,
    `Selected Widget id: ${readGraphIdentity(node.id)}`,
    route ? `Invocation route: ${route.token} — ${route.label}. Route summary: ${route.summary}` : '',
    agenticInvocations.length > 0
      ? `Agentic OS directives: ${agenticInvocations.map(invocation => `${invocation.token} — ${invocation.label}: ${invocation.summary}`).join(' | ')}`
      : '',
  ].filter(Boolean).join('\n').slice(0, 12_000)
}
