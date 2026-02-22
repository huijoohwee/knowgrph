import { pickTextFileWithExtensions } from '@/lib/graph/file'
import { bestMatch, applyParserAsync } from '@/features/parsers/registry'
import { getCachedParse, setCachedParse } from '@/features/parsers/cache'
import { toParserId } from '@/features/parsers'
import { useGraphStore } from '@/hooks/useGraphStore'
import { deriveFilenameFromUrl } from '@/lib/url'
import { ensureBuiltInParsersRegistered } from '@/features/parsers/ensure'
import type { GraphData, GraphNode, GraphEdge, JSONValue } from '@/lib/graph/types'
import { fetchRemoteText } from '@/lib/net/fetchRemoteText'
import { containsFrontmatterMermaid, isMarkdownLikeFileName, normalizeMermaidMmdToMarkdown } from 'grph-shared/markdown/mermaidInput'
import {
  type DbConnectorKind,
  type RelationalConnectorConfig,
  type RelationalResult,
  type Neo4jResult,
  buildRelationalGraph,
  buildNeo4jGraph,
} from '@/lib/graph/db'
import { pipelinePerfEnd, pipelinePerfMeasureAsync, pipelinePerfMeasureSync, pipelinePerfStart } from '@/lib/pipelinePerf'
import { seedMissingNodePositions } from '@/components/GraphCanvas/layout/initialization'

export type LoaderResult = {
  parserId?: string
  name?: string
  graphData?: GraphData
  counts?: { n: number; e: number }
  warnings?: string[]
  input?: { name: string; text: string }
}

function applyLayoutInitialization(graphData: GraphData) {
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  if (nodes.length < 2) return

  let missing = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i] as unknown as { x?: unknown; y?: unknown }
    const x = n.x
    const y = n.y
    const ok = typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)
    if (!ok) missing += 1
    if (missing >= 2) break
  }
  if (missing === 0) return

  const width = 1200
  const height = 900
  seedMissingNodePositions(nodes, width, height, { x: width / 2, y: height / 2 })
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
    pipelinePerfMeasureSync({
      name: 'import',
      stage: 'layout:init',
      run: () => applyLayoutInitialization(normalized.graphData!)
    })
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
    graphData: fetched.data,
    counts: { n: fetched.data.nodes.length, e: fetched.data.edges.length },
    warnings: fetched.warnings,
    input: text ? { name: fetched.name, text } : undefined,
  }
}

