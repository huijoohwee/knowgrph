import { pickTextFileWithExtensions } from '@/lib/graph/file'
import { bestMatch, applyParserAsync } from '@/features/parsers/registry'
import { getCachedParse, setCachedParse } from '@/features/parsers/cache'
import { toParserId } from '@/features/parsers'
import { useGraphStore } from '@/hooks/useGraphStore'
import { deriveFilenameFromUrl } from '@/lib/url'
import { ensureBuiltInParsersRegistered } from '@/features/parsers/ensure'
import type { GraphData, GraphNode, GraphEdge, JSONValue } from '@/lib/graph/types'
import { fetchRemoteText } from '@/lib/net/fetchRemoteText'
import {
  type DbConnectorKind,
  type RelationalConnectorConfig,
  type RelationalResult,
  type Neo4jResult,
  buildRelationalGraph,
  buildNeo4jGraph,
} from '@/lib/graph/db'

export type LoaderResult = {
  parserId?: string
  name?: string
  counts?: { n: number; e: number }
  warnings?: string[]
  input?: { name: string; text: string }
}

export async function loadGraphDataViaParser(): Promise<LoaderResult | null> {
  const f = await pickTextFileWithExtensions(['.csv', '.json', '.jsonld'])
  if (!f) return null
  const name = f.name || ''
  const text = f.text || ''
  return loadGraphDataFromTextViaParser(name, text)
}

function ensureGraphData(input: unknown): GraphData | null {
  if (!input || typeof input !== 'object') return null
  const obj = input as Record<string, unknown>
  const nodes = Array.isArray(obj.nodes) ? (obj.nodes as GraphNode[]) : []
  const edges = Array.isArray(obj.edges) ? (obj.edges as GraphEdge[]) : []
  if (!nodes.length && !edges.length) return null
  const context: JSONValue | undefined =
    typeof obj.context === 'undefined' ? 'backend' : (obj.context as JSONValue)
  const type = typeof obj.type === 'string' ? (obj.type as string) : 'Graph'
  return {
    context,
    type,
    nodes,
    edges,
  }
}

type BackendDbRelationalEnvelope = {
  kind: Extract<DbConnectorKind, 'postgres' | 'sqlite'>
  result: RelationalResult
  nodeConfig: RelationalConnectorConfig['node']
  edgeConfig?: RelationalConnectorConfig['edge']
}

type BackendDbNeo4jEnvelope = {
  kind: Extract<DbConnectorKind, 'neo4j'>
  result: Neo4jResult
}

type BackendEnvelope = GraphData | { graph: GraphData } | BackendDbRelationalEnvelope | BackendDbNeo4jEnvelope

function normalizeBackendResponse(json: unknown): { graphData: GraphData | null; warnings: string[] } {
  const direct = ensureGraphData(json)
  if (direct) return { graphData: direct, warnings: [] }
  if (!json || typeof json !== 'object') return { graphData: null, warnings: [] }
  const value = json as BackendEnvelope & Record<string, unknown>
  if (value.graph && typeof value.graph === 'object') {
    const inner = ensureGraphData(value.graph)
    if (inner) return { graphData: inner, warnings: [] }
  }
  const kindRaw = value.kind
  const kind = typeof kindRaw === 'string' ? (kindRaw as DbConnectorKind) : null
  if (kind === 'postgres' || kind === 'sqlite') {
    const result = value.result as RelationalResult | undefined
    const nodeConfig = value.nodeConfig as RelationalConnectorConfig['node'] | undefined
    const edgeConfig = value.edgeConfig as RelationalConnectorConfig['edge'] | undefined
    if (!result || !Array.isArray(result.nodes) || !nodeConfig || !nodeConfig.idColumn) {
      return { graphData: null, warnings: ['Backend relational payload missing nodes or configuration'] }
    }
    const cfg: RelationalConnectorConfig = {
      kind,
      node: nodeConfig,
      edge: edgeConfig,
    }
    return buildRelationalGraph(cfg, result)
  }
  if (kind === 'neo4j') {
    const neo = value.result as Neo4jResult | undefined
    if (!neo || !Array.isArray(neo.nodes) || !Array.isArray(neo.relationships)) {
      return { graphData: null, warnings: ['Backend neo4j payload missing nodes or relationships'] }
    }
    return buildNeo4jGraph(neo)
  }
  return { graphData: null, warnings: [] }
}

async function fetchBackendGraphData(url: string): Promise<{ name: string; data: GraphData; warnings: string[]; inputText: string } | null> {
  try {
    if (typeof window === 'undefined') return null
    const name = deriveFilenameFromUrl(url, 'remote.json')
    const inputText = await fetchRemoteText(url, { useProxy: true })
    if (!inputText) {
      const data: GraphData = { context: 'backend-error', type: 'Graph', nodes: [], edges: [] }
      return { name, data, warnings: [`Request failed for ${url}`], inputText: '' }
    }
    let json: unknown = null
    try {
      json = JSON.parse(inputText) as unknown
    } catch {
      const data: GraphData = { context: 'backend-error', type: 'Graph', nodes: [], edges: [] }
      return { name, data, warnings: ['Backend response was not valid JSON'], inputText }
    }
    const normalized = normalizeBackendResponse(json)
    if (!normalized.graphData) {
      const empty: GraphData = { context: 'backend-empty', type: 'Graph', nodes: [], edges: [] }
      const warnings =
        normalized.warnings && normalized.warnings.length > 0
          ? normalized.warnings
          : ['Backend response did not contain GraphData or database payload']
      return { name, data: empty, warnings, inputText }
    }
    return { name, data: normalized.graphData, warnings: normalized.warnings || [], inputText }
  } catch {
    return null
  }
}

export async function loadGraphDataFromBackendViaParser(url: string): Promise<LoaderResult | null> {
  try { useGraphStore.getState().clearGraphData() } catch { void 0 }
  const fetched = await fetchBackendGraphData(url)
  if (!fetched) return null
  try { useGraphStore.getState().setGraphData(fetched.data) } catch { void 0 }
  const text = fetched.inputText || ''
  return {
    name: fetched.name,
    counts: { n: fetched.data.nodes.length, e: fetched.data.edges.length },
    warnings: fetched.warnings,
    input: text ? { name: fetched.name, text } : undefined,
  }
}

export async function loadGraphDataFromTextViaParser(name: string, text: string): Promise<LoaderResult | null> {
  ensureBuiltInParsersRegistered()
  const bm = bestMatch({ name, text })
  if (!bm) return { input: { name, text }, warnings: ['No matching parser found'], counts: { n: 0, e: 0 } }
  const parserId = toParserId(bm.id)
  const cached = getCachedParse(parserId, name, text)
  const res = cached || await applyParserAsync(parserId, { name, text })
  if (!res) return { parserId: bm.id, name, input: { name, text }, warnings: ["Parser returned no result"], counts: { n: 0, e: 0 } }
  if (!cached) setCachedParse(parserId, name, text, res)
  const { graphData } = res
  try { useGraphStore.getState().setGraphData(graphData) } catch { void 0 }
  return {
    parserId: bm.id,
    name,
    counts: { n: graphData.nodes.length, e: graphData.edges.length },
    warnings: res.warnings || [],
    input: { name, text },
  }
}
