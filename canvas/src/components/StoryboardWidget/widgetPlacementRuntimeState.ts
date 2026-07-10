import type React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { isWorkspaceGraphMutationBlocked, type WorkspaceGraphMutationState } from '@/features/workspace-table/workspaceTableSsot'
import {
  readScopedFlowWidgetNodeValue,
  resolveFlowWidgetStateGraphKey,
  resolveScopedFlowWidgetNodeMap,
} from '@/lib/storyboardWidget/widgetStateScope'
import { getEffectiveZoomStateForKey } from '@/lib/canvas/zoom-effective'
import { screenToWorld } from '@/lib/zoom/viewport'
import { readVectorPaintedOverlayPosition } from '@/lib/canvas/vectorPaintedOverlayProjection'
import { computeDefaultWidgetFloatingPos } from '@/components/StoryboardWidget/widgetLayout'
import { isFrontmatterManagedOverlayNode, resolveFrontmatterBalancedFallbackPos } from '@/components/StoryboardWidget/widgetFrontmatterPlacement'
import { computeWidgetScaledSize } from '@/lib/canvas/overlayWidgetZoom'

export type AppliedOverlayPlacement = {
  left: number
  top: number
  scale: number
  zoomK: number
  offsetLeft: number
  offsetTop: number
}

export function shouldUseFrontmatterBalancedFallbackForScreenAuthority(args: {
  frontmatterManagedNode: boolean
  floatingUsesScreenAuthority: boolean
  hasAppliedPlacement: boolean
  openWidgetNodeCount: number
  pos: { top: number; left: number } | undefined
  fallback: { top: number; left: number }
}): boolean {
  if (!args.frontmatterManagedNode || !args.floatingUsesScreenAuthority || args.hasAppliedPlacement || args.openWidgetNodeCount <= 1) return false
  const pos = args.pos
  if (!pos || !Number.isFinite(pos.top) || !Number.isFinite(pos.left)) return true
  return Math.abs(pos.left - args.fallback.left) > 2 || Math.abs(pos.top - args.fallback.top) > 2
}

export function readScreenAuthorityFollowZoomKState(args: {
  zoomK: number
  enabled: boolean
  screenAuthorityZoomBaselineKRef: React.MutableRefObject<number | null>
  computeCollectiveFollowZoomK: (args: { zoomK: number; baselineZoomK: number }) => number
}): number {
  if (!args.enabled) return args.zoomK
  const safeZoomK = Number.isFinite(args.zoomK) && args.zoomK > 0 ? args.zoomK : 1
  if (args.screenAuthorityZoomBaselineKRef.current == null || !Number.isFinite(args.screenAuthorityZoomBaselineKRef.current) || args.screenAuthorityZoomBaselineKRef.current <= 0) {
    args.screenAuthorityZoomBaselineKRef.current = safeZoomK
  }
  return args.computeCollectiveFollowZoomK({ zoomK: safeZoomK, baselineZoomK: args.screenAuthorityZoomBaselineKRef.current })
}

export function resolveDefaultFloatingPosState(args: {
  stackIndex?: number
  viewportW: number
  viewportH: number
  initialFrontmatterManagedNode: boolean
  floatingUsesScreenAuthority: boolean
  zoomK: number
  openWidgetNodeCount: number
  readPanelScaleForZoom: (zoomK: number, frontmatterManagedNode?: boolean, viewportOverride?: { width: number; height: number } | null) => number
}): { top: number; left: number } {
  const pos = computeDefaultWidgetFloatingPos({ stackIndex: args.stackIndex, viewportW: args.viewportW, viewportH: args.viewportH })
  if (!args.initialFrontmatterManagedNode) return { top: pos.top, left: pos.left }
  const zoomK = args.initialFrontmatterManagedNode && args.floatingUsesScreenAuthority ? 1 : args.zoomK
  const frontmatterFallback = resolveFrontmatterBalancedFallbackPos({
    enabled: true,
    openWidgetNodeCount: args.openWidgetNodeCount,
    stackIndex: args.stackIndex,
    viewportW: args.viewportW,
    viewportH: args.viewportH,
    scaled: computeWidgetScaledSize(args.readPanelScaleForZoom(zoomK, true)),
    zoomK,
  })
  return frontmatterFallback ? frontmatterFallback : { top: pos.top, left: pos.left }
}

