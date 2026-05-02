import type { GraphData, JSONValue } from '@/lib/graph/types'
import { FLOW_WIDGET_BUNDLE_KIND, FLOW_WIDGET_BUNDLE_VERSION } from '@/lib/config'
import { hashArrayOfObjectsSignature, hashSignatureParts } from '@/lib/hash/signature'
import { buildScopedGraphSemanticKey, readGraphRevision } from '@/lib/graph/semanticKey'
import { isPlainObject } from '@/lib/graph/value'

type JsonRecord = Record<string, JSONValue>

type JsonLikeRecord = Record<string, unknown>

const WIDGET_BUNDLE_JSON_TEXT_CACHE_LIMIT = 24
const widgetBundleJsonTextCache = new Map<string, string>()

export type WidgetBundleV1 = {
  kind: typeof FLOW_WIDGET_BUNDLE_KIND
  version: typeof FLOW_WIDGET_BUNDLE_VERSION
  registry: JSONValue[]
  graph?: GraphData
}

function readPlainObject(v: unknown): JsonLikeRecord | null {
  return isPlainObject(v) ? (v as JsonLikeRecord) : null
}

function escapeMarkdownTableCell(raw: unknown): string {
  return String(raw ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br/>')
    .trim()
}

function buildMarkdownTable(headers: string[], rows: string[][]): string {
  const normalizedHeaders = headers.map(escapeMarkdownTableCell)
  const normalizedRows = rows.map(row => headers.map((_, idx) => escapeMarkdownTableCell(row[idx] ?? '')))
  return [
    `| ${normalizedHeaders.join(' | ')} |`,
    `| ${normalizedHeaders.map(() => '---').join(' | ')} |`,
    ...normalizedRows.map(row => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function toJsonValueOrNull(v: unknown): JSONValue | null {
  if (v === null) return null
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
  if (Array.isArray(v)) {
    const out: JSONValue[] = []
    for (let i = 0; i < v.length; i += 1) {
      const item = toJsonValueOrNull(v[i])
      if (item === null) out.push(null)
      else out.push(item)
    }
    return out
  }
  const record = readPlainObject(v) as JsonRecord | null
  if (record) {
    const out: JsonRecord = {}
    for (const [k, val] of Object.entries(record)) {
      const next = toJsonValueOrNull(val)
      if (next === null) out[k] = null
      else out[k] = next
    }
    return out
  }
  return null
}

export function buildWidgetBundleV1(args: {
  registryEntries: unknown[]
  graphData?: GraphData | null
}): WidgetBundleV1 {
  const registryEntries = Array.isArray(args.registryEntries) ? args.registryEntries : []
  const registry: JSONValue[] = []
  for (let i = 0; i < registryEntries.length; i += 1) {
    const v = toJsonValueOrNull(registryEntries[i])
    if (!v) continue
    registry.push(v)
  }
  const graph = args.graphData || undefined
  return {
    kind: FLOW_WIDGET_BUNDLE_KIND,
    version: FLOW_WIDGET_BUNDLE_VERSION,
    registry,
    ...(graph ? { graph } : {}),
  }
}

function buildWidgetBundleRegistrySignature(registryEntries: unknown[]): string {
  const entries = Array.isArray(registryEntries) ? registryEntries : []
  if (entries.length === 0) return hashSignatureParts(['widget-bundle-registry', 0])
  const normalized = entries.map(entry => {
    const record = readPlainObject(entry) || {}
    return {
      id: String(record.id || ''),
      isEnabled: record.isEnabled === true,
      nodeTypeId: String(record.nodeTypeId || ''),
      widgetTypeId: String(record.widgetTypeId || ''),
      formId: String(record.formId || ''),
      updatedAt: String(record.updatedAt || ''),
    }
  })
  return hashSignatureParts([
    'widget-bundle-registry',
    hashArrayOfObjectsSignature(normalized, {
      maxItems: Math.max(24, normalized.length),
      maxKeysPerItem: 6,
    }),
  ])
}

function buildWidgetBundleGraphSignature(args: {
  graphData?: GraphData | null
  graphRevision?: number | null
  graphSemanticKey?: string | null
}): string {
  const graphData = args.graphData || null
  const graphRevision = readGraphRevision(args.graphRevision)
  const graphSemanticKey = buildScopedGraphSemanticKey('widget-bundle-graph', {
    graphData,
    graphRevision,
    graphSemanticKey: args.graphSemanticKey,
  })
  if (!graphData) return hashSignatureParts(['widget-bundle-graph', 0])
  if (graphSemanticKey) return hashSignatureParts(['widget-bundle-graph', graphSemanticKey])
  return hashSignatureParts(['widget-bundle-graph', 0])
}

function readCachedWidgetBundleJsonText(signature: string): string | null {
  const cached = widgetBundleJsonTextCache.get(signature) || null
  if (cached == null) return null
  widgetBundleJsonTextCache.delete(signature)
  widgetBundleJsonTextCache.set(signature, cached)
  return cached
}

function writeCachedWidgetBundleJsonText(signature: string, text: string): string {
  widgetBundleJsonTextCache.set(signature, text)
  if (widgetBundleJsonTextCache.size > WIDGET_BUNDLE_JSON_TEXT_CACHE_LIMIT) {
    const oldestKey = widgetBundleJsonTextCache.keys().next().value
    if (typeof oldestKey === 'string') widgetBundleJsonTextCache.delete(oldestKey)
  }
  return text
}

export function buildWidgetBundleJsonText(args: {
  registryEntries: unknown[]
  graphData?: GraphData | null
  graphRevision?: number | null
  graphSemanticKey?: string | null
}): string {
  const signature = hashSignatureParts([
    'widget-bundle-json-text',
    buildWidgetBundleRegistrySignature(Array.isArray(args.registryEntries) ? args.registryEntries : []),
    buildWidgetBundleGraphSignature({
      graphData: args.graphData,
      graphRevision: args.graphRevision,
      graphSemanticKey: args.graphSemanticKey,
    }),
  ])
  const cached = readCachedWidgetBundleJsonText(signature)
  if (cached != null) return cached
  return writeCachedWidgetBundleJsonText(
    signature,
    widgetBundleToJsonText(
      buildWidgetBundleV1({
        registryEntries: args.registryEntries,
        graphData: args.graphData,
      }),
    ),
  )
}

export function widgetBundleToJsonText(bundle: WidgetBundleV1): string {
  return JSON.stringify(bundle, null, 2)
}

export function widgetBundleToJsonBlob(bundle: WidgetBundleV1): Blob {
  return new Blob([widgetBundleToJsonText(bundle)], { type: 'application/json' })
}

export function tryBuildWidgetBundleMarkdownFromJsonText(text: string): string | null {
  const trimmed = String(text || '').trim()
  if (!trimmed.startsWith('{')) return null
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (!readPlainObject(parsed)) return null
    if (parsed.kind !== FLOW_WIDGET_BUNDLE_KIND) return null
    if (parsed.version !== FLOW_WIDGET_BUNDLE_VERSION) return null

    const registry = Array.isArray(parsed.registry)
      ? parsed.registry.map(readPlainObject).filter((entry): entry is JsonLikeRecord => entry != null)
      : []
    const graph = readPlainObject(parsed.graph)
    const nodes = Array.isArray(graph?.nodes)
      ? graph.nodes.map(readPlainObject).filter((node): node is JsonLikeRecord => node != null)
      : []
    const edges = Array.isArray(graph?.edges)
      ? graph.edges.map(readPlainObject).filter((edge): edge is JsonLikeRecord => edge != null)
      : []

    const lines: string[] = ['# Widget Bundle', '']
    lines.push(`- Registry entries: ${registry.length}`)
    lines.push(`- Graph nodes: ${nodes.length}`)
    lines.push(`- Graph edges: ${edges.length}`)
    lines.push('')

    if (registry.length > 0) {
      const registryRows = registry.map(entry => [
        String(entry.id || ''),
        String(entry.nodeTypeId || ''),
        String(entry.widgetTypeId || ''),
        String(entry.formId || ''),
        entry.isEnabled === true ? 'true' : 'false',
      ])
      lines.push('## Registry', '')
      lines.push(buildMarkdownTable(['id', 'nodeTypeId', 'widgetTypeId', 'formId', 'isEnabled'], registryRows))
      lines.push('')
    }

    if (nodes.length > 0) {
      const nodeRows = nodes.map(node => [
        String(node.id || ''),
        String(node.label || ''),
        String(node.type || ''),
        String(node.x ?? ''),
        String(node.y ?? ''),
      ])
      lines.push('## Graph Nodes', '')
      lines.push(buildMarkdownTable(['id', 'label', 'type', 'x', 'y'], nodeRows))
      lines.push('')
    }

    if (edges.length > 0) {
      const edgeRows = edges.map(edge => [
        String(edge.id || ''),
        String(edge.source || ''),
        String(edge.target || ''),
        String(edge.label || ''),
        String(edge.type || ''),
      ])
      lines.push('## Graph Edges', '')
      lines.push(buildMarkdownTable(['id', 'source', 'target', 'label', 'type'], edgeRows))
      lines.push('')
    }

    return lines.join('\n').trim()
  } catch {
    return null
  }
}
