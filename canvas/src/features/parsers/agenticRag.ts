import { toParserId, type ParserSpec } from './types'
import type { GraphData, GraphNode, GraphEdge, JSONValue } from '@/lib/graph/types'
import { runAgenticPipeline } from '@/features/agentic-rag'

export const AGENTIC_RAG_PARSER_ID = toParserId('agentic-rag-pipeline')

export const agenticRagParser: ParserSpec = {
  id: AGENTIC_RAG_PARSER_ID,
  name: 'Agentic RAG Pipeline',
  
  match: (name: string, text: string) => {
    void name
    void text
    // Match any markdown file or text that looks like prose
    // We can be more specific if needed, e.g. check for frontmatter
    return true
  },

  parse: (name: string, text: string) => {
    void name
    // Synchronous wrapper (if pipeline was sync, but it is)
    const pipelineResult = runAgenticPipeline(text)
    
    const nodes: GraphNode[] = pipelineResult.entities.map(e => ({
      id: e.id,
      label: e.text,
      type: e.type,
      properties: {
        confidence: e.confidence,
        provenance: e.provenance
      },
      metadata: {
        agenticRag: true
      }
    }))

    const edges: GraphEdge[] = pipelineResult.edges.map((e, i) => ({
      id: `edge-${i}`,
      source: e.sourceId,
      target: e.targetId,
      label: e.relation,
      properties: {
        confidence: e.confidence,
        ...e.properties
      }
    }))

    const pipelineMetrics = Object.fromEntries(
      Object.entries(pipelineResult.metrics).filter(([, v]) => v !== undefined),
    ) as Record<string, JSONValue>

    const graphData: GraphData = {
      type: 'Graph',
      context: 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld',
      nodes,
      edges,
      metadata: {
        pipelineMetrics
      }
    }

    return {
      graphData,
      warnings: []
    }
  }
}
