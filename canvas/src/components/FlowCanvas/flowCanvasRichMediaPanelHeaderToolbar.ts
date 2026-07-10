import type React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  markFlowWidgetPinPointerActivation,
  readFlowWidgetPinnedInCanvas,
  shouldSkipFlowWidgetPinClickAfterPointerActivation,
  toggleFlowWidgetPinnedById,
} from '@/lib/storyboardWidget/flowWidgetPinnedState'
import { resolveScopedFlowWidgetNodeMap } from '@/lib/storyboardWidget/widgetStateScope'
import type { MediaOverlayNode } from '@/lib/render/mediaOverlayPool'
import type { RichMediaPanelProps } from '@/components/RichMediaPanel.types'

type HeaderToolbarProps = Pick<
  RichMediaPanelProps,
  | 'headerPinned'
  | 'onHeaderPinnedPointerDown'
  | 'onHeaderTogglePinned'
  | 'widgetToolbarActive'
>

export type FlowCanvasHeaderPinProps = Pick<
  RichMediaPanelProps,
  | 'headerPinned'
  | 'onHeaderPinnedPointerDown'
  | 'onHeaderTogglePinned'
>

export type FlowCanvasRichMediaPanelHeaderToolbar = {
  activate: () => void
  panelProps: HeaderToolbarProps
}

export function buildFlowCanvasHeaderPinProps(args: {
  enabled: boolean
  flowWidgetPinnedByNodeId: Record<string, boolean> | null | undefined
  flowWidgetStateGraphKey: string | null | undefined
  onBeforePinnedChange?: (pinned: boolean) => void
  nodeId: string
  onPinnedChange?: (pinned: boolean) => void
  stopEvent: (event: React.SyntheticEvent) => void
}): FlowCanvasHeaderPinProps {
  const nodeId = String(args.nodeId || '').trim()
  if (!args.enabled || !nodeId) return {}
  const headerPinned = readFlowWidgetPinnedInCanvas(args.flowWidgetPinnedByNodeId, nodeId)
  const commitTogglePinned = () => {
    const st = useGraphStore.getState()
    const currentPinnedById = resolveScopedFlowWidgetNodeMap({
      graphMetaKey: args.flowWidgetStateGraphKey,
      keyedByGraphMetaKey: (st as unknown as { flowWidgetPinnedByNodeIdByGraphMetaKey?: Record<string, Record<string, boolean>> }).flowWidgetPinnedByNodeIdByGraphMetaKey,
      globalByNodeId: st.flowWidgetPinnedByNodeId,
    })
    const nextPinnedById = toggleFlowWidgetPinnedById(currentPinnedById, nodeId)
    if (!nextPinnedById) return
    const nextPinned = readFlowWidgetPinnedInCanvas(nextPinnedById, nodeId)
    args.onBeforePinnedChange?.(nextPinned)
    st.setFlowWidgetPinnedByNodeIdForGraph(args.flowWidgetStateGraphKey, nextPinnedById)
    args.onPinnedChange?.(nextPinned)
  }
  const togglePinned = (event: React.MouseEvent) => {
    args.stopEvent(event)
    if (shouldSkipFlowWidgetPinClickAfterPointerActivation(nodeId)) return
    commitTogglePinned()
  }
  const onHeaderPinnedPointerDown = (event: React.PointerEvent) => {
    args.stopEvent(event)
    if (event.button !== 0) return
    markFlowWidgetPinPointerActivation(nodeId)
    commitTogglePinned()
  }
  return {
    headerPinned,
    onHeaderPinnedPointerDown,
    onHeaderTogglePinned: togglePinned,
  }
}

export function buildFlowCanvasRichMediaPanelHeaderToolbar(args: {
  enabled: boolean
  flowWidgetPinnedByNodeId: Record<string, boolean> | null | undefined
  flowWidgetStateGraphKey: string | null | undefined
  isSelected: boolean
  node: MediaOverlayNode
  requestCommit: () => void
  scheduleLayout: () => void
  setActiveRichMediaPanelId: (id: string) => void
  stopEvent: (event: React.SyntheticEvent) => void
}): FlowCanvasRichMediaPanelHeaderToolbar {
  const nodeId = String(args.node.id || '').trim()
  const activate = () => {
    if (!nodeId) return
    args.setActiveRichMediaPanelId(nodeId)
    const st = useGraphStore.getState()
    st.updateOpenWidgetNodeIds(prev => (prev.includes(nodeId) ? prev : [...prev, nodeId]))
    useGraphStore.setState({
      selectionSource: 'canvas',
      selectedNodeId: nodeId,
      selectedNodeIds: [nodeId],
      selectedEdgeId: null,
      selectedEdgeIds: [],
      selectedGroupId: null,
      selectedGroupIds: [],
    })
  }
  if (!args.enabled) return { activate, panelProps: { widgetToolbarActive: args.isSelected } }
  const pinProps = buildFlowCanvasHeaderPinProps({
    enabled: args.enabled,
    flowWidgetPinnedByNodeId: args.flowWidgetPinnedByNodeId,
    flowWidgetStateGraphKey: args.flowWidgetStateGraphKey,
    nodeId,
    onPinnedChange: () => {
      args.scheduleLayout()
      args.requestCommit()
    },
    stopEvent: args.stopEvent,
  })
  const togglePinned = pinProps.onHeaderTogglePinned
  return {
    activate,
    panelProps: {
      headerPinned: pinProps.headerPinned,
      onHeaderPinnedPointerDown: pinProps.onHeaderPinnedPointerDown,
      onHeaderTogglePinned: togglePinned,
      widgetToolbarActive: args.isSelected,
    },
  }
}
