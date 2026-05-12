import React from 'react'

import { computeFlowGroupAabb, type FlowNativeRuntime } from '@/components/FlowCanvas/nativeRuntime'
import { placeWidgetsCenteredInGroupBounds } from '@/components/FlowEditor/seedGroupSpread'
import { computeCollectiveFollowPinnedScale, computeWidgetScaledSize, WIDGET_BASE_SIZE } from '@/components/FlowEditor/widgetZoom'
import {
  isCanonicalFrontmatterBuiltInWidgetNode,
  shouldAutoPlaceFlowEditorWidget,
} from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
import { useGraphStore } from '@/hooks/useGraphStore'
import { isWorkspaceGraphMutationBlocked } from '@/features/workspace-table/workspaceTableSsot'
import { getEffectiveZoomStateForKey } from '@/lib/canvas/zoom-effective'
import {
  emitFlowEditorInteractionFrame as emitFlowEditorInteractionFrameEvent,
  FLOW_EDITOR_INTERACTION_FRAME_EVENT,
} from '@/lib/canvas/flow-editor-overlay-proxy'
import {
  computeBalancedSpreadViewportMargins,
  computeBalancedSpreadSpacingPx,
  isHorizontalOverlayStrip,
  isVerticalOverlayCluster,
} from '@/lib/ui/overlayBalancedSpread'
import { useIsomorphicLayoutEffect } from '@/lib/react/useIsomorphicLayoutEffect'
import type { GraphData } from '@/lib/graph/types'
import { readWidgetGridLayoutSettings, snapToGridPx } from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
import { readGraphDataRevision } from '@/lib/graph/documentMetadata'
import { getCachedFlowEditorWidgetPlacementContext } from '@/components/FlowEditorCanvas/runtime/flowEditorRenderGraph'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'
import { resolveBalancedViewportPreset } from '@/lib/graph/frontmatterFlowSettings'
import { isFlowTransformShowingGraph } from '@/components/FlowCanvas/transformGuards'
import { DEFAULT_FLOW_NODE_HEIGHT_PX, DEFAULT_FLOW_NODE_WIDTH_PX } from '@/lib/graph/layoutDefaults'
import { __flowCanvasDebug, syncFlowCanvasDebugWindow } from '@/components/FlowCanvas/flowCanvasDebug'

const FLOW_EDITOR_RUNTIME_SCENE_TRACE_KEY = '__flowEditorRuntimeSceneDebug'

function pushFlowEditorRuntimeSceneTrace(entry: {
  reason: string
  sceneNodeCount: number
  positionsReady: boolean
  workspaceMutationBlocked: boolean
  viewportW: number
  viewportH: number
  transform: { k: number; x: number; y: number } | null
}) {
  if (typeof window === 'undefined') return
  const w = window as Window & {
    [FLOW_EDITOR_RUNTIME_SCENE_TRACE_KEY]?: {
      last: string
      history: Array<{
        ts: number
        reason: string
        sceneNodeCount: number
        positionsReady: boolean
        workspaceMutationBlocked: boolean
        viewportW: number
        viewportH: number
        transform: { k: number; x: number; y: number } | null
      }>
    }
  }
  const sig = [
    entry.reason,
    entry.sceneNodeCount,
    entry.positionsReady ? 1 : 0,
    entry.workspaceMutationBlocked ? 1 : 0,
    `${entry.viewportW}x${entry.viewportH}`,
    entry.transform ? `${Math.round(entry.transform.x)}:${Math.round(entry.transform.y)}:${Math.round(entry.transform.k * 1000)}` : 'none',
  ].join('|')
  const current = w[FLOW_EDITOR_RUNTIME_SCENE_TRACE_KEY] || { last: '', history: [] }
  if (current.last === sig) return
  const nextHistory = current.history.concat([{
    ts: Date.now(),
    reason: entry.reason,
    sceneNodeCount: entry.sceneNodeCount,
    positionsReady: entry.positionsReady,
    workspaceMutationBlocked: entry.workspaceMutationBlocked,
    viewportW: entry.viewportW,
    viewportH: entry.viewportH,
    transform: entry.transform,
  }])
  while (nextHistory.length > 32) nextHistory.shift()
  w[FLOW_EDITOR_RUNTIME_SCENE_TRACE_KEY] = {
    last: sig,
    history: nextHistory,
  }
}

