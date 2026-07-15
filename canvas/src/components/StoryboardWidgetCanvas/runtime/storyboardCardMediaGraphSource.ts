import { syncActiveMarkdownDocumentTextFromParsedGraph, writeActiveMarkdownDocumentTextIfPresent } from '@/hooks/store/graph-data-slice/graphDataFrontmatterFlowSync'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'

export function persistStoryboardCardMediaGraphSource(graphData: GraphData): void {
  const state = useGraphStore.getState()
  const sourceSync = syncActiveMarkdownDocumentTextFromParsedGraph({
    state,
    sourceFiles: state.sourceFiles || [],
    parsedGraphData: graphData,
  })
  if (typeof sourceSync.markdownDocumentText !== 'string') return
  state.setSourceFiles(sourceSync.sourceFiles)
  state.setMarkdownDocument(
    sourceSync.markdownDocumentName ?? state.markdownDocumentName,
    sourceSync.markdownDocumentText,
    { applyViewPreset: false },
  )
  writeActiveMarkdownDocumentTextIfPresent({
    state: useGraphStore.getState(),
    sourceFiles: sourceSync.sourceFiles,
    text: sourceSync.markdownDocumentText,
    label: 'Storyboard media graph',
  })
}
