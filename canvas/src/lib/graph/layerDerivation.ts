import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'

type TokenCounts = {
  totalTokens: number
  freqByToken: Map<string, number>
  norm: number
}

function normalizeText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function tokenize(text: string, minTokenLength: number, stopwords: ReadonlySet<string>): string[] {
  const trimmed = (text || '').toLowerCase()
  if (!trimmed) return []
  const parts = trimmed.split(/[^a-z0-9_]+/g).filter(Boolean)
  const out: string[] = []
  for (let i = 0; i < parts.length; i += 1) {
    const t = parts[i]
    if (t.length < minTokenLength) continue
    if (stopwords.has(t)) continue
    out.push(t)
  }
  return out
}

function getSemanticCfg(schema: GraphSchema): NonNullable<NonNullable<GraphSchema['layers']>['semantic']> {
  const cfg = schema.layers?.semantic || {}
  return cfg as NonNullable<NonNullable<GraphSchema['layers']>['semantic']>
}

function buildTokenCountsByNode(nodes: GraphNode[], schema: GraphSchema): Map<string, TokenCounts> {
  const cfg = getSemanticCfg(schema)
  const textKeys = Array.isArray(cfg.textKeys) && cfg.textKeys.length > 0 ? cfg.textKeys : []
  const minTokenLengthRaw = cfg.minTokenLength
  const minTokenLength =
    typeof minTokenLengthRaw === 'number' && Number.isFinite(minTokenLengthRaw) ? Math.max(1, Math.floor(minTokenLengthRaw)) : 3
  const maxTokensRaw = cfg.maxTokensPerNode
  const maxTokensPerNode =
    typeof maxTokensRaw === 'number' && Number.isFinite(maxTokensRaw) ? Math.max(0, Math.floor(maxTokensRaw)) : 2000
  const stopwordsArr = Array.isArray(cfg.stopwords) ? cfg.stopwords : []
  const stopwords = new Set<string>(stopwordsArr.map(s => String(s || '').toLowerCase()).filter(Boolean))

  const byId = new Map<string, TokenCounts>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const props = (n.properties || {}) as Record<string, unknown>
    let raw = normalizeText(n.label)
    for (let k = 0; k < textKeys.length; k += 1) {
      const key = String(textKeys[k] || '').trim()
      if (!key) continue
      const v = props[key]
      if (typeof v === 'string') raw += '\n' + v
    }
    const tokensAll = tokenize(raw, minTokenLength, stopwords)
    const tokens = maxTokensPerNode > 0 ? tokensAll.slice(0, maxTokensPerNode) : tokensAll
    const freqByToken = new Map<string, number>()
    for (let t = 0; t < tokens.length; t += 1) {
      const tok = tokens[t]
      freqByToken.set(tok, (freqByToken.get(tok) || 0) + 1)
    }
    let normSq = 0
    freqByToken.forEach((c) => {
      normSq += c * c
    })
    const norm = Math.sqrt(normSq)
    byId.set(String(n.id), { totalTokens: tokens.length, freqByToken, norm })
  }
  return byId
}

