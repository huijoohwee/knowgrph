import React from 'react'

import type { GraphData, GraphNode } from '@/lib/graph/types'
import { UI_COPY } from '@/lib/config'
import { readGraphDataRevision } from '@/lib/graph/documentMetadata'
import { exportWidgetBundleAsJson } from '@/lib/graph/file'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { useFlowEditorWorkflowRunAll } from '@/components/FlowEditorCanvas/runtime/useFlowEditorWorkflowRunAll'
import { createFlowEditorWorkflowNodeRunner } from '@/components/FlowEditorCanvas/runtime/flowEditorWorkflowRunAction'

export function useFlowEditorWorkflowActions(args: {
  flowEditorViewActive: boolean
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
  updateNode: (id: string, patch: Partial<GraphNode>) => void
  upsertUiToast: (args: { id: string; kind: 'neutral' | 'warning' | 'success' | 'error'; message: string; ttlMs?: number }) => void
  scheduleOverlayEdgeUpdate: () => void
}) {
  const runWorkflowNode = React.useMemo(() => createFlowEditorWorkflowNodeRunner({
    baseGraphKind: args.baseGraphKind,
    baseGraphData: args.baseGraphData,
    readDraftGraphData: () => (args.draftGraphDataRef.current || args.draftGraphData) as GraphData | null,
    commitDraftGraphDataUpdate: (currentDraft, nextDraft) => {
      args.draftGraphDataRef.current = nextDraft
      args.setDraftGraphData(prev => (prev === currentDraft ? nextDraft : args.draftGraphDataRef.current))
    },
    renderGraphDataOverride: args.renderGraphDataOverride,
    markdownDocumentName: args.markdownDocumentName,
    markdownDocumentSourceUrl: args.markdownDocumentSourceUrl,
    widgetRegistry: args.widgetRegistry,
    appendDraftNode: args.appendDraftNode,
    updateNode: args.updateNode,
    upsertUiToast: args.upsertUiToast,
    scheduleOverlayEdgeUpdate: args.scheduleOverlayEdgeUpdate,
  }), [args])

  useFlowEditorWorkflowRunAll({
    flowEditorViewActive: args.flowEditorViewActive,
    draftGraphData: args.draftGraphData,
    draftGraphDataRef: args.draftGraphDataRef,
    upsertUiToast: args.upsertUiToast,
    runWorkflowNode,
  })

  const exportWorkflowBundle = React.useCallback(async () => {
    try {
      const draft = (args.draftGraphDataRef.current || args.draftGraphData) as GraphData | null
      if (!draft) {
        args.upsertUiToast({ id: 'flow-editor-export-bundle', kind: 'neutral', message: UI_COPY.flowEditorNoDraftGraphToast, ttlMs: 2400 })
        return
      }
      await exportWidgetBundleAsJson({
        graphData: draft,
        registryEntries: args.widgetRegistry,
        suggestedName: 'flow-workflow.widget.bundle.json',
        graphRevision: readGraphDataRevision(draft),
      })
      args.upsertUiToast({ id: 'flow-editor-export-bundle', kind: 'neutral', message: UI_COPY.flowEditorRunExportedToast, ttlMs: 2200 })
    } catch {
      args.upsertUiToast({ id: 'flow-editor-export-bundle-failed', kind: 'neutral', message: UI_COPY.flowEditorRunFailedToast, ttlMs: 2600 })
    }
  }, [args])

  return { exportWorkflowBundle, runWorkflowNode }
}
