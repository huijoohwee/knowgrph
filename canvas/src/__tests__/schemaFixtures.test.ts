import { parseJsonLd, toJsonLd } from '@/lib/graph/jsonld'
import type { GraphData, SelectionAnchorIds } from '@/lib/graph/types'
import { validateGraphDataWithSchema } from '@/lib/graph/validation'
import { validateSchema } from '@/features/schema/validation'
import { schemaFromJsonLd, schemaToJsonLd } from '@/features/schema/schemaJsonLd'
import { buildSelectionSubgraphForIds, buildSelectionSubgraphForAnchorIds } from '@/lib/graph/file'
import * as d3 from 'd3'
import type { GraphSchema } from '@/lib/graph/schema'

const parseJsonUnknown = (input: unknown): unknown => {
  if (typeof input === 'string') return JSON.parse(input)
  return input
}

const readTextFromUrl = async (url: URL): Promise<string> => {
  const isNodeRuntime =
    typeof process !== 'undefined' && !!(process as unknown as { versions?: { node?: string } }).versions?.node
  if (isNodeRuntime) {
    const fs = await import('node:fs')
    return fs.readFileSync(url, 'utf8')
  }
  const res = await fetch(url.toString())
  return await res.text()
}

const readUniversalSchema = async (): Promise<GraphSchema> => {
  const schemaText = await readTextFromUrl(
    new URL('../../../schema-config/knowgrph-universal-schema-config.jsonld', import.meta.url),
  )
  const rawSchema = parseJsonUnknown(schemaText) as unknown
  return validateSchema(rawSchema as Partial<GraphSchema>)
}

const pickFirstKey = (record: Record<string, unknown> | null | undefined): string | null => {
  if (!record) return null
  const keys = Object.keys(record)
  return keys[0] || null
}

const buildSchemaAwareGraph = (schema: GraphSchema): GraphData => {
  const nodeType = pickFirstKey(schema.nodeStyles as unknown as Record<string, unknown>) || 'Entity'
  const edgeLabel = pickFirstKey(schema.edgeStyles as unknown as Record<string, unknown>) || 'relatedTo'
  return {
    context: 'schema-aware-test',
    type: 'Graph',
    nodes: [
      {
        id: 'n1',
        label: 'Node 1',
        type: nodeType,
        properties: {
          graphRAGPath: { query: 'test', traverse: ['n2', 'n3'] },
          chunk_text: 'Synthetic node for schema-aware tests',
          metadata: { source: 'test', confidence: 1 },
        },
      },
      { id: 'n2', label: 'Node 2', type: nodeType, properties: {} },
      { id: 'n3', label: 'Node 3', type: nodeType, properties: {} },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', label: edgeLabel, properties: {} },
      { id: 'e2', source: 'n2', target: 'n3', label: edgeLabel, properties: {} },
    ],
  }
}

export const testUniversalSchemaValidatesSchemaAwareGraph = async () => {
  const schema = await readUniversalSchema()
  const data = buildSchemaAwareGraph(schema)
  const summary = validateGraphDataWithSchema(data, schema)
  if (summary.metrics.nodeCount !== data.nodes.length) throw new Error('schema-aware nodeCount mismatch')
  if (summary.metrics.edgeCount !== data.edges.length) throw new Error('schema-aware edgeCount mismatch')
  if (summary.metrics.duplicateNodeIdCount !== 0) throw new Error('schema-aware graph has duplicate node IDs')
  if (summary.metrics.danglingEdgeCount !== 0) throw new Error('schema-aware graph has dangling edges')
}

export const testUniversalSchemaHasGraphRagPathPropertySpecs = async () => {
  const schema = await readUniversalSchema()
  const fileGraphRagPathSpec = schema.propertySchemas?.node?.File?.graphRAGPath
  if (!fileGraphRagPathSpec || fileGraphRagPathSpec.type !== 'object') {
    throw new Error('universal schema File.graphRAGPath spec missing or wrong type')
  }
}