function buildPairStats(args: {
  nodeIds: string[]
  countsByNodeId: Map<string, TokenCounts>
  metric: 'cosine' | 'pmi'
}): { similarityByPair: Map<string, number>; cooccurrenceByPair: Map<string, number> } {
  const { nodeIds, countsByNodeId, metric } = args
  const inverted = new Map<string, Array<{ id: string; count: number }>>()
  let totalTokens = 0
  for (let i = 0; i < nodeIds.length; i += 1) {
    const id = nodeIds[i]
    const counts = countsByNodeId.get(id)
    if (!counts) continue
    totalTokens += counts.totalTokens
    counts.freqByToken.forEach((count, token) => {
      const list = inverted.get(token) || []
      list.push({ id, count })
      inverted.set(token, list)
    })
  }

  const dotByPair = new Map<string, number>()
  const sharedByPair = new Map<string, number>()

  const addToPair = (a: string, b: string, delta: number, map: Map<string, number>) => {
    const key = a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`
    map.set(key, (map.get(key) || 0) + delta)
  }

  inverted.forEach((list) => {
    if (list.length < 2) return
    for (let i = 0; i < list.length; i += 1) {
      const ai = list[i]
      for (let j = i + 1; j < list.length; j += 1) {
        const bj = list[j]
        addToPair(ai.id, bj.id, ai.count * bj.count, dotByPair)
        addToPair(ai.id, bj.id, Math.min(ai.count, bj.count), sharedByPair)
      }
    }
  })

  const similarityByPair = new Map<string, number>()
  dotByPair.forEach((dot, key) => {
    const [a, b] = key.split('\u0000')
    const ca = countsByNodeId.get(a)
    const cb = countsByNodeId.get(b)
    if (!ca || !cb) return
    if (metric === 'cosine') {
      if (ca.norm <= 0 || cb.norm <= 0) return
      const sim = dot / (ca.norm * cb.norm)
      if (!Number.isFinite(sim) || sim <= 0) return
      similarityByPair.set(key, sim)
      return
    }
    const shared = sharedByPair.get(key) || 0
    if (shared <= 0) return
    if (totalTokens <= 0) return
    const pi = ca.totalTokens / totalTokens
    const pj = cb.totalTokens / totalTokens
    const pij = shared / totalTokens
    if (pi <= 0 || pj <= 0 || pij <= 0) return
    const score = Math.log2(pij / (pi * pj))
    const clamped = Math.max(0, score)
    if (!Number.isFinite(clamped) || clamped <= 0) return
    similarityByPair.set(key, clamped)
  })
  return { similarityByPair, cooccurrenceByPair: sharedByPair }
}

function clampNumber(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min
  return Math.max(min, Math.min(max, v))
}

export function filterGraphToFrontmatterMermaid(
  graphData: GraphData | null | undefined,
  activeDocumentPath?: string | null,
): GraphData | null {
  if (!graphData) return null
  const nodesRaw = Array.isArray(graphData.nodes) ? graphData.nodes : []
  const edgesRaw = Array.isArray(graphData.edges) ? graphData.edges : []

  const docBaseName = (() => {
    const raw = String(activeDocumentPath || '').trim()
    if (!raw) return ''
    const norm = raw.replace(/\\/g, '/')
    const parts = norm.split('/')
    const last = parts[parts.length - 1] || ''
    return last
  })()

  const filteredNodes: GraphNode[] = []
  for (let i = 0; i < nodesRaw.length; i += 1) {
    const node = nodesRaw[i] as GraphNode
    const type = String(node.type || '')
    if (type !== 'MermaidDiagram' && type !== 'MermaidNode' && type !== 'MermaidSubgraph') continue
    const meta = node.metadata || {}
    const docPathRaw = meta.documentPath
    const docPath = typeof docPathRaw === 'string' ? docPathRaw.trim() : ''
    if (docBaseName && docPath && docPath !== docBaseName) continue
    const nextMeta: Record<string, GraphNode['metadata'][string]> = {
      ...meta,
      documentPath: docBaseName || docPath || '',
      lineStart: 1,
      lineEnd: 1,
    }
    filteredNodes.push({ ...node, metadata: nextMeta })
  }

  if (filteredNodes.length === 0) {
    return {
      ...graphData,
      nodes: [],
      edges: [],
    }
  }

  const keepIds = new Set<string>()
  for (let i = 0; i < filteredNodes.length; i += 1) {
    const n = filteredNodes[i]
    keepIds.add(String(n.id))
  }

  const filteredEdges: GraphEdge[] = []
  for (let i = 0; i < edgesRaw.length; i += 1) {
    const e = edgesRaw[i] as GraphEdge
    const label = String(e.label || '')
    if (label !== 'pointsTo') continue
    const s = String(e.source)
    const t = String(e.target)
    if (!keepIds.has(s) || !keepIds.has(t)) continue
    filteredEdges.push(e)
  }

  return {
    ...graphData,
    nodes: filteredNodes,
    edges: filteredEdges,
  }
}

function computeLouvainCommunities(args: {
  nodeIds: string[]
  edges: Array<{ source: string; target: string; weight: number }>
  resolution: number
  maxPasses: number
  maxMovesPerPass: number
}): Map<string, number> {
  const { nodeIds, edges, resolution, maxPasses, maxMovesPerPass } = args
  const adj = new Map<string, Array<{ n: string; w: number }>>()
  const degree = new Map<string, number>()
  const ensure = (id: string) => {
    if (!adj.has(id)) adj.set(id, [])
    if (!degree.has(id)) degree.set(id, 0)
  }
  for (let i = 0; i < nodeIds.length; i += 1) ensure(nodeIds[i])
  let m2 = 0
  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i]
    const s = String(e.source)
    const t = String(e.target)
    if (!s || !t || s === t) continue
    const w = e.weight
    if (!(typeof w === 'number' && Number.isFinite(w) && w > 0)) continue
    ensure(s)
    ensure(t)
    adj.get(s)!.push({ n: t, w })
    adj.get(t)!.push({ n: s, w })
    degree.set(s, (degree.get(s) || 0) + w)
    degree.set(t, (degree.get(t) || 0) + w)
    m2 += 2 * w
  }
  if (m2 <= 0) {
    const out = new Map<string, number>()
    for (let i = 0; i < nodeIds.length; i += 1) out.set(nodeIds[i], i)
    return out
  }

  const communityByNode = new Map<string, number>()
  const totByCommunity = new Map<number, number>()
  for (let i = 0; i < nodeIds.length; i += 1) {
    const id = nodeIds[i]
    communityByNode.set(id, i)
    totByCommunity.set(i, degree.get(id) || 0)
  }

  const neighborCommunityWeights = (nodeId: string): Map<number, number> => {
    const m = new Map<number, number>()
    const list = adj.get(nodeId) || []
    for (let i = 0; i < list.length; i += 1) {
      const { n, w } = list[i]
      const c = communityByNode.get(n)
      if (c == null) continue
      m.set(c, (m.get(c) || 0) + w)
    }
    return m
  }

  const ki = (nodeId: string) => degree.get(nodeId) || 0

  for (let pass = 0; pass < Math.max(1, maxPasses); pass += 1) {
    let moves = 0
    let changed = false
    for (let idx = 0; idx < nodeIds.length; idx += 1) {
      if (moves >= maxMovesPerPass) break
      const nodeId = nodeIds[idx]
      const curC = communityByNode.get(nodeId)
      if (curC == null) continue
      const k = ki(nodeId)
      if (k <= 0) continue

      totByCommunity.set(curC, (totByCommunity.get(curC) || 0) - k)

      const weightsByC = neighborCommunityWeights(nodeId)
      let bestC = curC
      let bestGain = 0
      weightsByC.forEach((kIn, c) => {
        const totC = totByCommunity.get(c) || 0
        const gain = kIn - (resolution * totC * k) / m2
        if (gain > bestGain + 1e-12) {
          bestGain = gain
          bestC = c
        }
      })

      communityByNode.set(nodeId, bestC)
      totByCommunity.set(bestC, (totByCommunity.get(bestC) || 0) + k)

      if (bestC !== curC) {
        changed = true
        moves += 1
      }
    }
    if (!changed) break
  }

  const raw = new Map<string, number>()
  communityByNode.forEach((c, id) => raw.set(id, c))
  const unique = Array.from(new Set<number>(Array.from(raw.values()))).sort((a, b) => a - b)
  const remap = new Map<number, number>()
  for (let i = 0; i < unique.length; i += 1) remap.set(unique[i], i)
  const out = new Map<string, number>()
  raw.forEach((c, id) => out.set(id, remap.get(c) || 0))
  return out
}

export function deriveGraphDataForLayers(graphData: GraphData | null | undefined, schema: GraphSchema): GraphData | null {
  if (!graphData) return null
  const nodesRaw = Array.isArray(graphData.nodes) ? graphData.nodes : []
  const edges = Array.isArray(graphData.edges) ? graphData.edges : []
  const nodes = nodesRaw as GraphNode[]
  const mode = schema.layers?.mode || 'property'
  if (mode === 'property') {
    const nextNodes = nodes.filter(n => String((n as GraphNode).type || '') !== 'Document') as GraphNode[]
    if (nextNodes.length === nodes.length) {
      return graphData
    }
    const keepIds = new Set<string>(nextNodes.map(n => String(n.id)))
    const nextEdges = edges.filter(e => {
      const s = String(e.source)
      const t = String(e.target)
      return keepIds.has(s) && keepIds.has(t)
    })
    return { ...graphData, nodes: nextNodes, edges: nextEdges }
  }
  if (mode === 'document-structure') {
    const typedNodes = nodes as GraphNode[]
    if (typedNodes.length > 0) {
      let changed = false
      const nextNodes: GraphNode[] = typedNodes.map((n) => {
        const props = (n.properties || {}) as Record<string, GraphNode['properties'][string]>
        if (props['visual:layer'] != null) return n
        const t = String(n.type || '')
        let layer: number | null = null
        if (t === 'Document' || t === 'Section') layer = 3
        else if (t === 'Paragraph' || t === 'Table' || t === 'List') layer = 2
        else if (t === 'CodeBlock' || t === 'ListItem') layer = 1
        if (layer == null) return n
        const nextProps: Record<string, GraphNode['properties'][string]> = {
          ...props,
          'visual:layer': layer,
        }
        changed = true
        return { ...n, properties: nextProps }
      })
      if (changed) {
        return {
          ...graphData,
          nodes: nextNodes,
        }
      }
      return graphData
    }
  }
  const cfg = getSemanticCfg(schema)
  const similarityEdgeLabelRaw = cfg.similarityEdgeLabel
  const similarityEdgeLabel = typeof similarityEdgeLabelRaw === 'string' ? similarityEdgeLabelRaw.trim() : ''
  if (!similarityEdgeLabel) return graphData

  const metric: 'cosine' | 'pmi' = cfg.similarityMetric === 'pmi' ? 'pmi' : 'cosine'
  const topKRaw = cfg.topKEdgesPerNode
  const topKEdgesPerNode =
    typeof topKRaw === 'number' && Number.isFinite(topKRaw) ? Math.max(0, Math.floor(topKRaw)) : 3
  const minSimRaw = cfg.minSimilarity
  const minSimilarity =
    typeof minSimRaw === 'number' && Number.isFinite(minSimRaw) ? Math.max(0, minSimRaw) : (metric === 'pmi' ? 0.15 : 0.2)

  const nodeIds = nodes.map(n => String(n.id)).filter(Boolean)
  const countsByNodeId = buildTokenCountsByNode(nodes, schema)
  const { similarityByPair, cooccurrenceByPair } = buildPairStats({ nodeIds, countsByNodeId, metric })

  const candidatesByNode = new Map<string, Array<{ other: string; w: number }>>()
  const addCandidate = (a: string, b: string, w: number) => {
    const arr = candidatesByNode.get(a) || []
    arr.push({ other: b, w })
    candidatesByNode.set(a, arr)
  }
  similarityByPair.forEach((w, key) => {
    const [a, b] = key.split('\u0000')
    if (!a || !b) return
    addCandidate(a, b, w)
    addCandidate(b, a, w)
  })

  const acceptedPairs = new Set<string>()
  candidatesByNode.forEach((arr, id) => {
    if (!arr.length) return
    arr.sort((a, b) => {
      const diff = b.w - a.w
      if (diff !== 0) return diff
      return a.other.localeCompare(b.other)
    })
    const keep = topKEdgesPerNode > 0 ? arr.slice(0, topKEdgesPerNode * 4) : arr
    let accepted = 0
    for (let i = 0; i < keep.length; i += 1) {
      if (topKEdgesPerNode > 0 && accepted >= topKEdgesPerNode) break
      const item = keep[i]
      if (item.w < minSimilarity) continue
      const key = id < item.other ? `${id}\u0000${item.other}` : `${item.other}\u0000${id}`
      acceptedPairs.add(key)
      accepted += 1
    }
  })

  const similarityEdges: GraphEdge[] = []
  const weightSumByNode = new Map<string, number>()
  acceptedPairs.forEach((key) => {
    const [a, b] = key.split('\u0000')
    const w = similarityByPair.get(key)
    if (!a || !b || w == null) return
    const co = cooccurrenceByPair.get(key) || 0
    const width = clampNumber(1 + Math.sqrt(Math.max(0, co)) * 0.5, 1, 6)
    const id = `sem:${metric}:${a}::${b}`
    similarityEdges.push({
      id,
      source: a,
      target: b,
      label: similarityEdgeLabel,
      properties: {
        weight: w,
        count: co,
        width,
        'visual:weight': w,
        'visual:width': width,
      },
      metadata: {
        derived: true,
        kind: 'semantic',
      },
    })
    weightSumByNode.set(a, (weightSumByNode.get(a) || 0) + w)
    weightSumByNode.set(b, (weightSumByNode.get(b) || 0) + w)
  })

  const communityDetectionEnabled = cfg.communityDetection?.enabled !== false
  const communities = communityDetectionEnabled
    ? computeLouvainCommunities({
        nodeIds,
        edges: similarityEdges.map(e => ({
          source: String(e.source),
          target: String(e.target),
          weight: typeof e.properties?.weight === 'number' ? (e.properties.weight as number) : (e.properties?.['visual:weight'] as number) || 0,
        })),
        resolution:
          typeof cfg.communityDetection?.resolution === 'number' && Number.isFinite(cfg.communityDetection.resolution)
            ? Math.max(0.05, cfg.communityDetection.resolution)
            : 1,
        maxPasses:
          typeof cfg.communityDetection?.maxPasses === 'number' && Number.isFinite(cfg.communityDetection.maxPasses)
            ? Math.max(1, Math.floor(cfg.communityDetection.maxPasses))
            : 10,
        maxMovesPerPass:
          typeof cfg.communityDetection?.maxMovesPerPass === 'number' && Number.isFinite(cfg.communityDetection.maxMovesPerPass)
            ? Math.max(100, Math.floor(cfg.communityDetection.maxMovesPerPass))
            : 20000,
      })
    : null

  const nextNodes: GraphNode[] = nodes.map((n) => {
    const id = String(n.id)
    const counts = countsByNodeId.get(id)
    const tokenCount = counts ? counts.totalTokens : 0
    const weightSum = weightSumByNode.get(id) || 0
    const importance = tokenCount > 0 ? tokenCount : weightSum
    const nodeSize = clampNumber(10 + Math.sqrt(Math.max(0, importance)) * 2, 10, 40)
    const communityId = communities ? (communities.get(id) ?? null) : null
    const nextProps: Record<string, GraphNode['properties'][string]> = { ...(n.properties || {}) }
    nextProps['visual:importance'] = importance
    nextProps['visual:nodeSize'] = nodeSize
    if (communityId != null) {
      nextProps['visual:community'] = communityId
    }
    return { ...n, properties: nextProps }
  })

  const filteredEdges = edges.filter(e => !(e.metadata && (e.metadata as Record<string, unknown>).derived === true))
  const nextEdges = [...filteredEdges, ...similarityEdges]
  const finalNodes = nextNodes.filter(n => String(n.type || '') !== 'Document')
  const keepIds = new Set<string>(finalNodes.map(n => String(n.id)))
  const finalEdges = nextEdges.filter(e => {
    const s = String(e.source)
    const t = String(e.target)
    return keepIds.has(s) && keepIds.has(t)
  })
  return { ...graphData, nodes: finalNodes, edges: finalEdges }
}
