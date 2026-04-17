import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useShallow } from 'zustand/react/shallow'
import type { GraphData } from '@/lib/graph/types'
import type { GraphState } from '@/hooks/useGraphStore'
import { keywordGraphCache, KEYWORD_GRAPH_ALGO_VERSION } from '@/features/semantic-mode/keywordGraph'
import { hashText } from '@/features/parsers/hash'
import { hasNodeMedia } from '@/components/GraphCanvas/helpers'
import { filterGraphToFrontmatterMermaid, hasFrontmatterMermaidSeeds } from '@/lib/graph/layerDerivation'
import { deriveGraphDataWithGroupCollapse } from '@/components/GraphCanvas/viewDerivation'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import { deriveMarkdownTableGraphForFrontmatterMode } from '@/features/markdown/tableGraph/deriveMarkdownTableGraph'
import { buildCollapsedGroupIdsKey } from '@/lib/canvas/collapsedGroupIdsKey'
import { buildGraphMetaKey } from '@/lib/graph/graphMetaKey'
import { LRUCache } from '@/lib/cache/LRUCache'
import { pipelinePerfEnd, pipelinePerfStart } from '@/lib/pipelinePerf'
import { deriveKeywordGraphInWorker, deriveKeywordGraphPreviewInWorker } from '@/features/semantic-mode/keywordGraphWorker'
import { useDebouncedValue } from '@/features/hooks/useDebouncedValue'
import { parseGraph } from '@/lib/graph/io/adapter'
import { buildMarkdownJsonLd } from '@/features/parsers/markdownJsonLd'
import { parseJsonLd } from '@/lib/graph/jsonld'
import {
  normalizeBipartiteApiGraphData,
  parseBipartiteApiGraphPayload,
  useApiGraphBipartiteGraphData,
} from '@/features/bipartite/apiGraphBipartite'
import { buildBipartiteSourceMeta } from '@/lib/bipartite/source'
import type { Canvas2dRendererId } from '@/lib/config'
import { containsFrontmatterMermaid } from 'grph-shared/markdown/mermaidInput'
import { isFrontmatterOnlyPolicyActive } from '@/lib/config.render'

let mermaidFrontmatterGeometryModulePromise: Promise<typeof import('@/lib/mermaid/mermaidFrontmatterGeometry')> | null = null

const loadMermaidFrontmatterGeometryModule = async () => {
  if (!mermaidFrontmatterGeometryModulePromise) {
    mermaidFrontmatterGeometryModulePromise = import('@/lib/mermaid/mermaidFrontmatterGeometry')
  }
  return mermaidFrontmatterGeometryModulePromise
}

