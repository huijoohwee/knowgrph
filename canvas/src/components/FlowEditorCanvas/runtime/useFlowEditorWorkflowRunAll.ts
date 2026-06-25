import React from 'react'

import { WORKFLOW_RUN_ALL_EVENT } from '@/features/canvas/utils'
import { buildWorkspaceGraphMutationTransitionState } from '@/features/workspace-table/workspaceTableSsot'
import { useGraphStore } from '@/hooks/useGraphStore'
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

type RunAllWorkspaceFrame = {
  workspaceViewMode: 'canvas' | 'editor'
  workspaceCanvasPaneOpen: boolean
  editorWorkspacePane: 'markdown'
}

const readRunAllWorkspaceFrame = (): RunAllWorkspaceFrame => {
  const state = useGraphStore.getState()
  return {
    workspaceViewMode: state.workspaceViewMode === 'editor' ? 'editor' : 'canvas',
    workspaceCanvasPaneOpen: state.workspaceCanvasPaneOpen === true,
    editorWorkspacePane: 'markdown',
  }
}

const restoreRunAllWorkspaceFrame = (frame: RunAllWorkspaceFrame): void => {
  const state = useGraphStore.getState()
  if (
    state.workspaceViewMode === frame.workspaceViewMode
    && state.workspaceCanvasPaneOpen === frame.workspaceCanvasPaneOpen
    && state.editorWorkspacePane === frame.editorWorkspacePane
  ) return
  useGraphStore.setState({
    workspaceViewMode: frame.workspaceViewMode,
    workspaceCanvasPaneOpen: frame.workspaceCanvasPaneOpen,
    editorWorkspacePane: frame.editorWorkspacePane,
    ...buildWorkspaceGraphMutationTransitionState({
      workspaceViewMode: frame.workspaceViewMode,
      workspaceCanvasPaneOpen: frame.workspaceCanvasPaneOpen,
      markdownWorkspaceIndexingInFlight: state.markdownWorkspaceIndexingInFlight,
      transitionSemanticKey: 'flow-editor-run-all:restore-workspace-frame',
    }),
  })
}

const setRunAllLayoutMutationLock = (active: boolean): void => {
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
  upsertUiToast: (args: { id: string; kind: 'neutral' | 'warning' | 'success' | 'error'; message: string; ttlMs?: number }) => void
  runWorkflowNode: (nodeId: string, runOptions?: { allowCreateRichMediaPanel?: boolean; suppressLayoutMutation?: boolean; visitedNodeIds?: Set<string> }) => Promise<void>
}) {
  const runWorkflowAllInFlightRef = React.useRef(false)
  const runWorkflowAllNodes = React.useCallback(async () => {
    if (!args.flowEditorViewActive) {
      args.upsertUiToast({ id: 'flow-editor-run-all-not-active', kind: 'neutral', message: 'Open Flow Editor to run all.', ttlMs: 2200 })
      return
    }
    if (runWorkflowAllInFlightRef.current) return
    runWorkflowAllInFlightRef.current = true
    const workspaceFrame = readRunAllWorkspaceFrame()
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
      const phaseCounts = runPlan?.phaseCounts || { text: 0, imageFoundation: 0, imageScene: 0, video: 0 }
      const phaseSummary = FLOW_RUN_ALL_PHASES.map(phase => `${phase.label}: ${phaseCounts[phase.id] || 0}`).join(' · ')
      args.upsertUiToast({ id: 'flow-editor-run-all', kind: 'neutral', message: `Running ${ids.length} nodes in sequence. ${phaseSummary}`, ttlMs: 2600 })
      for (let index = 0; index < ids.length; index += 1) {
        await args.runWorkflowNode(ids[index]!, { allowCreateRichMediaPanel: false, suppressLayoutMutation: true })
        if (typeof requestAnimationFrame === 'function') await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      }
      args.upsertUiToast({ id: 'flow-editor-run-all-done', kind: 'neutral', message: `Ran ${ids.length} nodes.`, ttlMs: 2200 })
    } finally {
      restoreRunAllWorkspaceFrame(workspaceFrame)
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
