import React from 'react'

import type { UiToastInput } from '@/hooks/store/types'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { UI_COPY } from '@/lib/config'
import { readGraphDataRevision } from '@/lib/graph/documentMetadata'
import { exportWidgetBundleAsJson } from '@/lib/graph/file'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { WORKFLOW_RESET_ALL_EVENT } from '@/features/canvas/utils'
import { clearRichMediaOutputProperties } from '@/features/chat/richMediaRun'
import { useFlowEditorWorkflowRunAll } from '@/components/FlowEditorCanvas/runtime/useFlowEditorWorkflowRunAll'
import { createFlowEditorWorkflowNodeRunner } from '@/components/FlowEditorCanvas/runtime/flowEditorWorkflowRunAction'
import { areFlowEditorWorkflowRecordValuesEqual } from '@/components/FlowEditorCanvas/runtime/flowEditorWorkflowWriteback'
import { bumpFlowEditorDraftGraphDataRevision } from '@/lib/flowEditor/flowEditorDraftGraphData'

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
  upsertUiToast: (args: UiToastInput) => void
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
    scheduleOutputEdgeRefresh: args.scheduleOverlayEdgeUpdate,
  })

  const resetWorkflowOutputs = React.useCallback(() => {
    if (!args.flowEditorViewActive) {
      args.upsertUiToast({ id: 'flow-editor-reset-all-not-active', kind: 'neutral', message: 'Open Flow Editor to reset workflow outputs.', ttlMs: 2200 })
      return
    }
    const draft = (args.draftGraphDataRef.current || args.draftGraphData) as GraphData | null
    const nodes = Array.isArray(draft?.nodes) ? draft!.nodes : []
    if (!draft || nodes.length === 0) {
      args.upsertUiToast({ id: 'flow-editor-reset-all-missing', kind: 'neutral', message: UI_COPY.flowEditorNoDraftGraphToast, ttlMs: 2400 })
      return
    }
    let resetCount = 0
    const nextNodes = nodes.map(node => {
      const currentProps = (node.properties || {}) as Record<string, unknown>
      const nextProps = clearRichMediaOutputProperties(currentProps)
      if (areFlowEditorWorkflowRecordValuesEqual(currentProps, nextProps)) return node
      resetCount += 1
      return { ...node, properties: nextProps as never }
    })
    if (resetCount === 0) {
      args.upsertUiToast({ id: 'flow-editor-reset-all-empty', kind: 'neutral', message: 'No stale workflow outputs to reset.', ttlMs: 2200 })
      return
    }
    const nextDraft = bumpFlowEditorDraftGraphDataRevision({ ...draft, nodes: nextNodes })
    args.draftGraphDataRef.current = nextDraft
    args.setDraftGraphData(prev => (prev === draft ? nextDraft : args.draftGraphDataRef.current))
    args.scheduleOverlayEdgeUpdate()
    args.upsertUiToast({ id: 'flow-editor-reset-all-done', kind: 'neutral', message: `Reset ${resetCount} workflow node${resetCount === 1 ? '' : 's'}.`, ttlMs: 2200 })
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