export const testGraphRagPathSchemaFixture = async () => {
  const schema = await readUniversalSchema()
  const graphRagPathSpec = schema.propertySchemas?.node?.File?.graphRAGPath
  if (!graphRagPathSpec || graphRagPathSpec.type !== 'object') {
    throw new Error('graphRAGPath schema graphRAGPath property spec missing or wrong type')
  }
  const chunkTextSpec = schema.propertySchemas?.node?.File?.chunk_text
  if (!chunkTextSpec || chunkTextSpec.type !== 'string') {
    throw new Error('graphRAGPath schema chunk_text property spec missing or wrong type')
  }
}

export const testSchemaFromJsonLdBuildsCatalogAndPropertySpecs = async () => {
  const rawJsonLd: unknown = {
    '@context': { kg: 'http://example.org/kg#' },
    layers: {
      mode: 'semantic',
      semantic: { similarityMetric: 'cosine', minSimilarity: 0.42, topKEdgesPerNode: 7 },
    },
    '@graph': [
      { '@id': 'kg:class:concept', '@type': 'kg:NodeType', name: 'concept' },
      { '@id': 'kg:class:technique', '@type': 'kg:NodeType', name: 'technique' },
      { '@id': 'kg:prop:enables', '@type': 'kg:EdgeLabel', name: 'enables' },
      { '@id': 'kg:prop:evaluates', '@type': 'kg:EdgeLabel', name: 'evaluates' },
      { '@id': 'kg:prop:visual:importance', '@type': 'kg:Property', name: 'visual:importance', owner: 'concept', range: 'number' },
      { '@id': 'kg:prop:weight', '@type': 'kg:Property', name: 'weight', owner: 'evaluates', range: 'number' },
    ],
  }
  await Promise.resolve()
  const schema = validateSchema(schemaFromJsonLd(rawJsonLd))
  const nodeTypes = schema.catalog?.nodeTypes || []
  const edgeLabels = schema.catalog?.edgeLabels || []
  if (!nodeTypes.includes('concept') || !nodeTypes.includes('technique')) {
    throw new Error('ai-customer-voice-management schema missing expected node types')
  }
  if (!edgeLabels.includes('enables') || !edgeLabels.includes('evaluates')) {
    throw new Error('ai-customer-voice-management schema missing expected edge labels')
  }
  const conceptImportanceSpec = schema.propertySchemas?.node?.concept?.['visual:importance']
  if (!conceptImportanceSpec || conceptImportanceSpec.type !== 'number') {
    throw new Error('ai-customer-voice-management schema visual:importance node spec missing or wrong type')
  }
  const evaluatesWeightSpec = schema.propertySchemas?.edge?.evaluates?.weight
  if (!evaluatesWeightSpec || evaluatesWeightSpec.type !== 'number') {
    throw new Error('ai-customer-voice-management schema evaluates weight edge spec missing or wrong type')
  }
  if (schema.layers?.mode !== 'semantic') {
    throw new Error('schemaFromJsonLd did not parse layers.mode')
  }
  if (schema.layers?.semantic?.minSimilarity !== 0.42) {
    throw new Error('schemaFromJsonLd did not parse layers.semantic.minSimilarity')
  }
  if (schema.layers?.semantic?.topKEdgesPerNode !== 7) {
    throw new Error('schemaFromJsonLd did not parse layers.semantic.topKEdgesPerNode')
  }
}

export const testJsonLdGraphsParseAndValidateWithUniversalSchema = async () => {
  const schema = await readUniversalSchema()
  const dataGraph = buildSchemaAwareGraph(schema)
  const parsed = parseJsonLd(toJsonLd(dataGraph)) as GraphData
  if (parsed.nodes.length === 0) throw new Error('parsed jsonld graph has no nodes')
  if (parsed.edges.length === 0) throw new Error('parsed jsonld graph has no edges')
  const summary = validateGraphDataWithSchema(parsed, schema)
  if (summary.metrics.nodeCount !== parsed.nodes.length) throw new Error('parsed jsonld nodeCount mismatch')
  if (summary.metrics.edgeCount !== parsed.edges.length) throw new Error('parsed jsonld edgeCount mismatch')
}

