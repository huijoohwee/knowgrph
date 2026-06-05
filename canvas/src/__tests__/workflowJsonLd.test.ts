import {
  buildHistoryJsonLdDocument,
  buildGraphFieldSettingsJsonLdDocument,
  buildGraphRagWorkflowJsonLdDocument,
  parseHistoryDocument,
  parseGraphFieldSettingsDocument,
  validateGraphRagWorkflowJsonLdObject,
} from '@/features/panels/utils/workflowJsonLd'
import {
  DEFAULT_GRAPHRAG_CONFIG_PATH,
  parseGraphragCliConfigYamlToJsonLd,
  buildGraphRagWorkflowFromGraphData,
} from '@/features/panels/utils/graphragConfig'
import { DEFAULT_SCHEMA_CONFIG_PATH } from '@/lib/graph/file'
import type { GraphData, JSONValue } from '@/lib/graph/types'
import type { GraphFieldSettingsById } from '@/features/graph-fields/graphFields'

const readGraphragCliConfigYamlText = async (): Promise<string> => {
  const url = new URL(`../../../${DEFAULT_GRAPHRAG_CONFIG_PATH}`, import.meta.url)
  const isNodeRuntime =
    typeof process !== 'undefined' && !!(process as unknown as { versions?: { node?: string } }).versions?.node
  if (isNodeRuntime) {
    const fs = await import('node:fs')
    return fs.readFileSync(url, 'utf8')
  }
  const res = await fetch(url.toString())
  return await res.text()
}

const readJsonFixture = async (relativePath: string): Promise<unknown> => {
  const url = new URL(relativePath, import.meta.url)
  const isNodeRuntime =
    typeof process !== 'undefined' && !!(process as unknown as { versions?: { node?: string } }).versions?.node
  if (isNodeRuntime) {
    const fs = await import('node:fs')
    const text = fs.readFileSync(url, 'utf8')
    return JSON.parse(text) as unknown
  }
  const res = await fetch(url.toString())
  const text = await res.text()
  return JSON.parse(text) as unknown
}

export function testWorkflowJsonLdHistoryGraphShape() {
  const graph: GraphData = {
    type: 'Graph',
    nodes: [],
    edges: [],
  }
  const historySettings: GraphFieldSettingsById = {
    'node:name': {
      displayName: 'Name',
      isHidden: false,
      fieldType: 'Single line text',
      isCustom: false,
    },
  }
  const history = [
    {
      id: 'h1',
      label: 'First',
      timestamp: 1,
      graphData: graph,
      graphFieldSettingsById: historySettings,
    },
    {
      id: 'h2',
      label: 'Second',
      timestamp: 2,
      graphData: graph,
    },
  ]
  const doc = buildHistoryJsonLdDocument(history, 1)
  const graphValue = doc['@graph'] as unknown
  if (!Array.isArray(graphValue)) {
    throw new Error('history JSON-LD @graph is not an array')
  }
  const kgHistoryValue = doc['kg:history'] as unknown
  if (!Array.isArray(kgHistoryValue)) {
    throw new Error('history JSON-LD kg:history is not an array')
  }
  if (graphValue.length !== kgHistoryValue.length) {
    throw new Error('history JSON-LD @graph length mismatch with kg:history')
  }
  const firstGraph = graphValue[0] as { [key: string]: unknown }
  const firstKg = kgHistoryValue[0] as { [key: string]: unknown }
  const graphId = (firstGraph['@id'] ?? firstGraph.id) as string | undefined
  const kgId = (firstKg['@id'] ?? firstKg.id) as string | undefined
  if (!graphId || !kgId || graphId !== kgId) {
    throw new Error('history JSON-LD first entry id mismatch between @graph and kg:history')
  }
  const parsed = parseHistoryDocument(doc)
  if (!parsed) {
    throw new Error('parseHistoryDocument returned null for history JSON-LD')
  }
  if (parsed.history.length !== history.length) {
    throw new Error('parseHistoryDocument history length mismatch')
  }
  const parsedSettings = parsed.history[0]?.graphFieldSettingsById || {}
  if (!parsedSettings['node:name']) {
    throw new Error('parseHistoryDocument lost graphFieldSettingsById for first entry')
  }
}

