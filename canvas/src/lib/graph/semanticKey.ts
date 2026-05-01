import type { GraphData } from '@/lib/graph/types'
import { hashSignatureParts } from '@/lib/hash/signature'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'

type BuildScopedGraphSemanticKeyArgs = {
  graphData?: GraphData | null
  graphRevision?: number | null
  graphSemanticKey?: string | null
  sourceLayerHash?: string | null
  sourceLayerOrderHash?: string | null
}

export function readGraphRevision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

export function buildScopedGraphSemanticKey(
  scope: string,
  args: BuildScopedGraphSemanticKeyArgs = {},
): string {
  const graphData = args.graphData || null
  const graphRevision = readGraphRevision(args.graphRevision)
  const explicitSemanticKey = String(args.graphSemanticKey || '').trim()
  const sourceLayerHash = String(args.sourceLayerHash || '').trim()
  const sourceLayerOrderHash = String(args.sourceLayerOrderHash || '').trim()
  const graphMetaKey = buildGraphMetaKeyIgnoringPending(graphData)
  const graphContext = String(graphData?.context || '').trim()
  const nodesCount = Array.isArray(graphData?.nodes) ? graphData.nodes.length : 0
  const edgesCount = Array.isArray(graphData?.edges) ? graphData.edges.length : 0

  if (
    graphRevision <= 0
    && !explicitSemanticKey
    && !sourceLayerHash
    && !sourceLayerOrderHash
    && !graphMetaKey
    && !graphContext
    && !graphData
  ) {
    return ''
  }

  return hashSignatureParts([
    scope,
    graphRevision > 0 ? `rev:${graphRevision}` : '',
    explicitSemanticKey,
    sourceLayerHash,
    sourceLayerOrderHash,
    graphMetaKey,
    graphContext,
    nodesCount,
    edgesCount,
  ])
}
