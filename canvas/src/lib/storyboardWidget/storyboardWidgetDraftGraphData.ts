import { readGraphDataRevision } from '@/lib/graph/documentMetadata'
import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'
import { readFlowEdgePortKey } from '@/lib/graph/flowPorts'
import { readNodeProperties } from '@/lib/graph/nodeProperties'
import { hashRecordSignature32, hashSignatureParts } from '@/lib/hash/signature'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'

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

const cleanSignatureText = (value: unknown): string => String(value ?? '').trim()

const readGraphMetadataIdentity = (graphData: GraphData | null | undefined): string => {
  const metadata = graphData?.metadata
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return ''
  const rec = metadata as Record<string, unknown>
  return [
    cleanSignatureText(rec.kind),
    cleanSignatureText(rec.source),
    cleanSignatureText(rec.sourceLayerHash),
    cleanSignatureText(rec.sourceLayerOrderHash),
    cleanSignatureText(rec.graphSemanticKey),
  ].join(':')
}

export function buildStoryboardWidgetDraftGraphBaseSignature(graphData: GraphData | null | undefined): string {
  const nodes = Array.isArray(graphData?.nodes) ? (graphData!.nodes as GraphNode[]) : []
  const edges = Array.isArray(graphData?.edges) ? (graphData!.edges as GraphEdge[]) : []
  const nodeParts = nodes
    .map(node => [
      cleanSignatureText(node?.id),
      cleanSignatureText(node?.type),
      cleanSignatureText(node?.label),
      String(hashRecordSignature32(readNodeProperties(node), { maxEntries: 120, maxDepth: 2 })),
    ].join(':'))
    .sort((left, right) => left.localeCompare(right))
  const edgeParts = edges
    .map(edge => {
      const { src, tgt } = readGraphEdgeEndpoints(edge)
      return [
        cleanSignatureText(edge?.id),
        cleanSignatureText(src),
        cleanSignatureText(tgt),
        cleanSignatureText(edge?.label),
        cleanSignatureText(readFlowEdgePortKey(edge, 'source')),
        cleanSignatureText(readFlowEdgePortKey(edge, 'target')),
        String(hashRecordSignature32(edge?.properties, { maxEntries: 120, maxDepth: 2 })),
      ].join(':')
    })
    .sort((left, right) => left.localeCompare(right))
  return hashSignatureParts([
    'storyboard-widget-draft-base',
    cleanSignatureText(graphData?.context),
    cleanSignatureText(graphData?.type),
    readGraphMetadataIdentity(graphData),
    nodes.length,
    ...nodeParts,
    edges.length,
    ...edgeParts,
  ])
}

function hasSameDraftGraphBaseSignature(currentDraft: GraphData | null, baseGraphData: GraphData | null): boolean {
  if (!currentDraft || !baseGraphData) return false
  return buildStoryboardWidgetDraftGraphBaseSignature(currentDraft) === buildStoryboardWidgetDraftGraphBaseSignature(baseGraphData)
}

export function bumpStoryboardWidgetDraftGraphDataRevision(graphData: GraphData, opts?: { revisionFloor?: number | null }): GraphData {
  const metadata = (graphData.metadata || {}) as Record<string, unknown>
  const current = Math.max(
    readGraphDataRevision(graphData),
    typeof opts?.revisionFloor === 'number' && Number.isFinite(opts.revisionFloor)
      ? Math.max(0, Math.floor(opts.revisionFloor))
      : 0,
  )
  return { ...graphData, metadata: { ...metadata, graphDataRevision: current + 1 } }
}

export function resolveStoryboardWidgetDraftGraphDataForBaseReset(args: {
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
  if (hasSameDraftGraphBaseSignature(current, base)) return current
  const currentRevision = readGraphDataRevision(current)
  const baseRevision = readGraphDataRevision(base)
  if (currentRevision < baseRevision) return base
  return hasCompatibleDraftNodeIdentity(current, base) ? current : base
}
