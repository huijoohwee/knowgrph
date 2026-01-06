import { EntitySpan, ExtractedEdge, PipelineResult } from './types'

export class DocumentUnifier {
  unify(results: PipelineResult[]): PipelineResult {
    const mergedEntities: Map<string, EntitySpan> = new Map()
    const mergedEdges: ExtractedEdge[] = []
    
    // 1. Merge Entities
    for (const res of results) {
      for (const entity of res.entities) {
        const key = entity.text.toLowerCase()
        if (mergedEntities.has(key)) {
          // Merge logic: Average confidence, extend provenance
          const existing = mergedEntities.get(key)!
          // Simple keep-highest-confidence for now
          if (entity.confidence > existing.confidence) {
             mergedEntities.set(key, entity)
          }
        } else {
          mergedEntities.set(key, entity)
        }
      }
    }
    
    // 2. Remap Edges
    const entityIdMap = new Map<string, string>() // Old ID -> New ID (based on text)
    // Actually, in the loop above we didn't track old IDs.
    // Let's refine: We need to map the original ephemeral IDs to the unified ID.
    
    // Re-run for mapping
    const finalEntities = Array.from(mergedEntities.values())
    const textToFinalId = new Map<string, string>()
    finalEntities.forEach(e => textToFinalId.set(e.text.toLowerCase(), e.id))
    
    for (const res of results) {
      // Create a local map for this result's entities
      const localIdToText = new Map<string, string>()
      res.entities.forEach(e => localIdToText.set(e.id, e.text.toLowerCase()))
      
      for (const edge of res.edges) {
        const sourceText = localIdToText.get(edge.sourceId)
        const targetText = localIdToText.get(edge.targetId)
        
        if (sourceText && targetText) {
          const finalSourceId = textToFinalId.get(sourceText)
          const finalTargetId = textToFinalId.get(targetText)
          
          if (finalSourceId && finalTargetId) {
             mergedEdges.push({
               ...edge,
               sourceId: finalSourceId,
               targetId: finalTargetId
             })
          }
        }
      }
    }
    
    return {
      entities: finalEntities,
      edges: mergedEdges,
      metrics: {}
    }
  }
}
