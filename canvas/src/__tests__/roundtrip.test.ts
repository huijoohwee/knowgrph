import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { GraphData } from '@/lib/graph/types'
import { graphToCombinedCsv, parseCsvToGraph } from '@/lib/graph/csv'
import { normalizeGraphData } from '@/lib/graph/normalize'
import { parseJsonLd } from '@/lib/graph/jsonld'
import { graphToGraphML, graphToCypher, parseGraph } from '@/lib/graph/io/adapter'
import { computeDerivedFields } from '@/features/graph-fields/graphFields'

export function testCsvRoundTrip() {
  const g: GraphData = {
    context: 'test',
    type: 'Graph',
    nodes: [
      { id: 'n1', label: 'A', type: 'Company', properties: { degree: 3 } },
      { id: 'n2', label: 'B', type: 'Investor', properties: {} },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', label: 'InvestedIn', properties: { weight: 2 } },
    ],
  }
  const csv = graphToCombinedCsv(g)
  const g2 = parseCsvToGraph(csv)
  if (g2.nodes.length !== 2 || g2.edges.length !== 1) throw new Error('csv counts mismatch')
  const e = g2.edges[0]
  if (e.label !== 'InvestedIn') throw new Error('csv edge label mismatch')
  if (String(e.source) !== 'n1' || String(e.target) !== 'n2') throw new Error('csv edge endpoints mismatch')
  if (!e.properties || e.properties.weight !== 2) throw new Error('csv edge weight property mismatch')
}

export function testGraphMlExport() {
  const g: GraphData = {
    context: 'test',
    type: 'Graph',
    nodes: [
      { id: 'n1', label: 'A', type: 'Company', properties: { degree: 3 } },
      { id: 'n2', label: 'B', type: 'Investor', properties: {} },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', label: 'InvestedIn', properties: { weight: 2 } },
    ],
  }
  const xml = graphToGraphML(g)
  if (!xml.includes('<graphml')) throw new Error('graphml missing root tag')
  if (!xml.includes('<node id="n1">')) throw new Error('graphml missing node n1')
  if (!xml.includes('<edge id="e1"')) throw new Error('graphml missing edge e1')
  if (!xml.includes('<data key="label">A</data>')) throw new Error('graphml missing node label data')
  if (!xml.includes('<data key="label">InvestedIn</data>')) throw new Error('graphml missing edge label data')
}

export function testCypherExport() {
  const g: GraphData = {
    context: 'test',
    type: 'Graph',
    nodes: [
      { id: 'n1', label: 'A', type: 'Company', properties: { degree: 3 } },
      { id: 'n2', label: 'B', type: 'Investor', properties: {} },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', label: 'InvestedIn', properties: { weight: 2 } },
    ],
  }
  const cypher = graphToCypher(g)
  if (!cypher.includes('CREATE (n0:Company')) throw new Error('cypher missing node create')
  if (!cypher.includes('CREATE (n0)-[r0:InvestedIn')) throw new Error('cypher missing edge create')
  if (!cypher.includes('degree: 3')) throw new Error('cypher missing numeric property')
}

