import { TokenLinker } from './TokenLinker'
import { EdgeElevator } from './EdgeElevator'
import { ThresholdTuner } from './ThresholdTuner'
import { DocumentUnifier } from './DocumentUnifier'
import { FeedbackOrchestrator } from './FeedbackOrchestrator'
import { CorpusReasoner } from './CorpusReasoner'
import { AgenticQueryEngine } from './AgenticQueryEngine'
import { AgenticRagConfig, DEFAULT_AGENTIC_RAG_CONFIG, PipelineResult } from './types'

const readAgenticRagConfigFromEnv = (): Partial<AgenticRagConfig> => {
  if (typeof import.meta === 'undefined') return {}
  const meta = import.meta as unknown as { env?: Record<string, unknown> }
  const env = meta.env
  const raw = env && env.VITE_AGENTIC_RAG_CONFIG_JSON
  if (typeof raw !== 'string') return {}
  const trimmed = raw.trim()
  if (!trimmed) return {}
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    const result: Partial<AgenticRagConfig> = {}
    const resultAny = result as Record<string, unknown>
    const keys: Array<keyof AgenticRagConfig> = [
      'phrase_boundary_threshold',
      'max_entity_span_tokens',
      'coreference_distance_limit',
      'edge_confidence_threshold',
      'max_syntactic_path_length',
      'temporal_marker_boost',
      'auto_tune_enabled',
      'tuning_sensitivity',
      'feedback_window_size',
    ]
    for (const key of keys) {
      const value = parsed[key as string]
      const defaultValue = DEFAULT_AGENTIC_RAG_CONFIG[key]
      if (typeof defaultValue === 'number') {
        if (typeof value === 'number') {
          resultAny[key as string] = value
        }
      } else if (typeof defaultValue === 'boolean') {
        if (typeof value === 'boolean') {
          resultAny[key as string] = value
        }
      }
    }
    return result
  } catch {
    return {}
  }
}

const buildAgenticRagConfig = (overrides?: Partial<AgenticRagConfig>): AgenticRagConfig => ({
  ...DEFAULT_AGENTIC_RAG_CONFIG,
  ...readAgenticRagConfigFromEnv(),
  ...(overrides || {}),
})

export * from './types'
export * from './TokenLinker'
export * from './EdgeElevator'
export * from './ThresholdTuner'
export * from './DocumentUnifier'
export * from './FeedbackOrchestrator'
export * from './CorpusReasoner'
export * from './AgenticQueryEngine'

export class AgenticRagPipeline {
  private config: AgenticRagConfig
  private linker: TokenLinker
  private elevator: EdgeElevator
  private tuner: ThresholdTuner
  private unifier: DocumentUnifier
  private feedback: FeedbackOrchestrator
  private reasoner: CorpusReasoner

  constructor(config: AgenticRagConfig = DEFAULT_AGENTIC_RAG_CONFIG) {
    this.config = config
    this.linker = new TokenLinker(config)
    this.elevator = new EdgeElevator(config)
    this.tuner = new ThresholdTuner(config)
    this.unifier = new DocumentUnifier()
    this.feedback = new FeedbackOrchestrator(config)
    this.reasoner = new CorpusReasoner()
  }

  run(documents: string[]): PipelineResult {
    const results: PipelineResult[] = []

    for (const docText of documents) {
      // 1. Token Linking
      const entities = this.linker.process(docText)
      
      // 2. Threshold Tuning
      // Adjust config based on current doc characteristics
      const tunedConfig = this.tuner.tune(this.config, entities, docText.length, docText)
      
      // Re-initialize elevator with tuned config for this doc (simulated dynamic update)
      const localElevator = new EdgeElevator(tunedConfig)
      
      // 3. Edge Elevation
      const edges = localElevator.process(entities, docText)
      
      const result: PipelineResult = {
        entities,
        edges,
        metrics: {
          entityDensity: (entities.length / docText.length) * 100
        }
      }
      
      results.push(result)
      
      // 4. Feedback Loop
      // Adjust global config for next documents based on this result
      this.config = this.feedback.process(result)
      // Update persistent components with new global config
      this.linker = new TokenLinker(this.config)
      this.elevator = new EdgeElevator(this.config)
      this.tuner = new ThresholdTuner(this.config)
    }

    // 5. Document Unification
    const unified = this.unifier.unify(results)
    
    // 6. Corpus Reasoning
    const reasoned = this.reasoner.process(unified)
    
    return reasoned
  }
  
  createQueryEngine(graph: PipelineResult): AgenticQueryEngine {
    return new AgenticQueryEngine(graph)
  }
}

export const runAgenticPipeline = (text: string, config?: Partial<AgenticRagConfig>): PipelineResult => {
  const finalConfig = buildAgenticRagConfig(config)
  const pipeline = new AgenticRagPipeline(finalConfig)
  return pipeline.run([text])
}
