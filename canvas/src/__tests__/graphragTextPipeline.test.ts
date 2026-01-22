import { runGraphRagTextPipeline } from '@/lib/graph/graphragTextPipeline'
import { builtInParsers } from '@/features/parsers/default'

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

export function testGraphRagTextParserSpecMatchesTxt() {
  const spec = builtInParsers.find(p => String(p.id) === 'graphrag-text')
  if (!spec) throw new Error('Missing graphrag-text parser spec')
  const ok = spec.match('sample.txt', 'Alice founded Acme Corp.')
  if (!ok) throw new Error('Expected graphrag-text parser to match .txt inputs')
  const shouldRejectJson = spec.match('graph.json', '{"nodes":[],"edges":[]}')
  if (shouldRejectJson) throw new Error('Expected graphrag-text parser to reject json-like inputs')
}

