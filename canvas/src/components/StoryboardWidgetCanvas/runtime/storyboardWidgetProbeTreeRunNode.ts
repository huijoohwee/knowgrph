import {
  readGraphNodeCanonicalTextProperty,
  readGraphNodeProperties,
} from '@/lib/cards/graphNodeCardFields'
import { STORYBOARD_OUTPUT_PROPERTY_KEYS, STORYBOARD_SUMMARY_PROPERTY_KEYS } from '@/components/StoryboardCanvas/storyboardModel'
import { unwrapGraphCellValue } from '@/lib/graph/nodeProperties'
import type { GraphNode } from '@/lib/graph/types'
import type { StoryboardWidgetWorkflowNodeResolutionContext } from './storyboardWidgetRenderGraph'

const readGraphIdentity = (value: unknown): string => String(unwrapGraphCellValue(value) ?? '').trim()

export const isStoryboardWidgetProbeTreeContinuationNode = (node: GraphNode): boolean => {
  const properties = readGraphNodeProperties(node)
  const parentNodeId = readGraphIdentity(properties.parentNodeId || properties.parentGraphNodeId)
  const responseOwned = readGraphIdentity(properties.probeTreeResponseMode) === 'llm-contract'
    || readGraphIdentity(properties.cardTypeLabel) === 'Probe-Tree Card'
  return parentNodeId.length > 0 && responseOwned
}

export function resolveStoryboardWidgetProbeTreeSelectedRunNode(args: {
  requestedNodeId: string
  fallbackNode: GraphNode
  candidates: ReadonlyArray<GraphNode | null | undefined>
}): GraphNode {
  const requestedNodeId = readGraphIdentity(args.requestedNodeId) || readGraphIdentity(args.fallbackNode.id)
  const exactCandidates = args.candidates.filter((node): node is GraphNode => (
    Boolean(node) && readGraphIdentity(node?.id) === requestedNodeId
  ))
  const continuationNode = exactCandidates.find(isStoryboardWidgetProbeTreeContinuationNode)
  if (!continuationNode) return args.fallbackNode

  const continuationCandidates = exactCandidates.filter(isStoryboardWidgetProbeTreeContinuationNode)
  const authoredCandidates = [
    ...continuationCandidates,
    ...exactCandidates.filter(node => !continuationCandidates.includes(node)),
  ]
  const authoredOutput = authoredCandidates
    .map(node => readGraphNodeCanonicalTextProperty(readGraphNodeProperties(node), STORYBOARD_OUTPUT_PROPERTY_KEYS))
    .find(Boolean)
  const authoredSummary = authoredCandidates
    .map(node => readGraphNodeCanonicalTextProperty(readGraphNodeProperties(node), STORYBOARD_SUMMARY_PROPERTY_KEYS))
    .find(Boolean)
  if (!authoredOutput && !authoredSummary) return continuationNode
  return {
    ...continuationNode,
    properties: {
      ...readGraphNodeProperties(continuationNode),
      ...(authoredOutput ? { output: authoredOutput } : {}),
      ...(authoredSummary ? { summary: authoredSummary } : {}),
    },
  }
}

export function resolveStoryboardWidgetProbeTreeSelectedRunNodeFromContext(args: {
  context: StoryboardWidgetWorkflowNodeResolutionContext
  requestedNodeId: string
  fallbackNode: GraphNode
}): GraphNode {
  const { context, fallbackNode, requestedNodeId } = args
  return resolveStoryboardWidgetProbeTreeSelectedRunNode({
    requestedNodeId,
    fallbackNode,
    candidates: [
      ...context.renderNodes,
      ...context.storeNodes,
      ...context.draftNodes,
      ...context.baseNodes,
      fallbackNode,
    ],
  })
}
