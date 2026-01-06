import { AgenticRagPipeline, DEFAULT_AGENTIC_RAG_CONFIG } from '@/features/agentic-rag'
import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { useParserUIState } from '@/features/parsers/uiState'
import { useGraphStore } from '@/hooks/useGraphStore'
import { openBottomPanel } from '@/features/bottom-panel/open'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { DEMO_HTML_CONTENT } from './data'
import { parseHtmlToMarkdown, extractJsonLd } from '@/features/parsers/html-parser'

export async function runAgenticRagDemo(
  setPipelineStatus: (status: string | null) => void
): Promise<void> {
  // 1. Ingest & Parse (Simulated scraping)
  const demoText = parseHtmlToMarkdown(DEMO_HTML_CONTENT)
  const jsonLd = extractJsonLd(DEMO_HTML_CONTENT)

  // 2. Load markdown into editor
  const res = await loadGraphDataFromTextViaParser('demo.md', demoText)
  
  if (res) {
     try {
      const ui = useParserUIState.getState()
      if (res.input) {
        ui.setLastInput(res.input.name, res.input.text)
      }
      ui.setDataLoadStatus(true, res.input?.name || 'Demo Loaded')
      
      const state = useGraphStore.getState()
      state.setMarkdownDocument('demo.md', demoText)
      state.setBottomPanelCurationView('markdown')
      openBottomPanel('curation')
     } catch (e) {
       console.error(e)
     }
  }

  // 3. Run Agentic RAG Pipeline
  try {
     setPipelineStatus("Running Agentic RAG...")
     // Small delay to let UI update
     await new Promise(resolve => setTimeout(resolve, 100))
     
     const pipeline = new AgenticRagPipeline(DEFAULT_AGENTIC_RAG_CONFIG)
     const result = pipeline.run([demoText])

     // 4. Convert result to GraphData
     const nodes: GraphNode[] = result.entities.map(e => ({
       id: e.id,
       label: e.text,
       type: 'concept',
       properties: {
         name: e.text,
         type: e.type,
         confidence: e.confidence,
         provenance: e.provenance
       },
       x: Math.random() * 800 - 400,
       y: Math.random() * 600 - 300
     }))

     const edges: GraphEdge[] = result.edges.map((e, idx) => ({
        id: `edge-${idx}`,
        source: e.sourceId,
        target: e.targetId,
        label: e.relation,
        properties: {
           confidence: e.confidence,
           ...e.properties
        }
     }))

     const graphData: GraphData = {
       type: 'application/vnd.knowgrph.graph+json',
       nodes,
       edges,
       metadata: {
          agenticRagMetrics: result.metrics,
          sourceJsonLd: jsonLd
       }
     }

     useGraphStore.getState().setGraphData(graphData)
     setPipelineStatus("Agentic RAG Complete")
     
     // Open graph view
     openBottomPanel('curation')
     
  } catch (err) {
     console.error("Demo failed", err)
     setPipelineStatus("Agentic RAG Failed")
  }
}
