import { parseCanonicalNodeIds } from '@/lib/graph/canonicalNodeIds'
import { bumpStoryboardWidgetDraftGraphDataRevision } from '@/lib/storyboardWidget/storyboardWidgetDraftGraphData'
import { unwrapGraphCellValue } from '@/lib/graph/nodeProperties'
import type { GraphData, GraphNode } from '@/lib/graph/types'

export type StoryboardWidgetWorkflowOutputLoadingKind = 'text' | 'image' | 'video' | 'audio'

export function areStoryboardWidgetWorkflowRecordValuesEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    if (!Object.is(a[key], b[key])) return false
  }
  return true
}

export function collectStoryboardWidgetWorkflowCandidateNodeIds(nodeIds: ReadonlyArray<string>): Set<string> {
  const candidateIds = new Set<string>()
  for (let i = 0; i < nodeIds.length; i += 1) {
    for (const next of parseCanonicalNodeIds(nodeIds[i])) candidateIds.add(next)
  }
  return candidateIds
}

export function updateStoryboardWidgetWorkflowOutputForKnownNodeIds(args: {
  nodeIds: ReadonlyArray<string>
  fallbackNode: GraphNode
  fallbackWritableNodeId: string
  readLiveDraftGraphData: () => GraphData | null
  resolveNodeByIdAcrossGraphs: (candidateId: string) => GraphNode | null
  commitDraftGraphDataUpdate: (currentDraft: GraphData, nextDraft: GraphData) => void
  updateNode: (id: string, patch: Partial<GraphNode>) => void
  scheduleWorkflowOutputEdgeRefresh: () => void
  suppressStoreGraphWriteback?: boolean
  buildPatch: (nodeProps: Record<string, unknown>) => Record<string, unknown>
}): void {
  const candidateIds = collectStoryboardWidgetWorkflowCandidateNodeIds(args.nodeIds)
  const currentDraft = args.readLiveDraftGraphData()
  let updatedDraft = false
  if (currentDraft && Array.isArray(currentDraft.nodes) && currentDraft.nodes.length > 0) {
    let changed = false
    const nextNodes = currentDraft.nodes.map(existing => {
      const existingId = String(unwrapGraphCellValue(existing?.id) || '').trim()
      if (!existingId || !candidateIds.has(existingId)) return existing
      const currentProps = (existing.properties || {}) as Record<string, unknown>
      const nextProps = args.buildPatch(currentProps)
      if (areStoryboardWidgetWorkflowRecordValuesEqual(currentProps, nextProps)) return existing
      changed = true
      return { ...existing, properties: nextProps as never }
    })
    if (changed) {
      const nextDraft = bumpStoryboardWidgetDraftGraphDataRevision({ ...currentDraft, nodes: nextNodes })
      args.commitDraftGraphDataUpdate(currentDraft, nextDraft)
      updatedDraft = true
    }
  }

  if (args.suppressStoreGraphWriteback === true) {
    return
  }

  let updated = false
  for (const candidateId of Array.from(candidateIds.values())) {
    const hit = args.resolveNodeByIdAcrossGraphs(candidateId)
    if (!hit) continue
    const currentProps = (hit.properties || {}) as Record<string, unknown>
    const nextProps = args.buildPatch(currentProps)
    if (areStoryboardWidgetWorkflowRecordValuesEqual(currentProps, nextProps)) continue
    args.updateNode(candidateId, { properties: nextProps as never })
    updated = true
  }
  if (!updated) {
    const currentProps = (args.fallbackNode.properties || {}) as Record<string, unknown>
    const nextProps = args.buildPatch(currentProps)
    if (!areStoryboardWidgetWorkflowRecordValuesEqual(currentProps, nextProps)) {
      args.updateNode(args.fallbackWritableNodeId, { properties: nextProps as never })
      updated = true
    }
  }
  if (updated) args.scheduleWorkflowOutputEdgeRefresh()
}

export function setStoryboardWidgetWorkflowRunLoadingStateForKnownNodeIds(args: {
  nodeIds: ReadonlyArray<string>
  fallbackNode: GraphNode
  fallbackWritableNodeId: string
  loading: boolean
  kind?: StoryboardWidgetWorkflowOutputLoadingKind
  readLiveDraftGraphData: () => GraphData | null
  resolveNodeByIdAcrossGraphs: (candidateId: string) => GraphNode | null
  commitDraftGraphDataUpdate: (currentDraft: GraphData, nextDraft: GraphData) => void
  updateNode: (id: string, patch: Partial<GraphNode>) => void
  scheduleWorkflowOutputEdgeRefresh: () => void
  suppressStoreGraphWriteback?: boolean
}): void {
  updateStoryboardWidgetWorkflowOutputForKnownNodeIds({
    nodeIds: args.nodeIds,
    fallbackNode: args.fallbackNode,
    fallbackWritableNodeId: args.fallbackWritableNodeId,
    readLiveDraftGraphData: args.readLiveDraftGraphData,
    resolveNodeByIdAcrossGraphs: args.resolveNodeByIdAcrossGraphs,
    commitDraftGraphDataUpdate: args.commitDraftGraphDataUpdate,
    updateNode: args.updateNode,
    scheduleWorkflowOutputEdgeRefresh: args.scheduleWorkflowOutputEdgeRefresh,
    suppressStoreGraphWriteback: args.suppressStoreGraphWriteback,
    buildPatch: nodeProps => ({
      ...nodeProps,
      outputLoading: args.loading === true ? true : undefined,
      outputLoadingKind: args.loading === true ? (args.kind || undefined) : undefined,
      lastRunAt: args.loading === true ? new Date().toISOString() : nodeProps.lastRunAt,
    }),
  })
}
