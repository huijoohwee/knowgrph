import { pickTextFileWithExtensions } from '@/lib/graph/file'
import { bestMatch, applyParserAsync, getParserRegistryRevision } from '@/features/parsers/registry'
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

export type LoaderResult = {
  parserId?: string
  name?: string
  graphData?: GraphData
  counts?: { n: number; e: number }
  warnings?: string[]
  input?: { name: string; text: string }
}

type LoadGraphDataFromTextOptions = {
  applyToStore?: boolean
  syncMarkdownDocument?: boolean
  onProgress?: (stage: string) => void
}

const notifyLoaderProgress = (options: LoadGraphDataFromTextOptions | undefined, stage: string): void => {
  try {
    options?.onProgress?.(stage)
  } catch {
    void 0
  }
}

const finalizeLoaderResult = (args: {
  t0: number | null
  parserId?: string
  sourceName: string
  sourceText: string
  result: LoaderResult
  usedCache?: boolean
  fallbackFromParserId?: string
  outcome: 'ok' | 'no-match' | 'empty-result' | 'fallback' | 'empty-graph'
}): LoaderResult => {
  const graphData = args.result.graphData
  pipelinePerfEnd({
    name: 'import',
    stage: 'loader:all',
    t0: args.t0,
    detail: {
      parserId: args.parserId || '',
      sourceName: args.sourceName,
      textChars: args.sourceText.length,
      nodes: graphData?.nodes?.length || 0,
      edges: graphData?.edges?.length || 0,
      usedCache: args.usedCache === true,
      fallbackFromParserId: args.fallbackFromParserId || '',
      outcome: args.outcome,
    },
  })
  return args.result
}

export async function loadGraphDataViaParser(): Promise<LoaderResult | null> {
  const f = await pickTextFileWithExtensions(['.csv', '.json', '.jsonld', '.md', '.markdown', '.mmd'])
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
    graphData: fetched.data,
    counts: { n: fetched.data.nodes.length, e: fetched.data.edges.length },
    warnings: fetched.warnings,
    input: text ? { name: fetched.name, text } : undefined,
  }
}

export async function loadGraphDataFromTextViaParser(
  name: string,
  text: string,
  options?: LoadGraphDataFromTextOptions,
): Promise<LoaderResult | null> {
  const tAll = pipelinePerfStart()
  ensureBuiltInParsersRegistered()
  const normalizedText = normalizeMermaidMmdToMarkdown(name, text)

  if (
    options?.applyToStore !== false &&
    options?.syncMarkdownDocument !== false &&
    isMarkdownLikeFileName(String(name || ''))
  ) {
    try {
      void useGraphStore.getState().setActiveMarkdownDocument({ name, text: normalizedText, normalizeMermaidMmd: false })
    } catch {
      void 0
    }
  }
  notifyLoaderProgress(options, 'Selecting parser')
  const bm = pipelinePerfMeasureSync({
    name: 'import',
    stage: 'parser:select',
    run: () => bestMatch({ name, text: normalizedText })
  })
  if (!bm) {
    return finalizeLoaderResult({
      t0: tAll,
      sourceName: name,
      sourceText: normalizedText,
      result: { input: { name, text }, warnings: ['No matching parser found'], counts: { n: 0, e: 0 } },
      outcome: 'no-match',
    })
  }
  const parserId = toParserId(bm.id)
  const cfgKey = `reg:${getParserRegistryRevision()}`
  const cached = getCachedParse(parserId, name, normalizedText, cfgKey)
  if (cached) {
    notifyLoaderProgress(options, 'Using cached parse')
  } else {
    notifyLoaderProgress(options, `Parsing (${bm.id})`)
  }
  const res = cached || await pipelinePerfMeasureAsync({
    name: 'import',
    stage: 'parser:apply',
    detail: { parserId: bm.id, name, textChars: normalizedText.length },
    run: () => applyParserAsync(parserId, { name, text: normalizedText }),
  })
  if (!res) {
    return finalizeLoaderResult({
      t0: tAll,
      parserId: bm.id,
      sourceName: name,
      sourceText: normalizedText,
      result: { parserId: bm.id, name, input: { name, text: normalizedText }, warnings: ["Parser returned no result"], counts: { n: 0, e: 0 } },
      usedCache: !!cached,
      outcome: 'empty-result',
    })
  }

  if (!cached) setCachedParse(parserId, name, normalizedText, res, cfgKey)
  let { graphData } = res
  const maybeEmpty = !((graphData.nodes?.length || 0) > 0) && !((graphData.edges?.length || 0) > 0)
  const lower = String(name || '').trim().toLowerCase()
  if (maybeEmpty && bm.id !== 'markdown' && (lower.endsWith('.md') || lower.endsWith('.markdown'))) {
    notifyLoaderProgress(options, 'Fallback: markdown parser')
    const markdownParserId = toParserId('markdown')
    const fallbackCached = getCachedParse(markdownParserId, name, normalizedText, cfgKey)
    const fallback = fallbackCached || await pipelinePerfMeasureAsync({
      name: 'import',
      stage: 'parser:fallback:markdown',
      detail: { parserId: bm.id, fallbackParserId: 'markdown', name, textChars: normalizedText.length },
      run: () => applyParserAsync(markdownParserId, { name, text: normalizedText }),
    })
    if (fallback?.graphData) {
      if (!fallbackCached) setCachedParse(markdownParserId, name, normalizedText, fallback, cfgKey)
      graphData = fallback.graphData

      if (options?.applyToStore !== false) {
        notifyLoaderProgress(options, 'Applying graph')
        try {
          useGraphStore.getState().setGraphData(graphData)
        } catch {
          void 0
        }
      }
      notifyLoaderProgress(options, 'Done')
      return finalizeLoaderResult({
        t0: tAll,
        parserId: 'markdown',
        sourceName: name,
        sourceText: normalizedText,
        result: {
          parserId: 'markdown',
          name,
          graphData,
          counts: { n: graphData.nodes.length, e: graphData.edges.length },
          warnings: [
            ...(fallback.warnings || []),
            `Parser fallback: ${bm.id} yielded empty graph; used markdown parser instead.`,
          ],
          input: { name, text: normalizedText },
        },
        usedCache: !!fallbackCached,
        fallbackFromParserId: bm.id,
        outcome: 'fallback',
      })
    }
  }
  if (options?.applyToStore !== false) {
    notifyLoaderProgress(options, 'Applying graph')
    try {
      useGraphStore.getState().setGraphData(graphData)
    } catch {
      void 0
    }
  }
  notifyLoaderProgress(options, 'Done')
  return finalizeLoaderResult({
    t0: tAll,
    parserId: bm.id,
    sourceName: name,
    sourceText: normalizedText,
    result: {
      parserId: bm.id,
      name,
      graphData,
      counts: { n: graphData.nodes.length, e: graphData.edges.length },
      warnings: res.warnings || [],
      input: { name, text: normalizedText },
    },
    usedCache: !!cached,
    outcome: maybeEmpty ? 'empty-graph' : 'ok',
  })
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