export function resolveFloatingPosState(args: {
  pos: { top: number; left: number } | undefined
  fallback: { top: number; left: number }
  initialFrontmatterManagedNode: boolean
  floatingUsesScreenAuthority: boolean
  hasAppliedPlacement: boolean
  openWidgetNodeCount: number
}): { top: number; left: number } {
  if (args.pos && Number.isFinite(args.pos.top) && Number.isFinite(args.pos.left)) {
    if (shouldUseFrontmatterBalancedFallbackForScreenAuthority({
      frontmatterManagedNode: args.initialFrontmatterManagedNode,
      floatingUsesScreenAuthority: args.floatingUsesScreenAuthority,
      hasAppliedPlacement: args.hasAppliedPlacement,
      openWidgetNodeCount: args.openWidgetNodeCount,
      pos: args.pos,
      fallback: args.fallback,
    })) return args.fallback
    return args.pos
  }
  return args.fallback
}

export function persistFloatingPosForNode(args: {
  nodeId: string
  graphMetaKey?: string | null
  pos: { top: number; left: number }
}): void {
  const { nodeId, graphMetaKey, pos } = args
  if (!nodeId) return
  const state = useGraphStore.getState()
  if (isWorkspaceGraphMutationBlocked(state)) {
    useGraphStore.setState(prev => {
      const prevState = prev as unknown as {
        graphData?: Record<string, unknown> | null
        flowWidgetPosByNodeId?: Record<string, { top: number; left: number }>
        flowWidgetPosByNodeIdByGraphMetaKey?: Record<string, Record<string, { top: number; left: number }>>
      }
      const graphKey = resolveFlowWidgetStateGraphKey({
        graphMetaKey,
        graphData: (prev as unknown as { graphData?: unknown }).graphData,
      })
      const prevPos = resolveScopedFlowWidgetNodeMap({
        graphMetaKey: graphKey,
        keyedByGraphMetaKey: prevState.flowWidgetPosByNodeIdByGraphMetaKey,
        globalByNodeId: prevState.flowWidgetPosByNodeId,
      })
      const prevEntry = prevPos[nodeId]
      if (prevEntry && prevEntry.top === pos.top && prevEntry.left === pos.left) return {}
      const nextPos = { ...prevPos, [nodeId]: { top: pos.top, left: pos.left } }
      if (!graphKey) return { flowWidgetPosByNodeId: nextPos }
      const byKey = prevState.flowWidgetPosByNodeIdByGraphMetaKey || {}
      return {
        flowWidgetPosByNodeId: nextPos,
        flowWidgetPosByNodeIdByGraphMetaKey: { ...byKey, [graphKey]: nextPos },
      }
    })
    return
  }
  const current = state.flowWidgetPosByNodeId || {}
  const prev = current[nodeId]
  if (prev && prev.top === pos.top && prev.left === pos.left) return
  state.setFlowWidgetPosByNodeId({ ...current, [nodeId]: { top: pos.top, left: pos.left } })
}

