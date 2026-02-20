import type { GraphData, GraphNode, GraphEdge } from '@/lib/graph/types'
import type { SearchResult } from './types'
import { normalized } from '@/features/panels/utils/json'
const jsonStr = (v: unknown) => {
  try {
    return JSON.stringify(v ?? {})
  } catch {
    return ''
  }
}

type Ranked<T extends SearchResult> = T & { _score: number }

type NodeIndexEntry = {
  node: GraphNode
  id: string
  label: string
  type: string
  path: string
  props: string
}

type EdgeIndexEntry = {
  edge: GraphEdge
  id: string
  label: string
  source: string
  target: string
  path: string
  props: string
}

const scoreText = (text: string, q: string) => {
  if (!q) return 0
  if (text === q) return 100
  if (text.startsWith(q)) return 80
  if (text.includes(q)) return 60
  return 0
}

type ParsedQuery = {
  free: string[]
  filters: Record<string, string[]>
}

const parseQuery = (raw: string): ParsedQuery => {
  const q = normalized(raw).trim()
  if (!q) return { free: [], filters: {} }
  const parts = q.split(/\s+/g).filter(Boolean)
  const free: string[] = []
  const filters: Record<string, string[]> = {}
  for (const part of parts) {
    const idx = part.indexOf(':')
    if (idx <= 0) {
      free.push(part)
      continue
    }
    const key = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    if (!key || !value) {
      free.push(part)
      continue
    }
    const arr = filters[key] || []
    arr.push(value)
    filters[key] = arr
  }
  return { free, filters }
}

const matchAll = (text: string, q: string[]): boolean => {
  if (!q.length) return true
  for (let i = 0; i < q.length; i += 1) {
    if (!text.includes(q[i]!)) return false
  }
  return true
}

const sumScore = (fields: string[], q: string[]): number => {
  if (!q.length) return 0
  let s = 0
  for (let i = 0; i < q.length; i += 1) {
    const term = q[i]!
    let best = 0
    for (let j = 0; j < fields.length; j += 1) {
      const v = fields[j]!
      const sc = scoreText(v, term)
      if (sc > best) best = sc
      if (best >= 100) break
    }
    s += best
  }
  return s
}

const rankNode = (entry: NodeIndexEntry, parsed: ParsedQuery): Ranked<SearchResult> | null => {
  const kindFilters = parsed.filters.kind || parsed.filters.k || []
  if (kindFilters.length && !kindFilters.some(v => v === 'node')) return null

  const typeFilters = parsed.filters.type || []
  if (typeFilters.length && !typeFilters.some(v => entry.type.includes(v))) return null

  const idFilters = parsed.filters.id || []
  if (idFilters.length && !matchAll(entry.id, idFilters)) return null

  const labelFilters = parsed.filters.label || []
  if (labelFilters.length && !matchAll(entry.label, labelFilters)) return null

  const pathFilters = parsed.filters.path || parsed.filters.file || []
  if (pathFilters.length && !matchAll(entry.path, pathFilters)) return null

  const propsFilters = parsed.filters.props || parsed.filters.prop || []
  if (propsFilters.length && !matchAll(entry.props, propsFilters)) return null

  const id = entry.id
  const label = entry.label
  const type = entry.type
  const path = entry.path
  const props = entry.props
  const s = sumScore([id, label, type, path, props], parsed.free)
  if (s <= 0) return null
  return {
    kind: 'node',
    id: entry.node.id,
    title: entry.node.label || entry.node.id,
    meta: { type: entry.node.type, label: entry.node.label },
    _score: s,
  }
}

const edgeEndpointId = (x: string | GraphNode | undefined): string => {
  if (typeof x === 'string') return x
  if (x && typeof x.id === 'string') return x.id
  return ''
}

const memo = new WeakMap<GraphData, Map<string, SearchResult[]>>()
const nodeTextMemo = new WeakMap<GraphData, NodeIndexEntry[]>()
const edgeTextMemo = new WeakMap<GraphData, EdgeIndexEntry[]>()
const makeKey = (q: string, limit: number) => `${q}::${limit}`

const rankEdge = (entry: EdgeIndexEntry, parsed: ParsedQuery): Ranked<SearchResult> | null => {
  const kindFilters = parsed.filters.kind || parsed.filters.k || []
  if (kindFilters.length && !kindFilters.some(v => v === 'edge')) return null

  const idFilters = parsed.filters.id || []
  if (idFilters.length && !matchAll(entry.id, idFilters)) return null

  const labelFilters = parsed.filters.label || []
  if (labelFilters.length && !matchAll(entry.label, labelFilters)) return null

  const sourceFilters = parsed.filters.source || []
  if (sourceFilters.length && !matchAll(entry.source, sourceFilters)) return null

  const targetFilters = parsed.filters.target || []
  if (targetFilters.length && !matchAll(entry.target, targetFilters)) return null

  const pathFilters = parsed.filters.path || parsed.filters.file || []
  if (pathFilters.length && !matchAll(entry.path, pathFilters)) return null

  const propsFilters = parsed.filters.props || parsed.filters.prop || []
  if (propsFilters.length && !matchAll(entry.props, propsFilters)) return null

  const id = entry.id
  const label = entry.label
  const source = entry.source
  const target = entry.target
  const path = entry.path
  const props = entry.props
  const s = sumScore([id, label, source, target, path, props], parsed.free)
  if (s <= 0) return null
  return {
    kind: 'edge',
    id: entry.edge.id,
    title: entry.edge.label || entry.edge.id,
    meta: {
      source: edgeEndpointId(entry.edge.source),
      target: edgeEndpointId(entry.edge.target),
      label: entry.edge.label,
    },
    _score: s,
  }
}

