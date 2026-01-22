import { LRUCache } from '@/lib/cache/LRUCache'
import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { hashText } from '@/features/parsers/hash'
import { tokenizeForStats } from '@/components/BottomPanel/BottomPanelStatsUtils'
import { NLTK_STOPWORDS_EN_SET } from '@/features/semantic-mode/keywordStopwords'
import { MVP_COLOR_PALETTE } from '@/lib/graph/schema'
import { computeConnectedComponents, computePageRank } from '@/features/semantic-mode/graphAlgorithms'
import {
  extractMentionsRobust,
  extractTriplesHeuristic,
  splitSentencesWithOffsets,
  isVerbLike,
  normalizeWhitespace,
  type TextEntity,
} from '@/lib/graph/textAnalysis'

export type KeywordGraphSource = {
  documentId: string
  documentText: string
  sourceLabel?: string
}

export type KeywordGraphResult = {
  graph: GraphData
  nodeCountsById: Map<string, number>
}

const DEFAULT_STOPWORDS = NLTK_STOPWORDS_EN_SET

const clampNumber = (v: number, min: number, max: number): number => {
  if (!Number.isFinite(v)) return min
  return Math.max(min, Math.min(max, v))
}

const keywordNodeSizeFromCount = (count: number): number => {
  const c = Number.isFinite(count) ? Math.max(0, count) : 0
  const radius = 8 + Math.sqrt(c) * 4
  return clampNumber(radius, 10, 40)
}

