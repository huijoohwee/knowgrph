import type { GraphData } from '@/lib/graph/types'
import { hashText } from '@/features/parsers/hash'
import { hasNodeMedia } from '@/components/GraphCanvas/helpers'
import { buildGraphMetaKey } from '@/lib/graph/graphMetaKey'
import { pickKeywordTextFromNode } from './keywordSourceText'

const computeBaselineIdentityKeys = (baseGraphData: GraphData): {
  baselineGraphMetaKey: string
  baselineDatasetKey: string
  baselineSourceLayerHash: string
} => {
  const baseMeta =
    baseGraphData.metadata && typeof baseGraphData.metadata === 'object' && !Array.isArray(baseGraphData.metadata)
      ? (baseGraphData.metadata as Record<string, unknown>)
      : null
  const baselineSourceLayerHash = typeof baseMeta?.sourceLayerHash === 'string' ? baseMeta.sourceLayerHash.trim() : ''
  const baselineGraphMetaKey = buildGraphMetaKey(baseGraphData)
  const baselineDatasetKey = (() => {
    if (baselineSourceLayerHash) return `sourceLayer:${baselineSourceLayerHash}`
    const graphId = typeof baseMeta?.graphId === 'string' ? baseMeta.graphId.trim() : ''
    if (graphId) return `graphId:${graphId}`
    const kind = typeof baseMeta?.kind === 'string' ? baseMeta.kind.trim() : ''
    const source = typeof baseMeta?.source === 'string' ? baseMeta.source.trim() : ''
    if (kind || source) return `meta:${kind}:${source}`
    const nodes = Array.isArray(baseGraphData.nodes) ? baseGraphData.nodes : []
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i] as unknown as { type?: unknown; properties?: unknown; metadata?: unknown } | null
      const t = typeof n?.type === 'string' ? n.type.trim() : ''
      if (t !== 'Document') continue
      const props = n?.properties && typeof n.properties === 'object' && !Array.isArray(n.properties)
        ? (n.properties as Record<string, unknown>)
        : {}
      const path = typeof props.path === 'string' ? props.path.trim() : ''
      if (path) return `path:${path}`
      const nMeta = n?.metadata && typeof n.metadata === 'object' && !Array.isArray(n.metadata)
        ? (n.metadata as Record<string, unknown>)
        : {}
      const docPath = typeof nMeta.documentPath === 'string' ? nMeta.documentPath.trim() : ''
      if (docPath) return `doc:${docPath}`
      break
    }
    return ''
  })()
  return { baselineGraphMetaKey, baselineDatasetKey, baselineSourceLayerHash }
}

