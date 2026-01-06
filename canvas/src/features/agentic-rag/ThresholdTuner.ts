import { AgenticRagConfig, EntitySpan } from './types'

export class ThresholdTuner {
  private config: AgenticRagConfig

  constructor(config: AgenticRagConfig) {
    this.config = config
  }

  tune(config: AgenticRagConfig, entities: EntitySpan[], textLength: number, text: string = ''): AgenticRagConfig {
    if (!config.auto_tune_enabled) return config

    const newConfig = { ...config }
    
    // Entity Density: entities per 100 chars (roughly)
    const density = (entities.length / Math.max(1, textLength)) * 100
    
    // Rule: IF density > 15 THEN increase phrase_boundary_threshold
    // (Adjusted scale since chars != tokens)
    if (density > 5) { // Arbitrary threshold for demo
       newConfig.phrase_boundary_threshold = Math.min(0.95, config.phrase_boundary_threshold + config.tuning_sensitivity)
    } else if (density < 1) {
       newConfig.phrase_boundary_threshold = Math.max(0.5, config.phrase_boundary_threshold - config.tuning_sensitivity)
    }

    // Syntactic Complexity (Simulated)
    // Heuristic: Average sentence length (by period count)
    // complex_syntax_needs_tighter_constraints_for_precision
    if (text) {
      const sentenceCount = (text.match(/[.!?]/g) || []).length
      const avgSentenceLength = sentenceCount > 0 ? textLength / sentenceCount : 0
      
      // If sentences are very long (> 150 chars), assume complexity
      if (avgSentenceLength > 150) {
        // Decrease max_syntactic_path_length
        newConfig.max_syntactic_path_length = Math.max(2, config.max_syntactic_path_length - 1)
      } else if (avgSentenceLength < 50) {
        // Increase max_syntactic_path_length
        newConfig.max_syntactic_path_length = Math.min(8, config.max_syntactic_path_length + 1)
      }
    }
    
    return newConfig
  }
}
