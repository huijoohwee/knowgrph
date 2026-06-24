import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import {
  FLOW_EDITOR_OVERLAY_ROOT_SELECTOR,
  RICH_MEDIA_OVERLAY_ROOT_SELECTOR,
  readCanvasOverlayNodeId,
  readFlowEditorOverlaySurfaceId,
} from '@/lib/canvas/flow-editor-overlay-proxy'
import { isWorkspaceEditorOverlayOpen, isWorkspaceGraphMutationBlocked } from '@/features/workspace-table/workspaceTableSsot'
import { resolveScopedFlowWidgetNodeMap } from '@/lib/flowEditor/widgetStateScope'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'

export function recenterFlowEditorOverlayWidgetPositions(args: {
  activeSurfaceId: string
  deltaX: number
  deltaY: number
  graphData?: GraphData | null
}) {
  const { activeSurfaceId, deltaX, deltaY } = args
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return
  if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return
  const st = useGraphStore.getState() as {
    graphData?: GraphData | null
    flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }>
    flowWidgetWorldPosByNodeIdByGraphMetaKey?: Record<string, Record<string, { x: number; y: number }>>
    flowWidgetPosByNodeId?: Record<string, { top: number; left: number }>
    flowWidgetPosByNodeIdByGraphMetaKey?: Record<string, Record<string, { top: number; left: number }>>
    setFlowWidgetWorldPosByNodeId: (pos: Record<string, { x: number; y: number }>) => void
    setFlowWidgetPosByNodeId: (pos: Record<string, { top: number; left: number }>) => void
  }
  const graphKey = buildGraphMetaKeyIgnoringPending(args.graphData || st.graphData || null)
  const storeGraphKey = buildGraphMetaKeyIgnoringPending(st.graphData || null)
  if (isWorkspaceGraphMutationBlocked(st as never)) return
  const shouldWriteGraphScopedInMemory =
    isWorkspaceEditorOverlayOpen(st as never)
    || (!!graphKey && graphKey !== storeGraphKey)
  const base = resolveScopedFlowWidgetNodeMap({
    graphMetaKey: graphKey,
    keyedByGraphMetaKey: st.flowWidgetWorldPosByNodeIdByGraphMetaKey,
    globalByNodeId: st.flowWidgetWorldPosByNodeId,
  })
  const ids = readOverlayNodeIdsForSurface(activeSurfaceId)
  if (ids.size === 0) return
  let changedWorld = false
  let changedScreen = false
  const nextWorld = { ...base }
  const nextScreen = {
    ...resolveScopedFlowWidgetNodeMap({
      graphMetaKey: graphKey,
      keyedByGraphMetaKey: st.flowWidgetPosByNodeIdByGraphMetaKey,
      globalByNodeId: st.flowWidgetPosByNodeId,
    }),
  }
  ids.forEach((nodeId) => {
    const curWorld = nextWorld[nodeId]
    if (curWorld && Number.isFinite(curWorld.x) && Number.isFinite(curWorld.y)) {
      nextWorld[nodeId] = { x: curWorld.x + deltaX, y: curWorld.y + deltaY }
      changedWorld = true
    }
    const curScreen = nextScreen[nodeId]
    if (curScreen && Number.isFinite(curScreen.left) && Number.isFinite(curScreen.top)) {
      nextScreen[nodeId] = { left: curScreen.left + deltaX, top: curScreen.top + deltaY }
      changedScreen = true
    }
  })
  if (shouldWriteGraphScopedInMemory) {
    writeGraphScopedOverlayPositions({ graphKey, changedWorld, changedScreen, nextWorld, nextScreen })
    return
  }
  if (changedWorld) st.setFlowWidgetWorldPosByNodeId(nextWorld)
  if (changedScreen) st.setFlowWidgetPosByNodeId(nextScreen)
}

const readOverlayNodeIdsForSurface = (activeSurfaceId: string): Set<string> => {
  const ids = new Set<string>()
  const selectors = [FLOW_EDITOR_OVERLAY_ROOT_SELECTOR, RICH_MEDIA_OVERLAY_ROOT_SELECTOR]
  for (let i = 0; i < selectors.length; i += 1) {
    const selector = selectors[i]!
    const roots = Array.from(document.querySelectorAll(selector)).filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement
        && readFlowEditorOverlaySurfaceId(el) === activeSurfaceId,
    )
    for (let j = 0; j < roots.length; j += 1) {
      const nodeId = readCanvasOverlayNodeId(roots[j])
      if (nodeId) ids.add(nodeId)
    }
  }
  return ids
}

const writeGraphScopedOverlayPositions = (args: {
  graphKey: string
  changedWorld: boolean
  changedScreen: boolean
  nextWorld: Record<string, { x: number; y: number }>
  nextScreen: Record<string, { top: number; left: number }>
}) => {
  useGraphStore.setState((prev) => {
    if (isWorkspaceGraphMutationBlocked(prev as never)) return {}
    const prevState = prev as unknown as {
      flowWidgetWorldPosByNodeIdByGraphMetaKey?: Record<string, Record<string, { x: number; y: number }>>
      flowWidgetPosByNodeIdByGraphMetaKey?: Record<string, Record<string, { top: number; left: number }>>
    }
    const nextState: Record<string, unknown> = {}
    if (args.changedWorld) {
      if (args.graphKey) {
        const worldByKey = prevState.flowWidgetWorldPosByNodeIdByGraphMetaKey || {}
        nextState.flowWidgetWorldPosByNodeIdByGraphMetaKey = { ...worldByKey, [args.graphKey]: args.nextWorld }
      }
      nextState.flowWidgetWorldPosByNodeId = args.nextWorld
    }
    if (args.changedScreen) {
      if (args.graphKey) {
        const posByKey = prevState.flowWidgetPosByNodeIdByGraphMetaKey || {}
        nextState.flowWidgetPosByNodeIdByGraphMetaKey = { ...posByKey, [args.graphKey]: args.nextScreen }
      }
      nextState.flowWidgetPosByNodeId = args.nextScreen
    }
    return nextState
  })
}
