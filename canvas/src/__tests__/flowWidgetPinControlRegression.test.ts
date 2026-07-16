import { buildFlowCanvasHeaderPinProps } from '@/components/FlowCanvas/flowCanvasRichMediaPanelHeaderToolbar'
import { useGraphStore } from '@/hooks/useGraphStore'

export function testStoryboardPinControlRemainsViewLocalDuringGraphMutationGuards() {
  const previous = useGraphStore.getState()
  const previousPatch = {
    workspaceViewMode: previous.workspaceViewMode,
    workspaceCanvasPaneOpen: previous.workspaceCanvasPaneOpen,
    markdownWorkspaceIndexingInFlight: previous.markdownWorkspaceIndexingInFlight,
    workspaceGraphMutationBlockUntilMs: previous.workspaceGraphMutationBlockUntilMs,
    workspaceGraphMutationBlockKey: previous.workspaceGraphMutationBlockKey,
    workspaceGraphMutationLayoutLockActive: previous.workspaceGraphMutationLayoutLockActive,
    flowWidgetPinnedByNodeId: previous.flowWidgetPinnedByNodeId,
    flowWidgetPinnedByNodeIdByGraphMetaKey: previous.flowWidgetPinnedByNodeIdByGraphMetaKey,
  }
  const graphKey = 'pin-control-editor-indexing'
  const nodeId = 'probe-card'
  const pointerEvent = { button: 0, stopPropagation: () => undefined } as never

  try {
    useGraphStore.setState({
      workspaceViewMode: 'editor',
      workspaceCanvasPaneOpen: true,
      markdownWorkspaceIndexingInFlight: true,
      workspaceGraphMutationBlockUntilMs: 0,
      workspaceGraphMutationBlockKey: '',
      workspaceGraphMutationLayoutLockActive: true,
      flowWidgetPinnedByNodeId: { [nodeId]: true },
      flowWidgetPinnedByNodeIdByGraphMetaKey: { [graphKey]: { [nodeId]: true } },
    } as never)

    const pinnedControl = buildFlowCanvasHeaderPinProps({
      enabled: true,
      flowWidgetPinnedByNodeId: { [nodeId]: true },
      flowWidgetStateGraphKey: graphKey,
      nodeId,
      stopEvent: event => event.stopPropagation(),
    })
    pinnedControl.onHeaderPinnedPointerDown?.(pointerEvent)
    const afterUnpin = useGraphStore.getState()
    if (afterUnpin.flowWidgetPinnedByNodeId[nodeId] !== false || afterUnpin.flowWidgetPinnedByNodeIdByGraphMetaKey[graphKey]?.[nodeId] !== false) {
      throw new Error('expected the explicit pin control to remain interactive while Editor Workspace is open, indexing, and protected by the layout lock')
    }

    useGraphStore.setState({
      workspaceGraphMutationBlockUntilMs: Date.now() + 5_000,
      workspaceGraphMutationBlockKey: 'renderer-transition',
    } as never)
    const transitionControl = buildFlowCanvasHeaderPinProps({
      enabled: true,
      flowWidgetPinnedByNodeId: { [nodeId]: false },
      flowWidgetStateGraphKey: graphKey,
      nodeId,
      stopEvent: event => event.stopPropagation(),
    })
    transitionControl.onHeaderPinnedPointerDown?.(pointerEvent)
    if (useGraphStore.getState().flowWidgetPinnedByNodeId[nodeId] !== true) {
      throw new Error('expected the explicit pin control to remain view-local during transient graph mutation guards')
    }
  } finally {
    useGraphStore.setState(previousPatch as never)
  }
}

export function testStoryboardPinControlTogglesDefaultPinnedToExplicitUnpinned() {
  const previous = useGraphStore.getState()
  const previousPatch = {
    flowWidgetPinnedByNodeId: previous.flowWidgetPinnedByNodeId,
    flowWidgetPinnedByNodeIdByGraphMetaKey: previous.flowWidgetPinnedByNodeIdByGraphMetaKey,
  }
  const graphKey = 'probe-tree-default-pin'
  const nodeId = 'probe-tree-ledger'
  const pointerEvent = { button: 0, stopPropagation: () => undefined } as never

  try {
    useGraphStore.setState({
      flowWidgetPinnedByNodeId: {},
      flowWidgetPinnedByNodeIdByGraphMetaKey: { [graphKey]: {} },
    } as never)
    const control = buildFlowCanvasHeaderPinProps({
      enabled: true,
      flowWidgetPinnedByNodeId: {},
      flowWidgetStateGraphKey: graphKey,
      nodeId,
      pinned: true,
      stopEvent: event => event.stopPropagation(),
    })
    if (control.headerPinned !== true) {
      throw new Error('expected the Probe-Tree ledger header to display its effective default-pinned state')
    }
    control.onHeaderPinnedPointerDown?.(pointerEvent)
    const afterUnpin = useGraphStore.getState()
    if (afterUnpin.flowWidgetPinnedByNodeId[nodeId] !== false || afterUnpin.flowWidgetPinnedByNodeIdByGraphMetaKey[graphKey]?.[nodeId] !== false) {
      throw new Error('expected the first pin control activation to turn default-pinned into an explicit unpin')
    }
  } finally {
    useGraphStore.setState(previousPatch as never)
  }
}
