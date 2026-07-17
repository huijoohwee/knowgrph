import { syncActiveMarkdownDocumentTextFromParsedGraph, writeActiveMarkdownDocumentTextIfPresent } from '@/hooks/store/graph-data-slice/graphDataFrontmatterFlowSync'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import {
  resolveStoryboardCardMediaGraphSourceOwner,
  shouldUpdateStoryboardCardMediaGraphActiveDocument,
  type StoryboardCardMediaGraphSourceOwner,
} from './storyboardCardMediaGraphSourceOwner'

export type StoryboardCardMediaGraphPersistenceOptions = {
  label?: string
  source?: 'sourceFiles' | 'gitGraph'
  sourceOwner?: StoryboardCardMediaGraphSourceOwner
}

export async function persistStoryboardCardMediaGraphSource(graphData: GraphData, options?: StoryboardCardMediaGraphPersistenceOptions): Promise<boolean> {
  const ownerResolution = resolveStoryboardCardMediaGraphSourceOwner({
    state: useGraphStore.getState(),
    sourceOwner: options?.sourceOwner,
  })
  const state = ownerResolution.state
  const sourceSync = syncActiveMarkdownDocumentTextFromParsedGraph({
    state,
    sourceFiles: state.sourceFiles || [],
    parsedGraphData: graphData,
  })
  if (!sourceSync.accepted) return false
  if (typeof sourceSync.markdownDocumentText !== 'string') return true
  const persistenceState = {
    ...state,
    sourceFiles: sourceSync.sourceFiles,
    markdownDocumentName: sourceSync.markdownDocumentName ?? state.markdownDocumentName,
    markdownDocumentText: sourceSync.markdownDocumentText,
  }
  useGraphStore.setState(current => {
    if (!shouldUpdateStoryboardCardMediaGraphActiveDocument({
      currentDocumentName: current.markdownDocumentName,
      ownerPath: ownerResolution.ownerPath,
    })) return { sourceFiles: sourceSync.sourceFiles }
    return {
      sourceFiles: sourceSync.sourceFiles,
      markdownDocumentName: sourceSync.markdownDocumentName ?? current.markdownDocumentName,
      markdownDocumentText: sourceSync.markdownDocumentText,
      markdownDocumentApplyViewPreset: false,
      markdownTokens: null,
      markdownTokensPath: null,
      markdownTokensKey: null,
      markdownTokensMeta: null,
      markdownTokensStartLineOffset: null,
    }
  })
  const persisted = await writeActiveMarkdownDocumentTextIfPresent({
    state: persistenceState,
    sourceFiles: sourceSync.sourceFiles,
    text: sourceSync.markdownDocumentText,
    label: options?.label || 'Storyboard media graph',
    source: options?.source,
  })
  if (!persisted) throw new Error('Unable to persist the generated Canvas document to the workspace.')
  return true
}
