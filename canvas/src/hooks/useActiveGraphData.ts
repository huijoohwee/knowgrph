import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useShallow } from 'zustand/react/shallow'
import type { GraphData } from '@/lib/graph/types'
import type { GraphState } from '@/hooks/useGraphStore'
import { keywordGraphCache, KEYWORD_GRAPH_ALGO_VERSION } from '@/features/semantic-mode/keywordGraph'
import { hashText } from '@/features/parsers/hash'
import { hasNodeMedia } from '@/components/GraphCanvas/helpers'
import { filterGraphToFrontmatterMermaid } from '@/lib/graph/layerDerivation'
import { deriveGraphDataWithGroupCollapse } from '@/components/GraphCanvas/viewDerivation'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import { deriveMarkdownTableGraphForFrontmatterMode } from '@/features/markdown/tableGraph/deriveMarkdownTableGraph'
import { buildCollapsedGroupIdsKey } from '@/lib/canvas/collapsedGroupIdsKey'
import { buildGraphMetaKey } from '@/lib/graph/graphMetaKey'
import { LRUCache } from '@/lib/cache/LRUCache'
import { pipelinePerfEnd, pipelinePerfStart } from '@/lib/pipelinePerf'
import { deriveKeywordGraphInWorker, deriveKeywordGraphPreviewInWorker } from '@/features/semantic-mode/keywordGraphWorker'
import { useDebouncedValue } from '@/features/hooks/useDebouncedValue'

const KEYWORD_SOURCE_EDGE_LABELS = new Set<string>([
  'hasSection',
  'hasBlock',
  'hasItem',
  'contains',
  'embedsImage',
  'linksTo',
  'mentions',
])

function stripFrontmatter(markdown: string): string {
  const s = String(markdown || '')
  if (!s.startsWith('---')) return s
  const lines = s.split(/\r?\n/)
  if (lines.length < 3) return s
  if (String(lines[0] || '').trim() !== '---') return s
  const endIdx = lines.slice(1).findIndex(l => String(l || '').trim() === '---')
  if (endIdx < 0) return s
  return lines.slice(endIdx + 2).join('\n')
}