const getNodeEntries = (graphData: GraphData): NodeIndexEntry[] => {
  const cached = nodeTextMemo.get(graphData)
  if (cached) return cached
  const nodes: NodeIndexEntry[] = []
  for (const n of graphData.nodes || []) {
    const id = normalized(n.id)
    const label = normalized(n.label)
    const type = normalized(n.type)
    const path = (() => {
      const meta = (n as unknown as { metadata?: unknown }).metadata
      const m = meta && typeof meta === 'object' && !Array.isArray(meta) ? (meta as Record<string, unknown>) : null
      const docPath = m && typeof m.documentPath === 'string' ? m.documentPath : ''
      const props = (n as unknown as { properties?: unknown }).properties
      const p = props && typeof props === 'object' && !Array.isArray(props) ? (props as Record<string, unknown>) : null
      const filePath = p && typeof p.path === 'string' ? p.path : ''
      return normalized(filePath || docPath)
    })()
    const props = normalized(jsonStr(n.properties))
    nodes.push({ node: n, id, label, type, path, props })
  }
  nodeTextMemo.set(graphData, nodes)
  return nodes
}

const getEdgeEntries = (graphData: GraphData): EdgeIndexEntry[] => {
  const cached = edgeTextMemo.get(graphData)
  if (cached) return cached
  const edges: EdgeIndexEntry[] = []
  for (const e of graphData.edges || []) {
    const id = normalized(e.id)
    const label = normalized(e.label)
    const source = normalized(edgeEndpointId(e.source))
    const target = normalized(edgeEndpointId(e.target))
    const path = (() => {
      const meta = (e as unknown as { metadata?: unknown }).metadata
      const m = meta && typeof meta === 'object' && !Array.isArray(meta) ? (meta as Record<string, unknown>) : null
      const docPath = m && typeof m.documentPath === 'string' ? m.documentPath : ''
      const props = (e as unknown as { properties?: unknown }).properties
      const p = props && typeof props === 'object' && !Array.isArray(props) ? (props as Record<string, unknown>) : null
      const filePath = p && typeof p.path === 'string' ? p.path : ''
      return normalized(filePath || docPath)
    })()
    const props = normalized(jsonStr(e.properties))
    edges.push({ edge: e, id, label, source, target, path, props })
  }
  edgeTextMemo.set(graphData, edges)
  return edges
}

export function searchGraph(graphData: GraphData | null | undefined, query: string, limit = 50): SearchResult[] {
  if (!graphData) return []
  const parsed = parseQuery(query)
  if (!parsed.free.length && Object.keys(parsed.filters).length === 0) return []
  const key = makeKey(`${parsed.free.join(' ')}|${JSON.stringify(parsed.filters)}`, limit)
  const byQuery = memo.get(graphData) || new Map<string, SearchResult[]>()
  const cached = byQuery.get(key)
  if (cached) return cached
  const ranked: Ranked<SearchResult>[] = []
  const nodeEntries = getNodeEntries(graphData)
  const edgeEntries = getEdgeEntries(graphData)
  for (const entry of nodeEntries) {
    const r = rankNode(entry, parsed)
    if (r) ranked.push(r)
  }
  for (const entry of edgeEntries) {
    const r = rankEdge(entry, parsed)
    if (r) ranked.push(r)
  }
  ranked.sort((a, b) => b._score - a._score)
  const out = ranked.slice(0, limit).map(({ id, kind, title, meta }) => ({ id, kind, title, meta }))
  byQuery.set(key, out)
  memo.set(graphData, byQuery)
  return out
}

export function searchNodes(graphData: GraphData | null | undefined, query: string, limit = 50): SearchResult[] {
  if (!graphData) return []
  const parsed = parseQuery(query)
  const kindFilters = parsed.filters.kind || parsed.filters.k || []
  if (kindFilters.length && !kindFilters.some(v => v === 'node')) return []
  if (!parsed.free.length && Object.keys(parsed.filters).length === 0) return []
  const ranked: Ranked<SearchResult>[] = []
  const nodeEntries = getNodeEntries(graphData)
  for (const entry of nodeEntries) {
    const r = rankNode(entry, parsed)
    if (r) ranked.push(r)
  }
  ranked.sort((a, b) => b._score - a._score)
  return ranked.slice(0, limit).map(({ id, kind, title, meta }) => ({ id, kind, title, meta }))
}

export function searchEdges(graphData: GraphData | null | undefined, query: string, limit = 50): SearchResult[] {
  if (!graphData) return []
  const parsed = parseQuery(query)
  const kindFilters = parsed.filters.kind || parsed.filters.k || []
  if (kindFilters.length && !kindFilters.some(v => v === 'edge')) return []
  if (!parsed.free.length && Object.keys(parsed.filters).length === 0) return []
  const ranked: Ranked<SearchResult>[] = []
  const edgeEntries = getEdgeEntries(graphData)
  for (const entry of edgeEntries) {
    const r = rankEdge(entry, parsed)
    if (r) ranked.push(r)
  }
  ranked.sort((a, b) => b._score - a._score)
  return ranked.slice(0, limit).map(({ id, kind, title, meta }) => ({ id, kind, title, meta }))
}