export async function testWorkflowJsonLdGraphRagPathGraphFieldSettingsFixture() {
  const cfg = await readJsonFixture(`../../../${DEFAULT_SCHEMA_CONFIG_PATH}`)
  const doc = (cfg as { metadata?: { fixtures?: { graphFieldSettings?: { graphRAGPath?: unknown } } } }).metadata?.fixtures?.graphFieldSettings?.graphRAGPath
  if (!doc) {
    throw new Error('Universal schema config missing metadata.fixtures.graphFieldSettings.graphRAGPath')
  }
  const parsed = parseGraphFieldSettingsDocument(doc)
  if (!parsed) {
    throw new Error('parseGraphFieldSettingsDocument returned null for graphRAGPath graph field settings JSON-LD')
  }
  if (parsed.graphId !== 'graphRAGPath-demo') {
    throw new Error('graphRAGPath graph field settings graphId mismatch')
  }
  const keys = Object.keys(parsed.settingsById || {})
  if (!keys.includes('node:graphRAGPath')) {
    throw new Error('graphRAGPath settings missing node:graphRAGPath field')
  }
  if (!keys.includes('node:chunk_text')) {
    throw new Error('graphRAGPath settings missing node:chunk_text field')
  }
  if (!keys.includes('node:metadata')) {
    throw new Error('graphRAGPath settings missing node:metadata field')
  }
}

export function testWorkflowJsonLdGraphFieldSettingsGraphShape() {
  const settingsById: GraphFieldSettingsById = {
    'node:name': {
      displayName: 'Name',
      isHidden: false,
      fieldType: 'Single line text',
      isCustom: false,
    },
    'edge:weight': {
      displayName: 'Weight',
      isHidden: false,
      fieldType: 'Number',
      isCustom: false,
    },
  }
  const doc = buildGraphFieldSettingsJsonLdDocument('graph-1', settingsById)
  const graphValue = doc['@graph'] as unknown
  if (!Array.isArray(graphValue)) {
    throw new Error('graph field settings JSON-LD @graph is not an array')
  }
  const fieldsValue = doc['kg:fields'] as unknown
  if (!Array.isArray(fieldsValue)) {
    throw new Error('graph field settings JSON-LD kg:fields is not an array')
  }
  if (graphValue.length !== fieldsValue.length) {
    throw new Error('graph field settings JSON-LD @graph length mismatch with kg:fields')
  }
  const idsFromGraph = new Set(
    graphValue
      .map(entry => entry as { [key: string]: unknown })
      .map(entry => {
        const raw = entry['kg:fieldId'] ?? entry.fieldId ?? entry.id ?? entry['@id']
        return typeof raw === 'string' ? raw : null
      })
      .filter((id): id is string => !!id),
  )
  if (!idsFromGraph.has('node:name') || !idsFromGraph.has('edge:weight')) {
    throw new Error('graph field settings JSON-LD @graph missing expected field ids')
  }
  const parsed = parseGraphFieldSettingsDocument(doc)
  if (!parsed) {
    throw new Error('parseGraphFieldSettingsDocument returned null for graph field settings JSON-LD')
  }
  if (parsed.graphId !== 'graph-1') {
    throw new Error('parseGraphFieldSettingsDocument graphId mismatch')
  }
  const keys = Object.keys(parsed.settingsById || {})
  if (!keys.includes('node:name') || !keys.includes('edge:weight')) {
    throw new Error('parseGraphFieldSettingsDocument missing settings for expected field ids')
  }
}

export function testWorkflowJsonLdGraphFieldSettingsCanonicalizesOrdering() {
  const first: GraphFieldSettingsById = {
    'edge:weight': { displayName: 'Weight', isHidden: false, fieldType: 'Number', isCustom: false },
    'node:title': { displayName: 'Title', isHidden: false, fieldType: 'Single line text', isCustom: true },
    'node:name': { displayName: 'Name', isHidden: false, fieldType: 'Single line text', isCustom: false },
  }
  const second: GraphFieldSettingsById = {
    'node:name': { displayName: 'Name', isHidden: false, fieldType: 'Single line text', isCustom: false },
    'node:title': { displayName: 'Title', isHidden: false, fieldType: 'Single line text', isCustom: true },
    'edge:weight': { displayName: 'Weight', isHidden: false, fieldType: 'Number', isCustom: false },
  }
  const docA = buildGraphFieldSettingsJsonLdDocument('graph-1', first)
  const docB = buildGraphFieldSettingsJsonLdDocument('graph-1', second)
  const ids = (doc: Record<string, JSONValue>): string[] => {
    const fields = doc['kg:fields'] as unknown
    if (!Array.isArray(fields)) throw new Error('graph field settings JSON-LD kg:fields is not an array')
    return fields.map(entry => {
      const raw = (entry as Record<string, unknown>)['kg:fieldId']
      return typeof raw === 'string' ? raw : ''
    })
  }
  const expected = ['node:name', 'node:title', 'edge:weight']
  if (JSON.stringify(ids(docA)) !== JSON.stringify(expected)) {
    throw new Error(`graph field settings JSON-LD field order drifted: ${JSON.stringify(ids(docA))}`)
  }
  if (JSON.stringify(ids(docA)) !== JSON.stringify(ids(docB))) {
    throw new Error('graph field settings JSON-LD should ignore settings map insertion order')
  }
  const parsed = parseGraphFieldSettingsDocument({ ...docA, 'kg:fields': [...(docA['kg:fields'] as unknown[] || [])].reverse() })
  if (!parsed) throw new Error('parseGraphFieldSettingsDocument returned null for reversed fields')
  if (JSON.stringify(Object.keys(parsed.settingsById)) !== JSON.stringify(expected)) {
    throw new Error(`parsed graph field settings keys should be canonical: ${JSON.stringify(Object.keys(parsed.settingsById))}`)
  }
}

