import type { GraphData } from '@/lib/graph/types'
import { hashSignatureParts } from '@/lib/hash/signature'
import { hashString32 } from '@/lib/hash/stringHash'
import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'
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

const mixGraphStructurePart = (hash: number, value: unknown): number => {
  const text = String(value ?? '').trim()
  return Math.imul((hash ^ hashString32(text)) >>> 0, 0x01000193) >>> 0
}

export function buildGraphStructureSemanticSignature(graphData?: GraphData | null): string {
  if (!graphData) return ''
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  const edges = Array.isArray(graphData.edges) ? graphData.edges : []
  let hash = 0x811c9dc5
  hash = mixGraphStructurePart(hash, `nodes:${nodes.length}`)
  hash = mixGraphStructurePart(hash, `edges:${edges.length}`)
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i] as { id?: unknown; type?: unknown; label?: unknown } | null | undefined
    hash = mixGraphStructurePart(hash, node?.id)
    hash = mixGraphStructurePart(hash, node?.type)
  }
  for (let i = 0; i < edges.length; i += 1) {
    const edge = edges[i]
    const { src, tgt } = readGraphEdgeEndpoints(edge)
    hash = mixGraphStructurePart(hash, (edge as { id?: unknown } | null | undefined)?.id)
    hash = mixGraphStructurePart(hash, src)
    hash = mixGraphStructurePart(hash, tgt)
    hash = mixGraphStructurePart(hash, (edge as { label?: unknown } | null | undefined)?.label)
  }
  return hash.toString(16).padStart(8, '0')
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
  const graphStructureSignature = buildGraphStructureSemanticSignature(graphData)
  const graphContext = String(graphData?.context || '').trim()
  const nodesCount = Array.isArray(graphData?.nodes) ? graphData.nodes.length : 0
  const edgesCount = Array.isArray(graphData?.edges) ? graphData.edges.length : 0

  if (
    graphRevision <= 0
    && !explicitSemanticKey
    && !sourceLayerHash
    && !sourceLayerOrderHash
    && !graphMetaKey
    && !graphStructureSignature
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
    graphStructureSignature,
    graphContext,
    nodesCount,
    edgesCount,
  ])
}
