import { splitComposedNodeId } from '@/lib/graph/canonicalNodeIds'
import type { GraphData } from '@/lib/graph/types'

function readGraphNodes(graphData: GraphData | null | undefined) {
  return Array.isArray(graphData?.nodes) ? graphData.nodes : []
}

function countComposedNodeIds(graphData: GraphData | null | undefined): number {
  const nodes = readGraphNodes(graphData)
  let count = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const id = String(nodes[i]?.id || '').trim()
    if (!id) continue
    const parts = splitComposedNodeId(id)
    if (parts.full && parts.inner && parts.full !== parts.inner) count += 1
  }
  return count
}

function countExactNodeIdMatches(graphData: GraphData | null | undefined, rawIds: ReadonlyArray<string>): number {
  const nodes = readGraphNodes(graphData)
  if (nodes.length === 0 || rawIds.length === 0) return 0
  const nodeIds = new Set(nodes.map(node => String(node?.id || '').trim()).filter(Boolean))
  let count = 0
  const seen = new Set<string>()
  for (let i = 0; i < rawIds.length; i += 1) {
    const id = String(rawIds[i] || '').trim()
    if (!id || seen.has(id) || !nodeIds.has(id)) continue
    seen.add(id)
    count += 1
  }
  return count
}

function countSharedInnerNodeIds(left: GraphData | null | undefined, right: GraphData | null | undefined): number {
  const leftNodes = readGraphNodes(left)
  const rightNodes = readGraphNodes(right)
  if (leftNodes.length === 0 || rightNodes.length === 0) return 0
  const rightInnerIds = new Set<string>()
  for (let i = 0; i < rightNodes.length; i += 1) {
    const inner = splitComposedNodeId(rightNodes[i]?.id).inner
    if (inner) rightInnerIds.add(inner)
  }
  let count = 0
  const seen = new Set<string>()
  for (let i = 0; i < leftNodes.length; i += 1) {
    const inner = splitComposedNodeId(leftNodes[i]?.id).inner
    if (!inner || seen.has(inner) || !rightInnerIds.has(inner)) continue
    seen.add(inner)
    count += 1
  }
  return count
}

export function shouldPreferScopedGraphDataAuthority(args: {
  candidateGraphData: GraphData | null
  authorityGraphData: GraphData | null
  nodeIds?: ReadonlyArray<string> | null
}): boolean {
  const candidate = args.candidateGraphData
  const authority = args.authorityGraphData
  if (!authority || candidate === authority) return false
  if (!candidate) return true

  const nodeIds = Array.from(new Set((args.nodeIds || []).map(id => String(id || '').trim()).filter(Boolean)))
  if (nodeIds.length > 0) {
    const candidateExact = countExactNodeIdMatches(candidate, nodeIds)
    const authorityExact = countExactNodeIdMatches(authority, nodeIds)
    if (authorityExact > candidateExact) return true
    if (candidateExact > authorityExact) return false
  }

  const authorityComposedCount = countComposedNodeIds(authority)
  const candidateComposedCount = countComposedNodeIds(candidate)
  if (authorityComposedCount <= candidateComposedCount) return false

  const candidateNodeCount = readGraphNodes(candidate).length
  const authorityNodeCount = readGraphNodes(authority).length
  if (candidateNodeCount === 0 || authorityNodeCount === 0) return false

  const sharedInnerCount = countSharedInnerNodeIds(candidate, authority)
  return sharedInnerCount >= Math.max(1, Math.min(candidateNodeCount, authorityNodeCount) * 0.5)
}

export function resolveFlowEditorGraphDataForNodeAuthority(args: {
  preferredGraphData: GraphData | null
  authorityGraphData: GraphData | null
  nodeIds?: ReadonlyArray<string> | null
}): GraphData | null {
  return shouldPreferScopedGraphDataAuthority({
    candidateGraphData: args.preferredGraphData,
    authorityGraphData: args.authorityGraphData,
    nodeIds: args.nodeIds,
  })
    ? args.authorityGraphData
    : (args.preferredGraphData || args.authorityGraphData || null)
}
