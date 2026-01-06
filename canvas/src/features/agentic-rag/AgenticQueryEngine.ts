import { PipelineResult } from './types'

export class AgenticQueryEngine {
  private graph: PipelineResult

  constructor(graph: PipelineResult) {
    this.graph = graph
  }

  query(userQuery: string): string {
    // 1. Intent Classification
    const intent = this.classifyIntent(userQuery)
    
    // 2. Entity Extraction from Query
    const focusEntities = this.extractFocusEntities(userQuery)
    
    if (focusEntities.length === 0) {
      return "I couldn't identify any specific entities to search for in the knowledge graph."
    }

    // 3. Traversal
    const context = this.traverse(focusEntities, intent)
    
    // 4. Synthesis (Simulated)
    return this.synthesizeAnswer(userQuery, context)
  }

  private classifyIntent(query: string): 'summary' | 'detail' | 'connection' {
    if (query.includes('how') || query.includes('relationship') || query.includes('connect')) return 'connection'
    if (query.includes('summarize') || query.includes('overview')) return 'summary'
    return 'detail'
  }

  private extractFocusEntities(query: string): string[] {
    // Simple heuristic: match known entities in the graph
    const knownNames = this.graph.entities.map(e => e.text.toLowerCase())
    const found: string[] = []
    
    knownNames.forEach(name => {
      if (query.toLowerCase().includes(name)) {
        found.push(name)
      }
    })
    
    return found
  }

  private traverse(focusNames: string[], intent: 'summary' | 'detail' | 'connection'): string[] {
    const results: string[] = []
    const visited = new Set<string>()
    
    // Find IDs
    const startNodes = this.graph.entities.filter(e => focusNames.includes(e.text.toLowerCase()))
    
    startNodes.forEach(node => {
      results.push(`**${node.text}** (Confidence: ${node.confidence.toFixed(2)})`)
      visited.add(node.id)
      
      // 1-hop neighbors
      const edges = this.graph.edges.filter(e => e.sourceId === node.id || e.targetId === node.id)
      
      edges.forEach(edge => {
        const otherId = edge.sourceId === node.id ? edge.targetId : edge.sourceId
        const otherNode = this.graph.entities.find(e => e.id === otherId)
        
        if (otherNode) {
          results.push(`- ${edge.relation} -> ${otherNode.text}`)
          
          if (intent === 'connection' || intent === 'detail') {
             // 2-hop (simplified)
             // ... logic for deeper traversal
          }
        }
      })
    })
    
    return results
  }

  private synthesizeAnswer(query: string, context: string[]): string {
    return `Based on the graph, here is what I found regarding "${query}":\n\n${context.join('\n')}`
  }
}
