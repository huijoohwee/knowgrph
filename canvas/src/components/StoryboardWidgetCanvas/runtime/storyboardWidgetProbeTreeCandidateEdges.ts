import { readGraphNodeProperties } from '@/lib/cards/graphNodeCardFields'
import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'
import { unwrapGraphCellValue } from '@/lib/graph/nodeProperties'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { bumpStoryboardWidgetDraftGraphDataRevision } from '@/lib/storyboardWidget/storyboardWidgetDraftGraphData'

const readString = (value: unknown): string => String(unwrapGraphCellValue(value) ?? '').trim()

const isProbeTreeBranchNode = (node: GraphNode): boolean => {
  const properties = readGraphNodeProperties(node)
  return readString(properties.cardTypeLabel) === 'Probe-Tree Card'
    || readString(properties.probeTreeCandidateKey).length > 0
    || readString(properties.probeTreeResponseMode).length > 0
}

export function normalizeProbeTreeCandidateEdges(args: {
  graphData: GraphData
  threadRootId: string
  threadNodeIds: ReadonlySet<string>
}): GraphData {
  const existingCandidateTargetIds = new Set((args.graphData.edges || [])
    .filter(edge => readString(edge.label) === 'candidateOption')
    .map(edge => readGraphEdgeEndpoints(edge).tgt)
    .filter(Boolean))
  const declaredParentByTargetId = new Map<string, string>()
  for (const node of args.graphData.nodes || []) {
    const nodeId = readString(node.id)
    if (!nodeId || nodeId === args.threadRootId || !args.threadNodeIds.has(nodeId)) continue
    if (!isProbeTreeBranchNode(node) && !existingCandidateTargetIds.has(nodeId)) continue
    const properties = readGraphNodeProperties(node)
    const parentNodeId = readString(properties.parentNodeId || properties.parentGraphNodeId)
    if (parentNodeId && args.threadNodeIds.has(parentNodeId)) declaredParentByTargetId.set(nodeId, parentNodeId)
  }
  const parentByTargetId = new Map<string, string>()
  for (const [targetNodeId, parentNodeId] of declaredParentByTargetId) {
    const seenNodeIds = new Set<string>([targetNodeId])
    let ancestorNodeId = parentNodeId
    while (ancestorNodeId && ancestorNodeId !== args.threadRootId && !seenNodeIds.has(ancestorNodeId)) {
      seenNodeIds.add(ancestorNodeId)
      ancestorNodeId = declaredParentByTargetId.get(ancestorNodeId) || ''
    }
    if (ancestorNodeId === args.threadRootId) parentByTargetId.set(targetNodeId, parentNodeId)
  }
  const retainedEdges: GraphEdge[] = []
  const retainedCandidateTargets = new Set<string>()
  let changed = false
  for (const edge of args.graphData.edges || []) {
    if (readString(edge.label) !== 'candidateOption') {
      retainedEdges.push(edge)
      continue
    }
    const { src, tgt } = readGraphEdgeEndpoints(edge)
    if (!args.threadNodeIds.has(src) && !args.threadNodeIds.has(tgt)) {
      retainedEdges.push(edge)
      continue
    }
    const expectedParentId = parentByTargetId.get(tgt)
    if (!expectedParentId && args.threadNodeIds.has(tgt)) {
      changed = true
      continue
    }
    if (!expectedParentId || src !== expectedParentId || retainedCandidateTargets.has(tgt)) {
      changed = true
      continue
    }
    retainedCandidateTargets.add(tgt)
    retainedEdges.push(edge)
  }
  const edgeIds = new Set(retainedEdges.map(edge => readString(edge.id)).filter(Boolean))
  for (const [targetNodeId, parentNodeId] of parentByTargetId) {
    if (retainedCandidateTargets.has(targetNodeId)) continue
    let edgeId = `probe-tree:candidate:${parentNodeId}:${targetNodeId}`
    while (edgeIds.has(edgeId)) edgeId = `${edgeId}:canonical`
    edgeIds.add(edgeId)
    retainedEdges.push({
      id: edgeId,
      source: parentNodeId,
      target: targetNodeId,
      label: 'candidateOption',
      properties: { evidenceKind: 'layout-canonical', confidence: 'medium' },
    })
    changed = true
  }
  return changed
    ? bumpStoryboardWidgetDraftGraphDataRevision({ ...args.graphData, edges: retainedEdges })
    : args.graphData
}