export function persistWorldPosForNode(args: {
  nodeId: string
  graphMetaKey?: string | null
  pos: { x: number; y: number }
  setFlowWidgetWorldPosByNodeId: (pos: Record<string, { x: number; y: number }>) => void
}): void {
  const { nodeId, graphMetaKey, pos, setFlowWidgetWorldPosByNodeId } = args
  if (!nodeId) return
  const state = useGraphStore.getState() as WorkspaceGraphMutationState & {
    flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }>
    flowWidgetWorldPosByNodeIdByGraphMetaKey?: Record<string, Record<string, { x: number; y: number }>>
    graphData?: unknown
  }
  if (isWorkspaceGraphMutationBlocked(state)) {
    useGraphStore.setState(prev => {
      const prevState = prev as unknown as {
        graphData?: unknown
        flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }>
        flowWidgetWorldPosByNodeIdByGraphMetaKey?: Record<string, Record<string, { x: number; y: number }>>
      }
      const graphKey = resolveFlowWidgetStateGraphKey({
        graphMetaKey,
        graphData: prevState.graphData,
      })
      const prevWorld = resolveScopedFlowWidgetNodeMap({
        graphMetaKey: graphKey,
        keyedByGraphMetaKey: prevState.flowWidgetWorldPosByNodeIdByGraphMetaKey,
        globalByNodeId: prevState.flowWidgetWorldPosByNodeId,
      })
      const prevEntry = prevWorld[nodeId]
      if (prevEntry && Math.abs(prevEntry.x - pos.x) <= 0.0001 && Math.abs(prevEntry.y - pos.y) <= 0.0001) return {}
      const nextWorld = { ...prevWorld, [nodeId]: { x: pos.x, y: pos.y } }
      if (!graphKey) return { flowWidgetWorldPosByNodeId: nextWorld }
      const byKey = prevState.flowWidgetWorldPosByNodeIdByGraphMetaKey || {}
      return {
        flowWidgetWorldPosByNodeId: nextWorld,
        flowWidgetWorldPosByNodeIdByGraphMetaKey: { ...byKey, [graphKey]: nextWorld },
      }
    })
    return
  }
  const current = state.flowWidgetWorldPosByNodeId || {}
  const prev = current[nodeId]
  if (prev && Math.abs(prev.x - pos.x) <= 0.0001 && Math.abs(prev.y - pos.y) <= 0.0001) return
  setFlowWidgetWorldPosByNodeId({ ...current, [nodeId]: { x: pos.x, y: pos.y } })
}

export function readStoredWidgetWorldPosForNode(args: {
  nodeId: string
  graphMetaKey?: string | null
}): { x: number; y: number } | null {
  const { nodeId, graphMetaKey } = args
  const state = useGraphStore.getState() as {
    graphData?: unknown
    flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }>
    flowWidgetWorldPosByNodeIdByGraphMetaKey?: Record<string, Record<string, { x: number; y: number }>>
  }
  const next = readScopedFlowWidgetNodeValue({
    nodeId,
    graphMetaKey,
    graphData: state.graphData,
    keyedByGraphMetaKey: state.flowWidgetWorldPosByNodeIdByGraphMetaKey,
    globalByNodeId: state.flowWidgetWorldPosByNodeId,
  }) || null
  if (!next || !Number.isFinite(next.x) || !Number.isFinite(next.y)) return null
  return { x: next.x, y: next.y }
}

export function shouldBypassStoreZoomFallback(args: {
  liveZoom: { k: number; x: number; y: number } | null
  floating: boolean
  floatingUsesScreenAuthority: boolean
  pinnedDragOverride: { left: number; top: number } | null
  worldDragOverride: { x: number; y: number } | null
  hasStoredWorldPos: boolean
}): boolean {
  const { liveZoom, floating, floatingUsesScreenAuthority, pinnedDragOverride, worldDragOverride, hasStoredWorldPos } = args
  if (liveZoom) return false
  if (floating || floatingUsesScreenAuthority) return false
  if (pinnedDragOverride || worldDragOverride) return false
  const state = useGraphStore.getState()
  if (!isWorkspaceGraphMutationBlocked(state)) return false
  return hasStoredWorldPos
}