export const testMiniVizComputesOnSelectionSubgraph = async () => {
  const schema = await readUniversalSchema()
  const dataGraph = buildSchemaAwareGraph(schema)
  if (dataGraph.nodes.length === 0) throw new Error('miniviz graph has no nodes')
  if (dataGraph.edges.length === 0) throw new Error('miniviz graph has no edges')

  const selectedNodeId = dataGraph.nodes[0]?.id ? String(dataGraph.nodes[0].id) : ''
  const selectedEdgeId = dataGraph.edges[0]?.id ? String(dataGraph.edges[0].id) : ''
  const selectionAnchorIds: SelectionAnchorIds = {
    selectionNodeIds: selectedNodeId ? [selectedNodeId] : [],
    selectionEdgeIds: selectedEdgeId ? [selectedEdgeId] : [],
  }
  const sub = buildSelectionSubgraphForAnchorIds(dataGraph, selectionAnchorIds)
  if (!sub) throw new Error('example selection subgraph is null')
  const legacySub = buildSelectionSubgraphForIds(
    dataGraph,
    selectionAnchorIds.selectionNodeIds,
    selectionAnchorIds.selectionEdgeIds,
  )
  if (!legacySub) throw new Error('example legacy selection subgraph is null')
  if (legacySub.nodes.length !== sub.nodes.length || legacySub.edges.length !== sub.edges.length) {
    throw new Error('example selection subgraph mismatch between anchor and ids helpers')
  }
  if (sub.nodes.length === 0) throw new Error('example selection subgraph has no nodes')

  const nodeTypes = new Map<string, number>()
  for (const node of sub.nodes) {
    const key = node && typeof node.type === 'string' && node.type.trim() ? node.type.trim() : 'node'
    nodeTypes.set(key, (nodeTypes.get(key) || 0) + 1)
  }
  if (nodeTypes.size === 0) throw new Error('example node type distribution empty')

  const edgeLabels = new Map<string, number>()
  for (const edge of sub.edges) {
    const key = edge && typeof edge.label === 'string' && edge.label.trim() ? edge.label.trim() : 'edge'
    edgeLabels.set(key, (edgeLabels.get(key) || 0) + 1)
  }

  const rootData: {
    name: string
    children: { name: string; children?: { name: string; value: number }[] }[]
  } = { name: 'root', children: [] }
  if (nodeTypes.size > 0) {
    rootData.children.push({
      name: 'nodes',
      children: Array.from(nodeTypes.entries()).slice(0, 6).map(([name, value]) => ({ name, value })),
    })
  }
  if (edgeLabels.size > 0) {
    rootData.children.push({
      name: 'edges',
      children: Array.from(edgeLabels.entries()).slice(0, 6).map(([name, value]) => ({ name, value })),
    })
  }
  const root = d3.hierarchy(rootData)
  const cluster = d3.cluster<typeof rootData>().size([2 * Math.PI, 32])
  cluster(root)
  if (root.links().length === 0) throw new Error('example cluster links empty')

  const degreeById = new Map<string, number>()
  for (const edge of sub.edges) {
    const s = String(edge.source)
    const t = String(edge.target)
    degreeById.set(s, (degreeById.get(s) || 0) + 1)
    degreeById.set(t, (degreeById.get(t) || 0) + 1)
  }
  const degrees: number[] = []
  degreeById.forEach(v => {
    if (v > 0 && Number.isFinite(v)) degrees.push(v)
  })
  if (degrees.length === 0) throw new Error('example degrees empty')
  degrees.sort((a, b) => a - b)
  const minDegree = degrees[0]
  const maxDegree = degrees[degrees.length - 1]
  const span = maxDegree - minDegree || 1
  const points: [number, number][] = []
  const width = 140
  const height = 40
  const cx = width / 2
  const cy = height / 2
  const sampleCount = Math.max(3, Math.min(24, degrees.length))
  for (let i = 0; i < sampleCount; i += 1) {
    const value = degrees[Math.floor((i / sampleCount) * degrees.length)]
    const normalized = Math.max(0, Math.min(1, (value - minDegree) / span))
    const angle = (2 * Math.PI * i) / sampleCount
    const r = 6 + normalized * 14
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)])
  }
  const hull = d3.polygonHull(points) ?? points
  if (hull.length < 3) throw new Error('example hull too small')
  const hullPath = d3.path()
  hullPath.moveTo(hull[0][0], hull[0][1])
  for (let i = 1; i < hull.length; i += 1) hullPath.lineTo(hull[i][0], hull[i][1])
  hullPath.closePath()
  const hullD = hullPath.toString()
  if (!hullD) throw new Error('example hull path empty')

  const countsByLength = new Map<number, number>()
  for (const edge of sub.edges) {
    const source = String(edge.source)
    const target = String(edge.target)
    const length = Math.max(0, Math.min(24, Math.abs(source.length - target.length)))
    countsByLength.set(length, (countsByLength.get(length) || 0) + 1)
  }
  const entries = Array.from(countsByLength.entries()).sort((a, b) => a[0] - b[0])
  if (entries.length === 0) throw new Error('example path entries empty')
  const maxCount = entries.reduce((acc, [, v]) => (v > acc ? v : acc), 0)
  if (!Number.isFinite(maxCount) || maxCount <= 0) throw new Error('example path maxCount invalid')
  const path = d3.path()
  for (let i = 0; i < entries.length; i += 1) {
    const [, count] = entries[i]
    const x = (width * i) / Math.max(1, entries.length - 1)
    const y = height - height * Math.max(0, Math.min(1, count / maxCount))
    if (i === 0) path.moveTo(x, y)
    else path.lineTo(x, y)
  }
  const sparkD = path.toString()
  if (!sparkD) throw new Error('example spark path empty')
}

