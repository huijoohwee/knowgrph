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
  const demoText = readFixture('./demo/graphrag-pipeline-demo.md').trim()
  const res = runGraphRagTextPipeline(demoText)
  const graph = res.graphData
  if (graph.type !== 'Graph') throw new Error('Expected GraphData.type=Graph')

  const labels = new Set(graph.nodes.map(n => n.label))
  const expectedNodes = [
    'Singapore',
    'city-state',
    'Southeast Asia',
    '5.9 million',
    'Changi Airport',
    'financial hub',
    'development projects',
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
  const expectedTriples = [
    'Singapore|is-a|city-state',
    'Singapore|located-in|Southeast Asia',
    'Singapore|has-population|5.9 million',
    'Singapore|known-for|financial hub',
    'Singapore|known-for|Changi Airport',
    'Singapore|has|development projects',
  ]
  expectedTriples.forEach(k => {
    if (!edgeTriples.includes(k)) throw new Error(`Missing expected edge: ${k}`)
  })
  if (graph.nodes.length !== 7) throw new Error(`Expected 7 nodes, got ${graph.nodes.length}`)
  if (graph.edges.length !== 6) throw new Error(`Expected 6 edges, got ${graph.edges.length}`)

  const meta = graph.metadata as unknown as Record<string, unknown>
  const pipeline = meta?.graphragTextPipeline as unknown as Record<string, unknown>
  const stages = pipeline?.stages as unknown
  if (!Array.isArray(stages) || stages.length !== 5) throw new Error('Expected 5 graphragTextPipeline stages')
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
