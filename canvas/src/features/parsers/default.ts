import { parseJsonLd } from '@/lib/graph/jsonld/index'
import type { GraphData, JSONValue } from '@/lib/graph/types'
import { parseGraph } from '@/lib/graph/io/adapter'
import { parseGraphInWorker } from '@/lib/graph/parseWorker'
import { runGraphRagTextPipeline } from '@/lib/graph/graphragTextPipeline'
import { DEFAULT_GRAPHRAG_TEXT_CENTRALITY_CONFIG, parseGraphRagTextCentralityConfig } from '@/lib/graph/graphragTextConfig'
import type { ParserSpec } from './types'
import { toParserId } from './types'
import { pythonSpec } from './python'
import { buildMarkdownJsonLd, slugify } from './markdownJsonLd'
import { tryParseMarkdownFrontmatterFlowGraph } from './markdownFrontmatterFlowGraph'
import { containsFrontmatterMermaid, isMarkdownLikeFileName } from 'grph-shared/markdown/mermaidInput'
import { LS_KEYS } from '@/lib/config'
import { lsJson } from '@/lib/persistence'

export { buildMarkdownJsonLd } from './markdownJsonLd'

const hasMarkdownStructure = (raw: string): boolean =>
  /^\s*#{1,6}\s+/m.test(raw) ||
  /^\s*```/m.test(raw) ||
  /^\s*[-*+]\s+/m.test(raw) ||
  /^\s*>\s+/m.test(raw) ||
  /!\[[^\]]*]\([^)]+\)/.test(raw) ||
  /\[[^\]]+]\([^)]+\)/.test(raw) ||
  /^\s*\|.*\|\s*$/m.test(raw) ||
  /^\s*---\s*$/m.test(raw) ||
  /```mermaid/i.test(raw)

const isLikelyPlainTextMarkdown = (text: string): boolean => {
  const raw = String(text || '').trim()
  if (!raw) return false
  if (raw.length > 20_000) return false
  const lines = raw.split('\n')
  const nonEmpty = lines.filter(l => l.trim().length > 0)
  if (nonEmpty.length > 12) return false
  if (hasMarkdownStructure(raw)) return false
  const alphaCount = raw.slice(0, 1024).replace(/[^a-zA-Z]/g, '').length
  return alphaCount >= 40
}

const markdownSpec: ParserSpec = {
  id: toParserId('markdown'),
  name: 'Markdown',
  match: (name, text) => {
    const lower = (name || '').toLowerCase()
    if (/^https?:\/\//i.test(lower)) {
      const isMdByName = isMarkdownLikeFileName(lower)
      if (isMdByName) return !isLikelyPlainTextMarkdown(text) || containsFrontmatterMermaid(text)
      return hasMarkdownStructure(String(text || ''))
    }
    if (isMarkdownLikeFileName(lower)) {
      if (isLikelyPlainTextMarkdown(text) && !containsFrontmatterMermaid(text)) return false
      return true
    }
    return false
  },
  parse: (name, text) => {
    const raw = String(text || '')
    const frontmatterFlow = tryParseMarkdownFrontmatterFlowGraph(name, raw)
    if (frontmatterFlow) return frontmatterFlow
    const maxChars = 500000
    if (raw.length > maxChars) {
      const baseName = (name || '').replace(/\\/g, '/').split('/').pop() || ''
      const stem = baseName.replace(/\.(md|markdown|mmd)$/i, '') || 'markdown'
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

const jsonSpec: ParserSpec = {
  id: toParserId('json'),
  name: 'JSON',
  match: (name) => {
    const lower = (name || '').toLowerCase()
    if (/^https?:\/\//i.test(lower)) return lower.endsWith('.json') || lower.endsWith('.geojson')
    return lower.endsWith('.json') || lower.endsWith('.geojson')
  },
  parseAsync: (name, text) => autoGraphSpec.parseAsync!(name, text),
  parse: (name, text) => autoGraphSpec.parse(name, text),
}

const csvSpec: ParserSpec = {
  id: toParserId('csv'),
  name: 'CSV',
  match: (name) => {
    const lower = (name || '').toLowerCase()
    if (/^https?:\/\//i.test(lower)) return lower.endsWith('.csv')
    return lower.endsWith('.csv')
  },
  parseAsync: (name, text) => autoGraphSpec.parseAsync!(name, text),
  parse: (name, text) => autoGraphSpec.parse(name, text),
}

const jsonLdSpec: ParserSpec = {
  id: toParserId('jsonld'),
  name: 'JSON‑LD',
  match: (name) => {
    const lower = (name || '').toLowerCase()
    if (/^https?:\/\//i.test(lower)) return lower.endsWith('.jsonld')
    return lower.endsWith('.jsonld')
  },
  parseAsync: (name, text) => autoGraphSpec.parseAsync!(name, text),
  parse: (name, text) => autoGraphSpec.parse(name, text),
}

const graphragTextSpec: ParserSpec = {
  id: toParserId('graphrag-text'),
  name: 'GraphRAG Text (Heuristic)',
  match: (name, text) => {
    const lower = String(name || '').toLowerCase()
    if (lower.endsWith('.txt')) return true
    if (lower.endsWith('.text')) return true
    if (/^https?:\/\//i.test(lower)) return false
    const raw = String(text || '').trim()
    if (!raw) return false
    if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
      return isLikelyPlainTextMarkdown(raw)
    }
    if (lower.endsWith('.json') || lower.endsWith('.jsonld') || lower.endsWith('.csv')) return false
    if (raw.startsWith('{') || raw.startsWith('[')) return false
    const alphaCount = raw.slice(0, 512).replace(/[^a-zA-Z]/g, '').length
    return alphaCount >= 40
  },
  parse: (name, text) => {
    void name
    const centrality = lsJson(
      LS_KEYS.graphragTextCentralityConfig,
      DEFAULT_GRAPHRAG_TEXT_CENTRALITY_CONFIG,
      parseGraphRagTextCentralityConfig,
    )
    const res = runGraphRagTextPipeline(text, { centrality })
    return { graphData: res.graphData, warnings: res.warnings }
  },
}

export const builtInParsers: ParserSpec[] = [
  markdownSpec,
  graphragTextSpec,
  pythonSpec,
  jsonSpec,
  csvSpec,
  jsonLdSpec,
  autoGraphSpec,
]