export const testSchemaJsonLdRoundTripPreservesLayers = async () => {
  const schema = validateSchema({
    layers: {
      mode: 'semantic',
      semantic: {
        hiddenNodeTypes: ['geo:Polygon'],
        similarityMetric: 'cosine',
        similarityEdgeLabel: 'semanticSimilarity',
        minSimilarity: 0.33,
        topKEdgesPerNode: 9,
        communityDetection: { enabled: true, resolution: 2.5, maxPasses: 3, maxMovesPerPass: 10 },
      },
      documentStructure: { minGroupSize: 5 },
    },
  } as Partial<GraphSchema>)
  const jsonld = schemaToJsonLd(schema)
  if (!jsonld.layers || typeof jsonld.layers !== 'object') {
    throw new Error('schemaToJsonLd did not export layers')
  }
  const roundTripped = validateSchema(schemaFromJsonLd(jsonld))
  if (roundTripped.layers?.mode !== 'semantic') {
    throw new Error('schema jsonld roundtrip did not preserve layers.mode')
  }
  if (roundTripped.layers?.semantic?.minSimilarity !== 0.33) {
    throw new Error('schema jsonld roundtrip did not preserve layers.semantic.minSimilarity')
  }
  const rtHidden = roundTripped.layers?.semantic?.hiddenNodeTypes
  if (!rtHidden || !Array.isArray(rtHidden) || !rtHidden.includes('geo:Polygon')) {
    throw new Error('schema jsonld roundtrip did not preserve layers.semantic.hiddenNodeTypes')
  }
  if (roundTripped.layers?.documentStructure?.minGroupSize !== 5) {
    throw new Error('schema jsonld roundtrip did not preserve layers.documentStructure.minGroupSize')
  }
  if (roundTripped.layers?.semantic?.communityDetection?.resolution !== 2.5) {
    throw new Error('schema jsonld roundtrip did not preserve layers.semantic.communityDetection.resolution')
  }
}

export const testExampleWorkflowSchemaSnippetParsesHiddenNodeTypes = async () => {
  const rawJsonLd: unknown = {
    '@context': { kg: 'http://example.org/kg#' },
    layers: {
      mode: 'semantic',
      semantic: { hiddenNodeTypes: ['geo:Polygon'] },
    },
    '@graph': [
      { '@id': 'kg:class:entity', '@type': 'kg:NodeType', name: 'Entity' },
      { '@id': 'kg:prop:relatedTo', '@type': 'kg:EdgeLabel', name: 'relatedTo' },
    ],
  }
  await Promise.resolve()
  const schema = validateSchema(schemaFromJsonLd(rawJsonLd))
  if (schema.layers?.mode !== 'semantic') {
    throw new Error('example workflow schema snippet did not set layers.mode to semantic')
  }
  const hidden = schema.layers?.semantic?.hiddenNodeTypes
  if (!hidden || !Array.isArray(hidden) || hidden.length === 0) {
    throw new Error('example workflow schema snippet missing hiddenNodeTypes')
  }
  if (!hidden.includes('geo:Polygon')) {
    throw new Error('example workflow schema snippet hiddenNodeTypes does not include geo:Polygon')
  }
}

