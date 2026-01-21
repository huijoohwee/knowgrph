import { LRUCache } from '@/lib/cache/LRUCache'
import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { hashText } from '@/features/parsers/hash'
import { tokenizeForStats } from '@/components/BottomPanel/BottomPanelStatsUtils'
import { NLTK_STOPWORDS_EN_SET } from '@/features/semantic-mode/keywordStopwords'

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

const VERB_HINTS = new Set<string>([
  'is','are','was','were','be','been','being','has','have','had','use','uses','used','using','make','makes','made','making',
  'build','builds','built','building','create','creates','created','creating','parse','parses','parsed','parsing',
  'derive','derives','derived','deriving','render','renders','rendered','rendering','layout','layouts','laid','laying',
  'link','links','linked','linking','connect','connects','connected','connecting','enable','enables','enabled','enabling',
  'disable','disables','disabled','disabling','support','supports','supported','supporting','cause','causes','caused','causing',
  'lead','leads','led','leading',
])

const isVerbLike = (token: string): boolean => {
  const t = String(token || '').toLowerCase()
  if (!t) return false
  if (VERB_HINTS.has(t)) return true
  if (t.length <= 2) return false
  if (DEFAULT_STOPWORDS.has(t)) return false
  if (t.endsWith('ed') || t.endsWith('ing')) return true
  if (t.endsWith('ize') || t.endsWith('ise')) return true
  if (t.endsWith('ify')) return true
  return false
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

const keywordPredicateNodeSizeFromCount = (count: number): number => {
  const c = Number.isFinite(count) ? Math.max(0, count) : 0
  const radius = 7 + Math.sqrt(c) * 3
  return clampNumber(radius, 8, 28)
}

const keywordEdgeWidthFromStrength = (args: { count: number; weight: number }): number => {
  const c = Number.isFinite(args.count) ? Math.max(0, args.count) : 0
  const w = Number.isFinite(args.weight) ? Math.max(0, args.weight) : 0
  const width = 1 + Math.sqrt(c) * 0.7 + w * 0.7
  return clampNumber(width, 1, 8)
}

type Mention = {
  key: string
  label: string
  start: number
  end: number
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

const splitSentencesWithOffsets = (text: string): Array<{ start: number; end: number }> => {
  const s = String(text || '')
  const out: Array<{ start: number; end: number }> = []
  let start = 0
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i]
    const isEnd = ch === '.' || ch === '!' || ch === '?' || ch === '\n'
    if (!isEnd) continue
    const end = i + 1
    if (end > start) out.push({ start, end })
    start = end
  }
  if (start < s.length) out.push({ start, end: s.length })
  return out.filter(r => r.end > r.start)
}