export const mergeKeywordGraphWithSourceNodes = (args: {
  baseGraphData: GraphData
  keywordGraph: GraphData
  sourceId: string
  tuning?: { mentionEdgesPerSourceNode?: number }
}): GraphData => {
  const baseNodes = Array.isArray(args.baseGraphData.nodes) ? args.baseGraphData.nodes : []
  const keywordNodes = Array.isArray(args.keywordGraph.nodes) ? args.keywordGraph.nodes : []
  const keywordEdges = Array.isArray(args.keywordGraph.edges) ? args.keywordGraph.edges : []

  const keywordEntityByToken = (() => {
    const map = new Map<string, string[]>()
    const push = (token: string, id: string) => {
      const t = token.trim().toLowerCase()
      if (!t || t.length < 2) return
      const arr = map.get(t) || []
      if (arr.includes(id)) return
      if (arr.length >= 8) return
      arr.push(id)
      map.set(t, arr)
    }
    for (let i = 0; i < keywordNodes.length; i += 1) {
      const n = keywordNodes[i]
      if (!n) continue
      const props = (n.properties || {}) as Record<string, unknown>
      const kind = typeof props['keyword:kind'] === 'string' ? props['keyword:kind'].trim() : ''
      if (kind !== 'entity') continue
      const id = String(n.id || '').trim()
      if (!id) continue
      const key = typeof props['keyword:key'] === 'string' ? props['keyword:key'].trim() : ''
      const label = String(n.label || '').trim()
      const tokens: string[] = []
      if (key) tokens.push(key)
      if (label) tokens.push(label)
      for (const raw of tokens) {
        const words = raw.toLowerCase().match(/[a-z0-9][a-z0-9_-]{1,}/g) || []
        for (const w of words) push(w, id)
      }
    }
    return map
  })()

  const communityByKeywordNodeId = (() => {
    const out = new Map<string, string>()
    for (let i = 0; i < keywordNodes.length; i += 1) {
      const n = keywordNodes[i]
      if (!n) continue
      const props = (n.properties || {}) as Record<string, unknown>
      const raw = props['visual:community']
      const cid =
        typeof raw === 'number'
          ? (Number.isFinite(raw) ? String(raw) : '')
          : typeof raw === 'string'
            ? raw.trim()
            : ''
      if (!cid) continue
      const id = String(n.id || '').trim()
      if (!id) continue
      out.set(id, cid)
    }
    return out
  })()

  const existingIds = new Set<string>(keywordNodes.map(n => String(n?.id)))

  const mergedSourceNodes = (() => {
    const out: typeof baseNodes = []
    for (let i = 0; i < baseNodes.length; i += 1) {
      const n = baseNodes[i]
      if (!n) continue
      const origId = String((n as { id?: unknown }).id || '').trim()
      if (!origId) continue
      const id = `doc:${origId}`
      if (existingIds.has(id)) continue
      const props = (n.properties && typeof n.properties === 'object' && !Array.isArray(n.properties))
        ? ({ ...(n.properties as Record<string, unknown>) } as Record<string, unknown>)
        : ({} as Record<string, unknown>)
      const label = String((n as { label?: unknown }).label || '').trim() || origId
      const typeRaw = String((n as { type?: unknown }).type || '').trim()
      props['source:type'] = typeRaw as unknown
      props['source:id'] = origId as unknown
      const next = {
        ...n,
        id,
        type: 'KeywordSource',
        label,
        properties: props,
        metadata: { ...(n.metadata || {}), derived: true, kind: 'keyword:source', source: args.sourceId },
      } as typeof n
      out.push(next)
    }
    return out
  })()

  const mentionEdges = (() => {
    if (keywordEntityByToken.size === 0) return [] as typeof keywordEdges
    const maxMentions = (() => {
      const raw = args.tuning?.mentionEdgesPerSourceNode
      if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.min(30, Math.floor(raw)))
      return 6
    })()
    const edges: typeof keywordEdges = []
    const pickTexts = (node: unknown): string[] => pickKeywordTextFromNode(node as { label?: unknown; type?: unknown; properties?: unknown })
    for (let i = 0; i < baseNodes.length; i += 1) {
      const n = baseNodes[i]
      if (!n) continue
      const origId = String((n as { id?: unknown }).id || '').trim()
      if (!origId) continue
      const srcId = `doc:${origId}`
      const texts = pickTexts(n)
      const counts = new Map<string, number>()
      for (let t = 0; t < texts.length; t += 1) {
        const s = String(texts[t] || '')
        if (!s) continue
        const words = s.toLowerCase().match(/[a-z0-9][a-z0-9_-]{1,}/g) || []
        for (let w = 0; w < words.length; w += 1) {
          const token = words[w]!
          const ids = keywordEntityByToken.get(token)
          if (!ids) continue
          for (let k = 0; k < ids.length; k += 1) {
            const kid = ids[k]!
            counts.set(kid, (counts.get(kid) || 0) + 1)
          }
        }
      }
      if (counts.size === 0) continue
      const top = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, maxMentions)
      for (let j = 0; j < top.length; j += 1) {
        const [kid, c] = top[j]!
        const id = `kw:mention:${hashText(`${srcId}|${kid}`)}`
        edges.push({
          id,
          source: srcId,
          target: kid,
          label: 'mentions',
          properties: {
            count: c as unknown,
            'keyword:kind': 'sourceMention' as unknown,
            'visual:width': Math.max(1, Math.min(4, Math.round(c))) as unknown,
            'visual:stroke': 'rgba(99, 102, 241, 0.35)' as unknown,
          },
          metadata: { derived: true, kind: 'keyword', source: args.sourceId },
        } as (typeof keywordEdges)[number])
      }
    }
    return edges
  })()

  const sourceCommunityById = (() => {
    const map = new Map<string, string>()
    for (let i = 0; i < mentionEdges.length; i += 1) {
      const e = mentionEdges[i] as unknown as { source?: unknown; target?: unknown }
      const src = String(e?.source || '').trim()
      const tgt = String(e?.target || '').trim()
      if (!src || !tgt) continue
      const cid = communityByKeywordNodeId.get(tgt)
      if (!cid) continue
      if (!map.has(src)) map.set(src, cid)
    }
    return map
  })()
  if (sourceCommunityById.size > 0) {
    for (let i = 0; i < mergedSourceNodes.length; i += 1) {
      const n = mergedSourceNodes[i] as unknown as { id?: unknown; properties?: unknown }
      const id = String(n?.id || '').trim()
      const cid = sourceCommunityById.get(id)
      if (!cid) continue
      const props = (n.properties && typeof n.properties === 'object' && !Array.isArray(n.properties))
        ? (n.properties as Record<string, unknown>)
        : {}
      props['visual:community'] = cid as unknown
      props['visual:layer'] = cid as unknown
      ;(mergedSourceNodes[i] as unknown as { properties: unknown }).properties = props
    }
  }

  const mediaNodes = (() => {
    const out: typeof baseNodes = []
    for (let i = 0; i < baseNodes.length; i += 1) {
      const n = baseNodes[i]
      if (!n) continue
      if (!hasNodeMedia(n)) continue
      out.push(n)
    }
    return out
  })()
  const mergedMediaNodes = (() => {
    if (mediaNodes.length === 0) return [] as typeof baseNodes
    const out: typeof baseNodes = []
    for (let i = 0; i < mediaNodes.length; i += 1) {
      const n = mediaNodes[i]
      const id = String((n as { id?: unknown }).id || '').trim()
      if (!id) continue
      if (existingIds.has(id)) continue
      out.push({
        ...n,
        properties: { ...(n.properties || {}) },
        metadata: { ...(n.metadata || {}), derived: true, kind: 'keyword:media', source: args.sourceId },
      } as typeof n)
    }
    return out
  })()

  const { baselineGraphMetaKey, baselineDatasetKey, baselineSourceLayerHash } = computeBaselineIdentityKeys(args.baseGraphData)

  const nextMeta: GraphData['metadata'] = {
    ...((args.keywordGraph.metadata && typeof args.keywordGraph.metadata === 'object' && !Array.isArray(args.keywordGraph.metadata)
      ? (args.keywordGraph.metadata as Record<string, unknown>)
      : {}) as Record<string, unknown>),
    baselineGraphMetaKey,
    ...(baselineDatasetKey ? { baselineDatasetKey } : {}),
    ...(baselineSourceLayerHash ? { baselineSourceLayerHash } : {}),
  } as GraphData['metadata']

  if (mergedSourceNodes.length === 0 && mergedMediaNodes.length === 0 && mentionEdges.length === 0) {
    return { ...args.keywordGraph, metadata: nextMeta }
  }
  return {
    ...args.keywordGraph,
    metadata: nextMeta,
    nodes: [...keywordNodes, ...mergedSourceNodes, ...mergedMediaNodes],
    edges: [...keywordEdges, ...mentionEdges],
  }
}
