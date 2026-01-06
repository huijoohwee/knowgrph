import { AgenticRagConfig, EntitySpan } from './types'

export class ThresholdTuner {
  private config: AgenticRagConfig

  constructor(config: AgenticRagConfig) {
    this.config = config
  }

  tune(config: AgenticRagConfig, entities: EntitySpan[], textLength: number): AgenticRagConfig {
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
    
    return newConfig
  }
}
