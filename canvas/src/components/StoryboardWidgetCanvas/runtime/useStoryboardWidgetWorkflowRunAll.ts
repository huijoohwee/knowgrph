import React from 'react'

import { WORKFLOW_RUN_ALL_EVENT, type WorkflowRunAllEventDetail, type WorkflowRunAllStatus } from '@/features/canvas/utils'
import { installWorkflowRunAllRunner } from '@/features/canvas/workflowRunAllBridge'
import { buildWorkspaceGraphMutationTransitionState } from '@/features/workspace-table/workspaceTableSsot'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { UiToastInput } from '@/hooks/store/types'
import { UI_COPY } from '@/lib/config'
import { readGraphDataRevision } from '@/lib/graph/documentMetadata'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { FLOW_RUN_ALL_PHASES } from '@/lib/storyboardWidget/runAllSequenceSsot'
import { getCachedStoryboardWidgetWorkflowRunPlan } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetRenderGraph'
import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'

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
      transitionSemanticKey: 'storyboard-widget-run-all:active',
    }),
  })
}

export function resolveStoryboardWidgetWorkflowRunGraphSnapshot(args: {
  detail: WorkflowRunAllEventDetail
  draftGraphData: GraphData | null
  currentGraphData: GraphData | null
}): GraphData | null {
  if (args.detail.source === 'chat') {
    return args.detail.committedGraphData || args.currentGraphData
  }
  return args.draftGraphData || args.currentGraphData
}

