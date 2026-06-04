import { parseCanonicalNodeIds } from '@/lib/graph/canonicalNodeIds'
import { readGraphDataRevision } from '@/lib/graph/documentMetadata'
import type { GraphData, GraphNode } from '@/lib/graph/types'

export type FlowEditorWorkflowOutputLoadingKind = 'text' | 'image' | 'video' | 'audio'

export function areFlowEditorWorkflowRecordValuesEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    if (!Object.is(a[key], b[key])) return false
  }
  return true
}

export function bumpFlowEditorWorkflowDraftGraphDataRevision(graphData: GraphData): GraphData {
  const metadata = (graphData.metadata || {}) as Record<string, unknown>
  const current = readGraphDataRevision(graphData)
  return { ...graphData, metadata: { ...metadata, graphDataRevision: current + 1 } }
}

export function collectFlowEditorWorkflowCandidateNodeIds(nodeIds: ReadonlyArray<string>): Set<string> {
  const candidateIds = new Set<string>()
  for (let i = 0; i < nodeIds.length; i += 1) {
    for (const next of parseCanonicalNodeIds(nodeIds[i])) candidateIds.add(next)
  }
  return candidateIds
}

export function updateFlowEditorWorkflowOutputForKnownNodeIds(args: {
  nodeIds: ReadonlyArray<string>
  fallbackNode: GraphNode
  fallbackWritableNodeId: string
  readLiveDraftGraphData: () => GraphData | null
  resolveNodeByIdAcrossGraphs: (candidateId: string) => GraphNode | null
  commitDraftGraphDataUpdate: (currentDraft: GraphData, nextDraft: GraphData) => void
  updateNode: (id: string, patch: Partial<GraphNode>) => void
  scheduleWorkflowOutputEdgeRefresh: () => void
  buildPatch: (nodeProps: Record<string, unknown>) => Record<string, unknown>
}): void {
  const candidateIds = collectFlowEditorWorkflowCandidateNodeIds(args.nodeIds)
  const currentDraft = args.readLiveDraftGraphData()
  if (currentDraft && Array.isArray(currentDraft.nodes) && currentDraft.nodes.length > 0) {
    let changed = false
    const nextNodes = currentDraft.nodes.map(existing => {
      const existingId = String(existing?.id || '').trim()
      if (!existingId || !candidateIds.has(existingId)) return existing
      const currentProps = (existing.properties || {}) as Record<string, unknown>
      const nextProps = args.buildPatch(currentProps)
      if (areFlowEditorWorkflowRecordValuesEqual(currentProps, nextProps)) return existing
      changed = true
      return { ...existing, properties: nextProps as never }
    })
    if (changed) {
      const nextDraft = bumpFlowEditorWorkflowDraftGraphDataRevision({ ...currentDraft, nodes: nextNodes })
      args.commitDraftGraphDataUpdate(currentDraft, nextDraft)
    }
  }

  let updated = false
  for (const candidateId of Array.from(candidateIds.values())) {
    const hit = args.resolveNodeByIdAcrossGraphs(candidateId)
    if (!hit) continue
    const currentProps = (hit.properties || {}) as Record<string, unknown>
    const nextProps = args.buildPatch(currentProps)
    if (areFlowEditorWorkflowRecordValuesEqual(currentProps, nextProps)) continue
    args.updateNode(candidateId, { properties: nextProps as never })
    updated = true
  }
  if (!updated) {
    const currentProps = (args.fallbackNode.properties || {}) as Record<string, unknown>
    const nextProps = args.buildPatch(currentProps)
    if (!areFlowEditorWorkflowRecordValuesEqual(currentProps, nextProps)) {
      args.updateNode(args.fallbackWritableNodeId, { properties: nextProps as never })
      updated = true
    }
  }
  if (updated) args.scheduleWorkflowOutputEdgeRefresh()
}

export function setFlowEditorWorkflowRunLoadingStateForKnownNodeIds(args: {
  nodeIds: ReadonlyArray<string>
  fallbackNode: GraphNode
  fallbackWritableNodeId: string
  loading: boolean
  kind?: FlowEditorWorkflowOutputLoadingKind
  readLiveDraftGraphData: () => GraphData | null
  resolveNodeByIdAcrossGraphs: (candidateId: string) => GraphNode | null
  commitDraftGraphDataUpdate: (currentDraft: GraphData, nextDraft: GraphData) => void
  updateNode: (id: string, patch: Partial<GraphNode>) => void
  scheduleWorkflowOutputEdgeRefresh: () => void
}): void {
  updateFlowEditorWorkflowOutputForKnownNodeIds({
    nodeIds: args.nodeIds,
    fallbackNode: args.fallbackNode,
    fallbackWritableNodeId: args.fallbackWritableNodeId,
    readLiveDraftGraphData: args.readLiveDraftGraphData,
    resolveNodeByIdAcrossGraphs: args.resolveNodeByIdAcrossGraphs,
    commitDraftGraphDataUpdate: args.commitDraftGraphDataUpdate,
    updateNode: args.updateNode,
    scheduleWorkflowOutputEdgeRefresh: args.scheduleWorkflowOutputEdgeRefresh,
    buildPatch: nodeProps => ({
      ...nodeProps,
      outputLoading: args.loading === true ? true : undefined,
      outputLoadingKind: args.loading === true ? (args.kind || undefined) : undefined,
      lastRunAt: args.loading === true ? new Date().toISOString() : nodeProps.lastRunAt,
    }),
  })
}
