import React from 'react'
import type { GraphData } from '@/lib/graph/types'
import { bumpStoryboardWidgetDraftGraphDataRevision } from '@/lib/storyboardWidget/storyboardWidgetDraftGraphData'
import { persistStoryboardCardMediaGraphSource, type StoryboardCardMediaGraphPersistenceOptions } from './storyboardCardMediaGraphSource'
import type { StoryboardCardMediaGraphSourceOwner } from './storyboardCardMediaGraphSourceOwner'

export function useStoryboardCardMediaGraphCommit({
  baseRevision,
  draftRevision,
  draftGraphDataRef,
  setDraftGraphData,
  setGraphDataPreservingLayout,
  sourceOwner,
  upsertUiToast,
}: {
  baseRevision: number
  draftRevision: number
  draftGraphDataRef: React.MutableRefObject<GraphData | null>
  setDraftGraphData: (graphData: GraphData) => void
  setGraphDataPreservingLayout: (graphData: GraphData) => void
  sourceOwner?: StoryboardCardMediaGraphSourceOwner
  upsertUiToast: (toast: { id: string; kind: 'error'; message: string; ttlMs: number }) => void
}) {
  const publish = React.useCallback((graphData: GraphData): GraphData => {
    const nextDraft = bumpStoryboardWidgetDraftGraphDataRevision(graphData, { revisionFloor: Math.max(draftRevision, baseRevision) })
    draftGraphDataRef.current = nextDraft
    setDraftGraphData(nextDraft)
    setGraphDataPreservingLayout(nextDraft)
    return nextDraft
  }, [baseRevision, draftGraphDataRef, draftRevision, setDraftGraphData, setGraphDataPreservingLayout])
  const persistPublished = React.useCallback(async (graphData: GraphData, options?: StoryboardCardMediaGraphPersistenceOptions) => {
    const persisted = await persistStoryboardCardMediaGraphSource(graphData, {
      ...options,
      sourceOwner: options?.sourceOwner || sourceOwner,
    })
    if (!persisted) throw new Error('The originating Canvas source is not a publishable graph document.')
  }, [sourceOwner])
  const commit = React.useCallback(async (graphData: GraphData, options?: StoryboardCardMediaGraphPersistenceOptions) => {
    await persistPublished(publish(graphData), options)
  }, [persistPublished, publish])
  const reportSurfacePersistenceFailure = React.useCallback((error: unknown) => {
    const detail = error && typeof error === 'object' && 'message' in error ? String((error as { message?: unknown }).message || '').trim() : ''
    upsertUiToast({ id: 'storyboard-card-media-persistence-failed', kind: 'error', message: detail || 'Canvas changes could not be persisted to the workspace.', ttlMs: 5200 })
  }, [upsertUiToast])
  const commitForSurface = React.useCallback((graphData: GraphData) => {
    void commit(graphData).catch(reportSurfacePersistenceFailure)
  }, [commit, reportSurfacePersistenceFailure])
  const persistPublishedForSurface = React.useCallback((graphData: GraphData) => {
    void persistPublished(graphData).catch(reportSurfacePersistenceFailure)
  }, [persistPublished, reportSurfacePersistenceFailure])
  return {
    publishStoryboardCardMediaGraph: publish,
    commitStoryboardCardMediaGraph: commit,
    commitStoryboardCardMediaGraphForSurface: commitForSurface,
    persistPublishedStoryboardCardMediaGraphForSurface: persistPublishedForSurface,
  }
}
