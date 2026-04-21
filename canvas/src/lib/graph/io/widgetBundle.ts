import type { GraphData, JSONValue } from '@/lib/graph/types'
import { FLOW_WIDGET_BUNDLE_KIND, FLOW_WIDGET_BUNDLE_VERSION } from '@/lib/config'

type JsonRecord = Record<string, JSONValue>

type JsonLikeRecord = Record<string, unknown>

export type WidgetBundleV1 = {
  kind: typeof FLOW_WIDGET_BUNDLE_KIND
  version: typeof FLOW_WIDGET_BUNDLE_VERSION
  registry: JSONValue[]
  graph?: GraphData
}

function isJsonRecord(v: unknown): v is JsonRecord {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isUnknownRecord(v: unknown): v is JsonLikeRecord {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
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
  if (isJsonRecord(v)) {
    const out: JsonRecord = {}
    for (const [k, val] of Object.entries(v)) {
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
    if (!isUnknownRecord(parsed)) return null
    if (parsed.kind !== FLOW_WIDGET_BUNDLE_KIND) return null
    if (parsed.version !== FLOW_WIDGET_BUNDLE_VERSION) return null

    const registry = Array.isArray(parsed.registry) ? parsed.registry.filter(isUnknownRecord) : []
    const graph = isUnknownRecord(parsed.graph) ? parsed.graph : null
    const nodes = Array.isArray(graph?.nodes) ? graph.nodes.filter(isUnknownRecord) : []
    const edges = Array.isArray(graph?.edges) ? graph.edges.filter(isUnknownRecord) : []

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
