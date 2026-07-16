import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/config'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { createUniqueId } from '@/lib/ids'
import { bumpStoryboardWidgetDraftGraphDataRevision } from '@/lib/storyboardWidget/storyboardWidgetDraftGraphData'
import { buildCanonicalNodeIdSet, isCanonicalNodeIdEqual } from '@/lib/graph/canonicalNodeIds'

export type StoryboardWidgetWorkflowTransactionNodeArgs = {
  id?: string | null
  type: string
  label?: string | null
  x: number
  y: number
  properties?: Record<string, unknown>
}

export function createStoryboardWidgetWorkflowPublicationTransaction(args: {
  readLiveDraftGraphData: () => GraphData | null
  commitDraftGraphDataUpdate: (currentDraft: GraphData, nextDraft: GraphData) => void
  commitPublishedGraphData?: (graphData: GraphData) => void
  updateNode: (id: string, patch: Partial<GraphNode>) => void
  appendWorkflowOutputEdge?: (edge: GraphEdge) => void
  scheduleWorkflowOutputEdgeRefresh: () => void
}) {
  const initialDraft = args.readLiveDraftGraphData()
  if (!initialDraft) return null
  let transactionDraft = initialDraft

  const readDraftGraphData = () => transactionDraft
  const commitDraftGraphDataUpdate = (_current: GraphData, next: GraphData) => {
    transactionDraft = next
  }
  const appendDraftNode = (nodeArgs: StoryboardWidgetWorkflowTransactionNodeArgs): string => {
    const usedNodeIds = buildCanonicalNodeIdSet((transactionDraft.nodes || []).map(node => node?.id))
    const requestedId = String(nodeArgs.id || '').trim()
    const nodeId = requestedId && !usedNodeIds.has(requestedId)
      ? requestedId
      : createUniqueId('n', usedNodeIds)
    const node: GraphNode = {
      id: nodeId,
      type: String(nodeArgs.type || '').trim() || FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
      label: String(nodeArgs.label || '').trim() || nodeId,
      x: Number.isFinite(nodeArgs.x) ? nodeArgs.x : 0,
      y: Number.isFinite(nodeArgs.y) ? nodeArgs.y : 0,
      properties: { ...(nodeArgs.properties || {}) } as never,
    }
    transactionDraft = bumpStoryboardWidgetDraftGraphDataRevision({
      ...transactionDraft,
      nodes: [...(transactionDraft.nodes || []), node],
      edges: Array.isArray(transactionDraft.edges) ? transactionDraft.edges : [],
    })
    return nodeId
  }
  const finish = (finishArgs: {
    preferPublishedGraphCommit: boolean
    updatedNodeIds: readonly string[]
    appendedEdges?: readonly GraphEdge[]
  }): boolean => {
    const publishCanonicalGraph = finishArgs.preferPublishedGraphCommit
      ? args.commitPublishedGraphData
      : undefined
    if (transactionDraft === initialDraft) {
      if (!publishCanonicalGraph) return false
      // An explicit terminal run also repairs a canonical/store authority that
      // may lag an already-current draft after source reindexing.
      publishCanonicalGraph(transactionDraft)
      args.scheduleWorkflowOutputEdgeRefresh()
      return true
    }
    if (publishCanonicalGraph) {
      publishCanonicalGraph(transactionDraft)
    } else {
      args.commitDraftGraphDataUpdate(initialDraft, transactionDraft)
      for (const nodeId of finishArgs.updatedNodeIds) {
        const node = transactionDraft.nodes.find(candidate => isCanonicalNodeIdEqual(candidate?.id, nodeId)) || null
        if (node) args.updateNode(nodeId, { properties: node.properties })
      }
      for (const edge of finishArgs.appendedEdges || []) args.appendWorkflowOutputEdge?.(edge)
    }
    args.scheduleWorkflowOutputEdgeRefresh()
    return true
  }

  return {
    appendDraftNode,
    commitDraftGraphDataUpdate,
    finish,
    readDraftGraphData,
  }
}
