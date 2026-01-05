import { isGraphRagBundle, parseGraphRagBundle } from '@/lib/graph/graphrag'
import { graphRagSpec } from '@/features/parsers/graphrag'

const sample = {
  entities: [
    { id: 'e1', name: 'Acme Corp', type: 'Entity', properties: { category: 'Company' } },
    { id: 'e2', name: 'Alice', type: 'Entity', properties: { category: 'Person' } },
  ],
  relationships: [
    { id: 'r1', source: 'e2', target: 'e1', type: 'worksAt', properties: {} }
  ],
  chunks: [
    { id: 'c1', title: 'Chunk 1', text: 'Alice works at Acme Corp.', docId: 'doc-1' }
  ]
}

export function testGraphRagDetection() {
  if (!isGraphRagBundle(sample)) throw new Error('Detection failed for GraphRAG sample')
}

export function testGraphRagParseBundle() {
  const data = parseGraphRagBundle(sample)
  if (data.nodes.length !== 3) throw new Error('Node count mismatch')
  if (data.edges.length !== 1) throw new Error('Edge count mismatch')
  const labels = new Set(data.nodes.map(n => n.label))
  if (!labels.has('Acme Corp') || !labels.has('Alice')) throw new Error('Missing expected node labels')
}

export function testGraphRagParserSpec() {
  const text = JSON.stringify(sample)
  const match = graphRagSpec.match('graph.json', text)
  if (!match) throw new Error('ParserSpec match failed')
  const { graphData } = graphRagSpec.parse('graph.json', text)
  if (graphData.nodes.length !== 3) throw new Error('Parsed node count mismatch')
}
