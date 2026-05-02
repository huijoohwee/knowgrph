import {
  AgenticGraphRagPathValue,
  AgenticRagChunkText,
  AgenticRagEmbedding,
  AgenticRagGeo,
  AgenticRagMediaKind,
  AgenticRagMediaUrl,
  AgenticRagNodeId,
  AgenticRagNodeProvenance,
  AgenticRagNodeView,
  GraphData,
  GraphNode,
  JSONValue,
  JsonLdGraphMappingConfig,
  ParsedAgenticGraphRagExamplePath,
  ParsedAgenticGraphRagTraversePath,
} from '../types'
import { isPlainObject } from '@/lib/graph/value'
import { getNodeMediaSpec } from '@/lib/canvas/graph-elements/mediaSpec'
import {
  isGraphRagPathValue,
  toParsedExamplePath,
  toParsedTraversePath,
} from '@/lib/graph/graphragTraversal'
import { AGENTIC_RAG_CONTEXT_URL } from '@/lib/agenticrag'

export function stripKg(x: unknown): string {
  const s = String(x ?? '')
  return s.startsWith('kg:') ? s.slice(3) : s
}

export const isRecord = isPlainObject

export const AGENTIC_RAG_MINIMAL_CONTEXT: Record<string, unknown> = {
  source: { '@type': '@id' },
  target: { '@type': '@id' },
  media_url: { '@type': '@id' },
  provenance: { '@type': '@id' },
  documentUrl: { '@type': '@id' },
  reference: { '@type': '@id' },
}

export function isIdPropertyKey(ctx: Record<string, unknown>, key: string): boolean {
  const entry = ctx[key]
  if (!entry || !isRecord(entry)) return false
  const t = entry['@type']
  return typeof t === 'string' && t === '@id'
}

export function isCompactIriLike(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('kg:')) return true
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return true
  return trimmed.includes(':')
}

export type JsonLdGraphMappingSummary = {
  nodeCount: number
  edgeCount: number
  edgeProps: string[]
  selectedEdgeProps: string[]
  sampleNodes: { id: string; type: string; label: string }[]
}

export type AgenticRagIgnoreFiltersSummary = {
  rawPatterns: string[]
  resolvedPatterns: string[]
}

export function resolveAgenticRagIgnorePattern(pattern: string): string {
  const text = pattern.trim()
  if (!text) return ''
  if (text.includes(':')) {
    const parts = text.split(':', 2)
    const key = (parts[0] || '').trim().toLowerCase()
    const value = (parts[1] || '').trim()
    if (!value) return ''
    if (key === 'dir') {
      let valueNorm = value.replace(/\\/g, '/')
      if (!valueNorm.endsWith('/')) valueNorm = `${valueNorm}/`
      return valueNorm
    }
    if (key === 'glob') {
      return value
    }
    if (key === 'path') {
      return value.replace(/\\/g, '/')
    }
  }
  return pattern
}

export function buildAgenticRagIgnoreFiltersFromRawPatterns(
  rawPatternsInput: string[],
): AgenticRagIgnoreFiltersSummary {
  const rawPatterns: string[] = []
  const resolvedPatterns: string[] = []
  rawPatternsInput.forEach((item) => {
    const value = String(item || '').trim()
    if (!value) return
    rawPatterns.push(value)
    const resolved = resolveAgenticRagIgnorePattern(value)
    if (resolved) resolvedPatterns.push(resolved)
  })
  return { rawPatterns, resolvedPatterns }
}

export function getJsonLdGraphMappingSummary(data: GraphData | null | undefined): JsonLdGraphMappingSummary | null {
  if (!data || data.type !== 'Graph') return null
  const nodes = Array.isArray(data.nodes) ? data.nodes : []
  const edges = Array.isArray(data.edges) ? data.edges : []

  let selectedEdgeProps: string[] = []
  const metaRaw = data.metadata as unknown
  if (metaRaw && typeof metaRaw === 'object' && !Array.isArray(metaRaw)) {
    const meta = metaRaw as Record<string, unknown>
    const cfgRaw = meta.jsonLdMapping as unknown
    if (cfgRaw && typeof cfgRaw === 'object' && !Array.isArray(cfgRaw)) {
      const cfg = cfgRaw as JsonLdGraphMappingConfig
      const listRaw = (cfg as unknown as Record<string, unknown>).contextEdgeProperties as unknown
      if (Array.isArray(listRaw)) {
        selectedEdgeProps = listRaw.filter(entry => typeof entry === 'string')
      }
    }
  }

  const contextValue = data.context as unknown
  let ctx: Record<string, unknown> | null = null
  if (typeof contextValue === 'string') {
    try {
      const parsed = JSON.parse(contextValue) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        ctx = parsed as Record<string, unknown>
      }
    } catch {
      ctx = null
    }
  } else if (contextValue && typeof contextValue === 'object' && !Array.isArray(contextValue)) {
    ctx = contextValue as Record<string, unknown>
  }

  if (!ctx) {
    const sampleNodes = nodes.slice(0, 3).map(node => ({
      id: String(node.id),
      type: String(node.type),
      label: String(node.label),
    }))
    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      edgeProps: [],
      selectedEdgeProps,
      sampleNodes,
    }
  }

  const edgeProps: string[] = []
  Object.keys(ctx).forEach(key => {
    const entry = ctx ? (ctx as Record<string, unknown>)[key] : undefined
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return
    const typeValue = (entry as Record<string, unknown>)['@type']
    if (typeValue === '@id') edgeProps.push(key)
  })

  if (edgeProps.length === 0 && edges.length > 0) {
    const labels = new Set<string>()
    edges.forEach(e => {
      if (e && typeof e.label === 'string' && e.label.trim()) labels.add(e.label.trim())
    })
    edgeProps.push(...Array.from(labels).sort())
  }

  const sampleNodes = nodes.slice(0, 3).map(node => ({
    id: String(node.id),
    type: String(node.type),
    label: String(node.label),
  }))

  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    edgeProps,
    selectedEdgeProps,
    sampleNodes,
  }
}

