import React from 'react'

import type { UiToastInput } from '@/hooks/store/types'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { UI_COPY } from '@/lib/config'
import { readGraphDataRevision } from '@/lib/graph/documentMetadata'
import { exportWidgetBundleAsJson } from '@/lib/graph/file'
import type { WidgetRegistryEntry } from '@/features/storyboard-widget-manager/widgetRegistryTypes'
import { WORKFLOW_RESET_ALL_EVENT } from '@/features/canvas/utils'
import { clearRichMediaOutputProperties } from '@/features/chat/richMediaRun'
import { useStoryboardWidgetWorkflowRunAll } from '@/components/StoryboardWidgetCanvas/runtime/useStoryboardWidgetWorkflowRunAll'
import { createStoryboardWidgetWorkflowNodeRunner } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowRunAction'
import { areStoryboardWidgetWorkflowRecordValuesEqual } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowWriteback'
import { bumpStoryboardWidgetDraftGraphDataRevision } from '@/lib/storyboardWidget/storyboardWidgetDraftGraphData'

export function useStoryboardWidgetWorkflowActions(args: {
  storyboardWidgetViewActive: boolean
  baseGraphKind: string
  baseGraphData: GraphData | null
  draftGraphData: GraphData | null
  draftGraphDataRef: React.MutableRefObject<GraphData | null>
  renderGraphDataOverride: GraphData | null
  markdownDocumentName: string | null
  markdownDocumentSourceUrl: string | null
  widgetRegistry: WidgetRegistryEntry[]
  appendDraftNode: (args: { id?: string | null; type: string; label?: string | null; x: number; y: number; properties?: Record<string, unknown> }) => string
  setDraftGraphData: React.Dispatch<React.SetStateAction<GraphData | null>>
  commitPublishedGraphData?: (graphData: GraphData) => void
  persistDraftGraphData: (graphData: GraphData) => void | Promise<void>
  updateNode: (id: string, patch: Partial<GraphNode>) => void
  upsertUiToast: (args: UiToastInput) => void
  scheduleOverlayEdgeUpdate: () => void
}) {
  const runWorkflowNode = React.useMemo(() => createStoryboardWidgetWorkflowNodeRunner({
    baseGraphKind: args.baseGraphKind,
    baseGraphData: args.baseGraphData,
    readDraftGraphData: () => (args.draftGraphDataRef.current || args.draftGraphData) as GraphData | null,
    commitDraftGraphDataUpdate: (currentDraft, nextDraft) => {
      args.draftGraphDataRef.current = nextDraft
      args.setDraftGraphData(prev => (prev === currentDraft ? nextDraft : args.draftGraphDataRef.current))
    },
    commitPublishedGraphData: args.commitPublishedGraphData,
    persistDraftGraphData: args.persistDraftGraphData,
    renderGraphDataOverride: args.renderGraphDataOverride,
    markdownDocumentName: args.markdownDocumentName,
    markdownDocumentSourceUrl: args.markdownDocumentSourceUrl,
    widgetRegistry: args.widgetRegistry,
    appendDraftNode: args.appendDraftNode,
    updateNode: args.updateNode,
    upsertUiToast: args.upsertUiToast,
    scheduleOverlayEdgeUpdate: args.scheduleOverlayEdgeUpdate,
  }), [args])

  useStoryboardWidgetWorkflowRunAll({
    storyboardWidgetViewActive: args.storyboardWidgetViewActive,
    draftGraphData: args.draftGraphData,
    draftGraphDataRef: args.draftGraphDataRef,
    setDraftGraphData: args.setDraftGraphData,
    upsertUiToast: args.upsertUiToast,
    runWorkflowNode,
    scheduleOutputEdgeRefresh: args.scheduleOverlayEdgeUpdate,
  })

  const resetWorkflowOutputs = React.useCallback(() => {
    if (!args.storyboardWidgetViewActive) {
      args.upsertUiToast({ id: 'storyboard-widget-reset-all-not-active', kind: 'neutral', message: 'Open Storyboard Widget to reset workflow outputs.', ttlMs: 2200 })
      return
    }
    const draft = (args.draftGraphDataRef.current || args.draftGraphData) as GraphData | null
    const nodes = Array.isArray(draft?.nodes) ? draft!.nodes : []
    if (!draft || nodes.length === 0) {
      args.upsertUiToast({ id: 'storyboard-widget-reset-all-missing', kind: 'neutral', message: UI_COPY.storyboardWidgetNoDraftGraphToast, ttlMs: 2400 })
      return
    }
    let resetCount = 0
    const nextNodes = nodes.map(node => {
      const currentProps = (node.properties || {}) as Record<string, unknown>
      const nextProps = clearRichMediaOutputProperties(currentProps)
      if (areStoryboardWidgetWorkflowRecordValuesEqual(currentProps, nextProps)) return node
      resetCount += 1
      return { ...node, properties: nextProps as never }
    })
    if (resetCount === 0) {
      args.upsertUiToast({ id: 'storyboard-widget-reset-all-empty', kind: 'neutral', message: 'No stale workflow outputs to reset.', ttlMs: 2200 })
      return
    }
    const nextDraft = bumpStoryboardWidgetDraftGraphDataRevision({ ...draft, nodes: nextNodes })
    args.draftGraphDataRef.current = nextDraft
    args.setDraftGraphData(prev => (prev === draft ? nextDraft : args.draftGraphDataRef.current))
    args.scheduleOverlayEdgeUpdate()
    args.upsertUiToast({ id: 'storyboard-widget-reset-all-done', kind: 'neutral', message: `Reset ${resetCount} workflow node${resetCount === 1 ? '' : 's'}.`, ttlMs: 2200 })
  }, [args])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => resetWorkflowOutputs()
    window.addEventListener(WORKFLOW_RESET_ALL_EVENT, handler as EventListener)
    return () => window.removeEventListener(WORKFLOW_RESET_ALL_EVENT, handler as EventListener)
  }, [resetWorkflowOutputs])

  const exportWorkflowBundle = React.useCallback(async () => {
    try {
      const draft = (args.draftGraphDataRef.current || args.draftGraphData) as GraphData | null
      if (!draft) {
        args.upsertUiToast({ id: 'storyboard-widget-export-bundle', kind: 'neutral', message: UI_COPY.storyboardWidgetNoDraftGraphToast, ttlMs: 2400 })
        return
      }
      await exportWidgetBundleAsJson({
        graphData: draft,
        registryEntries: args.widgetRegistry,
        suggestedName: 'flow-workflow.widget.bundle.json',
        graphRevision: readGraphDataRevision(draft),
      })
      args.upsertUiToast({ id: 'storyboard-widget-export-bundle', kind: 'neutral', message: UI_COPY.storyboardWidgetRunExportedToast, ttlMs: 2200 })
    } catch {
      args.upsertUiToast({ id: 'storyboard-widget-export-bundle-failed', kind: 'neutral', message: UI_COPY.storyboardWidgetRunFailedToast, ttlMs: 2600 })
    }
  }, [args])

  return { exportWorkflowBundle, runWorkflowNode }
}
