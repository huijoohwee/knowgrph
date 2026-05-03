import { AGENTIC_RAG_CONTEXT_URL } from '@/lib/agenticrag'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getAgenticRagContextComparison, getJsonLdGraphMappingSummary, parseJsonLd } from '@/lib/graph/jsonld'

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

export function testJsonLdUtilsReuseSharedPlainObjectGuard() {
  const filePath = resolve(process.cwd(), 'src', 'lib', 'graph', 'jsonld', 'utils.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("const readPlainObject = (value: unknown): Record<string, unknown> | null => {")) {
    throw new Error('expected jsonld utils to centralize plain-object coercion in one local helper')
  }
  if (!text.includes('const meta = readPlainObject(data.metadata)')) {
    throw new Error('expected jsonld utils metadata reads to reuse the shared local plain-object helper')
  }
  if (!text.includes('ctx = readPlainObject(parsed)')) {
    throw new Error('expected jsonld utils context parsing to reuse the shared local plain-object helper')
  }
  if (!text.includes('const props = readPlainObject(node.properties) || {}')) {
    throw new Error('expected jsonld utils node-property reads to reuse the shared local plain-object helper')
  }
  if (text.includes("if (metaRaw && typeof metaRaw === 'object' && !Array.isArray(metaRaw))")) {
    throw new Error('expected jsonld utils to stop coercing metadata objects inline')
  }
}

export function testJsonLdParseReusesSharedPlainObjectGuard() {
  const filePath = resolve(process.cwd(), 'src', 'lib', 'graph', 'jsonld', 'parse.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("const readPlainObject = (value: unknown): Record<string, unknown> | null => {")) {
    throw new Error('expected jsonld parse to centralize plain-object coercion in one local helper')
  }
  if (!text.includes('const rootRecord = readPlainObject(root)')) {
    throw new Error('expected jsonld parse root reads to reuse the shared local plain-object helper')
  }
  if (!text.includes('const parsedRecord = readPlainObject(parsed)')) {
    throw new Error('expected jsonld parse string-context reads to reuse the shared local plain-object helper')
  }
  if (!text.includes('const rawContextRecord = readPlainObject(rawCtx)')) {
    throw new Error('expected jsonld parse context object reads to reuse the shared local plain-object helper')
  }
  if (!text.includes('const graphMetadataRecord = readPlainObject(metaRaw)')) {
    throw new Error('expected jsonld parse metadata reads to reuse the shared local plain-object helper')
  }
  if (!text.includes('const cfgRaw = readPlainObject(meta.jsonLdMapping)')) {
    throw new Error('expected jsonld parse graph-mapping reads to reuse the shared local plain-object helper')
  }
  if (text.includes("if (entry && typeof entry === 'object' && !Array.isArray(entry))")) {
    throw new Error('expected jsonld parse to stop coercing array context entries inline')
  }
}

export function testJsonLdGraphMappingSummaryParsesStringContextAndSelectedEdgeProps() {
  const summary = getJsonLdGraphMappingSummary({
    type: 'Graph',
    metadata: {
      jsonLdMapping: {
        contextEdgeProperties: ['dependsOn'],
      },
    },
    context: JSON.stringify({
      dependsOn: { '@type': '@id' },
      ignored: { '@type': '@value' },
    }),
    nodes: [
      { id: 'A', type: 'File', label: 'A' },
      { id: 'B', type: 'File', label: 'B' },
    ],
    edges: [
      { id: 'E1', source: 'A', target: 'B', label: 'dependsOn' },
    ],
  } as never)
  if (!summary) throw new Error('expected jsonld graph mapping summary')
  if (summary.selectedEdgeProps.join(',') !== 'dependsOn') {
    throw new Error(`expected selected edge props from jsonld mapping metadata, got ${summary.selectedEdgeProps.join(',')}`)
  }
  if (summary.edgeProps.join(',') !== 'dependsOn') {
    throw new Error(`expected edge props from parsed string context, got ${summary.edgeProps.join(',')}`)
  }
}
