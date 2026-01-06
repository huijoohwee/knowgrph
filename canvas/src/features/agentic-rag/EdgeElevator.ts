import { AgenticRagConfig, EntitySpan, ExtractedEdge } from './types'

export class EdgeElevator {
  private config: AgenticRagConfig

  constructor(config: AgenticRagConfig) {
    this.config = config
  }

  process(entities: EntitySpan[], text: string): ExtractedEdge[] {
    void text
    const edges: ExtractedEdge[] = []
    
    // Simple heuristic: Connect adjacent entities if they are separated by a "verb-like" word
    // In a real system, this uses dependency parsing
    
    for (let i = 0; i < entities.length - 1; i++) {
      const source = entities[i]
      
      // Look ahead for targets within a certain distance (simulating max_syntactic_path_length)
      for (let j = i + 1; j < Math.min(entities.length, i + 4); j++) {
        const target = entities[j]
        
        // Check distance (very rough approximation using index difference)
        const distance = target.startIndex - source.endIndex
        if (distance > this.config.max_syntactic_path_length * 5) continue // *5 to account for token/char diff
        
        // Extract text between entities to find relation
        // This requires access to original text indices which we approximated
        const relationContext = this.extractContext()
        const relation = this.inferRelation(relationContext)
        
        const properties = this.extractProperties(relationContext)
        const confidence = this.calculateConfidence(distance, relation, properties)
        
        if (confidence >= this.config.edge_confidence_threshold) {
          edges.push({
            sourceId: source.id,
            targetId: target.id,
            relation,
            confidence,
            properties: {
              ...properties,
              sourceSentence: `${source.text} ${relationContext} ${target.text}`
            }
          })
        }
      }
    }
    
    return edges
  }

  private extractContext(): string {
    return 'related to'
  }

  private inferRelation(context: string): string {
    // Placeholder: In reality, extract the verb phrase between source and target
    if (context.includes('leads to')) return 'leads_to'
    if (context.includes('caused by')) return 'caused_by'
    return 'related_to'
  }

  private extractProperties(context: string): Partial<{
    temporal: string
    modality: string
    negation: boolean
    causality: 'high'
  }> {
    const props: Partial<{
      temporal: string
      modality: string
      negation: boolean
      causality: 'high'
    }> = {}
    
    // Temporal
    if (/\b(before|after|during|while|then)\b/i.test(context)) {
      props.temporal = context.match(/\b(before|after|during|while|then)\b/i)![0]
    }
    
    // Modality
    if (/\b(may|must|should|could|might)\b/i.test(context)) {
      props.modality = context.match(/\b(may|must|should|could|might)\b/i)![0]
    }
    
    // Negation
    if (/\b(not|never|no)\b/i.test(context)) {
      props.negation = true
    }
    
    // Causality
    if (/\b(causes|leads to|results in|because)\b/i.test(context)) {
      props.causality = 'high'
    }

    return props
  }

  private calculateConfidence(
    distance: number,
    _relation: string,
    properties: Partial<{ temporal: string; modality: string; negation: boolean; causality: 'high' }>,
  ): number {
    let score = 1.0 - (distance * 0.01) // Decay with distance
    
    // Apply temporal_marker_boost
    if (properties.temporal) {
      score += this.config.temporal_marker_boost
    }
    
    // Boost for explicit causality
    if (properties.causality) {
      score += 0.1
    }

    return Math.max(0, Math.min(1, score))
  }
}