export function readCurrentTransformState(args: {
  getLiveZoomTransform?: () => { k: number; x: number; y: number } | null
  zoomViewKey?: string | null
  zoomStateRef: React.MutableRefObject<{ k: number; x: number; y: number } | null>
  shouldBypassStoreZoomFallback: (liveZoom: { k: number; x: number; y: number } | null) => boolean
}): { k: number; x: number; y: number } {
  const { getLiveZoomTransform, zoomViewKey, zoomStateRef, shouldBypassStoreZoomFallback } = args
  const liveZoom = getLiveZoomTransform ? getLiveZoomTransform() : null
  const storeZoom = getEffectiveZoomStateForKey({
    zoomViewKey,
    zoomStateByKey: useGraphStore.getState().zoomStateByKey,
    zoomState: useGraphStore.getState().zoomState,
  })
  const bypassStore = shouldBypassStoreZoomFallback(liveZoom)
  let z = liveZoom || (bypassStore ? null : zoomStateRef.current)
  if (!liveZoom && !bypassStore && storeZoom && storeZoom !== z) {
    z = storeZoom
    zoomStateRef.current = storeZoom
  }
  return z || { k: 1, x: 0, y: 0 }
}

export function readPinConversionTransformState(args: {
  graphMetaKind?: string | null
  node: unknown
  floatingUsesScreenAuthority: boolean
  getLiveZoomTransform?: () => { k: number; x: number; y: number } | null
  readCurrentTransform: () => { k: number; x: number; y: number }
}): { k: number; x: number; y: number } {
  const { graphMetaKind, node, floatingUsesScreenAuthority, getLiveZoomTransform, readCurrentTransform } = args
  const frontmatterManagedNode = isFrontmatterManagedOverlayNode(graphMetaKind, node)
  if (frontmatterManagedNode && floatingUsesScreenAuthority) {
    return { k: 1, x: 0, y: 0 }
  }
  const liveZoom = getLiveZoomTransform ? getLiveZoomTransform() : null
  return liveZoom || readCurrentTransform()
}

export function persistFloatingPlacementState(args: {
  pos: { top: number; left: number }
  floatingUsesScreenAuthority: boolean
  screenAuthorityHandoffPosRef: React.MutableRefObject<{ left: number; top: number; scale: number } | null>
  widgetWorldPosRef: React.MutableRefObject<{ x: number; y: number } | null>
  persistFloatingPos: (pos: { top: number; left: number }) => void
  readCurrentTransform: () => { k: number; x: number; y: number }
  persistWorldPos: (pos: { x: number; y: number }) => void
}): void {
  const { pos, floatingUsesScreenAuthority, screenAuthorityHandoffPosRef, widgetWorldPosRef, persistFloatingPos, readCurrentTransform, persistWorldPos } = args
  screenAuthorityHandoffPosRef.current = null
  persistFloatingPos(pos)
  if (floatingUsesScreenAuthority) {
    widgetWorldPosRef.current = null
    return
  }
  persistWorldPos(screenToWorld({ transform: readCurrentTransform(), sx: pos.left, sy: pos.top }))
}

export function persistFloatingScreenPlacementState(args: {
  pos: { top: number; left: number }
  persistFloatingPos: (pos: { top: number; left: number }) => void
  widgetWorldPosRef: React.MutableRefObject<{ x: number; y: number } | null>
  lastAppliedRef: React.MutableRefObject<AppliedOverlayPlacement | null>
  screenAuthorityHandoffPosRef: React.MutableRefObject<{ left: number; top: number; scale: number } | null>
  screenAuthorityLayoutZoomBaseRef: React.MutableRefObject<{ left: number; top: number; scale: number } | null>
}): void {
  const { pos, persistFloatingPos, widgetWorldPosRef, lastAppliedRef, screenAuthorityHandoffPosRef, screenAuthorityLayoutZoomBaseRef } = args
  persistFloatingPos(pos)
  widgetWorldPosRef.current = null
  const scale = lastAppliedRef.current?.scale
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1
  screenAuthorityHandoffPosRef.current = { left: pos.left, top: pos.top, scale: safeScale }
  screenAuthorityLayoutZoomBaseRef.current = { left: pos.left, top: pos.top, scale: safeScale }
}

export function readCurrentOverlayScreenPlacementState(args: {
  asideRef: React.MutableRefObject<HTMLElement | null>
}): { left: number; top: number } | null {
  const el = args.asideRef.current
  return el ? readVectorPaintedOverlayPosition(el) : null
}

