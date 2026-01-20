import { parseJsonLd } from '@/lib/graph/jsonld/index'
import type { GraphData, JSONValue } from '@/lib/graph/types'
import { parseGraph } from '@/lib/graph/io/adapter'
import { parseGraphInWorker } from '@/lib/graph/parseWorker'
import type { ParserSpec } from './types'
import { toParserId } from './types'
import { pythonSpec } from './python'
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
    const maxChars = 500000
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

const autoGraphSpec: ParserSpec = {
  id: toParserId('auto'),
  name: 'Auto (CSV/JSON/JSON‑LD)',
  match: () => true,
  parseAsync: async (name, text) => {
    const workerData = await parseGraphInWorker(name, text)
    if (workerData) return { graphData: workerData, warnings: [] }
    const parsed = parseGraph(name, text)
    return { graphData: parsed.data, warnings: parsed.diag.warnings || [] }
  },
  parse: (name, text) => {
    const parsed = parseGraph(name, text)
    return { graphData: parsed.data, warnings: parsed.diag.warnings || [] }
  },
}

export const builtInParsers: ParserSpec[] = [markdownSpec, pythonSpec, autoGraphSpec]