export const testExampleWorkflowJsonLdSemanticVsDocumentStructureLayers = async () => {
  const url = new URL('../../../docs/assets/example-workflow.jsonld', import.meta.url)
  const text = await readTextFromUrl(url)
  const raw = parseJsonUnknown(text)
  const graph = parseJsonLd(raw) as GraphData
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    throw new Error('example workflow graph has no nodes')
  }
  if (!Array.isArray(graph.edges) || graph.edges.length === 0) {
    throw new Error('example workflow graph has no edges')
  }
  const polygonType = 'geo:Polygon'
  const hasPolygonNodes = graph.nodes.some(n => String(n.type || '') === polygonType)
  if (!hasPolygonNodes) {
    throw new Error('example workflow graph has no geo:Polygon nodes to validate layer behavior')
  }
  const baseSchema = validateSchema({
    layers: {
      mode: 'document-structure',
      semantic: { hiddenNodeTypes: [polygonType] },
      documentStructure: { minGroupSize: 1 },
    },
  } as Partial<GraphSchema>)
  const visibleNodesForSchema = (schema: GraphSchema) => {
    const layersCfg = schema.layers || {}
    const mode = layersCfg.mode || 'property'
    const semanticCfg = layersCfg.semantic || {}
    const semanticHiddenTypes = Array.isArray(semanticCfg.hiddenNodeTypes)
      ? semanticCfg.hiddenNodeTypes.map(t => String(t || '').trim()).filter(Boolean)
      : []
    if (mode !== 'semantic' || semanticHiddenTypes.length === 0) {
      return graph.nodes
    }
    const hiddenTypeSet = new Set(semanticHiddenTypes)
    const filtered = graph.nodes.filter(n => !hiddenTypeSet.has(String(n.type || '')))
    return filtered.length > 0 ? filtered : graph.nodes
  }
  const visibleEdgesForSchema = (schema: GraphSchema) => {
    const layersCfg = schema.layers || {}
    const mode = layersCfg.mode || 'property'
    const semanticCfg = layersCfg.semantic || {}
    const semanticHiddenTypes = Array.isArray(semanticCfg.hiddenNodeTypes)
      ? semanticCfg.hiddenNodeTypes.map(t => String(t || '').trim()).filter(Boolean)
      : []
    if (mode !== 'semantic' || semanticHiddenTypes.length === 0) {
      return graph.edges
    }
    const hiddenTypeSet = new Set(semanticHiddenTypes)
    const hiddenNodeIds = new Set<string>()
    graph.nodes.forEach(n => {
      const t = String(n.type || '')
      if (t && hiddenTypeSet.has(t)) {
        hiddenNodeIds.add(String(n.id))
      }
    })
    if (!hiddenNodeIds.size) return graph.edges
    const filtered = graph.edges.filter(e => {
      const src = String(e.source ?? '')
      const tgt = String(e.target ?? '')
      if (!src || !tgt) return false
      if (hiddenNodeIds.has(src) || hiddenNodeIds.has(tgt)) return false
      return true
    })
    return filtered.length > 0 ? filtered : graph.edges
  }
  const docSchema = validateSchema({ ...baseSchema, layers: { ...baseSchema.layers, mode: 'document-structure' } })
  const semSchema = validateSchema({ ...baseSchema, layers: { ...baseSchema.layers, mode: 'semantic' } })
  const docNodes = visibleNodesForSchema(docSchema)
  const semNodes = visibleNodesForSchema(semSchema)
  const docEdges = visibleEdgesForSchema(docSchema)
  const semEdges = visibleEdgesForSchema(semSchema)
  if (docNodes.length !== graph.nodes.length) {
    throw new Error('document-structure layer should not hide nodes for example workflow graph')
  }
  if (docEdges.length !== graph.edges.length) {
    throw new Error('document-structure layer should not hide edges for example workflow graph')
  }
  if (semNodes.length >= docNodes.length) {
    throw new Error('semantic layer did not hide any nodes for example workflow graph')
  }
  if (semEdges.length >= docEdges.length) {
    throw new Error('semantic layer did not hide any edges for example workflow graph')
  }
}
