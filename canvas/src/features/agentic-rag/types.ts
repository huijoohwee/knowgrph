export interface AgenticRagConfig {
  phrase_boundary_threshold: number
  max_entity_span_tokens: number
  coreference_distance_limit: number
  edge_confidence_threshold: number
  max_syntactic_path_length: number
  temporal_marker_boost: number
  auto_tune_enabled: boolean
  tuning_sensitivity: number
  feedback_window_size: number
}

export const DEFAULT_AGENTIC_RAG_CONFIG: AgenticRagConfig = {
  phrase_boundary_threshold: 0.75,
  max_entity_span_tokens: 8,
  coreference_distance_limit: 5,
  edge_confidence_threshold: 0.65,
  max_syntactic_path_length: 4,
  temporal_marker_boost: 0.15,
  auto_tune_enabled: true,
  tuning_sensitivity: 0.1,
  feedback_window_size: 10,
}

export interface Token {
  text: string
  index: number
  line?: number
  col?: number
  pos?: string // Part of speech
  dep?: string // Dependency label
  head?: number // Dependency head index
}

export interface EntitySpan {
  id: string
  text: string
  startIndex: number
  endIndex: number
  type: string
  confidence: number
  provenance: {
    lineStart: number
    lineEnd: number
    sourceText: string
  }
  properties?: Record<string, unknown>
}

export interface ExtractedEdge {
  sourceId: string
  targetId: string
  relation: string
  confidence: number
  properties: {
    temporal?: string
    modality?: string
    negation?: boolean
    causality?: string
    sourceSentence?: string
  }
}

export interface PipelineResult {
  entities: EntitySpan[]
  edges: ExtractedEdge[]
  metrics: {
    precision?: number
    recall?: number
    entityDensity?: number
    syntacticComplexity?: number
  }
}
