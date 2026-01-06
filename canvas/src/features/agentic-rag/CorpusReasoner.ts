import { ExtractedEdge, PipelineResult } from './types'

export class CorpusReasoner {
  
  process(unifiedResult: PipelineResult): PipelineResult {
    const enrichedEdges = [...unifiedResult.edges]
    
    // 1. Frequent Pattern Mining
    // Find co-occurrences (edges that appear often - simplified to finding dominant edges in single graph)
    // In a real corpus, this aggregates across docs. Here we look at the unified graph.
    
    // 2. Corpus-Wide Influence Ranking (PageRank)
    const scores = this.computePageRank(unifiedResult)
    
    // Annotate entities with centrality scores
    const enrichedEntities = unifiedResult.entities.map(e => ({
      ...e,
      properties: {
        ...e.provenance, // Mix provenance into properties for now or extend type
        centrality: scores.get(e.id) || 0
      }
    }))

    // 3. Emergent Relationship Detection
    // Infer edges if they share neighbors (Triangle closure)
    const newEdges = this.inferEdges(unifiedResult.edges)
    enrichedEdges.push(...newEdges)

    return {
      ...unifiedResult,
      entities: enrichedEntities,
      edges: enrichedEdges
    }
  }

  private computePageRank(graph: PipelineResult): Map<string, number> {
    const scores = new Map<string, number>()
    const damping = 0.85
    const nodes = graph.entities.map(e => e.id)
    
    // Initialize
    nodes.forEach(id => scores.set(id, 1 / nodes.length))
    
    // Iteration (simplified 1 pass for MVP)
    const newScores = new Map<string, number>()
    nodes.forEach(nodeId => {
      let rank = (1 - damping)
      
      // Find incoming edges
      const incoming = graph.edges.filter(e => e.targetId === nodeId)
      
      incoming.forEach(edge => {
        const sourceId = edge.sourceId
        const sourceOutDegree = graph.edges.filter(e => e.sourceId === sourceId).length
        rank += damping * ((scores.get(sourceId) || 0) / sourceOutDegree)
      })
      
      newScores.set(nodeId, rank)
    })
    
    return newScores
  }

  private inferEdges(edges: ExtractedEdge[]): ExtractedEdge[] {
    const inferred: ExtractedEdge[] = []
    const adj = new Map<string, string[]>()
    
    // Build adj list
    edges.forEach(e => {
      if (!adj.has(e.sourceId)) adj.set(e.sourceId, [])
      adj.get(e.sourceId)!.push(e.targetId)
    })
    
    // Triangle closure: A->B, B->C => Infer A->C
    adj.forEach((neighbors, a) => {
      neighbors.forEach(b => {
        const cList = adj.get(b)
        if (cList) {
          cList.forEach(c => {
            if (a !== c && !neighbors.includes(c)) {
              // Check if edge already exists
              const exists = edges.some(e => e.sourceId === a && e.targetId === c)
              if (!exists) {
                inferred.push({
                  sourceId: a,
                  targetId: c,
                  relation: 'inferred_connection',
                  confidence: 0.5, // Lower confidence for inferred
                  properties: {
                    sourceSentence: 'Inferred by CorpusReasoner'
                  }
                })
              }
            }
          })
        }
      })
    })
    
    return inferred
  }
}
