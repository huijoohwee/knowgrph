import type { GraphData } from '@/lib/graph/types'
import { parseGraphFromJson } from '@/lib/graph/io/adapter'
import { buildMarkdownJsonLd } from '@/features/parsers/markdownJsonLd'
import { parseJsonLd } from '@/lib/graph/jsonld'
import {
  normalizeFlowchartApiGraphData,
  parseFlowchartApiGraphPayload,
} from '@/features/flowchart/apiGraphFlowchart'
import { buildFlowchartSourceMeta } from '@/lib/flowchart/source'
import { containsFrontmatterMermaid } from 'grph-shared/markdown/mermaidInput'
import { buildSourceFileParseIdentityHash } from '@/features/source-files/sourceFileParseIdentity'
import { LRUCache } from '@/lib/cache/LRUCache'
import {
  mergeKgcSemanticGraphIntoGraphData,
  parseKgcSemanticGraphFromMarkdown,
} from '@/features/parsers/kgcSemanticGraph'

export const WORKSPACE_GRAPH_CONTEXT = 'workspace:graph'
export const WORKSPACE_GRAPH_SOURCE = 'workspace:graph'
export const WORKSPACE_GRAPH_PARSE_HINT = 'workspace:inline-data'
export const WORKSPACE_GRAPH_SOURCE_KIND = 'workspace'

const workspaceJsonGraphParseCache = new LRUCache<string, { graphData: GraphData | null }>(32)
const workspaceFrontmatterMermaidParseCache = new LRUCache<string, { graphData: GraphData | null }>(32)
const workspaceKgcSemanticGraphParseCache = new LRUCache<string, { graphData: GraphData | null }>(32)
export const WORKSPACE_STRUCTURED_PARSE_DEBOUNCE_MS = 120

const buildWorkspaceStructuredParseKey = (args: {
  parseKind: 'json-graph' | 'frontmatter-mermaid' | 'kgc-semantic'
  markdownName: string | null
  markdownText: string | null
}): string => {
  return buildSourceFileParseIdentityHash({
    cacheNamespace: `workspace:${args.parseKind}`,
    name: String(args.markdownName || ''),
    text: String(args.markdownText || ''),
  })
}

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
  const isFlowchart = typeCounts.problem > 0 && typeCounts.solution > 0
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
      : isFlowchart
        ? 'flowchart'
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
      const flowchartPayload = parseFlowchartApiGraphPayload(parsed)
      if (flowchartPayload) {
        return normalizeFlowchartApiGraphData({
          payload: flowchartPayload,
          sourceMeta: buildFlowchartSourceMeta({
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
      const parsedGraph = parseGraphFromJson(args.markdownName || WORKSPACE_GRAPH_PARSE_HINT, parsed, {
        textForGeoJsonTextFallback: trimmed,
      }).data
      return toWorkspaceJsonGraphData(parsedGraph)
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
      const parsedGraph = parseGraphFromJson(args.markdownName || WORKSPACE_GRAPH_PARSE_HINT, parsed, {
        textForGeoJsonTextFallback: trimmed,
      }).data
      return toWorkspaceJsonGraphData(parsedGraph)
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

export const parseWorkspaceJsonGraphDataCached = (args: { markdownName: string | null; markdownText: string | null }): GraphData | null => {
  const key = buildWorkspaceStructuredParseKey({
    parseKind: 'json-graph',
    markdownName: args.markdownName,
    markdownText: args.markdownText,
  })
  const cached = workspaceJsonGraphParseCache.get(key)
  if (cached) return cached.graphData
  const graphData = parseWorkspaceJsonGraphData(args)
  workspaceJsonGraphParseCache.set(key, { graphData })
  return graphData
}

export const parseWorkspaceKgcSemanticGraphDataCached = (args: {
  markdownName: string | null
  markdownText: string | null
}): GraphData | null => {
  const text = String(args.markdownText || '')
  if (!text.trim()) return null
  const key = buildWorkspaceStructuredParseKey({
    parseKind: 'kgc-semantic',
    markdownName: args.markdownName,
    markdownText: args.markdownText,
  })
  const cached = workspaceKgcSemanticGraphParseCache.get(key)
  if (cached) return cached.graphData
  let graphData: GraphData | null = null
  try {
    const semantic = parseKgcSemanticGraphFromMarkdown({
      name: args.markdownName || 'workspace:kgc-semantic.md',
      text,
    })
    if (semantic) {
      const jsonld = buildMarkdownJsonLd(args.markdownName || 'workspace:kgc-semantic.md', text)
      const parsed = parseJsonLd(jsonld)
      graphData = toWorkspaceJsonGraphData(
        mergeKgcSemanticGraphIntoGraphData({
          base: parsed,
          semantic: semantic.graphData,
        }),
      )
    }
  } catch {
    graphData = null
  }
  workspaceKgcSemanticGraphParseCache.set(key, { graphData })
  return graphData
}

export const parseWorkspaceFrontmatterMermaidGraphDataCached = (args: {
  markdownName: string | null
  markdownText: string | null
}): GraphData | null => {
  const text = String(args.markdownText || '')
  if (!text.trim()) return null
  if (!containsFrontmatterMermaid(text)) return null
  const key = buildWorkspaceStructuredParseKey({
    parseKind: 'frontmatter-mermaid',
    markdownName: args.markdownName,
    markdownText: args.markdownText,
  })
  const cached = workspaceFrontmatterMermaidParseCache.get(key)
  if (cached) return cached.graphData
  let graphData: GraphData | null = null
  try {
    const jsonld = buildMarkdownJsonLd(args.markdownName || 'workspace:frontmatter.md', text)
    const parsed = parseJsonLd(jsonld)
    graphData = toWorkspaceJsonGraphData(parsed)
  } catch {
    graphData = null
  }
  workspaceFrontmatterMermaidParseCache.set(key, { graphData })
  return graphData
}
