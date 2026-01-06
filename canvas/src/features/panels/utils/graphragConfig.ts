import yaml from 'js-yaml'

import type { GraphData, JsonLdGraphMappingConfig } from '@/lib/graph/types'
import {
  buildAgenticRagIgnoreFiltersFromRawPatterns,
  getAgenticRagIgnoreFiltersSummary,
} from '@/lib/graph/jsonld/index'

type RagTraversalRuleRelationConstraint = {
  '@type': 'rag:TraversalRule'
  ruleType: 'relation-constraint'
  allowedRelations: string[]
  rulePriority?: number
}

type RagContextWindow = {
  '@type': 'rag:ContextWindow'
  contextSize: number
  contextStrategy: string
}

type RagChunkingConfig = {
  '@type': 'rag:ChunkingConfig'
  method?: string
  chunkSize?: number
}

type RagEmbeddingModel = {
  '@type': 'rag:EmbeddingModel'
  provider?: string
  modelName?: string
}

type RagDatasetConfig = {
  inputDir?: string
  outputDir?: string
  ignoreCodebasePaths?: string[]
  ignoreCodebasePathsResolved?: string[]
}

export type DuckDbQueryConfig = {
  id: string
  label: string
  description?: string
  sql: string
  suggestedStartNodeId?: string
}

export type GraphRagWorkflowJsonLd = {
  '@context': {
    rag: string
  }
  '@type': 'rag:GraphRAGWorkflow'
  '@id': string
  graphId: string
  name: string
  retrievalMethod: 'graph-traversal'
  maxHops: number
  traversalRules: RagTraversalRuleRelationConstraint[]
  contextWindow: RagContextWindow
  dataset?: RagDatasetConfig
  chunking?: RagChunkingConfig
  embeddingModel?: RagEmbeddingModel
  duckdbQueries?: DuckDbQueryConfig[]
}

export function parseGraphragCliConfigYamlToJsonLd(
  yamlText: string,
  graphId: string | null | undefined,
): GraphRagWorkflowJsonLd | null {
  const trimmed = yamlText.trim()
  if (!trimmed) return null
  let parsed: unknown
  try {
    parsed = yaml.load(trimmed) as unknown
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null
  }

  const root = parsed as Record<string, unknown>
  const dataset = root.dataset
  const chunking = root.chunking
  const embeddings = root.embeddings
  const duckdbQueriesRaw = root.duckdb_queries

  const safeGraphId = typeof graphId === 'string' && graphId.trim() ? graphId : 'graph'
  const doc: GraphRagWorkflowJsonLd = {
    '@context': {
      rag: 'http://example.org/rag#',
    },
    '@type': 'rag:GraphRAGWorkflow',
    '@id': `example:graphrag-config-${safeGraphId}`,
    graphId: safeGraphId,
    name: 'GraphRAG Workflow',
    retrievalMethod: 'graph-traversal',
    maxHops: 3,
    traversalRules: [],
    contextWindow: {
      '@type': 'rag:ContextWindow',
      contextSize: 8192,
      contextStrategy: 'ranked-by-relevance',
    },
  }

  if (dataset && typeof dataset === 'object' && !Array.isArray(dataset)) {
  const ds = dataset as Record<string, unknown>
  const inputDir = typeof ds.input_dir === 'string' ? ds.input_dir : null
  const outputDir = typeof ds.output_dir === 'string' ? ds.output_dir : null
  const datasetConfig: RagDatasetConfig = {}
  if (inputDir) datasetConfig.inputDir = inputDir
  if (outputDir) datasetConfig.outputDir = outputDir
  if (Object.keys(datasetConfig).length > 0) {
    doc.dataset = datasetConfig
  }
  }

  if (chunking && typeof chunking === 'object' && !Array.isArray(chunking)) {
    const ch = chunking as Record<string, unknown>
    const method = typeof ch.method === 'string' ? ch.method : null
    const sizeValue = ch.chunk_size
    const size =
      typeof sizeValue === 'number' && Number.isFinite(sizeValue)
        ? Math.floor(sizeValue)
        : null
    const chunkingConfig: RagChunkingConfig = {
      '@type': 'rag:ChunkingConfig',
    }
    if (method) chunkingConfig.method = method
    if (size !== null) chunkingConfig.chunkSize = size
    if (Object.keys(chunkingConfig).length > 1) {
      doc.chunking = chunkingConfig
    }
  }

  if (embeddings && typeof embeddings === 'object' && !Array.isArray(embeddings)) {
    const em = embeddings as Record<string, unknown>
    const provider = typeof em.provider === 'string' ? em.provider : null
    const model = typeof em.model === 'string' ? em.model : null
    const embeddingConfig: RagEmbeddingModel = {
      '@type': 'rag:EmbeddingModel',
    }
    if (provider) embeddingConfig.provider = provider
    if (model) embeddingConfig.modelName = model
    if (Object.keys(embeddingConfig).length > 1) {
      doc.embeddingModel = embeddingConfig
    }
  }

  if (Array.isArray(duckdbQueriesRaw)) {
    const list: DuckDbQueryConfig[] = []
    duckdbQueriesRaw.forEach((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return
      const item = entry as Record<string, unknown>
      const idRaw = item.id
      const labelRaw = item.label
      const sqlRaw = item.sql
      if (typeof idRaw !== 'string' || !idRaw.trim()) return
      if (typeof labelRaw !== 'string' || !labelRaw.trim()) return
      if (typeof sqlRaw !== 'string' || !sqlRaw.trim()) return
      const descriptionRaw = item.description
      const suggestedStartNodeIdRaw = item.suggested_start_node_id
      const config: DuckDbQueryConfig = {
        id: idRaw,
        label: labelRaw,
        sql: sqlRaw,
      }
      if (typeof descriptionRaw === 'string' && descriptionRaw.trim()) {
        config.description = descriptionRaw
      }
      if (typeof suggestedStartNodeIdRaw === 'string' && suggestedStartNodeIdRaw.trim()) {
        config.suggestedStartNodeId = suggestedStartNodeIdRaw
      }
      list.push(config)
    })
    if (list.length > 0) {
      doc.duckdbQueries = list
    }
  }

  const agenticRag = root.agentic_rag
  if (agenticRag && typeof agenticRag === 'object' && !Array.isArray(agenticRag)) {
    const ar = agenticRag as Record<string, unknown>
    const traversalEdgesRaw = ar.traversal_edges
    if (Array.isArray(traversalEdgesRaw)) {
      const allowedRelations = traversalEdgesRaw
        .map(item => (typeof item === 'string' ? item.trim() : ''))
        .filter(item => item.length > 0)
      if (allowedRelations.length > 0) {
        doc.traversalRules = [
          ...doc.traversalRules,
          {
            '@type': 'rag:TraversalRule',
            ruleType: 'relation-constraint',
            allowedRelations,
          },
        ]
      }
    }
    const rawList = ar.ignore_codebase_paths
    if (Array.isArray(rawList)) {
      const rawPatternsInput = rawList
        .map(item => (typeof item === 'string' ? item.trim() : ''))
        .filter(item => item.length > 0)
      if (rawPatternsInput.length > 0) {
        const filters = buildAgenticRagIgnoreFiltersFromRawPatterns(rawPatternsInput)
        const datasetConfig: RagDatasetConfig = {
          ...(doc.dataset || {}),
        }
        if (filters.rawPatterns.length > 0) {
          datasetConfig.ignoreCodebasePaths = filters.rawPatterns
        }
        if (filters.resolvedPatterns.length > 0) {
          datasetConfig.ignoreCodebasePathsResolved = filters.resolvedPatterns
        }
        if (Object.keys(datasetConfig).length > 0) {
          doc.dataset = datasetConfig
        }
      }
    }
  }

  return doc
}

