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
  props: string
}

type EdgeIndexEntry = {
  edge: GraphEdge
  id: string
  label: string
  source: string
  target: string
  props: string
}

const scoreText = (text: string, q: string) => {
  if (!q) return 0
  if (text === q) return 100
  if (text.startsWith(q)) return 80
  if (text.includes(q)) return 60
  return 0
}

const rankNode = (entry: NodeIndexEntry, q: string): Ranked<SearchResult> | null => {
  const id = entry.id
  const label = entry.label
  const type = entry.type
  const props = entry.props
  const s = Math.max(
    scoreText(id, q),
    scoreText(label, q),
    scoreText(type, q),
    scoreText(props, q)
  )
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

const rankEdge = (entry: EdgeIndexEntry, q: string): Ranked<SearchResult> | null => {
  const id = entry.id
  const label = entry.label
  const source = entry.source
  const target = entry.target
  const props = entry.props
  const s = Math.max(
    scoreText(id, q),
    scoreText(label, q),
    scoreText(source, q),
    scoreText(target, q),
    scoreText(props, q)
  )
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
    const props = normalized(jsonStr(n.properties))
    nodes.push({ node: n, id, label, type, props })
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
    const props = normalized(jsonStr(e.properties))
    edges.push({ edge: e, id, label, source, target, props })
  }
  edgeTextMemo.set(graphData, edges)
  return edges
}

export function searchGraph(graphData: GraphData | null | undefined, query: string, limit = 50): SearchResult[] {
  if (!graphData) return []
  const q = normalized(query).trim()
  if (!q) return []
  const key = makeKey(q, limit)
  const byQuery = memo.get(graphData) || new Map<string, SearchResult[]>()
  const cached = byQuery.get(key)
  if (cached) return cached
  const ranked: Ranked<SearchResult>[] = []
  const nodeEntries = getNodeEntries(graphData)
  const edgeEntries = getEdgeEntries(graphData)
  for (const entry of nodeEntries) {
    const r = rankNode(entry, q)
    if (r) ranked.push(r)
  }
  for (const entry of edgeEntries) {
    const r = rankEdge(entry, q)
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
  const q = normalized(query).trim()
  if (!q) return []
  const ranked: Ranked<SearchResult>[] = []
  const nodeEntries = getNodeEntries(graphData)
  for (const entry of nodeEntries) {
    const r = rankNode(entry, q)
    if (r) ranked.push(r)
  }
  ranked.sort((a, b) => b._score - a._score)
  return ranked.slice(0, limit).map(({ id, kind, title, meta }) => ({ id, kind, title, meta }))
}

export function searchEdges(graphData: GraphData | null | undefined, query: string, limit = 50): SearchResult[] {
  if (!graphData) return []
  const q = normalized(query).trim()
  if (!q) return []
  const ranked: Ranked<SearchResult>[] = []
  const edgeEntries = getEdgeEntries(graphData)
  for (const entry of edgeEntries) {
    const r = rankEdge(entry, q)
    if (r) ranked.push(r)
  }
  ranked.sort((a, b) => b._score - a._score)
  return ranked.slice(0, limit).map(({ id, kind, title, meta }) => ({ id, kind, title, meta }))
}
