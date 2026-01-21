import { LRUCache } from '@/lib/cache/LRUCache'
import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { hashText } from '@/features/parsers/hash'
import { tokenizeForStats } from '@/components/BottomPanel/BottomPanelStatsUtils'

export type KeywordGraphSource = {
  documentId: string
  documentText: string
  sourceLabel?: string
}

export type KeywordGraphResult = {
  graph: GraphData
  nodeCountsById: Map<string, number>
}

const DEFAULT_STOPWORDS = new Set<string>([
  'a','an','and','are','as','at','be','because','been','but','by','can','could','did','do','does','for','from','had','has','have','he','her','hers','him','his','how','i','if','in','into','is','it','its','just','may','might','more','most','must','my','no','not','of','on','or','our','ours','she','should','so','some','such','than','that','the','their','theirs','them','then','there','these','they','this','those','to','too','us','was','we','were','what','when','where','which','who','why','will','with','would','you','your','yours',
])

const VERB_HINTS = new Set<string>([
  'is','are','was','were','be','been','being',
  'has','have','had',
  'use','uses','used','using',
  'make','makes','made','making',
  'build','builds','built','building',
  'create','creates','created','creating',
  'parse','parses','parsed','parsing',
  'derive','derives','derived','deriving',
  'render','renders','rendered','rendering',
  'layout','layouts','laid','laying',
  'link','links','linked','linking',
  'connect','connects','connected','connecting',
  'enable','enables','enabled','enabling',
  'disable','disables','disabled','disabling',
  'support','supports','supported','supporting',
  'cause','causes','caused','causing',
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

const buildLabelPropagationCommunities = (args: {
  nodeIds: string[]
  undirectedNeighbors: Map<string, string[]>
  maxIter?: number
}): Map<string, number> => {
  const maxIter = Number.isFinite(args.maxIter) ? Math.max(1, Math.floor(args.maxIter as number)) : 20
  const nodes = [...args.nodeIds].sort((a, b) => a.localeCompare(b))
  const labelById = new Map<string, number>()
  for (let i = 0; i < nodes.length; i += 1) labelById.set(nodes[i]!, i)
  if (nodes.length === 0) return labelById

  for (let iter = 0; iter < maxIter; iter += 1) {
    let changed = false
    for (let i = 0; i < nodes.length; i += 1) {
      const nid = nodes[i]!
      const nbs = args.undirectedNeighbors.get(nid) || []
      if (!nbs.length) continue
      const counts = new Map<number, number>()
      for (let j = 0; j < nbs.length; j += 1) {
        const nb = nbs[j]!
        const lbl = labelById.get(nb)
        if (lbl == null) continue
        counts.set(lbl, (counts.get(lbl) || 0) + 1)
      }
      if (counts.size === 0) continue
      let bestLabel: number | null = null
      let bestCount = -1
      counts.forEach((count, label) => {
        if (count > bestCount) {
          bestCount = count
          bestLabel = label
        } else if (count === bestCount && bestLabel != null && label < bestLabel) {
          bestLabel = label
        }
      })
      if (bestLabel == null) continue
      if (labelById.get(nid) !== bestLabel) {
        labelById.set(nid, bestLabel)
        changed = true
      }
    }
    if (!changed) break
  }

  const unique = Array.from(new Set(Array.from(labelById.values()))).sort((a, b) => a - b)
  const remap = new Map<number, number>()
  for (let i = 0; i < unique.length; i += 1) remap.set(unique[i]!, i)
  const out = new Map<string, number>()
  labelById.forEach((label, id) => out.set(id, remap.get(label) ?? 0))
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
        predicateKeys.add(String(verb || '').toLowerCase())
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
    nodes.push({
      id: v.id,
      label: v.label,
      type: 'Keyword',
      properties: {
        'keyword:key': key as unknown as JSONValue,
        'keyword:kind': 'entity',
        count: count as unknown as JSONValue,
        'visual:importance': count as unknown as JSONValue,
        'visual:nodeSize': nodeSize as unknown as JSONValue,
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

  const communities = buildLabelPropagationCommunities({
    nodeIds: nodes.map(n => String(n.id)),
    undirectedNeighbors,
    maxIter: 20,
  })
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    const cid = communities.get(String(n.id))
    if (cid == null) continue
    n.properties = { ...(n.properties || {}), 'visual:community': cid as unknown as JSONValue }
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
