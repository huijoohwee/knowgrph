import type { GraphData } from '@/lib/graph/types'
import { applyParser, builtInParsers, registerParser, resetParsers, toParserId } from '@/features/parsers'
import { buildMarkdownJsonLd } from '@/features/parsers/default'
import { filterGraphToFrontmatterMermaid } from '@/lib/graph/layerDerivation'

export async function testFrontmatterModeEdaMlpFiltersGraphToMermaidFrontmatter() {
  const envValue = String(process.env.KNOWGRPH_EDA_MLP_INTERVIEW_MD_PATH || '').trim()
  if (!envValue) {
    await Promise.resolve()
    return
  }

  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const markdownFixture = await (async () => {
    const pathMod = await import('node:path')
    const fsMod = await import('node:fs')
    const mdPath = pathMod.resolve(process.cwd(), envValue)
    return fsMod.readFileSync(mdPath, 'utf8')
  })()

  const jsonld = buildMarkdownJsonLd('file://eda-mlp-interview-session.md', markdownFixture)

  const res = applyParser(toParserId('jsonld'), {
    name: 'eda-mlp-interview-session.jsonld',
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
    throw new Error('expected base graph to contain Paragraph node for EDA→MLP markdown')
  }

  const filtered = filterGraphToFrontmatterMermaid(baseGraph, 'eda-mlp-interview-session.md')
  if (!filtered) throw new Error('filterGraphToFrontmatterMermaid returned null for EDA→MLP markdown')

  const nodes = Array.isArray(filtered.nodes) ? filtered.nodes : []
  const edges = Array.isArray(filtered.edges) ? filtered.edges : []

  if (nodes.length === 0) {
    throw new Error('frontmatter filter produced no nodes for EDA→MLP markdown')
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
      throw new Error(`frontmatter filter kept non-Mermaid node type ${type} for EDA→MLP markdown`)
    }
    const meta = (n.metadata || {}) as Record<string, unknown>
    const docPathRaw = meta.documentPath
    const docPath = typeof docPathRaw === 'string' ? docPathRaw.trim() : ''
    if (docPath !== 'eda-mlp-interview-session.md') {
      throw new Error(`frontmatter node has unexpected documentPath ${docPath} for EDA→MLP markdown`)
    }
    const lineStartRaw = meta.lineStart
    const lineEndRaw = meta.lineEnd
    if (typeof lineStartRaw !== 'number' || typeof lineEndRaw !== 'number') {
      throw new Error('frontmatter node missing lineStart or lineEnd for EDA→MLP markdown')
    }
  })

  if (diagramCount === 0) {
    throw new Error('frontmatter filter produced no MermaidDiagram nodes for EDA→MLP markdown')
  }
  if (nodeCount === 0) {
    throw new Error('frontmatter filter produced no MermaidNode nodes for EDA→MLP markdown')
  }
  if (subgraphCount === 0) {
    throw new Error('frontmatter filter produced no MermaidSubgraph nodes for EDA→MLP markdown')
  }

  const nodeIds = new Set(nodes.map(n => String(n.id)))
  edges.forEach((e) => {
    const label = String(e.label || '')
    if (label !== 'pointsTo') {
      throw new Error(`frontmatter filter kept non-pointsTo edge label ${label} for EDA→MLP markdown`)
    }
    const s = String(e.source)
    const t = String(e.target)
    if (!nodeIds.has(s) || !nodeIds.has(t)) {
      throw new Error(`frontmatter filter kept edge with endpoint outside frontmatter nodes ${s} -> ${t} for EDA→MLP markdown`)
    }
  })

  await Promise.resolve()
}
