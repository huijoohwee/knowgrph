import { TokenLinker } from './TokenLinker'
import { EdgeElevator } from './EdgeElevator'
import { ThresholdTuner } from './ThresholdTuner'
import { DocumentUnifier } from './DocumentUnifier'
import { AgenticRagConfig, DEFAULT_AGENTIC_RAG_CONFIG, PipelineResult } from './types'

export * from './types'

export class AgenticRagPipeline {
  private config: AgenticRagConfig
  private linker: TokenLinker
  private elevator: EdgeElevator
  private tuner: ThresholdTuner
  private unifier: DocumentUnifier

  constructor(config: AgenticRagConfig = DEFAULT_AGENTIC_RAG_CONFIG) {
    this.config = config
    this.linker = new TokenLinker(config)
    this.elevator = new EdgeElevator(config)
    this.tuner = new ThresholdTuner(config)
    this.unifier = new DocumentUnifier()
  }

  run(documents: string[]): PipelineResult {
    const results: PipelineResult[] = []

    for (const docText of documents) {
      // 1. Token Linking
      const entities = this.linker.process(docText)
      
      // 2. Threshold Tuning (Feedback Loop Simulation)
      // In a real loop, we would re-run linking with new config
      const tunedConfig = this.tuner.tune(this.config, entities, docText.length)
      // Update components with new config if needed (simplified here)
      
      // 3. Edge Elevation
      const edges = this.elevator.process(entities, docText)
      
      results.push({
        entities,
        edges,
        metrics: {}
      })
    }

    // 4. Document Unification
    return this.unifier.unify(results)
  }
}

export const runAgenticPipeline = (text: string, config?: Partial<AgenticRagConfig>): PipelineResult => {
  const finalConfig = { ...DEFAULT_AGENTIC_RAG_CONFIG, ...config }
  const pipeline = new AgenticRagPipeline(finalConfig)
  return pipeline.run([text])
}