export function testGraphFieldsDerivedFromCsvJsonJsonLd() {
  const baseGraph: GraphData = {
    context: 'test',
    type: 'Graph',
    nodes: [
      { id: 'n1', label: 'A', type: 'Company', properties: { degree: 3 } },
      { id: 'n2', label: 'B', type: 'Investor', properties: {} },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2', label: 'InvestedIn', properties: { weight: 2 } }],
  }
  const csvText = graphToCombinedCsv(baseGraph)
  const csvGraph = parseCsvToGraph(csvText)
  const csvFields = computeDerivedFields(csvGraph)
  if (!csvFields.some(f => f.id === 'node:degree')) {
    throw new Error('csv graph fields missing node:degree')
  }
  if (!csvFields.some(f => f.id === 'edge:weight')) {
    throw new Error('csv graph fields missing edge:weight')
  }

  const jsonText = JSON.stringify({
    type: 'Graph',
    nodes: [{ id: 'j1', label: 'Json Node', type: 'Entity', properties: { score: 42 } }],
    edges: [],
  })
  const jsonGraph = parseGraph('graph.json', jsonText).data
  const jsonFields = computeDerivedFields(jsonGraph)
  if (!jsonFields.some(f => f.id === 'node:score')) {
    throw new Error('json graph fields missing node:score')
  }

  const jsonld = {
    '@context': { '@vocab': 'https://schema.org/' },
    '@graph': [
      {
        '@id': 'ex:A',
        '@type': 'Thing',
        name: 'A',
        size: 'L',
      },
      {
        '@id': 'ex:B',
        '@type': 'Thing',
        name: 'B',
      },
      {
        '@id': 'ex:e1',
        'kg:subject': 'ex:A',
        'kg:predicate': 'relatedTo',
        'kg:object': 'ex:B',
        weight: 1,
      },
    ],
  }
  const jsonldGraph = parseJsonLd(jsonld)
  const jsonldFields = computeDerivedFields(jsonldGraph)
  if (!jsonldFields.some(f => f.id === 'node:size')) {
    throw new Error('jsonld graph fields missing node:size')
  }
  if (!jsonldFields.some(f => f.id === 'edge:weight')) {
    throw new Error('jsonld graph fields missing edge:weight')
  }
}

export function testGraphFieldsDerivedFromPlainEdgesCsv() {
  const header = 'source_id,target_id,weight\n'
  const rows = [
    ['n1', 'n2', '2'],
    ['n2', 'n3', '3'],
  ]
    .map(cols => cols.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','))
    .join('\n')
  const csv = header + '\n' + rows + '\n'
  const g = parseCsvToGraph(csv)
  if (!g || !Array.isArray(g.edges)) {
    throw new Error('plain edges csv graph not parsed')
  }
  if (g.edges.length !== 2) {
    throw new Error(`plain edges csv edges length mismatch: ${g.edges.length}`)
  }
  const fields = computeDerivedFields(g)
  if (!fields.some(f => f.id === 'edge:weight')) {
    throw new Error('plain edges csv graph fields missing edge:weight')
  }
}

export function testNormalizeGraphDataReusesSharedReaders() {
  const filePath = resolve(process.cwd(), 'src', 'lib', 'graph', 'normalize.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("import { toMetadataRecord } from '@/lib/graph/documentMetadata'")) {
    throw new Error('expected graph normalization to reuse the shared document metadata reader upstream')
  }
  if (!text.includes("import { isPlainObject } from '@/lib/graph/value'")) {
    throw new Error('expected graph normalization to reuse the shared plain-object guard upstream')
  }
  if (!text.includes('return isPlainObject(v) ? (v as Record<string, JSONValue>) : {}')) {
    throw new Error('expected graph normalization property coercion to reuse the shared plain-object guard')
  }
  if (!text.includes('const meta = toMetadataRecord(v) as Record<string, JSONValue>')) {
    throw new Error('expected graph normalization metadata coercion to reuse the shared document metadata reader')
  }
  if (text.includes('const isRecord = (v: unknown): v is Record<string, unknown> =>')) {
    throw new Error('expected graph normalization to stop defining a local record guard')
  }
}

export function testNormalizeGraphDataTrimsIdsAndNormalizesMetadata() {
  const normalized = normalizeGraphData({
    type: ' Graph ',
    context: 'test',
    metadata: { a: 1 },
    nodes: [
      { id: ' n1 ', label: ' A ', type: ' Node ', properties: { foo: 1 }, metadata: {} },
      null as never,
    ],
    edges: [
      { id: '', source: ' n1 ', target: ' n1 ', label: ' self ', properties: { weight: 2 }, metadata: {} },
    ],
  } as GraphData)
  if (normalized.type !== 'Graph') throw new Error('expected graph type to be trimmed')
  if (!normalized.metadata || normalized.metadata.a !== 1) throw new Error('expected graph metadata to be preserved')
  if (normalized.nodes.length !== 1 || normalized.nodes[0]?.id !== 'n1') {
    throw new Error('expected graph normalization to trim node ids and drop null nodes')
  }
  if (!normalized.edges[0]?.id || normalized.edges[0]?.source !== 'n1' || normalized.edges[0]?.target !== 'n1') {
    throw new Error('expected graph normalization to normalize edge ids and endpoints')
  }
}
