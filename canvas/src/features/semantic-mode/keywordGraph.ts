import { LRUCache } from '@/lib/cache/LRUCache'
import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { hashText } from '@/features/parsers/hash'
import { MVP_COLOR_PALETTE } from '@/lib/graph/schema'
import { computePageRank } from '@/features/semantic-mode/graphAlgorithms'
import { computePpmi, deriveEdgeWidthFromStrength } from '@/features/semantic-mode/association'
import { NLTK_STOPWORDS_EN } from '@/features/semantic-mode/keywordStopwords'
import {
  extractMentionsRobust,
  extractTriplesHeuristic,
  extractCooccurrencePairs,
  splitSentencesWithOffsets,
  isVerbLike,
  normalizeEntityKey,
} from '@/lib/graph/textAnalysis'

export type KeywordGraphSource = {
  documentId: string
  documentText: string
  sourceLabel?: string
  sourceTextHash?: string
}

export type KeywordGraphResult = {
  graph: GraphData
  nodeCountsById: Map<string, number>
}

const clampNumber = (v: number, min: number, max: number): number => {
  if (!Number.isFinite(v)) return min
  return Math.max(min, Math.min(max, v))
}

const keywordNodeSizeFromCount = (count: number): number => {
  const c = Number.isFinite(count) ? Math.max(0, count) : 0
  const radius = 8 + Math.sqrt(c) * 4
  return clampNumber(radius, 10, 40)
}

const KEYWORD_ROLE_COLORS = {
  subject: MVP_COLOR_PALETTE.nodes.idea,
  object: MVP_COLOR_PALETTE.nodes.execution,
  entity: MVP_COLOR_PALETTE.nodes.idea,
} as const

type Mention = {
  key: string
  label: string
  start: number
  end: number
  ner?: string
}

