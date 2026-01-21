import { ExtractedEdge, PipelineResult } from './types'
import { computePageRank } from '@/features/semantic-mode/graphAlgorithms'

export class CorpusReasoner {
  
  process(unifiedResult: PipelineResult): PipelineResult {
    const enrichedEdges = [...unifiedResult.edges]
    
    // 1. Frequent Pattern Mining
    // Find co-occurrences (edges that appear often - simplified to finding dominant edges in single graph)
    // In a real corpus, this aggregates across docs. Here we look at the unified graph.
    
    // 2. Corpus-Wide Influence Ranking (PageRank)
    const scores = (() => {
      const nodeIds = unifiedResult.entities.map(e => e.id).filter(Boolean)
      const neighbors = new Map<string, string[]>()
      for (let i = 0; i < unifiedResult.edges.length; i += 1) {
        const e = unifiedResult.edges[i]!
        const s = e.sourceId
        const t = e.targetId
        if (!s || !t || s === t) continue
        const arr = neighbors.get(s) || []
        arr.push(t)
        neighbors.set(s, arr)
      }
      return computePageRank({ nodeIds, neighbors, iterations: 20, damping: 0.85 })
    })()
    
    // Annotate entities with centrality scores
    const enrichedEntities = unifiedResult.entities.map(e => ({
      ...e,
      properties: {
        ...(e.properties || {}),
        centrality: scores.get(e.id) || 0,
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

  private inferEdges(edges: ExtractedEdge[]): ExtractedEdge[] {
    const inferred: ExtractedEdge[] = []
    const adj = new Map<string, string[]>()
    const existing = new Set<string>()
    
    // Build adj list
    edges.forEach(e => {
      if (!adj.has(e.sourceId)) adj.set(e.sourceId, [])
      adj.get(e.sourceId)!.push(e.targetId)
      existing.add(`${e.sourceId}|${e.targetId}`)
    })
    
    // Triangle closure: A->B, B->C => Infer A->C
    adj.forEach((neighbors, a) => {
      neighbors.forEach(b => {
        const cList = adj.get(b)
        if (cList) {
          cList.forEach(c => {
            if (a !== c && !neighbors.includes(c)) {
              if (!existing.has(`${a}|${c}`)) {
                inferred.push({
                  sourceId: a,
                  targetId: c,
                  relation: 'inferred_connection',
                  confidence: 0.5, // Lower confidence for inferred
                  properties: {
                    sourceSentence: 'Inferred by CorpusReasoner'
                  }
                })
                existing.add(`${a}|${c}`)
              }
            }
          })
        }
      })
    })
    
    return inferred
  }
}