const KEYWORD_SOURCE_EDGE_LABELS = new Set<string>([
  'hasSection',
  'hasBlock',
  'hasItem',
  'contains',
  'embedsImage',
  'embedsMedia',
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

const WORKSPACE_GRAPH_CONTEXT = 'workspace:graph'
const WORKSPACE_GRAPH_SOURCE = 'workspace:graph'
const WORKSPACE_GRAPH_PARSE_HINT = 'workspace:inline-data'
const WORKSPACE_GRAPH_SOURCE_KIND = 'workspace'

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

const asFinite = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

const asStr = (v: unknown): string => (typeof v === 'string' ? v : String(v ?? ''))

const toWorkspaceJsonGraphData = (data: GraphData): GraphData | null => {
  const nodes = Array.isArray(data?.nodes) ? data.nodes : []
  const edges = Array.isArray(data?.edges) ? data.edges : []
  if (nodes.length === 0 && edges.length === 0) return null
  const typeCounts = nodes.reduce(
    (acc, n) => {
      const t = String(n?.type || '').toLowerCase()
      if (t === 'problem') acc.problem += 1
      if (t === 'solution') acc.solution += 1
      return acc
    },
    { problem: 0, solution: 0 },
  )
  const isBipartite = typeCounts.problem > 0 && typeCounts.solution > 0
  const meta =
    data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
      ? (data.metadata as Record<string, unknown>)
      : {}
  const source =
    typeof meta.source === 'string' && meta.source.trim()
      ? meta.source
      : WORKSPACE_GRAPH_SOURCE
  const sourceKind =
    typeof meta.sourceKind === 'string' && meta.sourceKind.trim()
      ? meta.sourceKind
      : WORKSPACE_GRAPH_SOURCE_KIND
  const graphKind =
    typeof meta.graphKind === 'string' && meta.graphKind.trim()
      ? meta.graphKind
      : isBipartite
        ? 'bipartite'
        : 'graph'
  return {
    ...data,
    type: data.type || 'apiGraph',
    context: data.context || source,
    metadata: {
      ...meta,
      source,
      sourceKind,
      graphKind,
    } as Record<string, any>,
  }
}

const parseWorkspaceFallbackGraph = (name: string | null, text: string): GraphData | null => {
  try {
    const parsed = parseGraph(name || WORKSPACE_GRAPH_PARSE_HINT, text).data
    return toWorkspaceJsonGraphData(parsed)
  } catch {
    return null
  }
}

const parseWorkspaceJsonGraphData = (args: { markdownName: string | null; markdownText: string | null }): GraphData | null => {
  const rawText = String(args.markdownText || '')
  const trimmed = rawText.trim()
  if (!trimmed) return null
  const looksJson = trimmed.startsWith('{') || trimmed.startsWith('[')
  if (!looksJson) return null

  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    if (!Array.isArray(parsed)) {
      const bipartitePayload = parseBipartiteApiGraphPayload(parsed)
      if (bipartitePayload) {
        return normalizeBipartiteApiGraphData({
          payload: bipartitePayload,
          sourceMeta: buildBipartiteSourceMeta({
            kind: 'workspace',
            documentName: args.markdownName,
          }),
        })
      }
    }
    const obj = Array.isArray(parsed) ? null : (parsed as Record<string, unknown>)
    const nodesRaw = obj && Array.isArray(obj.nodes) ? obj.nodes : null
    const edgesRaw = obj && Array.isArray(obj.edges) ? obj.edges : null
    if (!nodesRaw || !edgesRaw) {
      return parseWorkspaceFallbackGraph(args.markdownName, trimmed)
    }

    const nodes = nodesRaw
      .map((n): GraphData['nodes'][number] | null => {
        if (!n || typeof n !== 'object' || Array.isArray(n)) return null
        const o = n as Record<string, unknown>
        const id = asStr(o.id).trim()
        if (!id) return null
        const type = asStr(o.type).trim() || 'node'
        const label = asStr(o.label).trim() || id
        const x = asFinite(o.x)
        const y = asFinite(o.y)
        const props: Record<string, unknown> = {}
        Object.keys(o).forEach(k => {
          if (k === 'id' || k === 'type' || k === 'label' || k === 'x' || k === 'y') return
          props[k] = o[k]
        })
        return {
          id,
          type,
          label,
          ...(x != null ? { x } : {}),
          ...(y != null ? { y } : {}),
          properties: props as Record<string, any>,
        }
      })
      .filter(Boolean) as GraphData['nodes']

    const nodeIdSet = new Set(nodes.map(n => String(n.id)))
    const edges = edgesRaw
      .map((e): GraphData['edges'][number] | null => {
        if (!e || typeof e !== 'object' || Array.isArray(e)) return null
        const o = e as Record<string, unknown>
        const source = asStr(o.source || o.problem_id).trim()
        const target = asStr(o.target || o.solution_id).trim()
        if (!source || !target) return null
        if (!nodeIdSet.has(source) || !nodeIdSet.has(target)) return null
        const id = asStr(o.id).trim() || `${source}->${target}`
        const strength = asFinite(o.strength)
        const props: Record<string, unknown> = {}
        Object.keys(o).forEach(k => {
          if (k === 'id' || k === 'source' || k === 'target' || k === 'problem_id' || k === 'solution_id') return
          props[k] = o[k]
        })
        if (strength != null) props.strength = strength
        return {
          id,
          source,
          target,
          label: asStr(o.label).trim() || 'linksTo',
          properties: props as Record<string, any>,
        }
      })
      .filter(Boolean) as GraphData['edges']

    if (nodes.length === 0) {
      return parseWorkspaceFallbackGraph(args.markdownName, trimmed)
    }
    return toWorkspaceJsonGraphData({
      type: 'apiGraph',
      context: WORKSPACE_GRAPH_CONTEXT,
      metadata: {
        source: WORKSPACE_GRAPH_SOURCE,
        sourceKind: WORKSPACE_GRAPH_SOURCE_KIND,
      } as Record<string, any>,
      nodes,
      edges,
    })
  } catch {
    return null
  }
}

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
  baseGraphDataRaw: null as GraphData | null,
  mode: 'document' as 'document' | 'keyword',
  markdownName: null as string | null,
  markdownText: null as string | null,
  canvasRenderMode: '2d' as '2d' | '3d',
  canvas2dRenderer: 'd3' as Canvas2dRendererId,
  keywordSourceMaxLines: 8000,
  keywordSourceMaxChars: 120_000,
  keywordGraphPreviewDebounceMs: 200,
  keywordGraphFullDebounceMs: 800,
  keywordGraphEdgesPerNode: 6,
  keywordGraphMaxEdgesCap: 2400,
  keywordGraphMentionEdgesPerSourceNode: 6,
  revision: 0,
} as const

