import { EntitySpan, ExtractedEdge, PipelineResult } from './types'

export class DocumentUnifier {
  unify(results: PipelineResult[]): PipelineResult {
    const mergedEntities: Map<string, EntitySpan> = new Map()
    const mergedEdges: ExtractedEdge[] = []

    // 1. Merge entities by normalized text while preserving the highest confidence.
    for (const res of results) {
      for (const entity of res.entities) {
        const key = entity.text.toLowerCase()
        if (mergedEntities.has(key)) {
          const existing = mergedEntities.get(key)!
          const newConfidence = Math.max(existing.confidence, entity.confidence)

          mergedEntities.set(key, {
            ...existing,
            confidence: newConfidence,
          })
        } else {
          mergedEntities.set(key, entity)
        }
      }
    }

    // 2. Remap Edges
    const textToFinalId = new Map<string, string>()
    const finalEntities = Array.from(mergedEntities.values())
    finalEntities.forEach(e => textToFinalId.set(e.text.toLowerCase(), e.id))

    for (const res of results) {
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

    // 3. Cross-Document Inference
    // Identify entities mentioned in multiple docs (implicitly handled by merging)
    // If we tracked doc IDs, we could create edges between docs.
    // For now, the merged graph represents the unified view.

    return {
      entities: finalEntities,
      edges: mergedEdges,
      metrics: {
        entityDensity: finalEntities.length / 100, // Placeholder
      }
    }
  }
}