export function getAgenticRagIgnoreFiltersSummary(
  data: GraphData | null | undefined,
): AgenticRagIgnoreFiltersSummary | null {
  if (!data) return null
  const metaRaw = data.metadata as unknown
  if (!metaRaw || typeof metaRaw !== 'object' || Array.isArray(metaRaw)) return null
  const meta = metaRaw as Record<string, unknown>
  const raw = meta.ignoreCodebasePaths as unknown
  const resolved = meta.ignoreCodebasePathsResolved as unknown
  const rawPatterns = Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') as string[] : []
  const resolvedPatterns = Array.isArray(resolved) ? resolved.filter((x) => typeof x === 'string') as string[] : []
  if (rawPatterns.length === 0 && resolvedPatterns.length === 0) return null
  return { rawPatterns, resolvedPatterns }
}

export type AgenticRagContextComparison = {
  canonicalContextUrl: string
  graphContextUrl: string | null
  isCanonicalMatch: boolean | null
}

export function getAgenticRagContextComparison(
  data: GraphData | null | undefined,
): AgenticRagContextComparison | null {
  if (!data) return null
  const value = data.context as JSONValue | undefined
  let graphContextUrl: string | null = null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    graphContextUrl = trimmed.length > 0 ? trimmed : null
  } else if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, JSONValue>
    const vocab = record['@vocab']
    if (typeof vocab === 'string' && vocab.trim().length > 0) {
      graphContextUrl = vocab.trim()
    }
  }
  let isCanonicalMatch: boolean | null = null
  if (graphContextUrl) {
    isCanonicalMatch = graphContextUrl === AGENTIC_RAG_CONTEXT_URL
  }
  return {
    canonicalContextUrl: AGENTIC_RAG_CONTEXT_URL,
    graphContextUrl,
    isCanonicalMatch,
  }
}

export function agenticRagNodeFromGraphNode(node: GraphNode): AgenticRagNodeView {
  const id = node.id as AgenticRagNodeId
  const labels = [node.type].filter(label => label && label.length > 0)
  const props = node.properties || {}
  const meta = node.metadata || {}

  let graphRagPath: AgenticGraphRagPathValue | undefined
  let parsedTraversePath: ParsedAgenticGraphRagTraversePath | null = null
  let parsedExamplePath: ParsedAgenticGraphRagExamplePath | null = null

  const graphRagPathRaw = (props as Record<string, JSONValue>).graphRAGPath as JSONValue | undefined
  if (isGraphRagPathValue(graphRagPathRaw)) {
    graphRagPath = graphRagPathRaw as AgenticGraphRagPathValue
    parsedTraversePath = toParsedTraversePath(graphRagPath)
    parsedExamplePath = toParsedExamplePath(graphRagPath)
  }

  const chunkRaw = props.chunk_text
  const chunkText =
    typeof chunkRaw === 'string'
      ? (chunkRaw as AgenticRagChunkText)
      : undefined

  const embeddingRaw = props.embedding
  const embedding =
    Array.isArray(embeddingRaw) && embeddingRaw.every(v => typeof v === 'number')
      ? (embeddingRaw as number[] as AgenticRagEmbedding)
      : undefined

  const mediaSpec = getNodeMediaSpec(node)
  const mediaKind = mediaSpec?.kind as AgenticRagMediaKind | undefined
  const mediaUrl =
    mediaSpec && typeof mediaSpec.url === 'string' && mediaSpec.url.trim().length > 0
      ? (mediaSpec.url as AgenticRagMediaUrl)
      : undefined

  const provenanceRaw = typeof meta === 'object' && !Array.isArray(meta) ? meta : {}
  const provenance: AgenticRagNodeProvenance | undefined =
    provenanceRaw && Object.keys(provenanceRaw).length > 0
      ? (provenanceRaw as AgenticRagNodeProvenance)
      : undefined

  const geo = (() => {
    const raw = (props as Record<string, JSONValue>).geo as unknown
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
    const rec = raw as Record<string, unknown>
    const lat = rec.lat
    const lng = rec.lng
    if (typeof lat !== 'number' || typeof lng !== 'number') return undefined
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined
    return { lat, lng } as AgenticRagGeo
  })()

  return {
    id,
    labels,
    properties: props,
    chunkText,
    embedding,
    geo,
    mediaKind,
    mediaUrl,
    provenance,
    graphRAGPath: graphRagPath,
    parsedGraphRagTraversePath: parsedTraversePath,
    parsedGraphRagExamplePath: parsedExamplePath,
  }
}