function isFrontmatterFlowGraphData(graphData: GraphData | null | undefined): boolean {
  if (!graphData) return false
  if (String(graphData.context || '').trim() === 'frontmatter-flow') return true
  const meta =
    graphData.metadata && typeof graphData.metadata === 'object' && !Array.isArray(graphData.metadata)
      ? (graphData.metadata as Record<string, unknown>)
      : null
  return String(meta?.kind || '').trim() === 'frontmatter-flow'
}

export function useActiveGraphData(enabled: boolean = true): GraphData | null {
  const selector = React.useMemo(
    () =>
      enabled
        ? (s: GraphState) => ({
            baseGraphDataRaw: s.graphData as GraphData | null,
            mode: (s.documentSemanticMode || 'document') as 'document' | 'keyword',
            markdownName: s.markdownDocumentName || null,
            markdownText: s.markdownDocumentText || null,
            canvasRenderMode: (s.canvasRenderMode || '2d') as '2d' | '3d',
            canvas2dRenderer: (s.canvas2dRenderer || 'd3') as Canvas2dRendererId,
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
    baseGraphDataRaw,
    mode,
    markdownName,
    markdownText,
    canvasRenderMode,
    canvas2dRenderer,
    keywordSourceMaxLines,
    keywordSourceMaxChars,
    keywordGraphPreviewDebounceMs,
    keywordGraphFullDebounceMs,
    keywordGraphEdgesPerNode,
    keywordGraphMaxEdgesCap,
    keywordGraphMentionEdgesPerSourceNode,
    revision,
  } = useGraphStore(useShallow(selector))
  const frontmatterOnlyPolicyActive = React.useMemo(() => {
    return isFrontmatterOnlyPolicyActive({ canvasRenderMode, canvas2dRenderer })
  }, [canvas2dRenderer, canvasRenderMode])
  const effectiveMode: 'document' | 'keyword' = frontmatterOnlyPolicyActive ? 'document' : mode

  // Flowchart renderer is frontmatter-only and reuses local ingest->parse->render data.
  const wantsApiGraphBipartite = false
  const workspaceJsonGraphData = React.useMemo(
    () => (enabled && !wantsApiGraphBipartite ? parseWorkspaceJsonGraphData({ markdownName, markdownText }) : null),
    [enabled, markdownName, markdownText, wantsApiGraphBipartite],
  )
  const workspaceFrontmatterMermaidGraphData = React.useMemo(() => {
    if (!enabled || wantsApiGraphBipartite) return null
    const text = String(markdownText || '')
    if (!text.trim()) return null
    if (!containsFrontmatterMermaid(text)) return null
    try {
      const jsonld = buildMarkdownJsonLd(markdownName || 'workspace:frontmatter.md', text)
      const parsed = parseJsonLd(jsonld)
      return toWorkspaceJsonGraphData(parsed)
    } catch {
      return null
    }
  }, [enabled, markdownName, markdownText, wantsApiGraphBipartite])
  const hasStructuredWorkspaceGraph = !!workspaceJsonGraphData || !!workspaceFrontmatterMermaidGraphData
  const baseGraphData = workspaceJsonGraphData || workspaceFrontmatterMermaidGraphData || baseGraphDataRaw
  const { graphData: apiGraphBipartite } = useApiGraphBipartiteGraphData(wantsApiGraphBipartite)

  const lastRef = React.useRef<GraphData | null>(null)

  React.useEffect(() => {
    if (!enabled) return
    if (!wantsApiGraphBipartite) return
    if (!apiGraphBipartite) return
    lastRef.current = apiGraphBipartite
  }, [apiGraphBipartite, enabled, wantsApiGraphBipartite])

  const lastKeywordRef = React.useRef<{ cacheKey: string; docId: string; graph: GraphData } | null>(null)
  const [asyncBump, setAsyncBump] = React.useState(0)
  const pendingKeyRef = React.useRef<string | null>(null)
  const pendingPreviewKeyRef = React.useRef<string | null>(null)

  const keywordDeriveInputs = React.useMemo(() => {
    if (wantsApiGraphBipartite) return null
    if (hasStructuredWorkspaceGraph) return null
    if (!baseGraphData) return null
    if (effectiveMode !== 'keyword') return null

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
    hasStructuredWorkspaceGraph,
    keywordGraphEdgesPerNode,
    keywordGraphMaxEdgesCap,
    keywordGraphMentionEdgesPerSourceNode,
    keywordSourceMaxChars,
    keywordSourceMaxLines,
    markdownName,
    markdownText,
    effectiveMode,
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
    if (hasStructuredWorkspaceGraph) return baseGraphData
    if (effectiveMode !== 'keyword') return baseGraphData

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
    // Avoid rendering synthetic pending placeholder graphs while keyword derivation is in-flight.
    // Keep the canonical baseline graph visible until a real keyword graph is derived.
    return baseGraphData
  }, [asyncBump, baseGraphData, hasStructuredWorkspaceGraph, keywordDeriveInputs, effectiveMode])

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
    if (effectiveMode !== 'keyword') return
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
  }, [baseGraphData, debouncedKeywordPreviewInputs, enabled, markdownName, effectiveMode])

  React.useEffect(() => {
    if (!enabled) return
    if (!baseGraphData) return
    if (effectiveMode !== 'keyword') return
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
  }, [baseGraphData, debouncedKeywordFullInputs, enabled, markdownName, effectiveMode])

  React.useEffect(() => {
    if (!enabled) return
    const next = wantsApiGraphBipartite ? apiGraphBipartite : computed
    lastRef.current = next
    if (wantsApiGraphBipartite) return
    if (effectiveMode === 'keyword' && keywordDeriveInputs) {
      const cached = keywordGraphCache.get(keywordDeriveInputs.cacheKey)
      if (cached && cached.graph) {
        lastKeywordRef.current = { cacheKey: keywordDeriveInputs.cacheKey, docId: keywordDeriveInputs.docId, graph: cached.graph }
      }
    }
  }, [apiGraphBipartite, computed, enabled, keywordDeriveInputs, effectiveMode, wantsApiGraphBipartite])

  const out = wantsApiGraphBipartite ? apiGraphBipartite : computed
  return enabled ? out : lastRef.current
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
      return tableGraph || args.graphData
    }
    const effective = computeEffectiveFrontmatterMode({
      frontmatterModeEnabled: args.frontmatterModeEnabled,
      documentSemanticMode: args.documentSemanticMode,
      graphData: args.graphData,
    })
    if (!args.frontmatterModeEnabled) return args.graphData
    return effective ? filterGraphToFrontmatterMermaid(args.graphData) : args.graphData
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
  markdownText: null as string | null,
  collapsedGroupIds: [] as string[],
  canvasRenderMode: '2d' as '2d' | '3d',
  canvas2dRenderer: 'd3' as Canvas2dRendererId,
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
            markdownText: s.markdownDocumentText || null,
            collapsedGroupIds: (s.collapsedGroupIds || []) as string[],
            canvasRenderMode: (s.canvasRenderMode || '2d') as '2d' | '3d',
            canvas2dRenderer: (s.canvas2dRenderer || 'd3') as Canvas2dRendererId,
          })
        : () => INACTIVE_RENDER_SLICE,
    [enabled],
  )

  const {
    frontmatterModeEnabled,
    multiDimTableModeEnabled,
    documentSemanticMode,
    documentStructureBaselineLock,
    markdownText,
    collapsedGroupIds,
    canvasRenderMode,
    canvas2dRenderer,
  } = useGraphStore(useShallow(selector))
  const frontmatterOnlyPolicyActive = React.useMemo(
    () => isFrontmatterOnlyPolicyActive({ canvasRenderMode, canvas2dRenderer }),
    [canvasRenderMode, canvas2dRenderer],
  )
  const effectiveDocumentSemanticMode = frontmatterOnlyPolicyActive ? 'document' : documentSemanticMode
  const effectiveFrontmatterModeEnabled = frontmatterOnlyPolicyActive ? true : frontmatterModeEnabled
  const effectiveMultiDimTableModeEnabled = frontmatterOnlyPolicyActive ? false : multiDimTableModeEnabled

  const applyMermaidGeometryAttemptKeyRef = React.useRef<string>('')
  const applyMermaidGeometryInFlightRef = React.useRef(false)
  React.useEffect(() => {
    if (!enabled) return
    if (!effectiveFrontmatterModeEnabled) return
    if (String(effectiveDocumentSemanticMode || 'document') !== 'document') return
    const base = graphData
    if (!base) return
    if (String((base as unknown as { context?: unknown }).context || '') === 'frontmatter-mermaid') return
    const meta =
      base.metadata && typeof base.metadata === 'object' && !Array.isArray(base.metadata)
        ? (base.metadata as Record<string, unknown>)
        : null
    if (meta && String(meta.layoutEngine || '') === 'mermaid') return
    if (!computeEffectiveFrontmatterMode({ frontmatterModeEnabled: true, documentSemanticMode: effectiveDocumentSemanticMode, graphData: base })) return
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    const attemptKey = `mermaidGeom:${buildGraphMetaKey(base)}:${base.nodes?.length || 0}:${base.edges?.length || 0}`
    if (applyMermaidGeometryAttemptKeyRef.current === attemptKey) return
    applyMermaidGeometryAttemptKeyRef.current = attemptKey
    if (applyMermaidGeometryInFlightRef.current) return
    applyMermaidGeometryInFlightRef.current = true

    let cancelled = false
    ;(async () => {
      try {
        const { applyMermaidFrontmatterGeometryToGraphData } = await loadMermaidFrontmatterGeometryModule()
        if (cancelled) return
        const updated = await applyMermaidFrontmatterGeometryToGraphData(base)
        if (cancelled) return
        if (!updated || updated === base) return
        if (String((updated as unknown as { context?: unknown }).context || '') !== 'frontmatter-mermaid') return
        useGraphStore.getState().setGraphDataPreservingLayout(updated)
      } catch {
        void 0
      } finally {
        applyMermaidGeometryInFlightRef.current = false
      }
    })()

    return () => {
      cancelled = true
    }
  }, [effectiveDocumentSemanticMode, effectiveFrontmatterModeEnabled, enabled, graphData])

  const lastRef = React.useRef<GraphData | null>(null)

  const collapsedGroupIdsKey = React.useMemo(() => {
    return buildCollapsedGroupIdsKey(collapsedGroupIds)
  }, [collapsedGroupIds])

  const viewGraphData = React.useMemo(() => {
    if (!graphData) return null
    const flowchartMode = canvasRenderMode === '2d' && canvas2dRenderer === 'd3Bipartite'
    if (flowchartMode) {
      const hasYamlFrontmatterMermaid = containsFrontmatterMermaid(String(markdownText || ''))
      if (!hasYamlFrontmatterMermaid) return null
      if (isFrontmatterFlowGraphData(graphData)) return graphData
      const source = hasFrontmatterMermaidSeeds(graphData) ? graphData : null
      if (!source) return null
      return filterGraphToFrontmatterMermaid(source)
    }
    return deriveGraphDataForActiveView({
      graphData,
      frontmatterModeEnabled: effectiveFrontmatterModeEnabled,
      multiDimTableModeEnabled: effectiveMultiDimTableModeEnabled,
      documentSemanticMode: effectiveDocumentSemanticMode,
      documentStructureBaselineLock,
      collapsedGroupIds: [],
    })
  }, [
    canvas2dRenderer,
    canvasRenderMode,
    effectiveDocumentSemanticMode,
    effectiveFrontmatterModeEnabled,
    effectiveMultiDimTableModeEnabled,
    graphData,
    markdownText,
  ])

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
