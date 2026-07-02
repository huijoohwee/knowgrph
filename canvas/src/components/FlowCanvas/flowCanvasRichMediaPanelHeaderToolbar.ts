import type React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { computeWidgetScale } from '@/lib/canvas/overlayWidgetZoom'
import { resolveCanvasAspectRatioSize, type CanvasAspectRatioMode } from '@/lib/canvas/canvasAspectRatioDisplayControls'
import {
  markFlowWidgetPinPointerActivation,
  readFlowWidgetPinnedInCanvas,
  shouldSkipFlowWidgetPinClickAfterPointerActivation,
  toggleFlowWidgetPinnedById,
} from '@/lib/storyboardWidget/flowWidgetPinnedState'
import { resolveScopedFlowWidgetNodeMap } from '@/lib/storyboardWidget/widgetStateScope'
import type { GraphNode } from '@/lib/graph/types'
import type { MediaOverlayNode } from '@/lib/render/mediaOverlayPool'
import { readStableRichMediaPanelSize } from '@/lib/render/mediaPanelLayout'
import { RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE } from '@/lib/render/richMediaPanelDefaults'
import type { RichMediaPanelProps } from '@/components/RichMediaPanel.types'
import type { FlowNativeRuntime } from '@/components/FlowCanvas/nativeRuntime'

type HeaderToolbarProps = Pick<
  RichMediaPanelProps,
  | 'headerMinimized'
  | 'headerPinned'
  | 'onHeaderPinnedPointerDown'
  | 'onHeaderToggleMinimized'
  | 'onHeaderTogglePinned'
  | 'onHeaderValidate'
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
    st.setFlowWidgetPinnedByNodeIdForGraph(args.flowWidgetStateGraphKey, nextPinnedById)
    args.onPinnedChange?.(readFlowWidgetPinnedInCanvas(nextPinnedById, nodeId))
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
  lastKnownWorldSize: { w: number; h: number } | null | undefined
  node: MediaOverlayNode
  nodeProperties: Record<string, unknown>
  readPanelElement: (id: string) => HTMLElement | null
  readRuntime: () => FlowNativeRuntime | null
  requestCommit: () => void
  scheduleLayout: () => void
  setActiveRichMediaPanelId: (id: string) => void
  setPanelSizeOverride: (id: string, size: { w: number; h: number }) => void
  setPanelSizeTargetWorld: (id: string, size: { w: number; h: number }) => void
  stopEvent: (event: React.SyntheticEvent) => void
  storyboardCardAspectMode: CanvasAspectRatioMode
  updateNode: (id: string, patch: { properties: Record<string, unknown> }) => void
  workspaceMutationBlocked: boolean
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
  const headerStableSize = readStableRichMediaPanelSize(args.nodeProperties, args.storyboardCardAspectMode) || args.lastKnownWorldSize || null
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
  const toggleSize = () => {
    if (!nodeId || args.workspaceMutationBlocked) return
    const runtime = args.readRuntime()
    const zoomK = typeof runtime?.transform?.k === 'number' && runtime.transform.k > 0 ? runtime.transform.k : 1
    const scale = computeWidgetScale(zoomK, null, { mode: 'pinnedInCanvas' })
    const rect = args.readPanelElement(nodeId)?.getBoundingClientRect()
    const measuredW = rect && Number.isFinite(rect.width) ? Math.max(24, Math.round(rect.width / Math.max(0.001, scale))) : 0
    const currentW = headerStableSize?.w || args.node.width || measuredW || RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE.width
    const nextWidth = Math.max(24, Math.round(currentW > 260 ? 220 : RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE.width))
    const nextFrame = resolveCanvasAspectRatioSize({
      defaultWidth: nextWidth,
      mode: args.storyboardCardAspectMode,
      width: nextWidth,
    })
    const nextHeight = Math.max(24, Math.round(nextFrame.height))
    args.setPanelSizeOverride(nodeId, { w: nextWidth * scale, h: nextHeight * scale })
    args.setPanelSizeTargetWorld(nodeId, { w: nextWidth, h: nextHeight })
    args.updateNode(nodeId, { properties: { ...args.nodeProperties, 'visual:width': nextWidth, 'visual:height': nextHeight } })
    args.scheduleLayout()
    args.requestCommit()
  }
  return {
    activate,
    panelProps: {
      headerMinimized: (headerStableSize?.w || args.node.width || 9999) <= 260,
      headerPinned: pinProps.headerPinned,
      onHeaderPinnedPointerDown: pinProps.onHeaderPinnedPointerDown,
      onHeaderToggleMinimized: toggleSize,
      onHeaderTogglePinned: togglePinned,
      onHeaderValidate: activate,
      widgetToolbarActive: args.isSelected,
    },
  }
}