export function useStoryboardWidgetWorkflowRunAll(args: {
  storyboardWidgetViewActive: boolean
  draftGraphData: GraphData | null
  draftGraphDataRef: React.MutableRefObject<GraphData | null>
  setDraftGraphData: React.Dispatch<React.SetStateAction<GraphData | null>>
  upsertUiToast: (args: UiToastInput) => void
  runWorkflowNode: (nodeId: string, runOptions?: { allowCreateRichMediaPanel?: boolean; suppressLayoutMutation?: boolean; visitedNodeIds?: Set<string>; propagateErrors?: boolean; requireDurableMediaPersistence?: boolean }) => Promise<void>
  scheduleOutputEdgeRefresh: () => void
}) {
  const runWorkflowAllInFlightRef = React.useRef(false)
  const runWorkflowAllNodes = React.useCallback(async (detail: WorkflowRunAllEventDetail = { source: 'unknown' }) => {
    const toastId = 'storyboard-widget-run-all'
    const upsertRunAllStatus = (status: WorkflowRunAllStatus, toast: Omit<UiToastInput, 'id'>) => {
      detail.onStatus?.(status)
      if (detail.source === 'chat') return
      args.upsertUiToast({ id: toastId, ...toast })
    }
    if (!args.storyboardWidgetViewActive) {
      args.upsertUiToast({ id: 'storyboard-widget-run-all-not-active', kind: 'neutral', message: 'Open Storyboard Widget to run all.', ttlMs: 2200 })
      return
    }
    if (runWorkflowAllInFlightRef.current) {
      upsertRunAllStatus({ phase: 'error', message: 'Run All is already running.' }, {
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
      const draft = resolveStoryboardWidgetWorkflowRunGraphSnapshot({
        detail,
        draftGraphData: (args.draftGraphDataRef.current || args.draftGraphData) as GraphData | null,
        currentGraphData: useGraphStore.getState().graphData as GraphData | null,
      })
      if (detail.source === 'chat' && draft) {
        args.draftGraphDataRef.current = draft
        args.setDraftGraphData(previous => (previous === draft ? previous : draft))
      }
      const nodes = Array.isArray(draft?.nodes) ? (draft!.nodes as GraphNode[]) : []
      if (!draft || nodes.length === 0) {
        upsertRunAllStatus({ phase: 'error', message: UI_COPY.storyboardWidgetNoDraftGraphToast }, {
          kind: 'neutral', message: UI_COPY.storyboardWidgetNoDraftGraphToast, ttlMs: 2400,
        })
        return
      }
      const runPlan = getCachedStoryboardWidgetWorkflowRunPlan({
        graphData: draft,
        graphRevision: readGraphDataRevision(draft),
        preferCurrentGraphDataRefs: true,
      })
      const ids = runPlan?.orderedNodeIds || []
      if (ids.length === 0) {
        upsertRunAllStatus({ phase: 'error', message: 'No runnable workflow nodes found.' }, {
          kind: 'neutral', message: 'No runnable workflow nodes found.', ttlMs: 2400,
        })
        return
      }
      const phaseCounts = runPlan?.phaseCounts || { text: 0, imageFoundation: 0, imageScene: 0, annotation: 0, video: 0 }
      const phaseSummary = FLOW_RUN_ALL_PHASES.map(phase => `${phase.label}: ${phaseCounts[phase.id] || 0}`).join(' · ')
      const message = `Run All starting: 0/${ids.length} nodes. ${phaseSummary}`
      upsertRunAllStatus({ phase: 'starting', message, current: 0, total: ids.length }, {
        kind: 'neutral',
        message,
        ttlMs: null,
        dismissible: false,
        busy: true,
      })
      for (let index = 0; index < ids.length; index += 1) {
        const nodeId = ids[index]!
        const node = resolveGraphNodeByCanonicalId(draft, nodeId)
        const label = String(node?.label || node?.type || nodeId).trim() || nodeId
        const runningMessage = `Run All running ${index + 1}/${ids.length}: ${label}`
        upsertRunAllStatus({ phase: 'running', message: runningMessage, current: index + 1, total: ids.length, nodeId, label }, {
          kind: 'neutral',
          message: runningMessage,
          ttlMs: null,
          dismissible: false,
          busy: true,
          log: false,
        })
        await args.runWorkflowNode(nodeId, {
          allowCreateRichMediaPanel: false,
          suppressLayoutMutation: true,
          propagateErrors: true,
          requireDurableMediaPersistence: detail.source === 'chat',
        })
        const completedMessage = `Run All completed ${index + 1}/${ids.length}: ${label}`
        upsertRunAllStatus({ phase: 'completed', message: completedMessage, current: index + 1, total: ids.length, nodeId, label }, {
          kind: 'neutral',
          message: completedMessage,
          ttlMs: null,
          dismissible: false,
          busy: true,
          log: false,
        })
        if (typeof requestAnimationFrame === 'function') await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      }
      args.scheduleOutputEdgeRefresh()
      const completeMessage = `Run All complete: ran ${ids.length} node${ids.length === 1 ? '' : 's'}.`
      upsertRunAllStatus({ phase: 'complete', message: completeMessage, current: ids.length, total: ids.length }, {
        kind: 'success',
        message: completeMessage,
        ttlMs: 2600,
        dismissible: true,
        busy: false,
      })
    } catch (error) {
      const errorDetail = error && typeof error === 'object' && 'message' in error ? String((error as { message?: unknown }).message || '').trim() : ''
      const message = errorDetail ? `Run All failed: ${errorDetail}` : UI_COPY.storyboardWidgetRunFailedToast
      upsertRunAllStatus({ phase: 'error', message }, {
        kind: 'error',
        message,
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
    const handler = (event: Event) => {
      void runWorkflowAllNodes((event as CustomEvent<WorkflowRunAllEventDetail | undefined>).detail || { source: 'unknown' })
    }
    window.addEventListener(WORKFLOW_RUN_ALL_EVENT, handler as EventListener)
    return () => window.removeEventListener(WORKFLOW_RUN_ALL_EVENT, handler as EventListener)
  }, [runWorkflowAllNodes])

  React.useEffect(() => {
    if (!args.storyboardWidgetViewActive) return
    return installWorkflowRunAllRunner(detail => {
      void runWorkflowAllNodes(detail)
    })
  }, [args.storyboardWidgetViewActive, runWorkflowAllNodes])
}
