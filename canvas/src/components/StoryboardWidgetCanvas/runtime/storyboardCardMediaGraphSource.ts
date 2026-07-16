import { syncActiveMarkdownDocumentTextFromParsedGraph, writeActiveMarkdownDocumentTextIfPresent } from '@/hooks/store/graph-data-slice/graphDataFrontmatterFlowSync'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'

export async function persistStoryboardCardMediaGraphSource(graphData: GraphData): Promise<void> {
  const state = useGraphStore.getState()
  const sourceSync = syncActiveMarkdownDocumentTextFromParsedGraph({
    state,
    sourceFiles: state.sourceFiles || [],
    parsedGraphData: graphData,
  })
  if (typeof sourceSync.markdownDocumentText !== 'string') return
  useGraphStore.setState(current => ({
    sourceFiles: sourceSync.sourceFiles,
    markdownDocumentName: sourceSync.markdownDocumentName ?? current.markdownDocumentName,
    markdownDocumentText: sourceSync.markdownDocumentText,
    markdownDocumentApplyViewPreset: false,
    markdownTokens: null,
    markdownTokensPath: null,
    markdownTokensKey: null,
    markdownTokensMeta: null,
    markdownTokensStartLineOffset: null,
  }))
  const persisted = await writeActiveMarkdownDocumentTextIfPresent({
    state: useGraphStore.getState(),
    sourceFiles: sourceSync.sourceFiles,
    text: sourceSync.markdownDocumentText,
    label: 'Storyboard media graph',
  })
  if (!persisted) throw new Error('Unable to persist the generated Canvas document to the workspace.')
}
