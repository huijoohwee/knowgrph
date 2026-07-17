import React from 'react'
import type { GraphData } from '@/lib/graph/types'
import { bumpStoryboardWidgetDraftGraphDataRevision } from '@/lib/storyboardWidget/storyboardWidgetDraftGraphData'
import { persistStoryboardCardMediaGraphSource, type StoryboardCardMediaGraphPersistenceOptions } from './storyboardCardMediaGraphSource'

export function useStoryboardCardMediaGraphCommit(args: {
  baseRevision: number
  draftRevision: number
  draftGraphDataRef: React.MutableRefObject<GraphData | null>
  setDraftGraphData: (graphData: GraphData) => void
  setGraphDataPreservingLayout: (graphData: GraphData) => void
  upsertUiToast: (toast: { id: string; kind: 'error'; message: string; ttlMs: number }) => void
}) {
  const publish = React.useCallback((graphData: GraphData): GraphData => {
    const nextDraft = bumpStoryboardWidgetDraftGraphDataRevision(graphData, { revisionFloor: Math.max(args.draftRevision, args.baseRevision) })
    args.draftGraphDataRef.current = nextDraft
    args.setDraftGraphData(nextDraft)
    args.setGraphDataPreservingLayout(nextDraft)
    return nextDraft
  }, [args.baseRevision, args.draftGraphDataRef, args.draftRevision, args.setDraftGraphData, args.setGraphDataPreservingLayout])
  const commit = React.useCallback(async (graphData: GraphData, options?: StoryboardCardMediaGraphPersistenceOptions) => {
    const persisted = await persistStoryboardCardMediaGraphSource(publish(graphData), options)
    if (!persisted) throw new Error('The active Canvas source did not accept the published graph.')
  }, [publish])
  const commitForSurface = React.useCallback((graphData: GraphData) => {
    void commit(graphData).catch(error => {
      const detail = error && typeof error === 'object' && 'message' in error ? String((error as { message?: unknown }).message || '').trim() : ''
      args.upsertUiToast({ id: 'storyboard-card-media-persistence-failed', kind: 'error', message: detail || 'Canvas changes could not be persisted to the workspace.', ttlMs: 5200 })
    })
  }, [args.upsertUiToast, commit])
  return { publishStoryboardCardMediaGraph: publish, commitStoryboardCardMediaGraph: commit, commitStoryboardCardMediaGraphForSurface: commitForSurface }
}
