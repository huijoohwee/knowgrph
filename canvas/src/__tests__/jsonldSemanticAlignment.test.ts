import { AGENTIC_RAG_CONTEXT_URL } from '@/lib/agenticrag'
import { parseJsonLd, getAgenticRagContextComparison } from '@/lib/graph/jsonld'

export function testAgenticRagContextComparisonMatchesCanonical() {
  const jsonld = {
    '@context': AGENTIC_RAG_CONTEXT_URL,
    '@graph': [
      { '@id': 'kg:A', '@type': 'kg:Node', labels: ['File'], name: 'A' },
      { '@id': 'kg:B', '@type': 'kg:Node', labels: ['File'], name: 'B' },
    ],
  }
  const graph = parseJsonLd(jsonld)
  const comparison = getAgenticRagContextComparison(graph)
  if (!comparison) throw new Error('missing agentic context comparison')
  if (comparison.graphContextUrl !== AGENTIC_RAG_CONTEXT_URL) {
    throw new Error('agentic context url mismatch')
  }
  if (comparison.isCanonicalMatch !== true) {
    throw new Error('agentic context should match canonical url')
  }
}

export function testAgenticRagJsonLdStripsKgPrefixForLabelsAndEdgeLabels() {
  const jsonld = {
    '@context': AGENTIC_RAG_CONTEXT_URL,
    '@graph': [
      { '@id': 'kg:A', '@type': 'kg:Node', labels: ['kg:Module'], name: 'Module A' },
      { '@id': 'kg:B', '@type': 'kg:Node', labels: ['kg:Function'], name: 'Function B' },
      { '@id': 'kg:E1', '@type': 'kg:Edge', source: 'kg:A', target: 'kg:B', label: 'kg:calls' },
    ],
  }
  const graph = parseJsonLd(jsonld)
  const a = graph.nodes.find(n => n.id === 'A')
  if (!a || a.type !== 'Module') throw new Error('node label type should strip kg: prefix')
  const e = graph.edges.find(edge => String(edge.id).includes('E1') || edge.label === 'calls')
  if (!e || e.label !== 'calls') throw new Error('edge label should strip kg: prefix')
}

