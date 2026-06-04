import type {
  ResearchThesisCompileRequest,
  ResearchThesisCompileResult,
  ResearchThesisSourceInput,
} from './researchThesisContract'

export type ResearchCompilerSourceFileLike = {
  id?: string | null
  name?: string | null
  text?: string | null
  enabled?: boolean | null
  source?: { path?: unknown } | null
}

export type ResearchCompilerRequestModel = {
  request: ResearchThesisCompileRequest
  selectedSourceCount: number
  issues: string[]
}

export type ResearchCompilerResultSummary = {
  status: 'idle' | 'ready' | 'error'
  runId: string
  sourceCount: number
  claimCount: number
  evidenceCount: number
  candidateNodeCount: number
  candidateEdgeCount: number
  cacheHits: number
  activeGraphMutated: boolean
  error: string
}

const normalizeText = (value: unknown): string => String(value || '').replace(/\r\n/g, '\n').trim()

export const readResearchCompilerSourcePath = (file: ResearchCompilerSourceFileLike): string => {
  const sourcePath = normalizeText(file.source?.path)
  if (sourcePath) return sourcePath
  const name = normalizeText(file.name)
  if (name) return name
  return normalizeText(file.id)
}

export function buildResearchCompilerSourceInputs(args: {
  sourceFiles: readonly ResearchCompilerSourceFileLike[]
  selectedSourceIds?: ReadonlySet<string> | readonly string[] | null
}): ResearchThesisSourceInput[] {
  const hasExplicitSelection = args.selectedSourceIds !== undefined && args.selectedSourceIds !== null
  const selected = new Set(Array.from(args.selectedSourceIds || [], id => normalizeText(id)).filter(Boolean))
  return (args.sourceFiles || [])
    .filter(file => hasExplicitSelection ? selected.has(normalizeText(file.id)) : file.enabled !== false)
    .map(file => ({
      sourceId: normalizeText(file.id) || null,
      canonicalPath: readResearchCompilerSourcePath(file),
      text: String(file.text || ''),
    }))
    .filter(source => source.canonicalPath && source.text.trim())
}

export function buildResearchCompilerRequestModel(args: {
  thesisPrompt: string
  sourceFiles: readonly ResearchCompilerSourceFileLike[]
  selectedSourceIds?: ReadonlySet<string> | readonly string[] | null
  maxInputTokens: number
  maxOutputTokens: number
  allowAssumptionDraft?: boolean
}): ResearchCompilerRequestModel {
  const sources = buildResearchCompilerSourceInputs({
    sourceFiles: args.sourceFiles,
    selectedSourceIds: args.selectedSourceIds,
  })
  const issues: string[] = []
  const thesisPrompt = normalizeText(args.thesisPrompt)
  if (!thesisPrompt || thesisPrompt.length < 6) issues.push('thesisPrompt')
  if (sources.length < 1 && args.allowAssumptionDraft !== true) issues.push('sourceSelection')
  const maxInputTokens = Number.isFinite(Number(args.maxInputTokens)) ? Math.max(1, Math.floor(Number(args.maxInputTokens))) : 80_000
  const maxOutputTokens = Number.isFinite(Number(args.maxOutputTokens)) ? Math.max(1, Math.floor(Number(args.maxOutputTokens))) : 12_000
  return {
    request: {
      thesisPrompt,
      sources,
      allowAssumptionDraft: args.allowAssumptionDraft === true,
      budget: {
        maxInputTokens,
        maxOutputTokens,
      },
    },
    selectedSourceCount: sources.length,
    issues,
  }
}

export function summarizeResearchCompilerResult(result: ResearchThesisCompileResult | null): ResearchCompilerResultSummary {
  if (!result) {
    return {
      status: 'idle',
      runId: '',
      sourceCount: 0,
      claimCount: 0,
      evidenceCount: 0,
      candidateNodeCount: 0,
      candidateEdgeCount: 0,
      cacheHits: 0,
      activeGraphMutated: false,
      error: '',
    }
  }
  if (result.ok === false) {
    return {
      status: 'error',
      runId: result.cost_log.run_id,
      sourceCount: 0,
      claimCount: 0,
      evidenceCount: 0,
      candidateNodeCount: 0,
      candidateEdgeCount: 0,
      cacheHits: result.cost_log.cache_hits,
      activeGraphMutated: false,
      error: result.error.message,
    }
  }
  return {
    status: 'ready',
    runId: result.manifest.run_id,
    sourceCount: result.manifest.source_refs.length,
    claimCount: result.spec.claims.length,
    evidenceCount: result.spec.evidence.length,
    candidateNodeCount: result.candidate_delta.graph.nodes.length,
    candidateEdgeCount: result.candidate_delta.graph.edges.length,
    cacheHits: result.cost_log.cache_hits,
    activeGraphMutated: result.candidate_delta.active_graph_mutated,
    error: '',
  }
}
