import { getDocumentLocationFromMetadata } from '@/lib/graph/markdownMetadata'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'

export type DocLocationHit = {
  kind: 'node' | 'edge'
  id: string
  lineStart: number
  lineEnd: number
}

export type DocLocationIndex = {
  size: number
  find: (line: number) => DocLocationHit | null
}

type RangeEntry = {
  start: number
  end: number
  kind: 'node' | 'edge'
  id: string
}

const upperBoundStart = (ranges: RangeEntry[], line: number): number => {
  let lo = 0
  let hi = ranges.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (ranges[mid]!.start <= line) lo = mid + 1
    else hi = mid
  }
  return lo
}

const lowerBoundPrefixMaxEndAtLeast = (prefixMaxEnd: number[], line: number, hi: number): number => {
  let lo = 0
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (prefixMaxEnd[mid]! >= line) hi = mid
    else lo = mid + 1
  }
  return lo
}

export function buildDocLocationIndex(args: {
  nodes: readonly GraphNode[] | null
  edges: readonly GraphEdge[] | null
  matchesDoc: (documentPath: unknown) => boolean
}): DocLocationIndex {
  const { nodes, edges, matchesDoc } = args
  if (!nodes && !edges) return { size: 0, find: () => null }

  const ranges: RangeEntry[] = []

  const nodeList = Array.isArray(nodes) ? (nodes as GraphNode[]) : []
  for (const n of nodeList) {
    const id = String(n?.id || '')
    if (!id) continue
    const loc = getDocumentLocationFromMetadata(n?.metadata)
    if (!loc) continue
    if (!matchesDoc(loc.documentPath)) continue
    const start = Math.max(1, Math.floor(Number(loc.lineStart) || 1))
    const end = Math.max(start, Math.floor(Number(loc.lineEnd || loc.lineStart) || start))
    ranges.push({ start, end, kind: 'node', id })
  }

  const edgeList = Array.isArray(edges) ? (edges as GraphEdge[]) : []
  for (const e of edgeList) {
    const id = String(e?.id || '')
    if (!id) continue
    const loc = getDocumentLocationFromMetadata(e?.metadata)
    if (!loc) continue
    if (!matchesDoc(loc.documentPath)) continue
    const start = Math.max(1, Math.floor(Number(loc.lineStart) || 1))
    const end = Math.max(start, Math.floor(Number(loc.lineEnd || loc.lineStart) || start))
    ranges.push({ start, end, kind: 'edge', id })
  }

  if (ranges.length === 0) return { size: 0, find: () => null }

  ranges.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start
    return b.end - a.end
  })

  const prefixMaxEnd: number[] = new Array(ranges.length)
  let maxEnd = 0
  for (let i = 0; i < ranges.length; i += 1) {
    const end = ranges[i]!.end
    if (end > maxEnd) maxEnd = end
    prefixMaxEnd[i] = maxEnd
  }

  const find = (line: number): DocLocationHit | null => {
    if (!Number.isFinite(line) || line <= 0) return null
    const v = Math.floor(line)
    const ub = upperBoundStart(ranges, v)
    const i = ub - 1
    if (i < 0) return null
    if (prefixMaxEnd[i]! < v) return null
    const j = lowerBoundPrefixMaxEndAtLeast(prefixMaxEnd, v, i + 1)
    for (let k = i; k >= j; k -= 1) {
      const cur = ranges[k]!
      if (cur.end < v) continue
      return { kind: cur.kind, id: cur.id, lineStart: cur.start, lineEnd: cur.end }
    }
    return null
  }

  return { size: ranges.length, find }
}
