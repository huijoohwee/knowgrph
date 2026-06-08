import { readGraphDataRevision } from '@/lib/graph/documentMetadata'
import type { GraphData } from '@/lib/graph/types'

function readNodeIds(graphData: GraphData | null | undefined): string[] {
  return (Array.isArray(graphData?.nodes) ? graphData.nodes : [])
    .map(node => String(node?.id || '').trim())
    .filter(Boolean)
}

function hasCompatibleDraftNodeIdentity(currentDraft: GraphData | null, baseGraphData: GraphData | null): boolean {
  const draftNodeIds = readNodeIds(currentDraft)
  const baseNodeIds = new Set(readNodeIds(baseGraphData))
  if (draftNodeIds.length === 0 || baseNodeIds.size === 0) return false
  const sharedCount = draftNodeIds.filter(id => baseNodeIds.has(id)).length
  return sharedCount >= Math.max(1, Math.min(draftNodeIds.length, baseNodeIds.size) * 0.8)
}

export function bumpFlowEditorDraftGraphDataRevision(graphData: GraphData): GraphData {
  const metadata = (graphData.metadata || {}) as Record<string, unknown>
  const current = readGraphDataRevision(graphData)
  return { ...graphData, metadata: { ...metadata, graphDataRevision: current + 1 } }
}

export function resolveFlowEditorDraftGraphDataForBaseReset(args: {
  activeDocumentKey: string
  previousDocumentKey: string | null
  currentDraftGraphData: GraphData | null
  nextBaseGraphData: GraphData | null
}): GraphData | null {
  const base = args.nextBaseGraphData
  if (!base) return null
  const current = args.currentDraftGraphData
  if (!current || current === base) return base
  if (args.previousDocumentKey !== args.activeDocumentKey) return base
  const currentRevision = readGraphDataRevision(current)
  const baseRevision = readGraphDataRevision(base)
  if (currentRevision <= baseRevision) return base
  return hasCompatibleDraftNodeIdentity(current, base) ? current : base
}