export function readCurrentOverlayScreenPlacementForHandoffState(args: {
  asideRef: React.MutableRefObject<HTMLElement | null>
}): { left: number; top: number } | null {
  const el = args.asideRef.current
  if (!el) return null
  const painted = readVectorPaintedOverlayPosition(el)
  const rect = el.getBoundingClientRect()
  if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top)) return painted
  if (painted && Math.abs(rect.left) <= 0.001 && Math.abs(rect.top) <= 0.001) return painted
  return { left: rect.left, top: rect.top }
}

export function readStoredFloatingScreenPlacementState(args: {
  nodeId: string
  graphMetaKey?: string | null
}): { left: number; top: number } | null {
  const { nodeId, graphMetaKey } = args
  if (!nodeId) return null
  const state = useGraphStore.getState() as {
    graphData?: unknown
    flowWidgetPosByNodeId?: Record<string, { top: number; left: number }>
    flowWidgetPosByNodeIdByGraphMetaKey?: Record<string, Record<string, { top: number; left: number }>>
  }
  const pos = readScopedFlowWidgetNodeValue({
    nodeId,
    graphMetaKey,
    graphData: state.graphData,
    keyedByGraphMetaKey: state.flowWidgetPosByNodeIdByGraphMetaKey,
    globalByNodeId: state.flowWidgetPosByNodeId,
  })
  const left = typeof pos?.left === 'number' && Number.isFinite(pos.left) ? pos.left : null
  const top = typeof pos?.top === 'number' && Number.isFinite(pos.top) ? pos.top : null
  return left == null || top == null ? null : { left, top }
}

export function persistCurrentScreenPlacementAsWorldPlacementState(args: {
  readCurrentOverlayScreenPlacement: () => { left: number; top: number } | null
  readStoredFloatingScreenPlacement: () => { left: number; top: number } | null
  lastAppliedRef: React.MutableRefObject<AppliedOverlayPlacement | null>
  readPinConversionTransform: () => { k: number; x: number; y: number }
  widgetWorldPosRef: React.MutableRefObject<{ x: number; y: number } | null>
  lastGoodWorldPosRef: React.MutableRefObject<{ x: number; y: number } | null>
  pinnedDragOverrideRef: React.MutableRefObject<{ left: number; top: number } | null>
  persistWorldPos: (pos: { x: number; y: number }) => void
}): boolean {
  const {
    readCurrentOverlayScreenPlacement,
    readStoredFloatingScreenPlacement,
    lastAppliedRef,
    readPinConversionTransform,
    widgetWorldPosRef,
    lastGoodWorldPosRef,
    pinnedDragOverrideRef,
    persistWorldPos,
  } = args
  const current = readCurrentOverlayScreenPlacement()
  const stored = readStoredFloatingScreenPlacement()
  const last = lastAppliedRef.current
  const currentMatchesLast = !!current && !!last
    && Math.abs(current.left - last.left) <= 0.001
    && Math.abs(current.top - last.top) <= 0.001
  const storedMatchesCurrent = !!stored && !!current
    && Math.abs(stored.left - current.left) <= 0.001
    && Math.abs(stored.top - current.top) <= 0.001
  const applied = (current && (!currentMatchesLast || !stored || !storedMatchesCurrent) ? current : null) || stored || current || last
  if (!applied) return false
  const world = screenToWorld({ transform: readPinConversionTransform(), sx: applied.left, sy: applied.top })
  if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) return false
  widgetWorldPosRef.current = world
  lastGoodWorldPosRef.current = world
  pinnedDragOverrideRef.current = { left: applied.left, top: applied.top }
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => {
      const currentOverride = pinnedDragOverrideRef.current
      if (currentOverride && Math.abs(currentOverride.left - applied.left) <= 0.001 && Math.abs(currentOverride.top - applied.top) <= 0.001) {
        pinnedDragOverrideRef.current = null
      }
    })
  }
  persistWorldPos(world)
  return true
}