const extractEntityMentions = (text: string): Mention[] => {
  const raw = String(text || '')
  if (!raw.trim()) return []
  const mentions: Mention[] = []
  const push = (label: string, start: number, end: number) => {
    const key = normalizeEntityKey(label)
    if (!key) return
    if (DEFAULT_STOPWORDS.has(key)) return
    if (key.length < 3) return
    mentions.push({ key, label: label.trim(), start, end })
  }

  const codeRe = /`([^`\n]+)`/g
  for (const m of raw.matchAll(codeRe)) {
    const v = String(m[1] || '').trim()
    if (!v) continue
    const idx = m.index ?? -1
    if (idx < 0) continue
    push(v, idx, idx + m[0].length)
  }

  const capPhrase = /\b(?:[A-Z][a-z0-9]+)(?:\s+[A-Z][a-z0-9]+){0,5}\b/g
  for (const m of raw.matchAll(capPhrase)) {
    const v = String(m[0] || '').trim()
    const idx = m.index ?? -1
    if (!v || idx < 0) continue
    push(v, idx, idx + v.length)
  }

  const identifier = /\b[a-zA-Z][a-zA-Z0-9_]*[A-Z][a-zA-Z0-9_]*\b/g
  for (const m of raw.matchAll(identifier)) {
    const v = String(m[0] || '').trim()
    const idx = m.index ?? -1
    if (!v || idx < 0) continue
    push(v, idx, idx + v.length)
  }

  const snakeOrKebab = /\b[a-zA-Z][a-zA-Z0-9_]*_[a-zA-Z0-9_]+\b/g
  for (const m of raw.matchAll(snakeOrKebab)) {
    const v = String(m[0] || '').trim()
    const idx = m.index ?? -1
    if (!v || idx < 0) continue
    push(v, idx, idx + v.length)
  }

  const word = /\b[a-zA-Z][a-zA-Z0-9_'-]{1,}\b/g
  for (const m of raw.matchAll(word)) {
    const v = String(m[0] || '').trim()
    const idx = m.index ?? -1
    if (!v || idx < 0) continue
    const key = normalizeEntityKey(v)
    if (!key) continue
    if (DEFAULT_STOPWORDS.has(key)) continue
    if (key.length < 3) continue
    if (isVerbLike(key)) continue
    push(v, idx, idx + v.length)
  }

  return mentions
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

const buildConnectedComponentCommunities = (args: {
  nodeIds: string[]
  undirectedNeighbors: Map<string, string[]>
}): Map<string, number> => {
  const nodes = [...args.nodeIds].sort((a, b) => a.localeCompare(b))
  const visited = new Set<string>()
  const out = new Map<string, number>()
  let communityId = 0

  for (let i = 0; i < nodes.length; i += 1) {
    const start = nodes[i]!
    if (visited.has(start)) continue
    const queue: string[] = [start]
    visited.add(start)
    out.set(start, communityId)
    for (let qi = 0; qi < queue.length; qi += 1) {
      const cur = queue[qi]!
      const nbs = (args.undirectedNeighbors.get(cur) || []).slice().sort((a, b) => a.localeCompare(b))
      for (let j = 0; j < nbs.length; j += 1) {
        const nb = nbs[j]!
        if (visited.has(nb)) continue
        visited.add(nb)
        out.set(nb, communityId)
        queue.push(nb)
      }
    }
    communityId += 1
  }

  return out
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
  const mentions = extractEntityMentions(text).slice().sort((a, b) => {
    const am = (a.start + a.end) / 2
    const bm = (b.start + b.end) / 2
    const diff = am - bm
    if (diff !== 0) return diff
    return a.key.localeCompare(b.key)
  })

  const entityByKey = new Map<string, { id: string; label: string; count: number }>()
  for (let i = 0; i < mentions.length; i += 1) {
    const m = mentions[i]!
    const key = m.key
    const existing = entityByKey.get(key)
    if (existing) {
      existing.count += 1
      continue
    }
    const id = `kw:entity:${hashText(key)}`
    entityByKey.set(key, { id, label: m.label || prettyLabel(key) || key, count: 1 })
  }

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

  const pairCounts = new Map<string, number>()
  const entityBlockCounts = new Map<string, number>()
  const relationCountsByPair = new Map<string, Map<string, number>>()
  const predicateKeys = new Set<string>()
  const predicateCountsByKey = new Map<string, number>()
  const subjectCountsByKey = new Map<string, number>()
  const objectCountsByKey = new Map<string, number>()

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
        const key = `${a}|${b}`
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
        const verbKey = normalizeEntityKey(String(verb || ''))
        if (verbKey) {
          predicateKeys.add(verbKey)
          predicateCountsByKey.set(verbKey, (predicateCountsByKey.get(verbKey) || 0) + 1)
        }
        const subjectKey = leftMention.key
        const objectKey = rightMention.key
        subjectCountsByKey.set(subjectKey, (subjectCountsByKey.get(subjectKey) || 0) + 1)
        objectCountsByKey.set(objectKey, (objectCountsByKey.get(objectKey) || 0) + 1)
        const pairKey = `${a}|${b}`
        const relMap = relationCountsByPair.get(pairKey) || new Map<string, number>()
        relMap.set(verb, (relMap.get(verb) || 0) + 1)
        relationCountsByPair.set(pairKey, relMap)
      }
    }
  }

  predicateKeys.forEach((p) => {
    const key = normalizeEntityKey(p)
    if (!key) return
    if (key.includes(' ')) return
    if (entityByKey.has(key)) entityByKey.delete(key)
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
    const subjectCount = subjectCountsByKey.get(key) || 0
    const objectCount = objectCountsByKey.get(key) || 0
    nodes.push({
      id: v.id,
      label: v.label,
      type: 'KeywordEntity',
      properties: {
        'keyword:key': key as unknown as JSONValue,
        'keyword:kind': 'entity',
        count: count as unknown as JSONValue,
        'keyword:subjectCount': subjectCount as unknown as JSONValue,
        'keyword:objectCount': objectCount as unknown as JSONValue,
        'visual:importance': count as unknown as JSONValue,
        'visual:nodeSize': nodeSize as unknown as JSONValue,
        tags: ['idea'] as unknown as JSONValue,
      },
      metadata: {
        derived: true,
        kind: 'keyword',
        source: docId,
      },
    })
  })

  const predicateByKey = new Map<string, { id: string; label: string; count: number }>()
  predicateKeys.forEach((rawKey) => {
    const key = normalizeEntityKey(rawKey)
    if (!key) return
    if (DEFAULT_STOPWORDS.has(key)) return
    if (key.length < 2) return
    const count = predicateCountsByKey.get(key) || 1
    const id = `kw:predicate:${hashText(key)}`
    predicateByKey.set(key, { id, label: prettyLabel(key) || key, count })
  })
  predicateByKey.forEach((v, key) => {
    nodeCountsById.set(v.id, v.count)
    const nodeSize = keywordPredicateNodeSizeFromCount(v.count)
    nodes.push({
      id: v.id,
      label: v.label,
      type: 'KeywordPredicate',
      properties: {
        'keyword:key': key as unknown as JSONValue,
        'keyword:kind': 'predicate',
        count: v.count as unknown as JSONValue,
        'visual:importance': v.count as unknown as JSONValue,
        'visual:nodeSize': nodeSize as unknown as JSONValue,
        tags: ['execution'] as unknown as JSONValue,
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
    const src = entityByKey.get(a)?.id || ''
    const tgt = entityByKey.get(b)?.id || ''
    if (!src || !tgt) return
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
        'keyword:kind': 'relation',
        'keyword:predicate': String(bestRel || '').toLowerCase() as unknown as JSONValue,
      },
      metadata: {
        derived: true,
        kind: 'keyword',
        source: docId,
      },
    })

    const predicateKey = normalizeEntityKey(bestRel)
    const predicateNodeId = predicateByKey.get(predicateKey)?.id || ''
    if (!predicateNodeId) return

    const subjectId = src
    const objectId = tgt
    const subjectEdgeId = `kw:edge:${hashText(`${subjectId}|keyword:subject|${predicateNodeId}`)}`
    edges.push({
      id: subjectEdgeId,
      source: subjectId,
      target: predicateNodeId,
      label: 'keyword:subject',
      properties: {
        count: count as unknown as JSONValue,
        weight: w as unknown as JSONValue,
        'visual:weight': w as unknown as JSONValue,
        'visual:width': clampNumber(width * 0.7, 1, 6) as unknown as JSONValue,
        'keyword:kind': 'subject',
        'keyword:predicate': predicateKey as unknown as JSONValue,
      },
      metadata: {
        derived: true,
        kind: 'keyword',
        source: docId,
      },
    })
    const objectEdgeId = `kw:edge:${hashText(`${predicateNodeId}|keyword:object|${objectId}`)}`
    edges.push({
      id: objectEdgeId,
      source: predicateNodeId,
      target: objectId,
      label: 'keyword:object',
      properties: {
        count: count as unknown as JSONValue,
        weight: w as unknown as JSONValue,
        'visual:weight': w as unknown as JSONValue,
        'visual:width': clampNumber(width * 0.7, 1, 6) as unknown as JSONValue,
        'keyword:kind': 'object',
        'keyword:predicate': predicateKey as unknown as JSONValue,
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

  const communities = buildConnectedComponentCommunities({
    nodeIds: nodes.map(n => String(n.id)),
    undirectedNeighbors,
  })
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    const cid = communities.get(String(n.id))
    if (cid == null) continue
    n.properties = {
      ...(n.properties || {}),
      'visual:community': cid as unknown as JSONValue,
      'visual:layer': cid as unknown as JSONValue,
    }
  }

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