function markdownToPlainText(markdown: string): string {
  const raw = String(markdown || '')
  if (!raw.trim()) return ''
  let text = raw
  text = text.replace(/```[\s\S]*?```/g, ' ')
  text = text.replace(/`[^`]*`/g, ' ')
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, '')
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1')
  text = text.replace(/\*([^*]+)\*/g, '$1')
  text = text.replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
  text = text.replace(/\s+/g, ' ')
  return text.trim()
}

const pickKeywordTextFromNode = (n: { id?: unknown; label?: unknown; type?: unknown; properties?: unknown }): string[] => {
  const label = typeof n.label === 'string' ? n.label.trim() : ''
  const props = n.properties && typeof n.properties === 'object' && !Array.isArray(n.properties)
    ? (n.properties as Record<string, unknown>)
    : null
  const id = typeof n.id === 'string' ? n.id.trim() : ''
  const textKeys = [
    'text',
    'content',
    'title',
    'name',
    'summary',
    'caption',
    'alt',
    'path',
    'filepath',
    'filePath',
    'file',
    'filename',
    'url',
    'href',
    'slug',
    'keywords',
    'tags',
  ]
  const out: string[] = []
  if (label) out.push(label)
  if (props) {
    for (let i = 0; i < textKeys.length; i += 1) {
      const key = textKeys[i]!
      const v = props[key]
      if (typeof v === 'string') {
        const t = v.trim()
        if (!t) continue
        if (t === label) continue
        out.push(t)
        continue
      }
      if (Array.isArray(v)) {
        for (let j = 0; j < v.length; j += 1) {
          const s = typeof v[j] === 'string' ? String(v[j]).trim() : ''
          if (!s) continue
          if (s === label) continue
          out.push(s)
        }
      }
    }
  }
  if (out.length === 0 && id && id.length <= 200) {
    const hasAlpha = /[a-zA-Z]/.test(id)
    if (hasAlpha) out.push(id)
  }
  return out
}

const buildKeywordSourceTextFromBaselineGraph = (
  graph: GraphData,
  opts?: { maxLines?: number; maxChars?: number },
): string => {
  const maxLines = (() => {
    const raw = opts?.maxLines
    if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(50, Math.min(200_000, Math.floor(raw)))
    return 8000
  })()
  const maxChars = (() => {
    const raw = opts?.maxChars
    if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(2000, Math.min(2_000_000, Math.floor(raw)))
    return 120_000
  })()
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : []
  const edges = Array.isArray(graph.edges) ? graph.edges : []

  const nodeById = new Map<string, (typeof nodes)[number]>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    if (!n) continue
    const id = String((n as { id?: unknown }).id || '').trim()
    if (!id) continue
    if (!nodeById.has(id)) nodeById.set(id, n)
  }

  const childrenById = new Map<string, string[]>()
  const parentCount = new Map<string, number>()
  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i] as unknown as { source?: unknown; target?: unknown; label?: unknown } | null
    if (!e) continue
    const label = String(e.label || '')
    if (!KEYWORD_SOURCE_EDGE_LABELS.has(label)) continue
    const src = String(e.source || '').trim()
    const tgt = String(e.target || '').trim()
    if (!src || !tgt) continue
    if (!nodeById.has(src) || !nodeById.has(tgt)) continue
    const arr = childrenById.get(src) || []
    arr.push(tgt)
    childrenById.set(src, arr)
    parentCount.set(tgt, (parentCount.get(tgt) || 0) + 1)
    if (!parentCount.has(src)) parentCount.set(src, 0)
  }
  childrenById.forEach(arr => arr.sort((a, b) => a.localeCompare(b)))

  const roots: string[] = []
  nodeById.forEach((_, id) => {
    const p = parentCount.get(id) || 0
    if (p === 0) roots.push(id)
  })
  roots.sort((a, b) => a.localeCompare(b))

  const allNodeIds = Array.from(nodeById.keys()).sort((a, b) => a.localeCompare(b))

  const visited = new Set<string>()
  const lines: string[] = []
  let chars = 0
  const nodeSnippet = (id: string): string => {
    const n = nodeById.get(id)
    if (!n) return ''
    const picked = pickKeywordTextFromNode(n as unknown as { id?: unknown; label?: unknown; type?: unknown; properties?: unknown })
    const first = picked[0]
    return typeof first === 'string' ? first.trim() : ''
  }
  const pushLines = (id: string) => {
    const n = nodeById.get(id)
    if (!n) return
    const picked = pickKeywordTextFromNode(n as unknown as { label?: unknown; type?: unknown; properties?: unknown })
    for (let i = 0; i < picked.length; i += 1) {
      const t = picked[i]!
      if (!t) continue
      if (chars >= maxChars) return
      lines.push(t)
      chars += t.length + 1
    }
  }

  const pushEdgeLine = (e: { source?: unknown; target?: unknown; label?: unknown }) => {
    if (lines.length >= maxLines) return
    if (chars >= maxChars) return
    const src = String(e.source || '').trim()
    const tgt = String(e.target || '').trim()
    if (!src || !tgt) return
    if (!nodeById.has(src) || !nodeById.has(tgt)) return
    const a = nodeSnippet(src)
    const b = nodeSnippet(tgt)
    if (!a || !b) return
    const rawLabel = typeof e.label === 'string' ? e.label.trim() : ''
    const lbl = rawLabel && rawLabel.length <= 80 ? rawLabel : ''
    const sentence = lbl ? `${a} ${lbl} ${b}.` : `${a} ${b}.`
    if (!sentence.trim()) return
    if (chars + sentence.length + 1 > maxChars) return
    lines.push(sentence)
    chars += sentence.length + 1
  }

  const seedIds = roots.length > 0 ? roots : allNodeIds
  const queue: string[] = [...seedIds]
  while (queue.length > 0) {
    const id = queue.shift()!
    if (!id || visited.has(id)) continue
    visited.add(id)
    pushLines(id)
    const kids = childrenById.get(id) || []
    for (let i = 0; i < kids.length; i += 1) queue.push(kids[i]!)
    if (lines.length >= maxLines) break
    if (chars >= maxChars) break
  }

  for (let i = 0; i < allNodeIds.length; i += 1) {
    const id = allNodeIds[i]!
    if (!id || visited.has(id)) continue
    visited.add(id)
    pushLines(id)
    if (lines.length >= maxLines) break
    if (chars >= maxChars) break
  }

  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i] as unknown as { source?: unknown; target?: unknown; label?: unknown } | null
    if (!e) continue
    pushEdgeLine(e)
    if (lines.length >= maxLines) break
    if (chars >= maxChars) break
  }

  const deduped: string[] = []
  const seen = new Set<string>()
  for (let i = 0; i < lines.length; i += 1) {
    const t = lines[i]!
    const key = t.length > 260 ? t.slice(0, 260) : t
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(t)
  }
  const joined = deduped.join('\n')
  if (joined.length <= maxChars) return joined
  return joined.slice(0, maxChars)
}

const keywordSourceTextCache = new LRUCache<string, { text: string; hash: string }>(40)
const keywordPreviewGraphCache = new LRUCache<string, GraphData>(20)

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

const INACTIVE_GRAPH_SLICE = {
  baseGraphData: null as GraphData | null,
  mode: 'document' as 'document' | 'keyword',
  markdownName: null as string | null,
  markdownText: null as string | null,
  keywordSourceMaxLines: 8000,
  keywordSourceMaxChars: 120_000,
  keywordGraphPreviewDebounceMs: 200,
  keywordGraphFullDebounceMs: 800,
  keywordGraphEdgesPerNode: 6,
  keywordGraphMaxEdgesCap: 2400,
  keywordGraphMentionEdgesPerSourceNode: 6,
  revision: 0,
} as const

export function useActiveGraphData(enabled: boolean = true): GraphData | null {
  const selector = React.useMemo(
    () =>
      enabled
        ? (s: GraphState) => ({
            baseGraphData: s.graphData as GraphData | null,
            mode: (s.documentSemanticMode || 'document') as 'document' | 'keyword',
            markdownName: s.markdownDocumentName || null,
            markdownText: s.markdownDocumentText || null,
            keywordSourceMaxLines: s.keywordSourceMaxLines,
            keywordSourceMaxChars: s.keywordSourceMaxChars,
            keywordGraphPreviewDebounceMs: s.keywordGraphPreviewDebounceMs,
            keywordGraphFullDebounceMs: s.keywordGraphFullDebounceMs,
            keywordGraphEdgesPerNode: s.keywordGraphEdgesPerNode,
            keywordGraphMaxEdgesCap: s.keywordGraphMaxEdgesCap,
            keywordGraphMentionEdgesPerSourceNode: s.keywordGraphMentionEdgesPerSourceNode,
            revision: s.graphDataRevision || 0,
          })
        : () => INACTIVE_GRAPH_SLICE,
    [enabled],
  )

  const {
    baseGraphData,
    mode,
    markdownName,
    markdownText,
    keywordSourceMaxLines,
    keywordSourceMaxChars,
    keywordGraphPreviewDebounceMs,
    keywordGraphFullDebounceMs,
    keywordGraphEdgesPerNode,
    keywordGraphMaxEdgesCap,
    keywordGraphMentionEdgesPerSourceNode,
    revision,
  } = useGraphStore(useShallow(selector))

  const lastRef = React.useRef<GraphData | null>(null)
  const lastKeywordRef = React.useRef<{ cacheKey: string; docId: string; graph: GraphData } | null>(null)
  const [asyncBump, setAsyncBump] = React.useState(0)
  const pendingKeyRef = React.useRef<string | null>(null)
  const pendingPreviewKeyRef = React.useRef<string | null>(null)

  const keywordDeriveInputs = React.useMemo(() => {
    if (!baseGraphData) return null
    if (mode !== 'keyword') return null

    const baseMetaKey = buildGraphMetaKey(baseGraphData)
    const baseLayerHash = (() => {
      const meta = (baseGraphData.metadata || null) as Record<string, unknown> | null
      const h = meta && typeof meta.sourceLayerHash === 'string' ? meta.sourceLayerHash.trim() : ''
      return h || ''
    })()

    const meta = baseGraphData.metadata && typeof baseGraphData.metadata === 'object' && !Array.isArray(baseGraphData.metadata)
      ? (baseGraphData.metadata as Record<string, unknown>)
      : null
    const sourceLayerComposition = typeof meta?.sourceLayerComposition === 'string' ? String(meta.sourceLayerComposition) : ''
    const isComposed = sourceLayerComposition === 'compose' || Array.isArray(meta?.sourceLayers)
    const preferredMarkdownText = typeof markdownText === 'string' && markdownText.trim() ? markdownText : ''
    const prefersMarkdown = !isComposed && preferredMarkdownText.length > 0

    const cacheKeyForText = `${baseLayerHash || baseMetaKey || `rev:${String(revision)}`}:L${keywordSourceMaxLines}:C${keywordSourceMaxChars}`
    const cachedText = prefersMarkdown ? null : keywordSourceTextCache.get(cacheKeyForText)

    const sourceText = (() => {
      if (!prefersMarkdown) {
        return cachedText
          ? cachedText.text
          : buildKeywordSourceTextFromBaselineGraph(baseGraphData, { maxLines: keywordSourceMaxLines, maxChars: keywordSourceMaxChars })
      }
      const mdPlain = markdownToPlainText(stripFrontmatter(preferredMarkdownText))
      const baseline = buildKeywordSourceTextFromBaselineGraph(baseGraphData, { maxLines: keywordSourceMaxLines, maxChars: keywordSourceMaxChars })
      const combined = [mdPlain, baseline].filter(Boolean).join('\n')
      if (combined.length <= keywordSourceMaxChars) return combined
      return combined.slice(0, keywordSourceMaxChars)
    })()
    const sourceTextHash = prefersMarkdown
      ? hashText(sourceText)
      : (cachedText ? cachedText.hash : (baseLayerHash || hashText(sourceText)))
    if (!prefersMarkdown && !cachedText) keywordSourceTextCache.set(cacheKeyForText, { text: sourceText, hash: sourceTextHash })

    const docId = baseMetaKey
      ? `graph:${hashText(baseMetaKey)}`
      : markdownName && markdownName.trim()
        ? `md:${hashText(markdownName.trim())}`
        : `graph:${hashText(String(revision))}`

    const tuningKey = `e${keywordGraphEdgesPerNode}-m${keywordGraphMaxEdgesCap}-me${keywordGraphMentionEdgesPerSourceNode}-L${keywordSourceMaxLines}-C${keywordSourceMaxChars}`
    const cacheKey = `keyword:v${KEYWORD_GRAPH_ALGO_VERSION}:${docId}:${sourceTextHash}:${tuningKey}`
    return {
      cacheKey,
      docId,
      sourceText,
      sourceTextHash,
      tuning: {
        edgesPerNode: keywordGraphEdgesPerNode,
        maxEdgesCap: keywordGraphMaxEdgesCap,
        mentionEdgesPerSourceNode: keywordGraphMentionEdgesPerSourceNode,
      },
    }
  }, [
    baseGraphData,
    keywordGraphEdgesPerNode,
    keywordGraphMaxEdgesCap,
    keywordGraphMentionEdgesPerSourceNode,
    keywordSourceMaxChars,
    keywordSourceMaxLines,
    markdownName,
    markdownText,
    mode,
    revision,
  ])

  const debouncedKeywordPreviewInputs = useDebouncedValue(
    keywordDeriveInputs,
    Math.max(0, Number(keywordGraphPreviewDebounceMs) || 0),
  )
  const debouncedKeywordFullInputs = useDebouncedValue(
    keywordDeriveInputs,
    Math.max(0, Number(keywordGraphFullDebounceMs) || 0),
  )

  const computed = React.useMemo(() => {
    void asyncBump
    if (!baseGraphData) return null
    if (mode !== 'keyword') return baseGraphData

    const inputs = keywordDeriveInputs
    if (!inputs) return null

    const cached = keywordGraphCache.get(inputs.cacheKey)
    if (cached) return cached.graph
    const preview = keywordPreviewGraphCache.get(inputs.cacheKey)
    if (preview) return preview
    if (lastKeywordRef.current) {
      if (lastKeywordRef.current.cacheKey === inputs.cacheKey) return lastKeywordRef.current.graph
      const prefix = `keyword:v${KEYWORD_GRAPH_ALGO_VERSION}:`
      if (lastKeywordRef.current.docId === inputs.docId && lastKeywordRef.current.cacheKey.startsWith(prefix)) {
        return lastKeywordRef.current.graph
      }
    }
    const placeholderMediaNodes = (() => {
      const nodes = Array.isArray(baseGraphData.nodes) ? baseGraphData.nodes : []
      const out: typeof nodes = []
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i]
        if (!n) continue
        if (!hasNodeMedia(n) && pickKeywordTextFromNode(n as unknown as { id?: unknown; label?: unknown; type?: unknown; properties?: unknown }).length === 0) continue
        out.push(n)
        if (out.length >= 40) break
      }
      return out
    })()
    const { baselineGraphMetaKey, baselineDatasetKey, baselineSourceLayerHash } = computeBaselineIdentityKeys(baseGraphData)
    return {
      type: 'Graph',
      context: '',
      metadata: {
        derived: true,
        kind: 'keyword',
        source: inputs.docId,
        sourceLayerHash: inputs.sourceTextHash,
        pending: true,
        baselineGraphMetaKey,
        ...(baselineDatasetKey ? { baselineDatasetKey } : {}),
        ...(baselineSourceLayerHash ? { baselineSourceLayerHash } : {}),
      } as unknown as GraphData['metadata'],
      nodes: placeholderMediaNodes,
      edges: [],
    } as GraphData
  }, [asyncBump, baseGraphData, keywordDeriveInputs, mode])

  const baseGraphDataRef = React.useRef<GraphData | null>(null)
  React.useEffect(() => {
    baseGraphDataRef.current = baseGraphData
  }, [baseGraphData])

  const keywordErrorToastKeyRef = React.useRef<Set<string>>(new Set())
  const readKeywordWorkerLastError = (): string => {
    try {
      const raw = (globalThis as unknown as { __kgKeywordWorkerLastError?: unknown }).__kgKeywordWorkerLastError
      return typeof raw === 'string' ? raw.trim() : ''
    } catch {
      return ''
    }
  }

  React.useEffect(() => {
    if (!enabled) return
    if (!baseGraphData) return
    if (mode !== 'keyword') return
    const inputs = debouncedKeywordPreviewInputs
    if (!inputs) return

    if (keywordGraphCache.get(inputs.cacheKey)) return
    if (keywordPreviewGraphCache.get(inputs.cacheKey)) return
    if (pendingPreviewKeyRef.current === inputs.cacheKey) return
    pendingPreviewKeyRef.current = inputs.cacheKey

    let canceled = false
    const controller = new AbortController()
    const t0 = pipelinePerfStart()

    void (async () => {
      try {
        if (canceled) return
        const snippet = inputs.sourceText.length > 16_000 ? inputs.sourceText.slice(0, 16_000) : inputs.sourceText
        if (!snippet.trim()) return

        const g = await deriveKeywordGraphPreviewInWorker({
          documentId: inputs.docId,
          documentText: snippet,
          sourceLabel: markdownName || undefined,
          sourceTextHash: inputs.sourceTextHash,
          tuning: {
            edgesPerNode: inputs.tuning.edgesPerNode,
            maxEdgesCap: inputs.tuning.maxEdgesCap,
          },
          timeoutMs: 20_000,
          signal: controller.signal,
        })
        if (!g) return
        const base = baseGraphDataRef.current
        if (!base) return
        const merged = mergeKeywordGraphWithSourceNodes({
          baseGraphData: base,
          keywordGraph: g,
          sourceId: inputs.docId,
          tuning: { mentionEdgesPerSourceNode: inputs.tuning.mentionEdgesPerSourceNode },
        })
        keywordPreviewGraphCache.set(inputs.cacheKey, merged)
        pipelinePerfEnd({ name: 'derive', stage: 'keyword:preview', t0, detail: { cacheKey: inputs.cacheKey } })
        setAsyncBump(v => v + 1)
      } catch {
        void 0
      } finally {
        if (pendingPreviewKeyRef.current === inputs.cacheKey) pendingPreviewKeyRef.current = null
        if (!keywordPreviewGraphCache.get(inputs.cacheKey)) {
          const shouldSkip = controller.signal.aborted || canceled
          if (!shouldSkip) {
            const err = readKeywordWorkerLastError()
            if (err && !keywordErrorToastKeyRef.current.has(`preview:${inputs.cacheKey}`)) {
              keywordErrorToastKeyRef.current.add(`preview:${inputs.cacheKey}`)
              try {
                useGraphStore.getState().upsertUiToast({
                  id: `kw-preview-failed:${hashText(inputs.cacheKey)}`,
                  kind: 'warning',
                  message: `Keyword preview failed: ${err}`,
                  ttlMs: 6000,
                })
              } catch {
                void 0
              }
            }
          }
        }
      }
    })()

    return () => {
      canceled = true
      try {
        controller.abort()
      } catch {
        void 0
      }
      if (pendingPreviewKeyRef.current === inputs.cacheKey) pendingPreviewKeyRef.current = null
    }
  }, [baseGraphData, debouncedKeywordPreviewInputs, enabled, markdownName, mode])

  React.useEffect(() => {
    if (!enabled) return
    if (!baseGraphData) return
    if (mode !== 'keyword') return
    const inputs = debouncedKeywordFullInputs
    if (!inputs) return

    if (keywordGraphCache.get(inputs.cacheKey)) return
    if (pendingKeyRef.current === inputs.cacheKey) return
    pendingKeyRef.current = inputs.cacheKey

    const tAll = pipelinePerfStart()
    const tDerive = pipelinePerfStart()
    let canceled = false
    const controller = new AbortController()

    void (async () => {
      try {
        const derivedGraph = await deriveKeywordGraphInWorker({
          documentId: inputs.docId,
          documentText: inputs.sourceText,
          sourceLabel: markdownName || undefined,
          sourceTextHash: inputs.sourceTextHash,
          tuning: {
            edgesPerNode: inputs.tuning.edgesPerNode,
            maxEdgesCap: inputs.tuning.maxEdgesCap,
          },
          timeoutMs: 90_000,
          signal: controller.signal,
        })
        if (canceled) return
        if (!derivedGraph) return

        const base = baseGraphDataRef.current
        if (!base) return
        const graph = mergeKeywordGraphWithSourceNodes({
          baseGraphData: base,
          keywordGraph: derivedGraph,
          sourceId: inputs.docId,
          tuning: { mentionEdgesPerSourceNode: inputs.tuning.mentionEdgesPerSourceNode },
        })
        keywordGraphCache.set(inputs.cacheKey, { graph, nodeCountsById: new Map() })
        pipelinePerfEnd({
          name: 'derive',
          stage: 'keyword:graph',
          t0: tDerive,
          detail: {
            cacheKey: inputs.cacheKey,
            nodes: Array.isArray(graph.nodes) ? graph.nodes.length : 0,
            edges: Array.isArray(graph.edges) ? graph.edges.length : 0,
          },
        })
        pipelinePerfEnd({ name: 'derive', stage: 'keyword:all', t0: tAll, detail: { cacheKey: inputs.cacheKey } })
        setAsyncBump(v => v + 1)
      } catch {
        void 0
      } finally {
        if (pendingKeyRef.current === inputs.cacheKey) pendingKeyRef.current = null
        if (!keywordGraphCache.get(inputs.cacheKey)) {
          const shouldSkip = controller.signal.aborted || canceled
          if (!shouldSkip) {
            const err = readKeywordWorkerLastError()
            if (err && !keywordErrorToastKeyRef.current.has(`full:${inputs.cacheKey}`)) {
              keywordErrorToastKeyRef.current.add(`full:${inputs.cacheKey}`)
              try {
                useGraphStore.getState().upsertUiToast({
                  id: `kw-derive-failed:${hashText(inputs.cacheKey)}`,
                  kind: 'warning',
                  message: `Keyword graph failed: ${err}`,
                  ttlMs: 8000,
                })
              } catch {
                void 0
              }
            }
          }
        }
      }
    })()

    return () => {
      canceled = true
      try {
        controller.abort()
      } catch {
        void 0
      }
    }
  }, [baseGraphData, debouncedKeywordFullInputs, enabled, markdownName, mode])

  React.useEffect(() => {
    if (!enabled) return
    lastRef.current = computed
    if (mode === 'keyword' && keywordDeriveInputs) {
      const cached = keywordGraphCache.get(keywordDeriveInputs.cacheKey)
      if (cached && cached.graph) {
        lastKeywordRef.current = { cacheKey: keywordDeriveInputs.cacheKey, docId: keywordDeriveInputs.docId, graph: cached.graph }
      }
    }
  }, [computed, enabled, keywordDeriveInputs, mode])

  return enabled ? computed : lastRef.current
}

export function deriveGraphDataForActiveView(args: {
  graphData: GraphData
  frontmatterModeEnabled: boolean
  multiDimTableModeEnabled: boolean
  documentSemanticMode: string
  documentStructureBaselineLock: boolean
  collapsedGroupIds: string[]
}): GraphData {
  const base = (() => {
    if (args.multiDimTableModeEnabled === true) {
      const tableGraph = deriveMarkdownTableGraphForFrontmatterMode({ graphData: args.graphData })
      return tableGraph || { ...args.graphData, nodes: [], edges: [] }
    }
    const effective = computeEffectiveFrontmatterMode({
      frontmatterModeEnabled: args.frontmatterModeEnabled,
      documentSemanticMode: args.documentSemanticMode,
      graphData: args.graphData,
    })
    if (!args.frontmatterModeEnabled) return args.graphData
    return effective ? filterGraphToFrontmatterMermaid(args.graphData) : { ...args.graphData, nodes: [], edges: [] }
  })()

  const collapsedGroupIds = Array.isArray(args.collapsedGroupIds) ? args.collapsedGroupIds : []
  if (collapsedGroupIds.length === 0) return base
  return deriveGraphDataWithGroupCollapse({ graphData: base, collapsedGroupIds })
}

const INACTIVE_RENDER_SLICE = {
  frontmatterModeEnabled: false,
  multiDimTableModeEnabled: false,
  documentSemanticMode: 'document',
  documentStructureBaselineLock: false,
  collapsedGroupIds: [] as string[],
} as const

export function useActiveGraphRenderData(enabled: boolean = true): GraphData | null {
  const graphData = useActiveGraphData(enabled)

  const selector = React.useMemo(
    () =>
      enabled
        ? (s: GraphState) => ({
            frontmatterModeEnabled: s.frontmatterModeEnabled === true,
            multiDimTableModeEnabled: s.multiDimTableModeEnabled === true,
            documentSemanticMode: String(s.documentSemanticMode || 'document'),
            documentStructureBaselineLock: s.documentStructureBaselineLock === true,
            collapsedGroupIds: (s.collapsedGroupIds || []) as string[],
          })
        : () => INACTIVE_RENDER_SLICE,
    [enabled],
  )

  const { frontmatterModeEnabled, multiDimTableModeEnabled, documentSemanticMode, documentStructureBaselineLock, collapsedGroupIds } = useGraphStore(useShallow(selector))

  const lastRef = React.useRef<GraphData | null>(null)

  const collapsedGroupIdsKey = React.useMemo(() => {
    return buildCollapsedGroupIdsKey(collapsedGroupIds)
  }, [collapsedGroupIds])

  const viewGraphData = React.useMemo(() => {
    if (!graphData) return null
    return deriveGraphDataForActiveView({
      graphData,
      frontmatterModeEnabled,
      multiDimTableModeEnabled,
      documentSemanticMode,
      documentStructureBaselineLock,
      collapsedGroupIds: [],
    })
  }, [documentSemanticMode, documentStructureBaselineLock, frontmatterModeEnabled, graphData, multiDimTableModeEnabled])

  const computed = React.useMemo(() => {
    if (!viewGraphData) return null
    if (!collapsedGroupIdsKey) return viewGraphData
    return deriveGraphDataWithGroupCollapse({
      graphData: viewGraphData,
      collapsedGroupIds: collapsedGroupIdsKey.split('|').filter(Boolean),
    })
  }, [collapsedGroupIdsKey, viewGraphData])

  React.useEffect(() => {
    if (!enabled) return
    lastRef.current = computed
  }, [computed, enabled])

  return enabled ? computed : lastRef.current
}
