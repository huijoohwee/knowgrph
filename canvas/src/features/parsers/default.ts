import { parseCsvToGraph } from '@/lib/graph/csv'
import { rawToGraphData } from '@/lib/graph/rawToGraph'
import { parseJsonLd } from '@/lib/graph/jsonld/index'
import type { GraphData, JSONValue } from '@/lib/graph/types'
import { isN8nWorkflow, parseN8nWorkflow } from '@/lib/graph/n8n'
import type { ParserSpec } from './types'
import { toParserId } from './types'
import { pythonSpec } from './python'
import { graphRagSpec } from './graphrag'
import { buildMarkdownJsonLd, slugify } from './markdownJsonLd'

export { buildMarkdownJsonLd } from './markdownJsonLd'

const markdownSpec: ParserSpec = {
  id: toParserId('markdown'),
  name: 'Markdown',
  match: (name) => {
    const lower = (name || '').toLowerCase()
    if (/^https?:\/\//i.test(lower)) return true
    return lower.endsWith('.md') || lower.endsWith('.markdown')
  },
  parse: (name, text) => {
    const raw = String(text || '')
    const maxChars = 120000
    if (raw.length > maxChars) {
      const baseName = (name || '').replace(/\\/g, '/').split('/').pop() || ''
      const stem = baseName.replace(/\.(md|markdown)$/i, '') || 'markdown'
      const nodeId = `md:large:${slugify(stem)}`
      const label = stem || baseName || 'Markdown Document'
      const previewLimit = 32000
      const preview = raw.slice(0, previewLimit)
      const graphData: GraphData = {
        type: 'Graph',
        context: 'markdown-large',
        nodes: [
          {
            id: nodeId,
            label,
            type: 'Document',
            properties: {
              format: 'text/markdown',
              path: baseName,
              length: raw.length,
              preview,
            },
            metadata: {
              truncated: raw.length > previewLimit,
            },
          },
        ],
        edges: [],
        metadata: {
          ingestionMetrics: {
            kind: 'markdown-large',
            originalLength: raw.length,
            previewLength: preview.length,
            truncated: raw.length > preview.length,
          },
        },
      }
      return {
        graphData,
        warnings: [
          'Very large markdown document ingested as a summary-only graph for performance.',
        ],
      }
    }
    const t0 = Date.now()
    const jsonld = buildMarkdownJsonLd(name, text)
    const t1 = Date.now()
    const baseGraph = parseJsonLd(jsonld)
    const t2 = Date.now()
    const baseMeta =
      baseGraph.metadata && typeof baseGraph.metadata === 'object' && !Array.isArray(baseGraph.metadata)
        ? baseGraph.metadata
        : ({} as Record<string, JSONValue>)
    const ingestionMetrics: Record<string, JSONValue> = {
      kind: 'markdown',
      buildMarkdownJsonLdMs: t1 - t0,
      parseJsonLdMs: t2 - t1,
      totalMs: t2 - t0,
    }
    const nextMeta: Record<string, JSONValue> = {
      ...baseMeta,
      ingestionMetrics,
    }
    const graphData = { ...baseGraph, metadata: nextMeta }
    return { graphData, warnings: [] }
  },
}

const csvSpec: ParserSpec = {
  id: toParserId('csv'),
  name: 'CSV',
  match: (name) => (name || '').toLowerCase().endsWith('.csv'),
  parse: (_, text) => ({ graphData: parseCsvToGraph(text), warnings: [] })
}

const jsonldSpec: ParserSpec = {
  id: toParserId('jsonld'),
  name: 'JSON‑LD',
  match: (name, text) => {
    const lower = (name || '').toLowerCase()
    if (lower.endsWith('.jsonld')) return true
    try { const obj = JSON.parse(text); return !!obj['@context'] } catch { return false }
  },
  parse: (_, text) => ({ graphData: parseJsonLd(JSON.parse(text)), warnings: [] })
}

const rawJsonSpec: ParserSpec = {
  id: toParserId('json'),
  name: 'Raw JSON',
  match: (name, text) => {
    const lower = (name || '').toLowerCase()
    if (lower.endsWith('.json')) return true
    try { JSON.parse(text); return true } catch { return false }
  },
  parse: (_, text) => {
    const obj = JSON.parse(text)
    if (obj && Array.isArray(obj.nodes) && Array.isArray(obj.edges)) return { graphData: obj, warnings: [] }
    return { graphData: rawToGraphData(obj), warnings: [] }
  }
}

const n8nSpec: ParserSpec = {
  id: toParserId('n8n'),
  name: 'N8n Workflow',
  match: (_, text) => { try { const obj = JSON.parse(text); return isN8nWorkflow(obj) } catch { return false } },
  parse: (_, text) => parseN8nWorkflow(JSON.parse(text))
}

export const builtInParsers: ParserSpec[] = [csvSpec, jsonldSpec, rawJsonSpec, n8nSpec, markdownSpec, pythonSpec, graphRagSpec]