const keywordEdgeWidthFromStrength = (args: { count: number; weight: number }): number => {
  const c = Number.isFinite(args.count) ? Math.max(0, args.count) : 0
  const w = Number.isFinite(args.weight) ? Math.max(0, args.weight) : 0
  const width = 1 + Math.sqrt(c) * 0.7 + w * 0.7
  return clampNumber(width, 1, 8)
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

const normalizeEntityKey = (raw: string): string => {
  const t = String(raw || '').trim().replace(/\s+/g, ' ')
  if (!t) return ''
  const stripped = t.replace(/^[\s"'“”‘’()[\]{}]+|[\s"'“”‘’()[\]{}]+$/g, '').trim()
  if (!stripped) return ''
  return stripped.toLowerCase()
}

const prettyLabel = (key: string): string => {
  const t = String(key || '').trim()
  if (!t) return ''
  return t
    .split(' ')
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

const inferRelationshipKeyword = (args: {
  betweenText: string
  stopwords: ReadonlySet<string>
  disallow: ReadonlySet<string>
}): string => {
  const tokens = tokenizeForStats(args.betweenText, 2, new Set())
  const cleaned = tokens
    .map(t => String(t || '').trim().toLowerCase())
    .filter(t => !!t && !args.stopwords.has(t) && !args.disallow.has(t))
  const verb = cleaned.find(t => isVerbLike(t))
  if (verb) return verb
  if (cleaned.length > 0) return cleaned[0]!
  return 'relates_to'
}

const computePpmi = (args: {
  pairCounts: Map<string, number>
  entityBlockCounts: Map<string, number>
  blockCount: number
}): Map<string, number> => {
  const out = new Map<string, number>()
  const blocks = Number.isFinite(args.blockCount) ? Math.max(0, Math.floor(args.blockCount)) : 0
  if (blocks <= 0) return out
  const total = blocks
  args.pairCounts.forEach((cnt, key) => {
    const parts = key.split('|')
    const a = parts[0] || ''
    const b = parts[1] || ''
    if (!a || !b) return
    const ca = args.entityBlockCounts.get(a) || 0
    const cb = args.entityBlockCounts.get(b) || 0
    if (ca <= 0 || cb <= 0 || cnt <= 0) return
    const pAb = cnt / total
    const pA = ca / total
    const pB = cb / total
    const denom = pA * pB
    if (denom <= 0 || pAb <= 0) return
    const pmi = Math.log(pAb / denom)
    if (!(pmi > 0)) return
    out.set(key, pmi)
  })
  return out
}

export const deriveKeywordGraphFromText = (source: KeywordGraphSource): KeywordGraphResult => {
  const docId = String(source.documentId || 'doc')
  const text = String(source.documentText || '')
  
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
  const triples = extractTriplesHeuristic(text, textEntities)
  for (const t of triples) {
    const sKey = normalizeEntityKey(t.subject)
    const oKey = normalizeEntityKey(t.object)
    const pKey = normalizeEntityKey(t.predicate)
    if (!sKey || !oKey || !pKey) continue
    if (!entityByKey.has(sKey)) {
        // Fallback: create node if missing (though extractTriples usually uses existing entities)
        const id = `kw:entity:${hashText(sKey)}`
        entityByKey.set(sKey, { id, label: t.subject, count: 1 })
    }
    if (!entityByKey.has(oKey)) {
        const id = `kw:entity:${hashText(oKey)}`
        entityByKey.set(oKey, { id, label: t.object, count: 1 })
    }
    
    // Boost counts
    const sNode = entityByKey.get(sKey)!
    sNode.count += 2
    const oNode = entityByKey.get(oKey)!
    oNode.count += 2

    // Record pair
    const pairKey = sKey.localeCompare(oKey) < 0 ? `${sKey}|${oKey}` : `${oKey}|${sKey}`
    pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + 3) // Higher weight for explicit triples

    // Record relation
    const relMap = relationCountsByPair.get(pairKey) || new Map<string, number>()
    relMap.set(pKey, (relMap.get(pKey) || 0) + 3)
    relationCountsByPair.set(pairKey, relMap)
    predicateKeys.add(pKey)

    // Record roles
    const sRole = roleCountsByEntityKey.get(sKey) || { subject: 0, object: 0 }
    sRole.subject += 3
    roleCountsByEntityKey.set(sKey, sRole)
    const oRole = roleCountsByEntityKey.get(oKey) || { subject: 0, object: 0 }
    oRole.object += 3
    roleCountsByEntityKey.set(oKey, oRole)

    // Record direction
    const dirKey = `${sKey}|${oKey}`
    const dirMap = directionCountsByPair.get(pairKey) || new Map<string, number>()
    dirMap.set(dirKey, (dirMap.get(dirKey) || 0) + 3)
    directionCountsByPair.set(pairKey, dirMap)
  }

  // 2. Process co-occurrence for implicit signals
  const sentenceRanges = splitSentencesWithOffsets(text)
  const mentionsBySentence: Mention[][] = []
  if (sentenceRanges.length > 0 && mentions.length > 0) {
    let mIdx = 0
    for (let sIdx = 0; sIdx < sentenceRanges.length; sIdx += 1) {
      const r = sentenceRanges[sIdx]!
      const bucket: Mention[] = []
      while (mIdx < mentions.length) {
        const m = mentions[mIdx]!
        const mid = (m.start + m.end) / 2
        if (mid < r.start) {
          mIdx += 1
          continue
        }
        if (mid > r.end) break
        bucket.push(m)
        mIdx += 1
      }
      mentionsBySentence.push(bucket)
    }
  } else {
    for (let i = 0; i < sentenceRanges.length; i += 1) mentionsBySentence.push([])
  }

  for (let sIdx = 0; sIdx < mentionsBySentence.length; sIdx += 1) {
    const list = mentionsBySentence[sIdx] || []
    if (list.length < 2) continue
    const localCounts = new Map<string, number>()
    for (let i = 0; i < list.length; i += 1) {
      const k = list[i]?.key
      if (!k) continue
      localCounts.set(k, (localCounts.get(k) || 0) + 1)
    }
    const uniqueKeys = Array.from(localCounts.entries())
      .sort((a, b) => {
        const diff = b[1] - a[1]
        if (diff !== 0) return diff
        return a[0].localeCompare(b[0])
      })
      .map(([k]) => k)
      .slice(0, 25)
    if (uniqueKeys.length < 2) continue
    const uniqueKeySet = new Set<string>(uniqueKeys)
    for (let i = 0; i < uniqueKeys.length; i += 1) {
      const k = uniqueKeys[i]!
      entityBlockCounts.set(k, (entityBlockCounts.get(k) || 0) + 1)
    }
    for (let i = 0; i < uniqueKeys.length; i += 1) {
      for (let j = i + 1; j < uniqueKeys.length; j += 1) {
        const a = uniqueKeys[i]!
        const b = uniqueKeys[j]!
        const key = a.localeCompare(b) < 0 ? `${a}|${b}` : `${b}|${a}`
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1)
      }
    }

    const sentence = text.slice(sentenceRanges[sIdx]!.start, sentenceRanges[sIdx]!.end)
    const earliestMentionByKey = new Map<string, Mention>()
    for (let i = 0; i < list.length; i += 1) {
      const m = list[i]!
      if (!uniqueKeySet.has(m.key)) continue
      const existing = earliestMentionByKey.get(m.key)
      if (!existing || m.start < existing.start) {
        earliestMentionByKey.set(m.key, m)
      }
    }
    for (let i = 0; i < uniqueKeys.length; i += 1) {
      for (let j = i + 1; j < uniqueKeys.length; j += 1) {
        const a = uniqueKeys[i]!
        const b = uniqueKeys[j]!
        const aMention = earliestMentionByKey.get(a)
        const bMention = earliestMentionByKey.get(b)
        if (!aMention || !bMention) continue
        const base = sentenceRanges[sIdx]!.start
        const leftMention = aMention.start <= bMention.start ? aMention : bMention
        const rightMention = aMention.start <= bMention.start ? bMention : aMention
        const left = Math.max(0, leftMention.end - base)
        const right = Math.max(0, rightMention.start - base)
        const between = left < right ? sentence.slice(left, right) : ''
        const disallow = new Set<string>([a, b])
        const verb = inferRelationshipKeyword({ betweenText: between, stopwords: DEFAULT_STOPWORDS, disallow })
        const predKey = normalizeEntityKey(String(verb || '')) || 'relates_to'
        predicateKeys.add(predKey)
        const pairKey = a.localeCompare(b) < 0 ? `${a}|${b}` : `${b}|${a}`
        const relMap = relationCountsByPair.get(pairKey) || new Map<string, number>()
        relMap.set(predKey, (relMap.get(predKey) || 0) + 1)
        relationCountsByPair.set(pairKey, relMap)

        const subjKey = leftMention.key
        const objKey = rightMention.key
        const subjCounts = roleCountsByEntityKey.get(subjKey) || { subject: 0, object: 0 }
        subjCounts.subject += 1
        roleCountsByEntityKey.set(subjKey, subjCounts)
        const objCounts = roleCountsByEntityKey.get(objKey) || { subject: 0, object: 0 }
        objCounts.object += 1
        roleCountsByEntityKey.set(objKey, objCounts)

        const dirKey = `${subjKey}|${objKey}`
        const dirMap = directionCountsByPair.get(pairKey) || new Map<string, number>()
        dirMap.set(dirKey, (dirMap.get(dirKey) || 0) + 1)
        directionCountsByPair.set(pairKey, dirMap)
      }
    }
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

  const ppmi = computePpmi({ pairCounts, entityBlockCounts, blockCount: mentionsBySentence.length })

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
    const width = keywordEdgeWidthFromStrength({ count, weight: w })
    const id = `kw:edge:${hashText(`${src}|${bestRel}|${tgt}`)}`
    edges.push({
      id,
      source: src,
      target: tgt,
      label: bestRel,
      properties: {
        count: count as unknown as JSONValue,
        weight: w as unknown as JSONValue,
        'visual:weight': w as unknown as JSONValue,
        'visual:width': width as unknown as JSONValue,
        'keyword:kind': 'predicate',
        'keyword:predicate': bestRel as unknown as JSONValue,
        'keyword:verbLike': (isVerbLike(bestRel) ? true : false) as unknown as JSONValue,
      },
      metadata: {
        derived: true,
        kind: 'keyword',
        source: docId,
      },
    })
  })
  edges.sort((a, b) => String(a.id).localeCompare(String(b.id)))

  const undirectedNeighbors = new Map<string, string[]>()
  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i]!
    const s = String(e.source || '')
    const t = String(e.target || '')
    if (!s || !t) continue
    const sArr = undirectedNeighbors.get(s) || []
    sArr.push(t)
    undirectedNeighbors.set(s, sArr)
    const tArr = undirectedNeighbors.get(t) || []
    tArr.push(s)
    undirectedNeighbors.set(t, tArr)
  }

  const entityNodeIds = nodes.map(n => String(n.id))
  const communities = computeConnectedComponents({
    nodeIds: entityNodeIds,
    undirectedNeighbors,
  })
  const pr = computePageRank({ nodeIds: entityNodeIds, neighbors: undirectedNeighbors, iterations: 24, damping: 0.85 })
  nodes.forEach((n) => {
    const id = String(n.id)
    const cid = communities.get(id)
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
      sourceLabel: (source.sourceLabel || '') as unknown as JSONValue,
    },
    nodes,
    edges,
  }

  return { graph, nodeCountsById }
}

export const keywordGraphCache = new LRUCache<string, KeywordGraphResult>(30, 60_000)