export function useFlowEditorRuntimeScene(args: {
  active: boolean
  openWidgetNodeIds: string[]
  renderGraphDataOverride: GraphData | null
  viewportW: number
  viewportH: number
  schema: unknown
  overlayTopologyLayoutSignature: string
  zoomViewKeyRef: React.MutableRefObject<string | null>
}) {
  const flowRuntimeRefRef = React.useRef<React.MutableRefObject<FlowNativeRuntime | null> | null>(null)
  const latestAutoSeedWorldPosByNodeIdRef = React.useRef<Record<string, { x: number; y: number }>>({})
  const lastUsableZoomTransformRef = React.useRef<{ k: number; x: number; y: number } | null>(null)
  const workspaceMutationBlocked = useGraphStore(s => isWorkspaceGraphMutationBlocked(s))
  const flowWidgetWorldPosCount = useGraphStore(s => Object.keys(s.flowWidgetWorldPosByNodeId || {}).length)
  const flowWidgetPinnedCount = useGraphStore(s => Object.keys(s.flowWidgetPinnedByNodeId || {}).length)
  const workspaceMutationBlockedPrevRef = React.useRef<boolean>(workspaceMutationBlocked)
  const lastInteractionFrameAtMsRef = React.useRef<number>(0)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const markInteraction = () => {
      lastInteractionFrameAtMsRef.current = Date.now()
    }
    try {
      window.addEventListener(FLOW_EDITOR_INTERACTION_FRAME_EVENT, markInteraction as EventListener)
    } catch {
      void 0
    }
    return () => {
      try {
        window.removeEventListener(FLOW_EDITOR_INTERACTION_FRAME_EVENT, markInteraction as EventListener)
      } catch {
        void 0
      }
    }
  }, [])

  const getLiveNodeWorldPos = React.useCallback((nodeId: string) => {
    const id = String(nodeId || '').trim()
    if (!id) return null
    const runtime = flowRuntimeRefRef.current?.current
    if (!runtime || runtime.positionsReady !== true) return null
    const n = runtime.scene?.nodeById?.get(id) || null
    if (!n) return null
    const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
    const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
    if (x == null || y == null) return null
    return { x, y }
  }, [])

  const getLiveZoomTransform = React.useCallback(() => {
    const runtime = flowRuntimeRefRef.current?.current
    const sceneNodes = runtime?.scene?.nodes
    const sceneNodeCount = Array.isArray(sceneNodes) ? sceneNodes.length : 0
    const workspaceMutationBlocked = isWorkspaceGraphMutationBlocked(useGraphStore.getState())
    const positionsReady = runtime?.positionsReady === true
    const interactionInProgress = Date.now() - lastInteractionFrameAtMsRef.current < 620
    const flowWidgetDraggingNodeId = String(useGraphStore.getState().flowWidgetDraggingNodeId || '').trim()
    const flowWidgetDragging = flowWidgetDraggingNodeId.length > 0
    if (Array.isArray(sceneNodes) && sceneNodes.length <= 0) {
      const lastUsable = lastUsableZoomTransformRef.current
      if (lastUsable) {
        pushFlowEditorRuntimeSceneTrace({
          reason: 'scene-empty-using-last-usable-transform',
          sceneNodeCount,
          positionsReady,
          workspaceMutationBlocked,
          viewportW: args.viewportW,
          viewportH: args.viewportH,
          transform: lastUsable,
        })
        return lastUsable
      }
      if (workspaceMutationBlocked) {
        pushFlowEditorRuntimeSceneTrace({
          reason: 'scene-empty-workspace-blocked-awaiting-live-transform',
          sceneNodeCount,
          positionsReady,
          workspaceMutationBlocked,
          viewportW: args.viewportW,
          viewportH: args.viewportH,
          transform: null,
        })
        return null
      }
      const st = useGraphStore.getState()
      const persisted = getEffectiveZoomStateForKey({
        zoomViewKey: args.zoomViewKeyRef.current,
        zoomStateByKey: st.zoomStateByKey,
        zoomState: st.zoomState,
      })
      const persistedK = typeof persisted?.k === 'number' && Number.isFinite(persisted.k) ? persisted.k : null
      const persistedX = typeof persisted?.x === 'number' && Number.isFinite(persisted.x) ? persisted.x : null
      const persistedY = typeof persisted?.y === 'number' && Number.isFinite(persisted.y) ? persisted.y : null
      const persistedLooksSafeForWorkspaceBlocked =
        persistedK != null
        && persistedX != null
        && persistedY != null
        && Math.abs(persistedX) <= args.viewportW * 0.6
        && Math.abs(persistedY) <= args.viewportH * 0.6
      const allowPersistedDuringActiveInteraction = interactionInProgress || flowWidgetDragging
      if (
        persistedK != null
        && persistedX != null
        && persistedY != null
        && (
          !workspaceMutationBlocked
          || persistedLooksSafeForWorkspaceBlocked
          || allowPersistedDuringActiveInteraction
        )
      ) {
        const persistedTransform = { k: persistedK, x: persistedX, y: persistedY }
        pushFlowEditorRuntimeSceneTrace({
          reason: 'scene-empty-using-persisted-transform',
          sceneNodeCount,
          positionsReady,
          workspaceMutationBlocked,
          viewportW: args.viewportW,
          viewportH: args.viewportH,
          transform: persistedTransform,
        })
        return persistedTransform
      }
      if (workspaceMutationBlocked && persistedK != null && persistedX != null && persistedY != null) {
        pushFlowEditorRuntimeSceneTrace({
          reason: 'scene-empty-persisted-transform-rejected-workspace-blocked',
          sceneNodeCount,
          positionsReady,
          workspaceMutationBlocked,
          viewportW: args.viewportW,
          viewportH: args.viewportH,
          transform: { k: persistedK, x: persistedX, y: persistedY },
        })
      }
      // Overlay-only runtime can transiently report empty scene during workspace recomposition.
      // Fall back to neutral only if no prior usable transform exists.
      pushFlowEditorRuntimeSceneTrace({
        reason: 'scene-empty-neutral-transform',
        sceneNodeCount,
        positionsReady,
        workspaceMutationBlocked,
        viewportW: args.viewportW,
        viewportH: args.viewportH,
        transform: { k: 1, x: 0, y: 0 },
      })
      return { k: 1, x: 0, y: 0 }
    }
    const t = runtime?.transform || null
    const k = typeof t?.k === 'number' && Number.isFinite(t.k) ? t.k : null
    const x = typeof t?.x === 'number' && Number.isFinite(t.x) ? t.x : null
    const y = typeof t?.y === 'number' && Number.isFinite(t.y) ? t.y : null
    if (k == null || x == null || y == null) {
      pushFlowEditorRuntimeSceneTrace({
        reason: 'runtime-transform-unavailable',
        sceneNodeCount,
        positionsReady,
        workspaceMutationBlocked,
        viewportW: args.viewportW,
        viewportH: args.viewportH,
        transform: null,
      })
      return null
    }
    const next = { k, x, y }
    if (workspaceMutationBlocked && sceneNodeCount > 0 && !interactionInProgress && !flowWidgetDragging) {
      const visible = isFlowTransformShowingGraph(next, {
        nodes: sceneNodes as Array<{ x?: unknown; y?: unknown }>,
        viewportW: args.viewportW,
        viewportH: args.viewportH,
        nodeW: DEFAULT_FLOW_NODE_WIDTH_PX,
        nodeH: DEFAULT_FLOW_NODE_HEIGHT_PX,
      })
      if (!visible) {
        const lastUsable = lastUsableZoomTransformRef.current
        if (lastUsable) {
          pushFlowEditorRuntimeSceneTrace({
            reason: 'workspace-blocked-offscreen-transform-reusing-last-usable',
            sceneNodeCount,
            positionsReady,
            workspaceMutationBlocked,
            viewportW: args.viewportW,
            viewportH: args.viewportH,
            transform: next,
          })
          return lastUsable
        }
        pushFlowEditorRuntimeSceneTrace({
          reason: 'workspace-blocked-offscreen-transform-neutralized',
          sceneNodeCount,
          positionsReady,
          workspaceMutationBlocked,
          viewportW: args.viewportW,
          viewportH: args.viewportH,
          transform: next,
        })
        return { k: 1, x: 0, y: 0 }
      }
    }
    lastUsableZoomTransformRef.current = next
    pushFlowEditorRuntimeSceneTrace({
      reason: 'runtime-transform-live',
      sceneNodeCount,
      positionsReady,
      workspaceMutationBlocked,
      viewportW: args.viewportW,
      viewportH: args.viewportH,
      transform: next,
    })
    return next
  }, [args.viewportH, args.viewportW])

  const getLiveContainmentGroupAabbForNode = React.useCallback((nodeId: string) => {
    const id = String(nodeId || '').trim()
    if (!id) return null
    const runtime = flowRuntimeRefRef.current?.current
    const scene = runtime?.scene
    if (!runtime || !scene) return null
    const groupIds = scene.groupIdsByNodeId?.get(id) || []
    if (!groupIds.length) return null
    const groups = Array.isArray(scene.groups) ? scene.groups : []
    if (groups.length === 0) return null

    const groupById = new Map<string, (typeof groups)[number]>()
    for (let i = 0; i < groups.length; i += 1) {
      const g = groups[i]
      const gid = String(g?.id || '').trim()
      if (gid && !groupById.has(gid)) groupById.set(gid, g)
    }

    const isContainmentGroup = (g: { id?: unknown; source?: unknown } | null): boolean => {
      if (!g) return false
      const src = String(g.source || '').trim()
      if (src === 'userSubgraph' || src === 'mermaidSubgraph' || src === 'layer' || src === 'community') return true
      const gid = String(g.id || '')
      if (gid.startsWith('subgraph:') || gid.startsWith('layer:') || gid.startsWith('community:')) return true
      return false
    }

    let bestId: string | null = null
    let bestDepth = -Infinity
    let bestSize = Infinity
    for (let i = 0; i < groupIds.length; i += 1) {
      const gid = String(groupIds[i] || '').trim()
      if (!gid) continue
      const g = groupById.get(gid) || null
      if (!isContainmentGroup(g)) continue
      const depthRaw = (g as unknown as { depth?: unknown })?.depth
      const depth = typeof depthRaw === 'number' && Number.isFinite(depthRaw) ? Math.max(0, Math.floor(depthRaw)) : 0
      const members = Array.isArray((g as unknown as { memberNodeIds?: unknown })?.memberNodeIds)
        ? ((g as unknown as { memberNodeIds: unknown[] }).memberNodeIds as unknown[])
        : []
      const size = members.length
      if (
        bestId == null
        || depth > bestDepth
        || (depth === bestDepth && size < bestSize)
        || (depth === bestDepth && size === bestSize && gid.localeCompare(bestId) < 0)
      ) {
        bestId = gid
        bestDepth = depth
        bestSize = size
      }
    }
    if (!bestId) return null
    const best = groupById.get(bestId) || null
    if (!best) return null

    const st = useGraphStore.getState()
    const t =
      getLiveZoomTransform() ||
      getEffectiveZoomStateForKey({
        zoomViewKey: args.zoomViewKeyRef.current,
        zoomStateByKey: st.zoomStateByKey,
        zoomState: st.zoomState,
      }) ||
      { k: 1, x: 0, y: 0 }
    const cfg = runtime.presentation.groups
    const aabb = computeFlowGroupAabb({
      scene,
      group: best as never,
      paddingPx: cfg.paddingPx,
      labelTopExtraPx: cfg.labelTopExtraPx,
    })
    if (!aabb) return null
    return { groupId: bestId, ...aabb }
  }, [args.zoomViewKeyRef, getLiveZoomTransform])

  const renderGraphDataOverrideRef = React.useRef<GraphData | null>(args.renderGraphDataOverride)
  React.useEffect(() => {
    renderGraphDataOverrideRef.current = args.renderGraphDataOverride
  }, [args.renderGraphDataOverride])

  const seededPinnedWidgetWorldPosKeyRef = React.useRef<string>('')
  const lastAutoSeedLayoutSignatureRef = React.useRef<string>('')
  React.useEffect(() => {
    const prev = workspaceMutationBlockedPrevRef.current
    workspaceMutationBlockedPrevRef.current = workspaceMutationBlocked
    if (workspaceMutationBlocked !== true || prev === true) return
    // Reset transient transform/seed authorities when Workspace overlay re-opens
    // so reopen cannot reuse stale far-right pre-init placement state.
    lastUsableZoomTransformRef.current = null
    latestAutoSeedWorldPosByNodeIdRef.current = {}
    seededPinnedWidgetWorldPosKeyRef.current = ''
    lastAutoSeedLayoutSignatureRef.current = ''
  }, [workspaceMutationBlocked])
  useIsomorphicLayoutEffect(() => {
    if (!args.active) return
    const st = useGraphStore.getState()
    const graphDataForSeeding = renderGraphDataOverrideRef.current || st.graphData || null
    const nodeTypeById = new Map<string, string>()
    const graphNodes = Array.isArray(graphDataForSeeding?.nodes) ? graphDataForSeeding.nodes : []
    for (let i = 0; i < graphNodes.length; i += 1) {
      const node = graphNodes[i]
      const id = String(node?.id || '').trim()
      if (!id || nodeTypeById.has(id)) continue
      nodeTypeById.set(id, String(node?.type || '').trim())
    }
    const widgetPlacementContext = getCachedFlowEditorWidgetPlacementContext({
      graphData: graphDataForSeeding,
      graphRevision: readGraphDataRevision(graphDataForSeeding),
      openWidgetNodeIds: args.openWidgetNodeIds,
      preferCurrentGraphDataRefs: true,
    })
    const graphMetaKind = widgetPlacementContext?.graphMetaKind || null
    const defaultPinnedInCanvas = widgetPlacementContext?.defaultPinnedInCanvas ?? true
    const pinnedById = st.flowWidgetPinnedByNodeId || {}
    const worldById =
      (st as unknown as { flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }> })
        .flowWidgetWorldPosByNodeId || {}
    const effectiveOpenIds = Array.isArray(widgetPlacementContext?.effectiveOpenWidgetNodeIds)
      ? widgetPlacementContext!.effectiveOpenWidgetNodeIds
      : []
    const effectiveOrFallbackOpenIds = effectiveOpenIds.length > 0
      ? effectiveOpenIds
      : (
          graphMetaKind === 'frontmatter-flow'
            ? Object.keys(worldById)
              .map(id => String(id || '').trim())
              .filter(Boolean)
            : []
        )
    if (effectiveOrFallbackOpenIds.length === 0) return
    const runtimeSceneNodeCount = (() => {
      const runtime = flowRuntimeRefRef.current?.current
      const nodes = runtime?.scene?.nodes
      return Array.isArray(nodes) ? nodes.length : 0
    })()
    const forceSceneEmptyReseed = runtimeSceneNodeCount <= 0 && graphMetaKind === 'frontmatter-flow'

    const pendingRaw = effectiveOrFallbackOpenIds
      .map(id => String(id || '').trim())
      .filter(Boolean)
      .filter(id => {
        const v = pinnedById[id]
        const pinned = typeof v === 'boolean' ? v : defaultPinnedInCanvas
        if (!pinned) return false
        if (forceSceneEmptyReseed) return true
        if (!shouldAutoPlaceFlowEditorWidget({ graphMetaKind, pinnedInCanvas: pinned, worldPos: worldById[id] })) return false
        const w = worldById[id]
        return !(w && Number.isFinite(w.x) && Number.isFinite(w.y))
      })

    const liveZoom = getLiveZoomTransform()
    const persistedZoom =
      getEffectiveZoomStateForKey({
        zoomViewKey: args.zoomViewKeyRef.current,
        zoomStateByKey: st.zoomStateByKey,
        zoomState: st.zoomState,
      }) || null
    const liveLooksDefault =
      !liveZoom
      || (
        Math.abs((Number.isFinite(liveZoom.k) ? liveZoom.k : 1) - 1) <= 1e-6
        && Math.abs(Number.isFinite(liveZoom.x) ? liveZoom.x : 0) <= 0.5
        && Math.abs(Number.isFinite(liveZoom.y) ? liveZoom.y : 0) <= 0.5
      )
    const persistedHasViewportOffset =
      !!persistedZoom
      && (
        Math.abs((Number.isFinite(persistedZoom.k) ? persistedZoom.k : 1) - 1) > 1e-3
        || Math.abs(Number.isFinite(persistedZoom.x) ? persistedZoom.x : 0) > 0.5
        || Math.abs(Number.isFinite(persistedZoom.y) ? persistedZoom.y : 0) > 0.5
      )
    const isFrontmatterFlow = graphMetaKind === 'frontmatter-flow'
    const isFirstFrontmatterInitSeed = isFrontmatterFlow && seededPinnedWidgetWorldPosKeyRef.current.length === 0
    const shouldUseNeutralSeedZoomForFrontmatterInit =
      isFirstFrontmatterInitSeed
    const shouldUseNeutralSeedZoom =
      runtimeSceneNodeCount <= 0
      || shouldUseNeutralSeedZoomForFrontmatterInit
    const allowPersistedViewportOffsetSeed = !isWorkspaceGraphMutationBlocked(st)
    const z =
      (shouldUseNeutralSeedZoom ? { k: 1, x: 0, y: 0 } : null)
      || (allowPersistedViewportOffsetSeed && persistedHasViewportOffset && liveLooksDefault ? persistedZoom : null)
      || liveZoom
      || persistedZoom
      || { k: 1, x: 0, y: 0 }
    const zoomK = typeof z.k === 'number' && Number.isFinite(z.k) ? z.k : 1
    const balancedViewportPreset = resolveBalancedViewportPreset({
      graphData: graphDataForSeeding,
      fallbackPreset: isFrontmatterFlow ? 'widgetFrontmatter' : 'widgetCanvas',
    })
    const spreadMargins = computeBalancedSpreadViewportMargins({
      viewportW: args.viewportW,
      viewportH: args.viewportH,
      preset: balancedViewportPreset,
    })
    const baseGapPx = Math.max(
      12,
      Math.min(40, Math.round(Math.max(1, args.viewportW - spreadMargins.left - spreadMargins.right) * 0.012)),
    )
    const pinnedOpenIds = (
      isFrontmatterFlow
        ? effectiveOrFallbackOpenIds
            .map(id => String(id || '').trim())
            .filter(Boolean)
        : effectiveOrFallbackOpenIds
            .map(id => String(id || '').trim())
            .filter(Boolean)
            .filter(id => {
              const v = pinnedById[id]
              return typeof v === 'boolean' ? v : defaultPinnedInCanvas
            })
    )
      .filter((id, index, arr) => arr.indexOf(id) === index)
      .sort((a, b) => a.localeCompare(b))
    const useViewportOnlyBucket = isFrontmatterFlow || pinnedOpenIds.length >= 12
    let panelScale = computeCollectiveFollowPinnedScale({
      zoomK,
      viewportW: args.viewportW,
      viewportH: args.viewportH,
      count: Math.max(1, pinnedOpenIds.length),
      baseWidth: WIDGET_BASE_SIZE.width,
      baseHeight: WIDGET_BASE_SIZE.height,
    })
    const panelScreen = computeWidgetScaledSize(panelScale)
    const panelWorldW = panelScreen.width / Math.max(0.001, zoomK)
    const panelWorldH = panelScreen.height / Math.max(0.001, zoomK)
    const widgetGrid = readWidgetGridLayoutSettings(args.schema)

    const gapBasePx = widgetGrid.gridEnabled ? Math.max(baseGapPx, widgetGrid.gapPx) : baseGapPx
    const gapScreenPx = computeBalancedSpreadSpacingPx({
      baseGapPx: gapBasePx,
      zoomK,
      count: Math.max(1, pinnedOpenIds.length),
    })
    const gapWorld = gapScreenPx / Math.max(0.001, zoomK)
    const cellW = (panelScreen.width + gapScreenPx) / Math.max(0.001, zoomK)
    const cellH = (panelScreen.height + gapScreenPx) / Math.max(0.001, zoomK)
    const worldStep = widgetGrid.gridEnabled && !isFrontmatterFlow ? Math.max(1, widgetGrid.stepPx) : 1
    const snapWorld = (v: number) => (worldStep > 1 ? snapToGridPx(v, worldStep) : v)
    const safeZoomK = Math.max(0.001, zoomK)
    const zoomX = typeof z.x === 'number' && Number.isFinite(z.x) ? z.x : 0
    const zoomY = typeof z.y === 'number' && Number.isFinite(z.y) ? z.y : 0
    const viewportBounds = useViewportOnlyBucket
      ? {
          minX: (0 - zoomX) / safeZoomK,
          minY: (0 - zoomY) / safeZoomK,
          maxX: (args.viewportW - zoomX) / safeZoomK,
          maxY: (args.viewportH - zoomY) / safeZoomK,
        }
      : {
          minX: (spreadMargins.left - zoomX) / safeZoomK,
          minY: (spreadMargins.top - zoomY) / safeZoomK,
          maxX: (args.viewportW - spreadMargins.right - zoomX) / safeZoomK,
          maxY: (args.viewportH - spreadMargins.bottom - zoomY) / safeZoomK,
        }
    const normalizeSeedBoundsToViewport = (bounds: { minX: number; minY: number; maxX: number; maxY: number }) => {
      const bounded = {
        minX: Number.isFinite(bounds.minX) ? bounds.minX : viewportBounds.minX,
        minY: Number.isFinite(bounds.minY) ? bounds.minY : viewportBounds.minY,
        maxX: Number.isFinite(bounds.maxX) ? bounds.maxX : viewportBounds.maxX,
        maxY: Number.isFinite(bounds.maxY) ? bounds.maxY : viewportBounds.maxY,
      }
      const intersected = {
        minX: Math.max(viewportBounds.minX, bounded.minX),
        minY: Math.max(viewportBounds.minY, bounded.minY),
        maxX: Math.min(viewportBounds.maxX, bounded.maxX),
        maxY: Math.min(viewportBounds.maxY, bounded.maxY),
      }
      if (intersected.maxX - intersected.minX >= 1 && intersected.maxY - intersected.minY >= 1) return intersected
      return viewportBounds
    }
    const placeSpreadGridInBounds = (ids: string[], bounds: { minX: number; minY: number; maxX: number; maxY: number }) =>
      placeWidgetsCenteredInGroupBounds({
        ids,
        bounds: normalizeSeedBoundsToViewport(bounds),
        cellW,
        cellH,
        gapWorld,
        snapWorld,
      })

    const viewportBucketId = '__viewport__'
    const allBoundsByBucket = new Map<string, { minX: number; minY: number; maxX: number; maxY: number }>()
    allBoundsByBucket.set(viewportBucketId, viewportBounds)
    for (let i = 0; i < pinnedOpenIds.length; i += 1) {
      const id = pinnedOpenIds[i]!
      if (useViewportOnlyBucket) continue
      const group = getLiveContainmentGroupAabbForNode(id)
      if (!group) continue
      allBoundsByBucket.set(
        `group:${group.groupId}`,
        normalizeSeedBoundsToViewport({ minX: group.minX, minY: group.minY, maxX: group.maxX, maxY: group.maxY }),
      )
    }

    const bucketSignature = Array.from(allBoundsByBucket.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bucketId, bounds]) => {
        const minX = Math.round(bounds.minX * 1000) / 1000
        const minY = Math.round(bounds.minY * 1000) / 1000
        const maxX = Math.round(bounds.maxX * 1000) / 1000
        const maxY = Math.round(bounds.maxY * 1000) / 1000
        return `${bucketId}:${minX},${minY},${maxX},${maxY}`
      })
      .join('|')
    const currentLayoutSignature = `${args.overlayTopologyLayoutSignature}|${args.zoomViewKeyRef.current || ''}|${args.viewportW}x${args.viewportH}|${bucketSignature}`

    const overlapEligible = (() => {
      const idsByBucket = new Map<string, string[]>()
      const pinnedWorldIdsByBucket = new Map<string, string[]>()
      const autoSeedWorldById = latestAutoSeedWorldPosByNodeIdRef.current || {}
      const autoSeedLayoutChanged =
        lastAutoSeedLayoutSignatureRef.current.length > 0
        && lastAutoSeedLayoutSignatureRef.current !== currentLayoutSignature
      for (let i = 0; i < pinnedOpenIds.length; i += 1) {
        const id = pinnedOpenIds[i]!
        const world = worldById[id]
        const group = useViewportOnlyBucket ? null : getLiveContainmentGroupAabbForNode(id)
        const bucketId = group ? `group:${group.groupId}` : viewportBucketId
        if (world && Number.isFinite(world.x) && Number.isFinite(world.y)) {
          const pinnedList = pinnedWorldIdsByBucket.get(bucketId) || []
          pinnedList.push(id)
          pinnedWorldIdsByBucket.set(bucketId, pinnedList)
        }
        const nodeTypeId = nodeTypeById.get(id) || ''
        const frontmatterPinnedWidget =
          graphMetaKind === 'frontmatter-flow'
          && isCanonicalFrontmatterBuiltInWidgetNode({ id, type: nodeTypeId })
        if (!shouldAutoPlaceFlowEditorWidget({ graphMetaKind, pinnedInCanvas: true, worldPos: world, nodeTypeId }) && !frontmatterPinnedWidget) continue
        if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) continue
        const list = idsByBucket.get(bucketId) || []
        list.push(id)
        idsByBucket.set(bucketId, list)
      }
      const overlappingIds = new Set<string>()
      const isOutsideViewportBounds = (id: string, bucketId: string) => {
        const world = worldById[id]
        if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) return false
        const bounds = allBoundsByBucket.get(bucketId) || viewportBounds
        const left = world.x
        const top = world.y
        const right = left + panelWorldW
        const bottom = top + panelWorldH
        if (right <= bounds.minX) return true
        if (bottom <= bounds.minY) return true
        if (left >= bounds.maxX) return true
        if (top >= bounds.maxY) return true
        return false
      }
      const hasOverlap = (aId: string, bId: string) => {
        const a = worldById[aId]
        const b = worldById[bId]
        if (!a || !b) return false
        const overlapX = a.x < b.x + panelWorldW && b.x < a.x + panelWorldW
        const overlapY = a.y < b.y + panelWorldH && b.y < a.y + panelWorldH
        return overlapX && overlapY
      }
      for (const [bucketId, pinnedIds] of pinnedWorldIdsByBucket.entries()) {
        for (let i = 0; i < pinnedIds.length; i += 1) {
          const id = pinnedIds[i]!
          if (isOutsideViewportBounds(id, bucketId)) overlappingIds.add(id)
          if (!autoSeedLayoutChanged) continue
          const prevAuto = autoSeedWorldById[id]
          if (!prevAuto || !Number.isFinite(prevAuto.x) || !Number.isFinite(prevAuto.y)) continue
          if (!worldById[id] || !Number.isFinite(worldById[id]!.x) || !Number.isFinite(worldById[id]!.y)) continue
          if (Math.abs(worldById[id]!.x - prevAuto.x) > 0.01 || Math.abs(worldById[id]!.y - prevAuto.y) > 0.01) continue
          overlappingIds.add(id)
        }
      }
      for (const ids of idsByBucket.values()) {
        const bucketItems = ids
          .map(id => {
            const world = worldById[id]
            if (!world) return null
            return { id, left: world.x, top: world.y, width: panelWorldW, height: panelWorldH }
          })
          .filter((item): item is { id: string; left: number; top: number; width: number; height: number } => !!item)
        const hasResidueCluster =
          bucketItems.length >= 3
          && (
            isVerticalOverlayCluster({ items: bucketItems, gapPx: gapWorld })
            || isHorizontalOverlayStrip({ items: bucketItems, gapPx: gapWorld })
          )
        if (hasResidueCluster) {
          for (let i = 0; i < bucketItems.length; i += 1) overlappingIds.add(bucketItems[i]!.id)
          continue
        }
        for (let i = 0; i < ids.length; i += 1) {
          const a = ids[i]!
          for (let j = i + 1; j < ids.length; j += 1) {
            const b = ids[j]!
            if (!hasOverlap(a, b)) continue
            overlappingIds.add(a)
            overlappingIds.add(b)
          }
        }
      }
      return Array.from(overlappingIds)
    })()
    let pending = Array.from(new Set([...pendingRaw, ...overlapEligible])).sort((a, b) => a.localeCompare(b))
    if (pending.length === 0 && pinnedOpenIds.length > 0) {
      const offscreenPinned = pinnedOpenIds
        .filter(id => {
          const world = worldById[id]
          if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) return false
          const left = world.x
          const top = world.y
          const right = world.x + panelWorldW
          const bottom = world.y + panelWorldH
          if (right <= viewportBounds.minX) return true
          if (bottom <= viewportBounds.minY) return true
          if (left >= viewportBounds.maxX) return true
          if (top >= viewportBounds.maxY) return true
          return false
        })
        .sort((a, b) => a.localeCompare(b))
      if (offscreenPinned.length > 0) pending = offscreenPinned
    }
    if (pending.length === 0) return

    const idsByBucket = new Map<string, string[]>()
    const boundsByBucket = new Map<string, { minX: number; minY: number; maxX: number; maxY: number }>()
    boundsByBucket.set(viewportBucketId, viewportBounds)
    for (let i = 0; i < pending.length; i += 1) {
      const id = pending[i]!
      const group = useViewportOnlyBucket ? null : getLiveContainmentGroupAabbForNode(id)
      const bucketId = group ? `group:${group.groupId}` : viewportBucketId
      const list = idsByBucket.get(bucketId) || []
      list.push(id)
      idsByBucket.set(bucketId, list)
      if (group) {
        boundsByBucket.set(
          bucketId,
          normalizeSeedBoundsToViewport({ minX: group.minX, minY: group.minY, maxX: group.maxX, maxY: group.maxY }),
        )
      }
    }
    const bucketIds = Array.from(idsByBucket.keys()).sort((a, b) => a.localeCompare(b))
    const pendingSet = new Set(pending)
    const seedKey = `${pending.join(',')}|${currentLayoutSignature}`
    const collectiveOutsideViewport = (() => {
      if (pending.length === 0) return false
      let minLeft = Number.POSITIVE_INFINITY
      let minTop = Number.POSITIVE_INFINITY
      let maxRight = Number.NEGATIVE_INFINITY
      let maxBottom = Number.NEGATIVE_INFINITY
      for (let i = 0; i < pending.length; i += 1) {
        const id = pending[i]!
        const world = worldById[id]
        if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) continue
        const left = world.x
        const top = world.y
        const right = world.x + panelWorldW
        const bottom = world.y + panelWorldH
        minLeft = Math.min(minLeft, left)
        minTop = Math.min(minTop, top)
        maxRight = Math.max(maxRight, right)
        maxBottom = Math.max(maxBottom, bottom)
      }
      if (!Number.isFinite(minLeft) || !Number.isFinite(minTop) || !Number.isFinite(maxRight) || !Number.isFinite(maxBottom)) return false
      const marginWorld = Math.max(panelWorldW, panelWorldH) * 0.2
      if (maxRight < viewportBounds.minX - marginWorld) return true
      if (maxBottom < viewportBounds.minY - marginWorld) return true
      if (minLeft > viewportBounds.maxX + marginWorld) return true
      if (minTop > viewportBounds.maxY + marginWorld) return true
      return false
    })()
    if (seededPinnedWidgetWorldPosKeyRef.current === seedKey && !collectiveOutsideViewport && !forceSceneEmptyReseed) return

    const nextWorld = { ...worldById }
    let changed = false
    const nextAutoSeedPositions: Record<string, { x: number; y: number }> = {}
    for (let i = 0; i < bucketIds.length; i += 1) {
      const bucketId = bucketIds[i]!
      const ids = (idsByBucket.get(bucketId) || [])
        .filter(id => pendingSet.has(id))
        .sort((a, b) => a.localeCompare(b))
      if (ids.length === 0) continue
      const bounds = boundsByBucket.get(bucketId) || viewportBounds
      const placed = placeSpreadGridInBounds(ids, bounds)
      for (let j = 0; j < placed.length; j += 1) {
        const p = placed[j]!
        const prev = worldById[p.id]
        if (!prev || Math.abs(prev.x - p.x) > 0.0001 || Math.abs(prev.y - p.y) > 0.0001) changed = true
        nextWorld[p.id] = { x: p.x, y: p.y }
        nextAutoSeedPositions[p.id] = { x: p.x, y: p.y }
      }
    }
    const autoSeedIds = Object.keys(nextAutoSeedPositions)
    if (autoSeedIds.length > 0) {
      let minLeft = Number.POSITIVE_INFINITY
      let minTop = Number.POSITIVE_INFINITY
      let maxRight = Number.NEGATIVE_INFINITY
      let maxBottom = Number.NEGATIVE_INFINITY
      let centroidX = 0
      let centroidY = 0
      for (let i = 0; i < autoSeedIds.length; i += 1) {
        const id = autoSeedIds[i]!
        const world = nextWorld[id]
        if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) continue
        const left = world.x
        const top = world.y
        const right = world.x + panelWorldW
        const bottom = world.y + panelWorldH
        minLeft = Math.min(minLeft, left)
        minTop = Math.min(minTop, top)
        maxRight = Math.max(maxRight, right)
        maxBottom = Math.max(maxBottom, bottom)
        centroidX += left + panelWorldW / 2
        centroidY += top + panelWorldH / 2
      }
      const hasBounds =
        Number.isFinite(minLeft)
        && Number.isFinite(minTop)
        && Number.isFinite(maxRight)
        && Number.isFinite(maxBottom)
      if (hasBounds) {
        centroidX /= Math.max(1, autoSeedIds.length)
        centroidY /= Math.max(1, autoSeedIds.length)
        const targetCenterX = (viewportBounds.minX + viewportBounds.maxX) / 2
        const targetCenterY = (viewportBounds.minY + viewportBounds.maxY) / 2
        const minDx = viewportBounds.minX - minLeft
        const maxDx = viewportBounds.maxX - maxRight
        const minDy = viewportBounds.minY - minTop
        const maxDy = viewportBounds.maxY - maxBottom
        const shiftX = Math.max(minDx, Math.min(maxDx, targetCenterX - centroidX))
        const shiftY = Math.max(minDy, Math.min(maxDy, targetCenterY - centroidY))
        if (Math.abs(shiftX) > 0.0001 || Math.abs(shiftY) > 0.0001) {
          for (let i = 0; i < autoSeedIds.length; i += 1) {
            const id = autoSeedIds[i]!
            const world = nextWorld[id]
            if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) continue
            const x = world.x + shiftX
            const y = world.y + shiftY
            nextWorld[id] = { x, y }
            nextAutoSeedPositions[id] = { x, y }
          }
          changed = true
        }
      }
    }
    latestAutoSeedWorldPosByNodeIdRef.current = nextAutoSeedPositions
    const nextWidgetWorldRectById: Record<string, { left: number; top: number; width: number; height: number }> = {}
    for (let i = 0; i < autoSeedIds.length; i += 1) {
      const id = autoSeedIds[i]!
      const world = nextWorld[id]
      if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) continue
      nextWidgetWorldRectById[id] = { left: world.x, top: world.y, width: panelWorldW, height: panelWorldH }
    }
    __flowCanvasDebug.widgetWorldRectById = nextWidgetWorldRectById
    syncFlowCanvasDebugWindow()
    if (!changed) {
      seededPinnedWidgetWorldPosKeyRef.current = seedKey
      lastAutoSeedLayoutSignatureRef.current = currentLayoutSignature
      return
    }
    const workspaceMutationBlocked = isWorkspaceGraphMutationBlocked(st)
    const hasMissingWorldSeeds = pendingRaw.length > 0
    const hasDriftReseedCandidates = overlapEligible.length > 0 || forceSceneEmptyReseed
    if (workspaceMutationBlocked && !collectiveOutsideViewport && !hasMissingWorldSeeds && !hasDriftReseedCandidates) return
    seededPinnedWidgetWorldPosKeyRef.current = seedKey
    lastAutoSeedLayoutSignatureRef.current = currentLayoutSignature
    if (workspaceMutationBlocked) {
      useGraphStore.setState(prev => {
        const prevState = prev as unknown as {
          graphData?: GraphData | null
          flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }>
          flowWidgetWorldPosByNodeIdByGraphMetaKey?: Record<string, Record<string, { x: number; y: number }>>
        }
        const prevWorld = (prev as unknown as { flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }> })
          .flowWidgetWorldPosByNodeId || {}
        const prevKeys = Object.keys(prevWorld)
        const nextKeys = Object.keys(nextWorld)
        if (prevKeys.length === nextKeys.length) {
          let unchanged = true
          for (let i = 0; i < nextKeys.length; i += 1) {
            const key = nextKeys[i]!
            const a = prevWorld[key]
            const b = nextWorld[key]
            if (!a || !b || Math.abs(a.x - b.x) > 0.0001 || Math.abs(a.y - b.y) > 0.0001) {
              unchanged = false
              break
            }
          }
          if (unchanged) return {}
        }
        const graphKey = buildGraphMetaKeyIgnoringPending(prevState.graphData || null)
        const worldByKey = prevState.flowWidgetWorldPosByNodeIdByGraphMetaKey || {}
        const nextWorldByKey = graphKey ? { ...worldByKey, [graphKey]: nextWorld } : worldByKey
        // Keep Workspace/indexing mutation guard semantics by skipping persistence,
        // but still update in-memory world seeds so visible Flow Editor collectives can recover.
        // Mirror graph-keyed world SSOT to prevent stale keyed carry-forward from overriding recovery.
        return graphKey
          ? {
              flowWidgetWorldPosByNodeId: nextWorld,
              flowWidgetWorldPosByNodeIdByGraphMetaKey: nextWorldByKey,
            }
          : { flowWidgetWorldPosByNodeId: nextWorld }
      })
      return
    }
    st.setFlowWidgetWorldPosByNodeId(nextWorld)
  }, [
    args.active,
    args.openWidgetNodeIds,
    args.overlayTopologyLayoutSignature,
    args.schema,
    args.viewportH,
    args.viewportW,
    args.zoomViewKeyRef,
    flowWidgetPinnedCount,
    flowWidgetWorldPosCount,
    getLiveContainmentGroupAabbForNode,
    getLiveZoomTransform,
  ])

  const emitFlowEditorInteractionFrame = React.useCallback(() => {
    emitFlowEditorInteractionFrameEvent()
  }, [])

  return {
    emitFlowEditorInteractionFrame,
    flowRuntimeRefRef,
    getLiveContainmentGroupAabbForNode,
    getLiveNodeWorldPos,
    getLiveZoomTransform,
    latestAutoSeedWorldPosByNodeIdRef,
  }
}
