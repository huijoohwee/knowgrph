import type { GraphData, GraphNode, JSONValue } from '@/lib/graph/types'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'

export type DesignTokenSummaryEntry = {
  value: string
  count: number
  sampleNodeIds: string[]
}

export type DesignTokenSummary = {
  semanticKey: string
  nodeCount: number
  typeEntries: DesignTokenSummaryEntry[]
  colorEntries: DesignTokenSummaryEntry[]
  typographyEntries: DesignTokenSummaryEntry[]
  spacingEntries: DesignTokenSummaryEntry[]
}

const MAX_CACHE_ENTRIES = 48
const MAX_SAMPLES = 4
const summaryCache = new Map<string, DesignTokenSummary>()

const normalizeTokenText = (value: unknown): string => String(value ?? '').trim()

const isPlainObject = (value: unknown): value is Record<string, JSONValue> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
)

const normalizeCssColor = (value: unknown): string => {
  const text = normalizeTokenText(value)
  if (!text) return ''
  if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(text)) return text.toLowerCase()
  if (/^(rgb|rgba|hsl|hsla)\(/i.test(text)) return text.replace(/\s+/g, '')
  if (/^var\(--[-a-z0-9]+\)$/i.test(text)) return text
  return ''
}

const normalizeTokenNumber = (value: unknown): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

const keyIncludesAny = (key: string, needles: string[]): boolean => {
  const normalized = key.toLowerCase()
  return needles.some(needle => normalized.includes(needle))
}

const addEntry = (bucket: Map<string, DesignTokenSummaryEntry>, value: string, nodeId: string) => {
  const token = normalizeTokenText(value)
  if (!token) return
  const existing = bucket.get(token)
  if (existing) {
    existing.count += 1
    if (existing.sampleNodeIds.length < MAX_SAMPLES && nodeId && !existing.sampleNodeIds.includes(nodeId)) {
      existing.sampleNodeIds.push(nodeId)
    }
    return
  }
  bucket.set(token, { value: token, count: 1, sampleNodeIds: nodeId ? [nodeId] : [] })
}

const sortedEntries = (bucket: Map<string, DesignTokenSummaryEntry>, maxEntries: number): DesignTokenSummaryEntry[] => (
  Array.from(bucket.values())
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, Math.max(1, maxEntries))
)

const visitNodeProperties = (
  node: GraphNode,
  visit: (key: string, value: JSONValue) => void,
) => {
  const walk = (prefix: string, value: JSONValue) => {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) walk(`${prefix}.${i}`, value[i]!)
      return
    }
    if (isPlainObject(value)) {
      for (const [key, child] of Object.entries(value)) walk(prefix ? `${prefix}.${key}` : key, child)
      return
    }
    visit(prefix, value)
  }

  if (isPlainObject(node.properties)) {
    for (const [key, value] of Object.entries(node.properties)) walk(key, value)
  }
  if (isPlainObject(node.metadata)) {
    for (const [key, value] of Object.entries(node.metadata)) walk(`metadata.${key}`, value)
  }
}

function computeDesignTokenSummary(args: { graphData: GraphData | null; semanticKey: string; maxEntries: number }): DesignTokenSummary {
  const nodes = Array.isArray(args.graphData?.nodes) ? args.graphData.nodes : []
  const types = new Map<string, DesignTokenSummaryEntry>()
  const colors = new Map<string, DesignTokenSummaryEntry>()
  const typography = new Map<string, DesignTokenSummaryEntry>()
  const spacing = new Map<string, DesignTokenSummaryEntry>()

  for (const node of nodes) {
    const nodeId = normalizeTokenText(node.id)
    const type = normalizeTokenText(node.type)
    if (type) addEntry(types, type, nodeId)

    visitNodeProperties(node, (key, value) => {
      const color = normalizeCssColor(value)
      if (color && keyIncludesAny(key, ['color', 'fill', 'stroke', 'background', 'border'])) {
        addEntry(colors, color, nodeId)
      }

      const numeric = normalizeTokenNumber(value)
      if (!numeric) return
      if (keyIncludesAny(key, ['font', 'line-height', 'letter-spacing', 'weight'])) {
        addEntry(typography, `${key}:${numeric}`, nodeId)
      } else if (keyIncludesAny(key, ['gap', 'padding', 'margin', 'radius', 'width', 'height', 'inset'])) {
        addEntry(spacing, `${key}:${numeric}`, nodeId)
      }
    })
  }

  return {
    semanticKey: args.semanticKey,
    nodeCount: nodes.length,
    typeEntries: sortedEntries(types, args.maxEntries),
    colorEntries: sortedEntries(colors, args.maxEntries),
    typographyEntries: sortedEntries(typography, args.maxEntries),
    spacingEntries: sortedEntries(spacing, args.maxEntries),
  }
}

export function summarizeDesignTokens(args: {
  graphData?: GraphData | null
  graphRevision?: number | null
  maxEntries?: number
}): DesignTokenSummary {
  const graphData = args.graphData || null
  const maxEntries = Math.max(1, Math.min(24, Math.floor(args.maxEntries || 8)))
  const semanticKey = buildScopedGraphSemanticKey('design-token-summary', {
    graphData,
    graphRevision: args.graphRevision,
  })
  const cacheKey = `${semanticKey || 'empty'}:${maxEntries}`
  const cached = summaryCache.get(cacheKey)
  if (cached) return cached

  const summary = computeDesignTokenSummary({ graphData, semanticKey, maxEntries })
  summaryCache.set(cacheKey, summary)
  if (summaryCache.size > MAX_CACHE_ENTRIES) {
    const first = summaryCache.keys().next().value
    if (first) summaryCache.delete(first)
  }
  return summary
}
