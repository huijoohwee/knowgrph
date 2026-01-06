import { TokenLinker } from './TokenLinker'
import { EdgeElevator } from './EdgeElevator'
import { ThresholdTuner } from './ThresholdTuner'
import { DocumentUnifier } from './DocumentUnifier'
import { FeedbackOrchestrator } from './FeedbackOrchestrator'
import { CorpusReasoner } from './CorpusReasoner'
import { AgenticQueryEngine } from './AgenticQueryEngine'
import { AgenticRagConfig, DEFAULT_AGENTIC_RAG_CONFIG, PipelineResult } from './types'

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
  const finalConfig = { ...DEFAULT_AGENTIC_RAG_CONFIG, ...config }
  const pipeline = new AgenticRagPipeline(finalConfig)
  return pipeline.run([text])
}
