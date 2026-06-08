import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { FLOW_SWARM_PREDICTION_NODE_TYPE_ID, FLOW_TEXT_GENERATION_NODE_TYPE_ID, FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID } from '@/lib/config'
import { readFlowComputeSource } from '@/lib/flowEditor/flowComputeInline'

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readPlainRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function readStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(cleanString).filter(Boolean)
  const single = cleanString(value)
  return single ? [single] : []
}

function pushUnique(out: string[], seen: Set<string>, values: ReadonlyArray<string>) {
  for (const value of values) {
    const id = cleanString(value)
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
}

function readWidgetCardValue(node: GraphNode | null): Record<string, unknown> | null {
  const properties = readPlainRecord(node?.properties)
  const card = readPlainRecord(properties?.['canvas:widgetCard'])
  if (!card) return null
  return readPlainRecord(card.value) || card
}

function readRunDownstreamConfigTargetIds(value: unknown): string[] {
  const config = readPlainRecord(value)
  if (!config || cleanString(config.trigger) !== 'runDownstream') return []
  return [
    ...readStringList(config.targets),
    ...readStringList(config.targetIds),
    ...readStringList(config.target),
    ...readStringList(config.targetNodeId),
  ]
}

export function readFlowWidgetCardRunDownstreamTargetIds(node: GraphNode | null): string[] {
  const cardValue = readWidgetCardValue(node)
  if (!cardValue) return []

  const seen = new Set<string>()
  const out: string[] = []
  pushUnique(out, seen, readRunDownstreamConfigTargetIds(cardValue.onEdit))

  const actions = Array.isArray(cardValue.actions) ? cardValue.actions : []
  for (const action of actions) {
    pushUnique(out, seen, readRunDownstreamConfigTargetIds(action))
  }

  return out
}

function readOutgoingEdgeTargetIds(args: { node: GraphNode; graphData: GraphData | null }): string[] {
  const sourceId = cleanString(args.node.id)
  if (!sourceId || !Array.isArray(args.graphData?.edges)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const edge of args.graphData.edges as GraphEdge[]) {
    const endpoints = readGraphEdgeEndpoints(edge)
    if (endpoints.src !== sourceId) continue
    pushUnique(out, seen, [endpoints.tgt])
  }
  return out
}

export function resolveFlowEditorWorkflowDownstreamRunTargetIds(args: {
  node: GraphNode
  graphData: GraphData | null
}): string[] {
  const graphNodeIds = new Set(
    (Array.isArray(args.graphData?.nodes) ? args.graphData!.nodes : [])
      .map(node => cleanString(node?.id))
      .filter(Boolean),
  )
  const sourceId = cleanString(args.node.id)
  const authoredTargetIds = readFlowWidgetCardRunDownstreamTargetIds(args.node)
  const candidateTargetIds = authoredTargetIds.length > 0
    ? authoredTargetIds
    : readOutgoingEdgeTargetIds({ node: args.node, graphData: args.graphData })

  const seen = new Set<string>()
  const out: string[] = []
  for (const targetId of candidateTargetIds) {
    const id = cleanString(targetId)
    if (!id || id === sourceId || seen.has(id)) continue
    if (graphNodeIds.size > 0 && !graphNodeIds.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function isFlowEditorWorkflowRunnableNode(args: {
  node: GraphNode | null
  resolveRichMediaKind?: (node: GraphNode) => unknown
}): boolean {
  const node = args.node
  if (!node) return false
  const nodeType = cleanString(node.type)
  if (readFlowComputeSource(node)) return true
  if (nodeType === FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID) return true
  if (nodeType === FLOW_SWARM_PREDICTION_NODE_TYPE_ID) return true
  if (nodeType === FLOW_TEXT_GENERATION_NODE_TYPE_ID) return true
  return Boolean(args.resolveRichMediaKind?.(node))
}
