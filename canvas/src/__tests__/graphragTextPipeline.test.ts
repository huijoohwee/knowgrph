import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runGraphRagTextPipeline } from '@/lib/graph/graphragTextPipeline'
import { builtInParsers } from '@/features/parsers/default'
import { bestMatch, resetParsers, registerParser } from '@/features/parsers/registry'

export function testGraphRagTextPipelineBuildsGraphAcrossDomains() {
  const fixtures = [
    'Singapore is a city-state in Southeast Asia. It has a population of 5.9 million and is known for Changi Airport.',
    'Alice founded Acme Corp in 2020. Acme Corp is located in Berlin.',
    'Protein kinase A phosphorylates a substrate in vitro. The reaction occurs in 2024.',
  ]

  let anyEdges = false

  fixtures.forEach((text) => {
    const res = runGraphRagTextPipeline(text)
    if (res.graphData.type !== 'Graph') throw new Error('Expected GraphData.type=Graph')
    if (!Array.isArray(res.graphData.nodes)) throw new Error('Expected graph nodes array')
    if (!Array.isArray(res.graphData.edges)) throw new Error('Expected graph edges array')
    if (res.graphData.nodes.length === 0) throw new Error('Expected at least 1 node')
    if (res.graphData.edges.length > 0) anyEdges = true
    const meta = res.graphData.metadata as unknown
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw new Error('Expected graph metadata object')
    const pipeline = (meta as Record<string, unknown>).graphragTextPipeline as unknown
    if (!pipeline || typeof pipeline !== 'object' || Array.isArray(pipeline)) throw new Error('Expected graphragTextPipeline metadata')
    const stages = (pipeline as Record<string, unknown>).stages
    if (!Array.isArray(stages) || stages.length < 4) throw new Error('Expected graphragTextPipeline stages')
  })

  if (!anyEdges) throw new Error('Expected at least one fixture to produce edges')
}

const readFixture = (relPath: string): string => {
  const self = fileURLToPath(import.meta.url)
  const dir = path.dirname(self)
  const abs = path.resolve(dir, relPath)
  return fs.readFileSync(abs, { encoding: 'utf8' })
}

export function testGraphRagTextPipelineMatchesDemoFixture() {
  const demoText = readFixture('./fixtures/graphrag-text-demo.md').trim()
  const res = runGraphRagTextPipeline(demoText)
  const graph = res.graphData
  if (graph.type !== 'Graph') throw new Error('Expected GraphData.type=Graph')

  const labels = new Set(graph.nodes.map(n => n.label))
  const expectedNodes = [
    'Project Alpha',
    'Example City',
  ]
  for (const l of expectedNodes) {
    if (!labels.has(l)) {
      throw new Error(`Missing expected node label: ${l}. Have: ${Array.from(labels).sort().join(' | ')}`)
    }
  }

  const edgeTriples = graph.edges.map(e => {
    const s = graph.nodes.find(n => n.id === e.source)?.label || ''
    const t = graph.nodes.find(n => n.id === e.target)?.label || ''
    return `${s}|${String(e.label || '')}|${t}`
  })
  const expectSome = (pred: (k: string) => boolean, label: string) => {
    if (!edgeTriples.some(pred)) {
      const sample = edgeTriples.filter(k => k.startsWith('Project Alpha|')).sort().slice(0, 30).join(' | ')
      throw new Error(`Missing expected edge pattern: ${label}. Project Alpha edges: ${sample}`)
    }
  }
  expectSome(k => k.startsWith('Project Alpha|is-a|'), 'Project Alpha|is-a|*')
  expectSome(k => k === 'Project Alpha|located-in|Example City', 'Project Alpha|located-in|Example City')

  const meta = graph.metadata as unknown as Record<string, unknown>
  const pipeline = meta?.graphragTextPipeline as unknown as Record<string, unknown>
  const stages = pipeline?.stages as unknown
  if (!Array.isArray(stages) || stages.length !== 10) throw new Error('Expected 10 graphragTextPipeline stages')
}

export function testGraphRagTextParserSpecMatchesTxt() {
  const spec = builtInParsers.find(p => String(p.id) === 'graphrag-text')
  if (!spec) throw new Error('Missing graphrag-text parser spec')
  const ok = spec.match('sample.txt', 'Alice founded Acme Corp.')
  if (!ok) throw new Error('Expected graphrag-text parser to match .txt inputs')
  const okPlainMd = spec.match('sample.md', 'Singapore is a city-state in Southeast Asia. It has a population of 5.9 million.')
  if (!okPlainMd) throw new Error('Expected graphrag-text parser to match plain-text markdown inputs')
  const rejectRealMd = spec.match('doc.md', '# Title\n\n- list item\n')
  if (rejectRealMd) throw new Error('Expected graphrag-text parser to reject structured markdown inputs')
  const shouldRejectJson = spec.match('graph.json', '{"nodes":[],"edges":[]}')
  if (shouldRejectJson) throw new Error('Expected graphrag-text parser to reject json-like inputs')
}

export function testGraphRagTextParserSelectionPrefersGraphRagOnPlainMd() {
  resetParsers()
  builtInParsers.forEach(registerParser)
  const fixture = 'Singapore is a city-state in Southeast Asia. It has a population of 5.9 million.'
  const spec = bestMatch({ name: 'demo.md', text: fixture })
  if (!spec) throw new Error('Expected bestMatch parser')
  if (String(spec.id) !== 'graphrag-text') throw new Error(`Expected graphrag-text, got ${String(spec.id)}`)
}

export function testGraphRagTextPipelineCentralityConfigDisablesMetrics() {
  const demoText = readFixture('./fixtures/graphrag-text-demo.md').trim()
  const res = runGraphRagTextPipeline(demoText, {
    centrality: { pagerank: false, hits: false, betweenness: false, closeness: false },
  })
  const graph = res.graphData
  if (graph.type !== 'Graph') throw new Error('Expected GraphData.type=Graph')
  const anyHasCentrality = graph.nodes.some(n => {
    const props = (n.properties || {}) as Record<string, unknown>
    return (
      'graphrag:pagerank' in props ||
      'graphrag:hubs' in props ||
      'graphrag:authorities' in props ||
      'graphrag:betweenness' in props ||
      'graphrag:closeness' in props
    )
  })
  if (anyHasCentrality) throw new Error('Expected centrality metrics to be omitted when disabled')

  const meta = graph.metadata as unknown as Record<string, unknown>
  const pipeline = meta?.graphragTextPipeline as unknown as Record<string, unknown>
  const cfg = pipeline?.config as unknown as Record<string, unknown>
  const centrality = cfg?.centrality as unknown as Record<string, unknown>
  if (!centrality) throw new Error('Expected graphragTextPipeline.config.centrality metadata')
  const keys = ['pagerank', 'hits', 'betweenness', 'closeness'] as const
  for (const k of keys) {
    if (centrality[k] !== false) throw new Error(`Expected centrality.${k}=false`)
  }
 }
