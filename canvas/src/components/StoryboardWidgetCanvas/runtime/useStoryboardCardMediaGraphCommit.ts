import React from 'react'
import type { GraphData } from '@/lib/graph/types'
import { bumpStoryboardWidgetDraftGraphDataRevision } from '@/lib/storyboardWidget/storyboardWidgetDraftGraphData'
import { persistStoryboardCardMediaGraphSource } from './storyboardCardMediaGraphSource'

export function useStoryboardCardMediaGraphCommit(args: {
  baseRevision: number
  draftRevision: number
  draftGraphDataRef: React.MutableRefObject<GraphData | null>
  setDraftGraphData: (graphData: GraphData) => void
  setGraphDataPreservingLayout: (graphData: GraphData) => void
  upsertUiToast: (toast: { id: string; kind: 'error'; message: string; ttlMs: number }) => void
}) {
  const commit = React.useCallback(async (graphData: GraphData) => {
    const nextDraft = bumpStoryboardWidgetDraftGraphDataRevision(graphData, { revisionFloor: Math.max(args.draftRevision, args.baseRevision) })
    args.draftGraphDataRef.current = nextDraft
    args.setDraftGraphData(nextDraft)
    args.setGraphDataPreservingLayout(nextDraft)
    await persistStoryboardCardMediaGraphSource(nextDraft)
  }, [args.baseRevision, args.draftGraphDataRef, args.draftRevision, args.setDraftGraphData, args.setGraphDataPreservingLayout])
  const commitForSurface = React.useCallback((graphData: GraphData) => {
    void commit(graphData).catch(error => {
      const detail = error && typeof error === 'object' && 'message' in error ? String((error as { message?: unknown }).message || '').trim() : ''
      args.upsertUiToast({ id: 'storyboard-card-media-persistence-failed', kind: 'error', message: detail || 'Canvas changes could not be persisted to the workspace.', ttlMs: 5200 })
    })
  }, [args.upsertUiToast, commit])
  return { commitStoryboardCardMediaGraph: commit, commitStoryboardCardMediaGraphForSurface: commitForSurface }
}
