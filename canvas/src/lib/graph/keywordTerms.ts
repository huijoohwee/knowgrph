import type { GraphData, GraphNode } from '@/lib/graph/types'

const KEYWORD_TERM_PROPERTY_KEYS = ['tags', 'keywords'] as const
export const GRAPH_KEYWORD_LANE_PROPERTY_KEYS = ['status', 'stage', 'column', 'lane', 'phase', 'track', 'swimlane', 'group', 'bucket', 'category', 'columnKey'] as const

const normalizeKeywordTerm = (value: unknown): string => {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

const splitKeywordTerms = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap(item => splitKeywordTerms(item))
  }
  const text = normalizeKeywordTerm(value)
  if (!text) return []
  return text
    .split(/[\n,;|]+/g)
    .map(part => normalizeKeywordTerm(part))
    .filter(Boolean)
}

const uniqueKeywordTerms = (values: readonly string[]): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const normalized = normalizeKeywordTerm(value)
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(normalized)
  }
  return out
}

const readNodeTypeKeywordTerm = (node: GraphNode): string[] => {
  const type = normalizeKeywordTerm(node.type)
  return type ? [type] : []
}

export function readGraphKeywordTermsFromProperties(properties: Record<string, unknown> | null | undefined): string[] {
  if (!properties) return []
  return uniqueKeywordTerms([
    ...KEYWORD_TERM_PROPERTY_KEYS.flatMap(key => splitKeywordTerms(properties[key])),
    ...GRAPH_KEYWORD_LANE_PROPERTY_KEYS.flatMap(key => splitKeywordTerms(properties[key])),
  ])
}

export function readGraphNodeCentralizedKeywordTerms(node: GraphNode): string[] {
  const properties = node && typeof node.properties === 'object' && node.properties && !Array.isArray(node.properties)
    ? (node.properties as Record<string, unknown>)
    : null
  return uniqueKeywordTerms([
    ...readGraphKeywordTermsFromProperties(properties),
    ...readNodeTypeKeywordTerm(node),
  ])
}

export type GraphKeywordTermStat = {
  term: string
  count: number
  nodeIds: string[]
}

export function collectGraphKeywordTermStats(
  graphData: GraphData | null | undefined,
  limit: number | null = null,
): GraphKeywordTermStat[] {
  const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : []
  const nodeIdsByTerm = new Map<string, { term: string; nodeIds: string[]; nodeIdSet: Set<string> }>()
  for (const node of nodes) {
    const nodeId = normalizeKeywordTerm(node?.id)
    if (!nodeId) continue
    for (const term of readGraphNodeCentralizedKeywordTerms(node)) {
      const key = term.toLowerCase()
      const entry = nodeIdsByTerm.get(key) || { term, nodeIds: [], nodeIdSet: new Set<string>() }
      if (!entry.nodeIdSet.has(nodeId)) {
        entry.nodeIdSet.add(nodeId)
        entry.nodeIds.push(nodeId)
      }
      nodeIdsByTerm.set(key, entry)
    }
  }
  const stats = Array.from(nodeIdsByTerm.values())
    .map(entry => ({
      term: entry.term,
      count: entry.nodeIds.length,
      nodeIds: entry.nodeIds,
    }))
    .sort((left, right) => {
      const countDiff = right.count - left.count
      if (countDiff !== 0) return countDiff
      return left.term.localeCompare(right.term)
    })
  if (limit == null) return stats
  return stats.slice(0, Math.max(0, Math.floor(limit)))
}
