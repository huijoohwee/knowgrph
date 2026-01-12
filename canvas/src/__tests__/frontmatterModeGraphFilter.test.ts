import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { GraphData } from '@/lib/graph/types'
import { applyParser, builtInParsers, registerParser, resetParsers, toParserId } from '@/features/parsers'
import { buildMarkdownJsonLd } from '@/features/parsers/default'
import { filterGraphToFrontmatterMermaid } from '@/lib/graph/layerDerivation'

export async function testFrontmatterModeFiltersGraphToMermaidNodes() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const path = resolve(new URL('.', import.meta.url).pathname, 'demo/markdown-slide-demo.md')
  const markdown = readFileSync(path, 'utf8')

  const jsonld = buildMarkdownJsonLd('file://markdown-slide-demo.md', markdown)

  const res = applyParser(toParserId('jsonld'), {
    name: 'markdown-slide-demo.jsonld',
    text: JSON.stringify(jsonld),
  })

  if (!res) throw new Error('jsonld parse returned null')
  if (res.warnings && res.warnings.length > 0) {
    throw new Error(`jsonld parse warnings: ${res.warnings.join('; ')}`)
  }

  const baseGraph = res.graphData as GraphData
  const baseNodes = Array.isArray(baseGraph.nodes) ? baseGraph.nodes : []
  const hasParagraph = baseNodes.some(n => String(n.type || '') === 'Paragraph')
  if (!hasParagraph) {
    throw new Error('expected base graph to contain Paragraph node')
  }

  const filtered = filterGraphToFrontmatterMermaid(baseGraph, 'docs/demo/markdown-slide-demo.md')
  if (!filtered) throw new Error('filterGraphToFrontmatterMermaid returned null')

  const nodes = Array.isArray(filtered.nodes) ? filtered.nodes : []
  const edges = Array.isArray(filtered.edges) ? filtered.edges : []

  if (nodes.length === 0) {
    throw new Error('frontmatter filter produced no nodes')
  }

  let diagramCount = 0
  let nodeCount = 0
  let subgraphCount = 0
  nodes.forEach((n) => {
    const type = String(n.type || '')
    if (type === 'MermaidDiagram') diagramCount += 1
    else if (type === 'MermaidNode') nodeCount += 1
    else if (type === 'MermaidSubgraph') subgraphCount += 1
    else {
      throw new Error(`frontmatter filter kept non-Mermaid node type ${type}`)
    }
    const meta = (n.metadata || {}) as Record<string, unknown>
    const docPathRaw = meta.documentPath
    const docPath = typeof docPathRaw === 'string' ? docPathRaw.trim() : ''
    if (docPath !== 'markdown-slide-demo.md') {
      throw new Error(`frontmatter node has unexpected documentPath ${docPath}`)
    }
    const lineStartRaw = meta.lineStart
    const lineEndRaw = meta.lineEnd
    if (typeof lineStartRaw !== 'number' || typeof lineEndRaw !== 'number') {
      throw new Error('frontmatter node missing lineStart or lineEnd')
    }
    if (lineStartRaw !== 1) {
      throw new Error(`frontmatter node lineStart expected 1, got ${lineStartRaw}`)
    }
  })

  if (diagramCount === 0) {
    throw new Error('frontmatter filter produced no MermaidDiagram nodes')
  }
  if (nodeCount === 0) {
    throw new Error('frontmatter filter produced no MermaidNode nodes')
  }
  if (subgraphCount === 0) {
    throw new Error('frontmatter filter produced no MermaidSubgraph nodes')
  }

  const nodeIds = new Set(nodes.map(n => String(n.id)))
  edges.forEach((e) => {
    const label = String(e.label || '')
    if (label !== 'pointsTo') {
      throw new Error(`frontmatter filter kept non-pointsTo edge label ${label}`)
    }
    const s = String(e.source)
    const t = String(e.target)
    if (!nodeIds.has(s) || !nodeIds.has(t)) {
      throw new Error(`frontmatter filter kept edge with endpoint outside frontmatter nodes ${s} -> ${t}`)
    }
  })

  await Promise.resolve()
}
