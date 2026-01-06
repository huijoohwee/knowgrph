import { AgenticRagConfig, EntitySpan, ExtractedEdge, Token } from './types'

export class EdgeElevator {
  private config: AgenticRagConfig

  constructor(config: AgenticRagConfig) {
    this.config = config
  }

  process(entities: EntitySpan[], text: string): ExtractedEdge[] {
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
        const relation = this.inferRelation(source, target)
        
        const confidence = this.calculateConfidence(distance, relation)
        
        if (confidence >= this.config.edge_confidence_threshold) {
          edges.push({
            sourceId: source.id,
            targetId: target.id,
            relation,
            confidence,
            properties: {
              sourceSentence: `${source.text} ${relation} ${target.text}`
            }
          })
        }
      }
    }
    
    return edges
  }

  private inferRelation(source: EntitySpan, target: EntitySpan): string {
    // Placeholder: In reality, extract the verb phrase between source and target
    return 'related_to'
  }

  private calculateConfidence(distance: number, relation: string): number {
    let score = 1.0 - (distance * 0.01) // Decay with distance
    
    // Apply temporal_marker_boost
    if (['before', 'after', 'during'].includes(relation)) {
      score += this.config.temporal_marker_boost
    }
    
    return Math.max(0, Math.min(1, score))
  }
}