export function testWorkflowJsonLdGraphFieldSettingsAgenticRagRoundTrip() {
  const settingsById: GraphFieldSettingsById = {
    'node:chunk_text': {
      displayName: 'AgenticRAG chunk text',
      isHidden: false,
      fieldType: 'Long text',
      isCustom: true,
    },
  }
  const doc = buildGraphFieldSettingsJsonLdDocument('agenticrag-1', settingsById)
  const graphValue = doc['@graph'] as unknown
  if (!Array.isArray(graphValue)) {
    throw new Error('graph field settings JSON-LD @graph is not an array')
  }
  const entry = graphValue
    .map(v => v as { [key: string]: unknown })
    .find(v => (v['kg:fieldId'] ?? v.fieldId ?? v.id ?? v['@id']) === 'node:chunk_text')
  if (!entry) {
    throw new Error('graph field settings JSON-LD missing node:chunk_text entry')
  }
  if (entry['kg:agenticRagFieldKind'] !== 'chunk_text') {
    throw new Error('graph field settings JSON-LD kg:agenticRagFieldKind mismatch for node:chunk_text')
  }
  const parsed = parseGraphFieldSettingsDocument(doc)
  if (!parsed) {
    throw new Error('parseGraphFieldSettingsDocument returned null for agenticrag graph field settings JSON-LD')
  }
  if (parsed.graphId !== 'agenticrag-1') {
    throw new Error('parseGraphFieldSettingsDocument graphId mismatch for agenticrag graph field settings JSON-LD')
  }
  const parsedSettings = parsed.settingsById['node:chunk_text']
  if (!parsedSettings) {
    throw new Error('parseGraphFieldSettingsDocument missing settings for node:chunk_text')
  }
  if (parsedSettings.isCustom !== true) {
    throw new Error('parseGraphFieldSettingsDocument lost isCustom=true for node:chunk_text')
  }
  const rebuilt = buildGraphFieldSettingsJsonLdDocument(parsed.graphId || 'graph', parsed.settingsById)
  const rebuiltGraphValue = rebuilt['@graph'] as unknown
  if (!Array.isArray(rebuiltGraphValue)) {
    throw new Error('rebuilt graph field settings JSON-LD @graph is not an array')
  }
  const rebuiltEntry = rebuiltGraphValue
    .map(v => v as { [key: string]: unknown })
    .find(v => (v['kg:fieldId'] ?? v.fieldId ?? v.id ?? v['@id']) === 'node:chunk_text')
  if (!rebuiltEntry) {
    throw new Error('rebuilt graph field settings JSON-LD missing node:chunk_text entry')
  }
  if (rebuiltEntry['kg:agenticRagFieldKind'] !== 'chunk_text') {
    throw new Error('rebuilt graph field settings JSON-LD kg:agenticRagFieldKind mismatch for node:chunk_text')
  }
}

export function testWorkflowJsonLdGraphRagWorkflowShape() {
  const doc = buildGraphRagWorkflowJsonLdDocument('graph-1')
  if (doc['@type'] !== 'rag:GraphRAGWorkflow') {
    throw new Error('GraphRAG workflow JSON-LD @type mismatch')
  }
  const ctx = doc['@context'] as unknown
  if (!ctx || typeof ctx !== 'object' || Array.isArray(ctx)) {
    throw new Error('GraphRAG workflow JSON-LD missing rag context')
  }
  if (!('rag' in ctx)) {
    throw new Error('GraphRAG workflow JSON-LD missing rag context')
  }
  if (!('contextWindow' in doc)) {
    throw new Error('GraphRAG workflow JSON-LD missing contextWindow')
  }
}

