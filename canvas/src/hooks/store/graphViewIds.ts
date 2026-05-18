import type { GraphState } from '@/hooks/store/types'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import { buildFlowWidgetOverlayEligibleNodeIdSet } from '@/lib/graph/flowWidgetEligibility'
import {
  deriveFrontmatterFlowOverlayNodeIds,
  resolveGraphNodeIdByCanonicalId,
} from '@/lib/flowEditor/frontmatterOverlayNodeIds'

export const normalizeIds = (ids: string[]): string[] => {
  const unique = new Set<string>()
  for (let i = 0; i < ids.length; i += 1) {
    const id = String(ids[i] || '').trim()
    if (!id) continue
    unique.add(id)
  }
  return Array.from(unique).sort((a, b) => a.localeCompare(b))
}

export const normalizeIdsPreserveOrder = (ids: string[]): string[] => {
  const out: string[] = []
  const seen = new Set<string>()
  for (let i = 0; i < ids.length; i += 1) {
    const id = String(ids[i] || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export const normalizeOpenWidgetNodeIds = (
  ids: string[],
  graphData: GraphState['graphData'] | null,
): string[] => {
  const normalized = normalizeIdsPreserveOrder(Array.isArray(ids) ? ids : [])
  if (!graphData) return normalized
  const nodeIds = new Set<string>((graphData.nodes || []).map(n => String(n.id || '')).filter(Boolean))
  const validNodeIds: string[] = []
  const seenValidIds = new Set<string>()
  for (let i = 0; i < normalized.length; i += 1) {
    const rawId = normalized[i]
    const resolvedId = resolveGraphNodeIdByCanonicalId(graphData, rawId) || rawId
    if (!nodeIds.has(resolvedId) || seenValidIds.has(resolvedId)) continue
    seenValidIds.add(resolvedId)
    validNodeIds.push(resolvedId)
  }
  if (!isFrontmatterFlowGraph(graphData)) {
    const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
    const eligible = buildFlowWidgetOverlayEligibleNodeIdSet(nodes as any)
    if (eligible.size === 0) return validNodeIds
    return validNodeIds.filter(id => eligible.has(id))
  }
  const allowedFrontmatterOverlayIds = new Set<string>(deriveFrontmatterFlowOverlayNodeIds(graphData))
  if (allowedFrontmatterOverlayIds.size === 0) return []
  return validNodeIds.filter(id => allowedFrontmatterOverlayIds.has(id))
}
