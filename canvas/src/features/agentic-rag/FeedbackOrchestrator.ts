import { AgenticRagConfig, PipelineResult } from './types'

export class FeedbackOrchestrator {
  private config: AgenticRagConfig
  private history: PipelineResult[] = []

  constructor(config: AgenticRagConfig) {
    this.config = config
  }

  process(result: PipelineResult): AgenticRagConfig {
    if (!this.config.auto_tune_enabled) return this.config

    this.history.push(result)
    if (this.history.length > this.config.feedback_window_size) {
      this.history.shift()
    }

    return this.adjustConfig()
  }

  private adjustConfig(): AgenticRagConfig {
    const newConfig = { ...this.config }
    
    // Compute aggregated metrics
    let totalConfidence = 0
    let totalDensity = 0
    
    this.history.forEach(res => {
      res.entities.forEach(e => totalConfidence += e.confidence)
      totalDensity += res.metrics.entityDensity || 0
    })
    
    const avgConfidence = totalConfidence / Math.max(1, this.history.reduce((acc, res) => acc + res.entities.length, 0))
    const avgDensity = totalDensity / this.history.length

    // Feedback Logic
    // IF edge_confidence_mean < 0.6 THEN signal_elevator_to_adjust_extraction_rules (lower threshold)
    if (avgConfidence < 0.6) {
       // Decrease threshold to allow more edges/entities (recall boost)
       newConfig.edge_confidence_threshold = Math.max(0.4, this.config.edge_confidence_threshold - 0.05)
    } else if (avgConfidence > 0.9) {
       // Increase threshold (precision boost)
       newConfig.edge_confidence_threshold = Math.min(0.9, this.config.edge_confidence_threshold + 0.05)
    }

    // IF entity_coherence_variance (proxy via density) is high/low
    if (avgDensity > 15) {
       // Too dense -> increase threshold
       newConfig.phrase_boundary_threshold = Math.min(0.95, this.config.phrase_boundary_threshold + 0.05)
    }

    return newConfig
  }
}
