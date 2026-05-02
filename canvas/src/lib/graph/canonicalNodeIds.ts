import type { GraphData, GraphNode } from '@/lib/graph/types'

export function splitComposedNodeId(rawId: unknown): { full: string; inner: string } {
  const full = String(rawId || '').trim()
  if (!full) return { full: '', inner: '' }
  const sep = full.indexOf('::')
  if (sep <= 0) return { full, inner: full }
  const inner = full.slice(sep + 2).trim()
  return { full, inner: inner || full }
}

export function parseCanonicalNodeIds(raw: unknown): string[] {
  const idValue = String(raw || '').trim()
  if (!idValue) return []
  const out = [idValue]
  const leaf = idValue.includes('::') ? String(idValue.split('::').pop() || '').trim() : ''
  if (leaf && leaf !== idValue) out.push(leaf)
  return out
}

export function buildCanonicalNodeLookup<T>(entries: Iterable<readonly [string, T]>): Map<string, T> {
  const lookup = new Map<string, T>()
  for (const [rawId, value] of entries) {
    const candidateIds = parseCanonicalNodeIds(rawId)
    for (let i = 0; i < candidateIds.length; i += 1) {
      const candidateId = String(candidateIds[i] || '').trim()
      if (candidateId && !lookup.has(candidateId)) lookup.set(candidateId, value)
    }
  }
  return lookup
}

export function buildCanonicalNodeIdSet(rawIds: Iterable<unknown>): Set<string> {
  const out = new Set<string>()
  for (const rawId of rawIds) {
    const candidateIds = parseCanonicalNodeIds(rawId)
    for (let i = 0; i < candidateIds.length; i += 1) {
      const candidateId = String(candidateIds[i] || '').trim()
      if (!candidateId) continue
      out.add(candidateId)
      const inner = splitComposedNodeId(candidateId).inner
      if (inner) out.add(inner)
    }
  }
  return out
}

export function canonicalNodeIdSetHas(
  lookup: ReadonlySet<string> | null | undefined,
  rawId: unknown,
): boolean {
  if (!lookup || lookup.size === 0) return false
  const candidateIds = parseCanonicalNodeIds(rawId)
  for (let i = 0; i < candidateIds.length; i += 1) {
    const candidateId = String(candidateIds[i] || '').trim()
    if (!candidateId) continue
    if (lookup.has(candidateId)) return true
    const inner = splitComposedNodeId(candidateId).inner
    if (inner && lookup.has(inner)) return true
  }
  return false
}

export function getCanonicalNodeLookupValue<T>(
  lookup: ReadonlyMap<string, T> | null | undefined,
  rawId: unknown,
): T | null {
  if (!lookup || lookup.size === 0) return null
  const candidateIds = parseCanonicalNodeIds(rawId)
  for (let i = 0; i < candidateIds.length; i += 1) {
    const candidateId = candidateIds[i]
    if (!candidateId) continue
    const value = lookup.get(candidateId)
    if (value) return value
  }
  return null
}

export function resolveGraphNodeByCanonicalId(graph: GraphData | null | undefined, rawId: unknown): GraphNode | null {
  if (!graph || !Array.isArray(graph.nodes)) return null
  const candidateIds = parseCanonicalNodeIds(rawId)
  if (candidateIds.length === 0) return null
  for (let i = 0; i < candidateIds.length; i += 1) {
    const candidateId = candidateIds[i]
    const exact = graph.nodes.find(n => String(n.id || '').trim() === candidateId) || null
    if (exact) return exact
  }
  const innerIds = new Set(candidateIds.map(id => splitComposedNodeId(id).inner).filter(Boolean))
  if (innerIds.size === 0) return null
  const innerMatches = graph.nodes.filter(n => innerIds.has(splitComposedNodeId(n.id).inner))
  return innerMatches.length === 1 ? innerMatches[0] || null : null
}

export function resolveGraphNodeIdsByCanonicalIds(
  graph: GraphData | null | undefined,
  rawIds: ReadonlyArray<string>,
): string[] {
  if (!graph || rawIds.length === 0) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (let i = 0; i < rawIds.length; i += 1) {
    const resolvedId = String(resolveGraphNodeByCanonicalId(graph, rawIds[i])?.id || '').trim()
    if (!resolvedId || seen.has(resolvedId)) continue
    seen.add(resolvedId)
    out.push(resolvedId)
  }
  return out
}

export function isCanonicalNodeIdEqual(a: unknown, b: unknown): boolean {
  const aFull = String(a || '').trim()
  const bFull = String(b || '').trim()
  if (!aFull || !bFull) return false
  if (aFull === bFull) return true
  const aCandidates = parseCanonicalNodeIds(aFull)
  const bCandidates = new Set(parseCanonicalNodeIds(bFull))
  for (let i = 0; i < aCandidates.length; i += 1) {
    if (bCandidates.has(aCandidates[i] || '')) return true
  }
  const aInner = splitComposedNodeId(aFull).inner
  const bInner = splitComposedNodeId(bFull).inner
  return Boolean(aInner && bInner && aInner === bInner)
}