export function buildGraphRagWorkflowFromGraphData(
  graphId: string | null | undefined,
  graphData: GraphData | null | undefined,
): GraphRagWorkflowJsonLd {
  const safeGraphId = typeof graphId === 'string' && graphId.trim() ? graphId : 'graph'
  const safeGraphData: GraphData | null =
      graphData && Array.isArray(graphData.nodes) && Array.isArray(graphData.edges)
      ? graphData
      : null

  let datasetConfig: RagDatasetConfig | undefined
  if (safeGraphData) {
    const ignoreSummary = getAgenticRagIgnoreFiltersSummary(safeGraphData)
    if (
      ignoreSummary &&
      (ignoreSummary.rawPatterns.length > 0 || ignoreSummary.resolvedPatterns.length > 0)
    ) {
      datasetConfig = {
        ...(datasetConfig || {}),
        ignoreCodebasePaths: ignoreSummary.rawPatterns,
        ignoreCodebasePathsResolved: ignoreSummary.resolvedPatterns,
      }
    }
  }

  const traversalRules: RagTraversalRuleRelationConstraint[] = []
  if (safeGraphData && safeGraphData.edges.length > 0) {
    let selectedFromMeta: string[] | null = null
    const metaRaw = safeGraphData.metadata as unknown
    if (metaRaw && typeof metaRaw === 'object' && !Array.isArray(metaRaw)) {
      const meta = metaRaw as Record<string, unknown>
      const cfgRaw = meta.jsonLdMapping as unknown
      if (cfgRaw && typeof cfgRaw === 'object' && !Array.isArray(cfgRaw)) {
        const cfg = cfgRaw as JsonLdGraphMappingConfig
        const listRaw = (cfg as unknown as Record<string, unknown>).contextEdgeProperties as unknown
        if (Array.isArray(listRaw)) {
          const list = listRaw
            .map(item => (typeof item === 'string' ? item.trim() : ''))
            .filter(label => label.length > 0)
          if (list.length > 0) {
            selectedFromMeta = list
          }
        }
      }
    }

    const allLabels = new Set<string>()
    safeGraphData.edges.forEach((e) => {
      const label = typeof e.label === 'string' ? e.label : ''
      if (label.trim()) allLabels.add(label.trim())
    })

    let allowedRelations: string[] = []
    if (selectedFromMeta && selectedFromMeta.length > 0) {
      allowedRelations = Array.from(allLabels).filter(label => selectedFromMeta!.includes(label))
      if (allowedRelations.length === 0) {
        allowedRelations = Array.from(allLabels)
      }
    } else {
      allowedRelations = Array.from(allLabels)
    }

    if (allowedRelations.length > 0) {
      traversalRules.push({
        '@type': 'rag:TraversalRule',
        ruleType: 'relation-constraint',
        allowedRelations,
        rulePriority: 1,
      })
    }
  }

  const doc: GraphRagWorkflowJsonLd = {
    '@context': {
      rag: 'http://example.org/rag#',
    },
    '@type': 'rag:GraphRAGWorkflow',
    '@id': `example:graphrag-config-${safeGraphId}`,
    graphId: safeGraphId,
    name: 'GraphRAG Workflow',
    retrievalMethod: 'graph-traversal',
    maxHops: 3,
    traversalRules,
    contextWindow: {
      '@type': 'rag:ContextWindow',
      contextSize: 8192,
      contextStrategy: 'ranked-by-relevance',
    },
  }

  if (datasetConfig) {
    doc.dataset = datasetConfig
  }

  return doc
}
