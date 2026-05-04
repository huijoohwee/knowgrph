import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'

export function normalizeTextForTokens(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

export function tokenizeForStats(
  text: string,
  minTokenLength: number,
  stopwords: ReadonlySet<string>,
): string[] {
  const trimmed = (text || '').toLowerCase()
  if (!trimmed) return []
  const parts = trimmed.split(/[^a-z0-9_]+/g).filter(Boolean)
  const out: string[] = []
  for (let i = 0; i < parts.length; i += 1) {
    const token = parts[i]
    if (token.length < minTokenLength) continue
    if (stopwords.has(token)) continue
    out.push(token)
  }
  return out
}

export type StatsTokenizationConfig = {
  textKeys: string[]
  minTokenLength: number
  maxTokensPerNode: number
  stopwords: ReadonlySet<string>
  includeTokens?: ReadonlySet<string> | null
}

export function getStatsTokenizationConfig(schema: GraphSchema): StatsTokenizationConfig {
  void schema
  return { textKeys: [], minTokenLength: 3, maxTokensPerNode: 2000, stopwords: new Set<string>() }
}

export function buildTokenFrequenciesForNodes(
  nodes: GraphNode[],
  cfg: StatsTokenizationConfig,
): { totalTokens: number; freqByToken: Map<string, number> } {
  let totalTokens = 0
  const freqByToken = new Map<string, number>()
  const includeTokens = cfg.includeTokens && cfg.includeTokens.size > 0 ? cfg.includeTokens : null
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const props = (node.properties || {}) as Record<string, unknown>
    let raw = normalizeTextForTokens(node.label)
    for (let k = 0; k < cfg.textKeys.length; k += 1) {
      const key = cfg.textKeys[k]
      const value = props[key]
      if (typeof value === 'string') raw += '\n' + value
    }
    const allTokens = tokenizeForStats(raw, cfg.minTokenLength, cfg.stopwords)
    const tokens = cfg.maxTokensPerNode > 0 ? allTokens.slice(0, cfg.maxTokensPerNode) : allTokens
    if (!includeTokens) {
      totalTokens += tokens.length
      for (let t = 0; t < tokens.length; t += 1) {
        const token = tokens[t]
        freqByToken.set(token, (freqByToken.get(token) || 0) + 1)
      }
      continue
    }
    for (let t = 0; t < tokens.length; t += 1) {
      const token = tokens[t]
      if (!includeTokens.has(token)) continue
      totalTokens += 1
      freqByToken.set(token, (freqByToken.get(token) || 0) + 1)
    }
  }
  return { totalTokens, freqByToken }
}

export function topTokenList(
  freqByToken: Map<string, number>,
  limit: number,
): Array<{ token: string; count: number }> {
  const entries = Array.from(freqByToken.entries()).map(([token, count]) => ({ token, count }))
  entries.sort((a, b) => {
    const diff = b.count - a.count
    if (diff !== 0) return diff
    return a.token.localeCompare(b.token)
  })
  return entries.slice(0, Math.max(0, limit))
}

export function getEdgeWeightForStats(edge: GraphEdge): number {
  const props = (edge.properties || {}) as Record<string, unknown>
  const weight = props.weight
  const visualWeight = props['visual:weight']
  const raw = typeof weight === 'number' ? weight : typeof visualWeight === 'number' ? visualWeight : null
  if (raw == null || !Number.isFinite(raw)) return 0
  return raw
}

export function getEdgeCooccurrenceForStats(edge: GraphEdge): number {
  const props = (edge.properties || {}) as Record<string, unknown>
  const count = props.count
  if (typeof count === 'number' && Number.isFinite(count)) return count
  return 0
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (value === 0) return '0'
  if (Math.abs(value) < 1) return value.toFixed(4)
  if (Math.abs(value) < 10) return value.toFixed(3)
  if (Math.abs(value) < 100) return value.toFixed(2)
  return value.toFixed(1)
}