const prettyLabel = (key: string): string => {
  const t = String(key || '').trim()
  if (!t) return ''
  return t
    .split(' ')
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

export const KEYWORD_GRAPH_ALGO_VERSION = 2

const STOPWORD_SET = new Set<string>(NLTK_STOPWORDS_EN.map(s => String(s || '').trim().toLowerCase()).filter(Boolean))

const isUsefulEntityKey = (rawKey: string): boolean => {
  const key = String(rawKey || '').trim()
  if (!key) return false
  const lower = key.toLowerCase()
  if (STOPWORD_SET.has(lower)) return false
  if (key.length <= 1) return /\d/.test(key)
  if (/^\d+$/.test(key)) return false
  if (/^[_-]+$/.test(key)) return false
  return true
}

type WeightedNeighbor = { id: string; w: number }

const computeLabelPropagationCommunities = (args: {
  nodeIds: string[]
  neighbors: Map<string, WeightedNeighbor[]>
  iterations: number
}): Map<string, string> => {
  const nodeIds = [...args.nodeIds].map(id => String(id || '').trim()).filter(Boolean)
  nodeIds.sort((a, b) => a.localeCompare(b))

  const labels = new Map<string, string>()
  for (let i = 0; i < nodeIds.length; i += 1) labels.set(nodeIds[i]!, nodeIds[i]!)

  const iters = Math.max(1, Math.min(32, Math.floor(args.iterations)))
  for (let iter = 0; iter < iters; iter += 1) {
    let changed = false
    for (let i = 0; i < nodeIds.length; i += 1) {
      const id = nodeIds[i]!
      const neigh = args.neighbors.get(id) || []
      if (neigh.length === 0) continue

      const weightByLabel = new Map<string, number>()
      for (let j = 0; j < neigh.length; j += 1) {
        const nb = neigh[j]!
        const nbId = String(nb.id || '').trim()
        if (!nbId) continue
        const nbLabel = labels.get(nbId) || nbId
        const w = typeof nb.w === 'number' && Number.isFinite(nb.w) && nb.w > 0 ? nb.w : 0
        if (w <= 0) continue
        weightByLabel.set(nbLabel, (weightByLabel.get(nbLabel) || 0) + w)
      }
      if (weightByLabel.size === 0) continue

      let bestLabel = labels.get(id) || id
      let bestW = -1
      weightByLabel.forEach((w, l) => {
        if (w > bestW) {
          bestW = w
          bestLabel = l
          return
        }
        if (w === bestW && l.localeCompare(bestLabel) < 0) {
          bestLabel = l
        }
      })

      const cur = labels.get(id) || id
      if (bestLabel !== cur) {
        labels.set(id, bestLabel)
        changed = true
      }
    }
    if (!changed) break
  }

  return labels
}

const compressCommunityLabels = (args: {
  labelsByNodeId: Map<string, string>
  neighbors: Map<string, WeightedNeighbor[]>
  maxCommunities: number
}): Map<string, number> => {
  const max = Math.max(2, Math.min(64, Math.floor(args.maxCommunities)))
  const labelsByNodeId = new Map(args.labelsByNodeId)

  const buildNodesByLabel = () => {
    const out = new Map<string, string[]>()
    labelsByNodeId.forEach((label, nodeId) => {
      const arr = out.get(label) || []
      arr.push(nodeId)
      out.set(label, arr)
    })
    out.forEach(arr => arr.sort((a, b) => a.localeCompare(b)))
    return out
  }

  let nodesByLabel = buildNodesByLabel()

  const totalCommunityWeight = (label: string): number => {
    const nodes = nodesByLabel.get(label) || []
    const nodeSet = new Set(nodes)
    let w = 0
    for (let i = 0; i < nodes.length; i += 1) {
      const id = nodes[i]!
      const neigh = args.neighbors.get(id) || []
      for (let j = 0; j < neigh.length; j += 1) {
        const nb = neigh[j]!
        if (!nodeSet.has(nb.id)) continue
        w += nb.w
      }
    }
    return w
  }

  while (nodesByLabel.size > max) {
    const labels = Array.from(nodesByLabel.entries()).map(([label, nodes]) => ({ label, size: nodes.length }))
    labels.sort((a, b) => a.size - b.size || a.label.localeCompare(b.label))
    const smallest = labels[0]
    if (!smallest) break
    const smallLabel = smallest.label
    const smallNodes = nodesByLabel.get(smallLabel) || []
    if (smallNodes.length === 0) {
      nodesByLabel.delete(smallLabel)
      continue
    }

    for (let i = 0; i < smallNodes.length; i += 1) {
      const id = smallNodes[i]!
      const neigh = args.neighbors.get(id) || []
      let bestTarget: string | null = null
      let bestW = -1
      for (let j = 0; j < neigh.length; j += 1) {
        const nb = neigh[j]!
        const nbLabel = labelsByNodeId.get(nb.id) || null
        if (!nbLabel || nbLabel === smallLabel) continue
        if (!nodesByLabel.has(nbLabel)) continue
        const w = nb.w
        if (w > bestW) {
          bestW = w
          bestTarget = nbLabel
        } else if (w === bestW && bestTarget && nbLabel.localeCompare(bestTarget) < 0) {
          bestTarget = nbLabel
        }
      }
      if (bestTarget) labelsByNodeId.set(id, bestTarget)
    }

    nodesByLabel = buildNodesByLabel()
  }

  const communities = Array.from(nodesByLabel.entries()).map(([label, nodes]) => ({
    label,
    size: nodes.length,
    weight: totalCommunityWeight(label),
  }))
  communities.sort((a, b) => b.weight - a.weight || b.size - a.size || a.label.localeCompare(b.label))

  const idByLabel = new Map<string, number>()
  for (let i = 0; i < communities.length; i += 1) {
    idByLabel.set(communities[i]!.label, i + 1)
  }

  const out = new Map<string, number>()
  labelsByNodeId.forEach((label, nodeId) => {
    const cid = idByLabel.get(label)
    if (cid != null) out.set(nodeId, cid)
  })
  return out
}


export const deriveKeywordGraphFromText = (source: KeywordGraphSource): KeywordGraphResult => {
  const docId = String(source.documentId || 'doc')
  const text = String(source.documentText || '')
  const rawSourceHash = typeof source.sourceTextHash === 'string' && source.sourceTextHash.trim()
    ? source.sourceTextHash.trim()
    : hashText(text)
  const sourceLayerHash = `kw:v${KEYWORD_GRAPH_ALGO_VERSION}:${rawSourceHash}`
  
  const textEntities = extractMentionsRobust(text)
  const mentions: Mention[] = textEntities.map(e => ({
    key: normalizeEntityKey(e.text),
    label: e.text,
    start: e.start,
    end: e.end,
    ner: e.label
  })).sort((a, b) => {
    const am = (a.start + a.end) / 2
    const bm = (b.start + b.end) / 2
    const diff = am - bm
    if (diff !== 0) return diff
    return a.key.localeCompare(b.key)
  })

  const entityByKey = new Map<string, { id: string; label: string; count: number; ner?: string }>()
  for (let i = 0; i < mentions.length; i += 1) {
    const m = mentions[i]!
    const key = m.key
    if (!isUsefulEntityKey(key)) continue
    const existing = entityByKey.get(key)
    if (existing) {
      existing.count += 1
      continue
    }
    const id = `kw:entity:${hashText(key)}`
    entityByKey.set(key, { id, label: m.label || prettyLabel(key) || key, count: 1, ner: m.ner })
  }

  const pairCounts = new Map<string, number>()
  const entityBlockCounts = new Map<string, number>()
  const relationCountsByPair = new Map<string, Map<string, number>>()
  const predicateKeys = new Set<string>()
  const roleCountsByEntityKey = new Map<string, { subject: number; object: number }>()
  const directionCountsByPair = new Map<string, Map<string, number>>()

  // 1. Process explicit triples first for strong signals
  const explicitTriples = extractTriplesHeuristic(text, textEntities)
  const cooccurrenceTriples = extractCooccurrencePairs(text, textEntities)
  
  // Merge all signals
  const allTriples = [...explicitTriples.map(t => ({ ...t, weight: 3 })), ...cooccurrenceTriples.map(t => ({ ...t, weight: 1 }))]

  for (const t of allTriples) {
    const sKey = normalizeEntityKey(t.subject)
    const oKey = normalizeEntityKey(t.object)
    const pKey = normalizeEntityKey(t.predicate)
    if (!sKey || !oKey || !pKey) continue
    if (!isUsefulEntityKey(sKey) || !isUsefulEntityKey(oKey) || !isUsefulEntityKey(pKey)) continue
    
    // Ensure nodes exist
    if (!entityByKey.has(sKey)) {
        const id = `kw:entity:${hashText(sKey)}`
        entityByKey.set(sKey, { id, label: t.subject, count: 1 })
    }
    if (!entityByKey.has(oKey)) {
        const id = `kw:entity:${hashText(oKey)}`
        entityByKey.set(oKey, { id, label: t.object, count: 1 })
    }
    
    // Boost counts based on signal strength
    const sNode = entityByKey.get(sKey)!
    sNode.count += t.weight
    const oNode = entityByKey.get(oKey)!
    oNode.count += t.weight

    // Record pair
    const pairKey = sKey.localeCompare(oKey) < 0 ? `${sKey}|${oKey}` : `${oKey}|${sKey}`
    pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + t.weight)

    // Record relation
    const relMap = relationCountsByPair.get(pairKey) || new Map<string, number>()
    relMap.set(pKey, (relMap.get(pKey) || 0) + t.weight)
    relationCountsByPair.set(pairKey, relMap)
    predicateKeys.add(pKey)

    // Record roles
    const sRole = roleCountsByEntityKey.get(sKey) || { subject: 0, object: 0 }
    sRole.subject += t.weight
    roleCountsByEntityKey.set(sKey, sRole)
    const oRole = roleCountsByEntityKey.get(oKey) || { subject: 0, object: 0 }
    oRole.object += t.weight
    roleCountsByEntityKey.set(oKey, oRole)

    // Record direction
    const dirKey = `${sKey}|${oKey}`
    const dirMap = directionCountsByPair.get(pairKey) || new Map<string, number>()
    dirMap.set(dirKey, (dirMap.get(dirKey) || 0) + t.weight)
    directionCountsByPair.set(pairKey, dirMap)
  }

  // Record block counts for PPMI
  const sentenceRanges = splitSentencesWithOffsets(text)
  for (const range of sentenceRanges) {
    const sentenceEntities = textEntities.filter(e => e.start >= range.start && e.end <= range.end)
    const uniqueKeys = new Set(sentenceEntities.map(e => normalizeEntityKey(e.text)).filter(k => !!k && isUsefulEntityKey(k)))
    uniqueKeys.forEach(k => {
      entityBlockCounts.set(k, (entityBlockCounts.get(k) || 0) + 1)
    })
  }

  predicateKeys.forEach((p) => {
    const key = normalizeEntityKey(p)
    if (!key) return
    if (key.includes(' ')) return
    if (entityByKey.has(key)) entityByKey.delete(key)
  })

  const roleByEntityKey = new Map<string, 'subject' | 'object' | 'entity'>()
  entityByKey.forEach((_, key) => {
    const counts = roleCountsByEntityKey.get(key) || { subject: 0, object: 0 }
    const subj = counts.subject
    const obj = counts.object
    const role: 'subject' | 'object' | 'entity' = subj > obj ? 'subject' : obj > subj ? 'object' : 'entity'
    roleByEntityKey.set(key, role)
  })

  pairCounts.forEach((_, pairKey) => {
    const parts = pairKey.split('|')
    const a = parts[0] || ''
    const b = parts[1] || ''
    if (!a || !b) {
      pairCounts.delete(pairKey)
      relationCountsByPair.delete(pairKey)
      return
    }
    if (!entityByKey.has(a) || !entityByKey.has(b)) {
      pairCounts.delete(pairKey)
      relationCountsByPair.delete(pairKey)
    }
  })

  const nodes: GraphNode[] = []
  const nodeCountsById = new Map<string, number>()
  entityByKey.forEach((v, key) => {
    const count = v.count
    nodeCountsById.set(v.id, count)
    const nodeSize = keywordNodeSizeFromCount(count)
    const role = roleByEntityKey.get(key) || 'entity'
    const fill = KEYWORD_ROLE_COLORS[role]
    nodes.push({
      id: v.id,
      label: v.label,
      type: 'Keyword',
      properties: {
        'keyword:key': key as unknown as JSONValue,
        'keyword:kind': 'entity',
        'keyword:role': role,
        'keyword:ner': v.ner as unknown as JSONValue,
        'keyword:frequency': count as unknown as JSONValue,
        count: count as unknown as JSONValue,
        'visual:importance': count as unknown as JSONValue,
        'visual:nodeSize': nodeSize as unknown as JSONValue,
        'visual:fill': fill as unknown as JSONValue,
        fill: fill as unknown as JSONValue,
        tags: [role === 'object' ? 'execution' : 'idea'] as unknown as JSONValue,
      },
      metadata: {
        derived: true,
        kind: 'keyword',
        source: docId,
      },
    })
  })
  nodes.sort((a, b) => String(a.id).localeCompare(String(b.id)))

  const ppmi = computePpmi({ pairCounts, entityBlockCounts, blockCount: sentenceRanges.length })

  const edges: GraphEdge[] = []
  pairCounts.forEach((count, pairKey) => {
    const [a, b] = pairKey.split('|')
    if (!a || !b) return
    const rawSrc = entityByKey.get(a)?.id || ''
    const rawTgt = entityByKey.get(b)?.id || ''
    if (!rawSrc || !rawTgt) return
    let src = rawSrc
    let tgt = rawTgt
    const relMap = relationCountsByPair.get(pairKey) || new Map<string, number>()
    let bestRel = 'relates_to'
    let bestRelCount = -1
    relMap.forEach((c, rel) => {
      if (c > bestRelCount) {
        bestRelCount = c
        bestRel = rel
      } else if (c === bestRelCount && rel.localeCompare(bestRel) < 0) {
        bestRel = rel
      }
    })
    const dirMap = directionCountsByPair.get(pairKey) || new Map<string, number>()
    let bestDir: string | null = null
    let bestDirCount = -1
    dirMap.forEach((c, k) => {
      if (c > bestDirCount) {
        bestDirCount = c
        bestDir = k
      } else if (c === bestDirCount && k.localeCompare(bestDir || '') < 0) {
        bestDir = k
      }
    })
    if (bestDir) {
      const [subjKey, objKey] = bestDir.split('|')
      const subjId = subjKey ? (entityByKey.get(subjKey)?.id || '') : ''
      const objId = objKey ? (entityByKey.get(objKey)?.id || '') : ''
      if (subjId && objId) {
        src = subjId
        tgt = objId
      }
    }
    const w = ppmi.get(pairKey) || 0
    const width = deriveEdgeWidthFromStrength({ count, weight: w })
    const strengthScore = Math.max(0, Math.min(1, w / 3))
    const strokeAlpha = clampNumber(0.15 + strengthScore * 0.85, 0.15, 1)
    const stroke = `rgba(156, 163, 175, ${strokeAlpha.toFixed(3)})`
    const id = `kw:edge:${hashText(`${src}|${bestRel}|${tgt}`)}`
    edges.push({
      id,
      source: src,
      target: tgt,
      label: bestRel,
      properties: {
        count: count as unknown as JSONValue,
        weight: w as unknown as JSONValue,
        'strength:count': count as unknown as JSONValue,
        'strength:ppmi': w as unknown as JSONValue,
        'strength:score': strengthScore as unknown as JSONValue,
        'visual:weight': w as unknown as JSONValue,
        'visual:width': width as unknown as JSONValue,
        'visual:stroke': stroke as unknown as JSONValue,
        'keyword:kind': 'predicate',
        'keyword:predicate': bestRel as unknown as JSONValue,
        'keyword:verbLike': (isVerbLike(bestRel) ? true : false) as unknown as JSONValue,
        'keyword:directed': (bestDir ? true : false) as unknown as JSONValue,
      },
      metadata: {
        derived: true,
        kind: 'keyword',
        source: docId,
      },
    })
  })
  edges.sort((a, b) => String(a.id).localeCompare(String(b.id)))

  const prunedEdges = (() => {
    const nodeCount = nodes.length
    const maxEdges = Math.max(60, Math.min(2400, nodeCount * 6))
    if (edges.length <= maxEdges) return edges
    const scored = edges
      .map(e => {
        const props = (e.properties || {}) as Record<string, unknown>
        const score = typeof props['strength:score'] === 'number' && Number.isFinite(props['strength:score']) ? (props['strength:score'] as number) : 0
        const count = typeof props['strength:count'] === 'number' && Number.isFinite(props['strength:count']) ? (props['strength:count'] as number) : 0
        return { e, score, count }
      })
      .sort((a, b) => b.score - a.score || b.count - a.count || String(a.e.id).localeCompare(String(b.e.id)))
    const kept = scored.slice(0, maxEdges).map(x => x.e)
    kept.sort((a, b) => String(a.id).localeCompare(String(b.id)))
    return kept
  })()

  const undirectedNeighbors = new Map<string, string[]>()
  const weightedNeighbors = new Map<string, WeightedNeighbor[]>()
  for (let i = 0; i < prunedEdges.length; i += 1) {
    const e = prunedEdges[i]!
    const s = String(e.source || '')
    const t = String(e.target || '')
    if (!s || !t) continue
    const sArr = undirectedNeighbors.get(s) || []
    sArr.push(t)
    undirectedNeighbors.set(s, sArr)
    const tArr = undirectedNeighbors.get(t) || []
    tArr.push(s)
    undirectedNeighbors.set(t, tArr)

    const props = (e.properties || {}) as Record<string, unknown>
    const wRaw = typeof props['strength:ppmi'] === 'number' && Number.isFinite(props['strength:ppmi']) ? (props['strength:ppmi'] as number) : null
    const w = wRaw != null && wRaw > 0 ? wRaw : 0
    if (w > 0) {
      const sW = weightedNeighbors.get(s) || []
      sW.push({ id: t, w })
      weightedNeighbors.set(s, sW)
      const tW = weightedNeighbors.get(t) || []
      tW.push({ id: s, w })
      weightedNeighbors.set(t, tW)
    }
  }

  const entityNodeIds = nodes.map(n => String(n.id))
  const lpa = computeLabelPropagationCommunities({
    nodeIds: entityNodeIds,
    neighbors: weightedNeighbors,
    iterations: entityNodeIds.length > 300 ? 8 : 14,
  })
  const communityByNodeId = compressCommunityLabels({
    labelsByNodeId: lpa,
    neighbors: weightedNeighbors,
    maxCommunities: entityNodeIds.length > 250 ? 14 : 18,
  })
  const pr = computePageRank({ nodeIds: entityNodeIds, neighbors: undirectedNeighbors, iterations: 24, damping: 0.85 })
  nodes.forEach((n) => {
    const id = String(n.id)
    const cid = communityByNodeId.get(id)
    const rank = pr.get(id) || 0
    const props = (n.properties || {}) as Record<string, unknown>
    const count = typeof props.count === 'number' && Number.isFinite(props.count) ? props.count : 0
    const importance = count + rank * 10
    n.properties = {
      ...(n.properties || {}),
      'keyword:pagerank': rank as unknown as JSONValue,
      'visual:importance': importance as unknown as JSONValue,
      ...(cid == null ? {} : { 'visual:community': cid as unknown as JSONValue, 'visual:layer': cid as unknown as JSONValue }),
    }
  })

  const graph: GraphData = {
    type: 'Graph',
    context: '',
    metadata: {
      derived: true,
      kind: 'keyword',
      source: docId,
      sourceLayerHash: sourceLayerHash as unknown as JSONValue,
      sourceLabel: (source.sourceLabel || '') as unknown as JSONValue,
    },
    nodes,
    edges: prunedEdges,
  }

  return { graph, nodeCountsById }
}

export const keywordGraphCache = new LRUCache<string, KeywordGraphResult>(30)
