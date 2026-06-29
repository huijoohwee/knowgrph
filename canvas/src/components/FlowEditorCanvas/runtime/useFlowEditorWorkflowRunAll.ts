import React from 'react'

import { WORKFLOW_RUN_ALL_EVENT } from '@/features/canvas/utils'
import { buildWorkspaceGraphMutationTransitionState } from '@/features/workspace-table/workspaceTableSsot'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { UiToastInput } from '@/hooks/store/types'
import { UI_COPY } from '@/lib/config'
import { readGraphDataRevision } from '@/lib/graph/documentMetadata'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { FLOW_RUN_ALL_PHASES } from '@/lib/flowEditor/runAllSequenceSsot'
import { getCachedFlowEditorWorkflowRunPlan } from '@/components/FlowEditorCanvas/runtime/flowEditorRenderGraph'

const waitForRunAllLayoutReleaseFrame = async (): Promise<void> => {
  if (typeof requestAnimationFrame !== 'function') return
  await new Promise<void>(resolve => requestAnimationFrame(() => {
    requestAnimationFrame(() => resolve())
  }))
}

export const setRunAllLayoutMutationLock = (active: boolean): void => {
  const state = useGraphStore.getState()
  if (!active) {
    useGraphStore.setState({ workspaceGraphMutationLayoutLockActive: false })
    return
  }
  useGraphStore.setState({
    workspaceGraphMutationLayoutLockActive: true,
    ...buildWorkspaceGraphMutationTransitionState({
      workspaceViewMode: state.workspaceViewMode,
      workspaceCanvasPaneOpen: state.workspaceCanvasPaneOpen,
      markdownWorkspaceIndexingInFlight: state.markdownWorkspaceIndexingInFlight,
      transitionSemanticKey: 'flow-editor-run-all:active',
    }),
  })
}

export function useFlowEditorWorkflowRunAll(args: {
  flowEditorViewActive: boolean
  draftGraphData: GraphData | null
  draftGraphDataRef: React.MutableRefObject<GraphData | null>
  upsertUiToast: (args: UiToastInput) => void
  runWorkflowNode: (nodeId: string, runOptions?: { allowCreateRichMediaPanel?: boolean; suppressLayoutMutation?: boolean; visitedNodeIds?: Set<string> }) => Promise<void>
  scheduleOutputEdgeRefresh: () => void
}) {
  const runWorkflowAllInFlightRef = React.useRef(false)
  const runWorkflowAllNodes = React.useCallback(async () => {
    const toastId = 'flow-editor-run-all'
    const upsertRunAllToast = (toast: Omit<UiToastInput, 'id'>) => {
      args.upsertUiToast({ id: toastId, ...toast })
    }
    if (!args.flowEditorViewActive) {
      args.upsertUiToast({ id: 'flow-editor-run-all-not-active', kind: 'neutral', message: 'Open Flow Editor to run all.', ttlMs: 2200 })
      return
    }
    if (runWorkflowAllInFlightRef.current) {
      upsertRunAllToast({
        kind: 'neutral',
        message: 'Run All is already running.',
        ttlMs: null,
        dismissible: false,
        busy: true,
        log: false,
      })
      return
    }
    runWorkflowAllInFlightRef.current = true
    setRunAllLayoutMutationLock(true)
    try {
      const draft = (args.draftGraphDataRef.current || args.draftGraphData) as GraphData | null
      const nodes = Array.isArray(draft?.nodes) ? (draft!.nodes as GraphNode[]) : []
      if (!draft || nodes.length === 0) {
        args.upsertUiToast({ id: 'flow-editor-run-all-missing', kind: 'neutral', message: UI_COPY.flowEditorNoDraftGraphToast, ttlMs: 2400 })
        return
      }
      const runPlan = getCachedFlowEditorWorkflowRunPlan({
        graphData: draft,
        graphRevision: readGraphDataRevision(draft),
        preferCurrentGraphDataRefs: true,
      })
      const ids = runPlan?.orderedNodeIds || []
      if (ids.length === 0) {
        args.upsertUiToast({ id: 'flow-editor-run-all-empty', kind: 'neutral', message: 'No runnable workflow nodes found.', ttlMs: 2400 })
        return
      }
      const phaseCounts = runPlan?.phaseCounts || { text: 0, imageFoundation: 0, imageScene: 0, annotation: 0, video: 0 }
      const phaseSummary = FLOW_RUN_ALL_PHASES.map(phase => `${phase.label}: ${phaseCounts[phase.id] || 0}`).join(' · ')
      upsertRunAllToast({
        kind: 'neutral',
        message: `Run All starting: 0/${ids.length} nodes. ${phaseSummary}`,
        ttlMs: null,
        dismissible: false,
        busy: true,
      })
      for (let index = 0; index < ids.length; index += 1) {
        const nodeId = ids[index]!
        const node = nodes.find(candidate => String(candidate.id || '') === nodeId)
        const label = String(node?.label || node?.type || nodeId).trim() || nodeId
        upsertRunAllToast({
          kind: 'neutral',
          message: `Run All running ${index + 1}/${ids.length}: ${label}`,
          ttlMs: null,
          dismissible: false,
          busy: true,
          log: false,
        })
        await args.runWorkflowNode(nodeId, { allowCreateRichMediaPanel: false, suppressLayoutMutation: true })
        upsertRunAllToast({
          kind: 'neutral',
          message: `Run All completed ${index + 1}/${ids.length}: ${label}`,
          ttlMs: null,
          dismissible: false,
          busy: true,
          log: false,
        })
        if (typeof requestAnimationFrame === 'function') await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      }
      args.scheduleOutputEdgeRefresh()
      upsertRunAllToast({
        kind: 'success',
        message: `Run All complete: ran ${ids.length} node${ids.length === 1 ? '' : 's'}.`,
        ttlMs: 2600,
        dismissible: true,
        busy: false,
      })
    } catch (error) {
      const detail = error && typeof error === 'object' && 'message' in error ? String((error as { message?: unknown }).message || '').trim() : ''
      upsertRunAllToast({
        kind: 'error',
        message: detail ? `Run All failed: ${detail}` : UI_COPY.flowEditorRunFailedToast,
        ttlMs: 4200,
        dismissible: true,
        busy: false,
      })
    } finally {
      await waitForRunAllLayoutReleaseFrame()
      setRunAllLayoutMutationLock(false)
      runWorkflowAllInFlightRef.current = false
    }
  }, [args])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => {
      void runWorkflowAllNodes()
    }
    window.addEventListener(WORKFLOW_RUN_ALL_EVENT, handler as EventListener)
    return () => window.removeEventListener(WORKFLOW_RUN_ALL_EVENT, handler as EventListener)
  }, [runWorkflowAllNodes])
}