export async function loadGraphDataFromTextViaParser(
  name: string,
  text: string,
  options?: { applyToStore?: boolean; onProgress?: (stage: string) => void },
): Promise<LoaderResult | null> {
  const tAll = pipelinePerfStart()
  ensureBuiltInParsersRegistered()
  const normalizedText = normalizeMermaidMmdToMarkdown(name, text)
  try {
    options?.onProgress?.('Selecting parser')
  } catch {
    void 0
  }
  const bm = pipelinePerfMeasureSync({
    name: 'import',
    stage: 'parser:select',
    run: () => bestMatch({ name, text: normalizedText })
  })
  if (!bm) return { input: { name, text }, warnings: ['No matching parser found'], counts: { n: 0, e: 0 } }
  const parserId = toParserId(bm.id)
  const cached = getCachedParse(parserId, name, normalizedText)
  if (cached) {
    try {
      options?.onProgress?.('Using cached parse')
    } catch {
      void 0
    }
  } else {
    try {
      options?.onProgress?.(`Parsing (${bm.id})`)
    } catch {
      void 0
    }
  }
  const res = cached || await pipelinePerfMeasureAsync({
    name: 'import',
    stage: 'parser:apply',
    detail: { parserId: bm.id, name, textChars: normalizedText.length },
    run: () => applyParserAsync(parserId, { name, text: normalizedText }),
  })
  if (!res) return { parserId: bm.id, name, input: { name, text: normalizedText }, warnings: ["Parser returned no result"], counts: { n: 0, e: 0 } }

  pipelinePerfMeasureSync({
    name: 'import',
    stage: 'layout:init',
    run: () => applyLayoutInitialization(res.graphData)
  })

  if (!cached) setCachedParse(parserId, name, normalizedText, res)
  let { graphData } = res
  const maybeEmpty = !((graphData.nodes?.length || 0) > 0) && !((graphData.edges?.length || 0) > 0)
  const lower = String(name || '').trim().toLowerCase()
  if (maybeEmpty && bm.id !== 'markdown' && (lower.endsWith('.md') || lower.endsWith('.markdown')) && containsFrontmatterMermaid(normalizedText)) {
    try {
      options?.onProgress?.('Fallback: markdown parser')
    } catch {
      void 0
    }
    const markdownParserId = toParserId('markdown')
    const fallbackCached = getCachedParse(markdownParserId, name, normalizedText)
    const fallback = fallbackCached || await applyParserAsync(markdownParserId, { name, text: normalizedText })
    if (fallback?.graphData) {
      if (!fallbackCached) setCachedParse(markdownParserId, name, normalizedText, fallback)
      graphData = fallback.graphData

      pipelinePerfMeasureSync({
        name: 'import',
        stage: 'layout:init',
        run: () => applyLayoutInitialization(graphData)
      })

      if (options?.applyToStore !== false) {
        try {
          options?.onProgress?.('Applying graph')
        } catch {
          void 0
        }
        try {
          useGraphStore.getState().setGraphData(graphData)
        } catch {
          void 0
        }
      }
      return {
        parserId: 'markdown',
        name,
        graphData,
        counts: { n: graphData.nodes.length, e: graphData.edges.length },
        warnings: [...(fallback.warnings || []), `Parser fallback: ${bm.id} yielded empty graph; used markdown parser instead.`],
        input: { name, text: normalizedText },
      }
    }
  }
  if (options?.applyToStore !== false) {
    try {
      options?.onProgress?.('Applying graph')
    } catch {
      void 0
    }
    try {
      useGraphStore.getState().setGraphData(graphData)
    } catch {
      void 0
    }
  }
  try {
    options?.onProgress?.('Done')
  } catch {
    void 0
  }
  pipelinePerfEnd({
    name: 'import',
    stage: 'loader:all',
    t0: tAll,
    detail: {
      parserId: bm.id,
      nodes: (graphData.nodes || []).length,
      edges: (graphData.edges || []).length,
      usedCache: !!cached,
    },
  })
  return {
    parserId: bm.id,
    name,
    graphData,
    counts: { n: graphData.nodes.length, e: graphData.edges.length },
    warnings: res.warnings || [],
    input: { name, text: normalizedText },
  }
}

export async function autoApplyFrontmatterMermaidMarkdownToGraphIfEmpty(args?: {
  name?: string | null
  text?: string | null
}): Promise<boolean> {
  const store = useGraphStore.getState()
  if ((store.documentSemanticMode || 'document') !== 'document') return false

  const name = String(args?.name ?? store.markdownDocumentName ?? 'document.md')
  const text = String(args?.text ?? store.markdownDocumentText ?? '')
  if (!text.trim()) return false
  if (!isMarkdownLikeFileName(name)) return false

  const base = store.graphData as unknown as { nodes?: unknown[]; edges?: unknown[] } | null
  const n = base && Array.isArray(base.nodes) ? base.nodes.length : 0
  const e = base && Array.isArray(base.edges) ? base.edges.length : 0
  if (n > 0 || e > 0) return false

  const lower = name.toLowerCase()
  const resolvedName = lower.endsWith('.md') || lower.endsWith('.markdown') ? name : `${name}.md`
  const res = await loadGraphDataFromTextViaParser(resolvedName, text, { applyToStore: true })
  return !!(res?.graphData && (res.graphData.nodes.length > 0 || res.graphData.edges.length > 0))
}
