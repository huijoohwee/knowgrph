import { extractTriplesHeuristic, type TextEntity } from '@/lib/graph/textAnalysis'
import { AgenticRagConfig, EntitySpan, ExtractedEdge } from './types'

export class EdgeElevator {
  private config: AgenticRagConfig

  constructor(config: AgenticRagConfig) {
    this.config = config
  }

  process(entities: EntitySpan[], text: string): ExtractedEdge[] {
    const textEntities: TextEntity[] = entities.map(e => ({
      text: e.text,
      label: e.type,
      start: e.startIndex,
      end: e.endIndex
    }))

    const triples = extractTriplesHeuristic(text, textEntities)
    const edges: ExtractedEdge[] = []

    for (const triple of triples) {
      const source = entities.find(e => e.text === triple.subject)
      const target = entities.find(e => e.text === triple.object)
      
      if (!source || !target) continue
      if (source.id === target.id) continue

      const confidence = triple.confidence
      
      if (confidence >= this.config.edge_confidence_threshold) {
        edges.push({
          sourceId: source.id,
          targetId: target.id,
          relation: triple.predicate,
          confidence,
          properties: {
            ...triple.properties,
            sourceSentence: text,
          }
        })
      }
    }
    
    return edges
  }
}