export async function testWorkflowJsonLdGraphRagCliYamlMapping() {
  const yamlText = await readGraphragCliConfigYamlText()
  const doc = parseGraphragCliConfigYamlToJsonLd(yamlText, 'yaml-graph')
  if (!doc) {
    throw new Error(`parseGraphragCliConfigYamlToJsonLd returned null for ${DEFAULT_GRAPHRAG_CONFIG_PATH}`)
  }
  if (doc['@type'] !== 'rag:GraphRAGWorkflow') {
    throw new Error('GraphRAG YAML mapping @type mismatch')
  }
  if (doc['@id'] !== 'example:graphrag-config-yaml-graph') {
    throw new Error('GraphRAG YAML mapping @id mismatch')
  }
  const dataset = doc.dataset as unknown
  if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset)) {
    throw new Error('GraphRAG YAML mapping missing dataset block')
  }
  const datasetConfig = dataset as { [key: string]: unknown }
  if (datasetConfig.inputDir !== './data/raw') {
    throw new Error('GraphRAG YAML mapping dataset.inputDir mismatch')
  }
  if (datasetConfig.outputDir !== './data/graphrag') {
    throw new Error('GraphRAG YAML mapping dataset.outputDir mismatch')
  }
  const chunking = doc.chunking as unknown
  if (!chunking || typeof chunking !== 'object' || Array.isArray(chunking)) {
    throw new Error('GraphRAG YAML mapping missing chunking block')
  }
  const chunkingConfig = chunking as { [key: string]: unknown }
  if (chunkingConfig.method !== 'recursive_character') {
    throw new Error('GraphRAG YAML mapping chunking.method mismatch')
  }
  if (chunkingConfig.chunkSize !== 1000) {
    throw new Error('GraphRAG YAML mapping chunking.chunkSize mismatch')
  }
  const embeddingModel = doc.embeddingModel as unknown
  if (!embeddingModel || typeof embeddingModel !== 'object' || Array.isArray(embeddingModel)) {
    throw new Error('GraphRAG YAML mapping missing embeddingModel block')
  }
  const embeddingConfig = embeddingModel as { [key: string]: unknown }
  if (embeddingConfig.provider !== 'cohere') {
    throw new Error('GraphRAG YAML mapping embeddingModel.provider mismatch')
  }
  if (embeddingConfig.modelName !== 'embed-english-v3.0') {
    throw new Error('GraphRAG YAML mapping embeddingModel.modelName mismatch')
  }
}

export function testWorkflowJsonLdGraphRagWorkflowFromGraphDataMapping() {
  const graph: GraphData = {
    context: 'test',
    type: 'Graph',
    nodes: [
      { id: 'n1', label: 'A', type: 'T', properties: {} },
      { id: 'n2', label: 'B', type: 'T', properties: {} },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', label: 'enables', properties: {} },
      { id: 'e2', source: 'n2', target: 'n1', label: 'supports', properties: {} },
    ],
    metadata: {
      jsonLdMapping: {
        contextEdgeProperties: ['enables'],
      } as unknown as JSONValue,
    },
  }
  const doc = buildGraphRagWorkflowFromGraphData('graph-1', graph)
  const rules = doc.traversalRules
  if (!Array.isArray(rules) || rules.length === 0) {
    throw new Error('GraphRAG workflow traversalRules missing for mapped graph')
  }
  const first = rules[0]
  const allowedRelations = first && Array.isArray(first.allowedRelations) ? first.allowedRelations : []
  if (!allowedRelations.includes('enables')) {
    throw new Error('GraphRAG workflow allowedRelations missing selected context edge property')
  }
  if (allowedRelations.includes('supports')) {
    throw new Error('GraphRAG workflow allowedRelations includes unselected edge label')
  }
}

export function testGraphRagWorkflowFromGraphDataValidatesWithWorkflowJsonLdValidator() {
  const graph: GraphData = {
    context: 'test',
    type: 'Graph',
    nodes: [
      { id: 'n1', label: 'A', type: 'T', properties: {} },
      { id: 'n2', label: 'B', type: 'T', properties: {} },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', label: 'enables', properties: {} },
    ],
  }
  const doc = buildGraphRagWorkflowFromGraphData('graph-1', graph)
  const result = validateGraphRagWorkflowJsonLdObject(doc as unknown as JSONValue)
  if (!result.ok) {
    const first = result.errors[0] || 'unknown error'
    throw new Error(`GraphRAG workflow from graphData failed validation: ${first}`)
  }
}

export function testGraphRagWorkflowValidatorRejectsInvalidDocument() {
  const invalid = {
    '@type': 'not-a-GraphRAGWorkflow',
    '@context': {},
  } as unknown as JSONValue
  const result = validateGraphRagWorkflowJsonLdObject(invalid)
  if (result.ok) {
    throw new Error('validateGraphRagWorkflowJsonLdObject accepted invalid workflow document')
  }
}
