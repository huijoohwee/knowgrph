import type React from 'react'

import * as d3 from 'd3'

import { useGraphStore } from '@/hooks/useGraphStore'
import { hitTestGroup, hitTestNode, requestFlowNativeDraw, setFlowNativeTransform, type FlowNativeDrawArgs, type FlowNativeRuntime } from '@/components/FlowCanvas/nativeRuntime'
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import { computeWheelZoomFactor, computeZoomWheelDeltaYpx } from '@/lib/canvas/zoom-input'
import { lockGlobalUserSelect, unlockGlobalUserSelect } from '@/lib/canvas/interaction-user-select'
import { coerceWheelFallback, resolveWheelAnchor } from '@/lib/canvas/wheel-anchor'
import { computeZoomWheelGuardDecision, type ZoomWheelGuardState } from '@/lib/canvas/zoom-wheel-guard'
import { shouldIgnoreCanvasWheelEvent } from '@/lib/canvas/wheel-target-guard'
import { readCanvasLocalPoint } from '@/lib/canvas/canvas-event-coords'
import { relaxFlowSceneNodePositions } from '@/components/FlowCanvas/relaxScenePositions'
import { computeFlowDragRelaxPolicy } from '@/components/FlowCanvas/relaxStepPolicy'
import {
  computeFlowWheelZoomDurationMs,
  easeOutCubic01,
  lerpNumber,
} from '@/components/FlowCanvas/wheelZoomSmoothing'
import { clampFlowWheelZoomIncrementMultiplier, clampFlowWheelZoomSpeedMultiplier } from '@/lib/canvas/flow-zoom-tuning'
import { cancelFlowZoomRequestAnim } from '@/components/FlowCanvas/applyZoomRequestNative'
import { getFlowAutoMinScale } from '@/components/FlowCanvas/flowScaleExtentOverride'
import { isSpacePanHeld } from '@/lib/canvas/space-pan'
import {
  computeWheelPanDeltaPx,
  isPanDragButton,
  shouldAllowPanDragForPointerEvent,
  shouldStartSelectionDragForPreset,
  shouldSuppressContextMenuForPreset,
} from '@/lib/canvas/viewport-controls'
import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { FlowConfig } from '@/components/FlowCanvas/config'
import { UI_SELECTORS } from '@/lib/config'
import type { ViewportControlsPreset } from '@/lib/config.viewport-controls'
import { clampScale, computeAnchoredZoomTransform, computePinchZoomTransform } from '@/lib/canvas/viewport-transform'
import { createEdgeScrollController } from '@/lib/canvas/edge-scroll'
import {
  clampCanvasInteractionSpeedMultiplier,
  clampCanvasPanSpeedMultiplier,
  readPanSpeed,
  readWheelBehavior,
  readZoomSpeed,
  shouldWheelZoom,
} from '@/lib/canvas/camera-options-2d'
import { disableAutoZoomModesForUserGesture } from '@/lib/canvas/auto-zoom-modes'
import { FLOW_EDITOR_OVERLAY_ROOT_SELECTOR, resolveFlowEditorOverlayProxyTarget } from '@/lib/canvas/flow-editor-overlay-proxy'

export type FlowCanvasDrag =
  | null
  | {
      type: 'pan'
      startSx: number
      startSy: number
      startTx: number
      startTy: number
      pointerId: number
    }
  | {
      type: 'pinch'
      pointerIdA: number
      pointerIdB: number
      startTransform: d3.ZoomTransform
      startA: { sx: number; sy: number }
      startB: { sx: number; sy: number }
      pointerId: number
    }
  | {
      type: 'node'
      nodeId: string
      startWorldX: number
      startWorldY: number
      startNodeX: number
      startNodeY: number
      pointerId: number
    }
  | {
      type: 'group'
      groupId: string
      memberNodeIds: string[]
      startWorldX: number
      startWorldY: number
      startNodePosById: Record<string, { x: number; y: number }>
      pointerId: number
    }
  | {
      type: 'lasso'
      startSx: number
      startSy: number
      lastSx: number
      lastSy: number
      pointerId: number
    }

export function bindFlowCanvasNativeInteractions(args: {
  active: boolean
  canvasEl: HTMLCanvasElement
  runtime: FlowNativeRuntime
  viewportControlsPreset: ViewportControlsPreset
  selectionOnDrag: boolean
  allowNodeDragOverride?: boolean
  collisionDuringDrag: boolean
  requestCommit: () => void
  buildDrawArgs: () => FlowNativeDrawArgs
  setSelectionBox: (next: null | { left: number; top: number; width: number; height: number }) => void
  onInteractionFrame?: () => void
  dragRef: React.MutableRefObject<FlowCanvasDrag>
  lastPointerInCanvasRef: React.MutableRefObject<null | { sx: number; sy: number; ts: number }>
  lastWheelIntentRef: React.MutableRefObject<null | { dir: 'in' | 'out'; ts: number }>
  zoomWheelGuardRef: React.MutableRefObject<ZoomWheelGuardState>
  userSelectLockPointerIdRef: React.MutableRefObject<number | null>
  positionsDirtySinceCommitRef: React.MutableRefObject<boolean>
  collisionSchemaRef: React.MutableRefObject<GraphSchema | null>
  collisionGraphDataRef: React.MutableRefObject<GraphData | null>
  collisionFlowConfigRef: React.MutableRefObject<FlowConfig | null>
  collisionPresentationRef: React.MutableRefObject<
    | {
        portHandles: { enabled: boolean; sizePx: number; offsetPx: number }
      }
    | null
  >
}) {
  const canvasEl = args.canvasEl
  const runtime = args.runtime

  const touchPointsById = new Map<number, { sx: number; sy: number }>()
  const edgeScroll = createEdgeScrollController()

  let pendingDragRelaxRaf: number | null = null
  let lastDragRelaxMs = 0
  let pendingWheelZoomRaf: number | null = null
  let pendingWheelZoomDeltaYpx = 0
  let pendingWheelZoomAnchor: null | { sx: number; sy: number } = null
  let pendingWheelZoomScaleExtent: null | { minK: number; maxK: number } = null

  let wheelZoomAnimRaf: number | null = null
  let wheelZoomAnimStartMs = 0
  let wheelZoomAnimDurationMs = 0
  let wheelZoomAnimFrom: d3.ZoomTransform = d3.zoomIdentity
  let wheelZoomAnimToK = 1
  let wheelZoomAnimAnchor: { sx: number; sy: number } = { sx: 0, sy: 0 }
  let wheelZoomAnimScaleExtent: { minK: number; maxK: number } = { minK: 0.05, maxK: 8 }

  const cancelWheelZoomAnimation = () => {
    if (wheelZoomAnimRaf == null) return
    try {
      cancelAnimationFrame(wheelZoomAnimRaf)
    } catch {
      void 0
    }
    wheelZoomAnimRaf = null
  }

  const tickWheelZoomAnimation = (nowMs: number) => {
    const safeNowMs = Number.isFinite(nowMs) ? nowMs : performance.now()
    const t0 = wheelZoomAnimFrom
    const minK = wheelZoomAnimScaleExtent.minK
    const maxK = wheelZoomAnimScaleExtent.maxK
    const toK = clampScale(wheelZoomAnimToK, { minK, maxK })
    const elapsed = safeNowMs - wheelZoomAnimStartMs
    const raw01 = wheelZoomAnimDurationMs > 0 ? elapsed / wheelZoomAnimDurationMs : 1
    const eased01 = easeOutCubic01(raw01)
    const k = clampScale(lerpNumber(t0.k, toK, eased01), { minK, maxK })
    const anchor = wheelZoomAnimAnchor

    setFlowNativeTransform(runtime, computeAnchoredZoomTransform({ transform: t0, anchor, nextK: k }))
    requestFlowNativeDraw(runtime, args.buildDrawArgs())
    args.requestCommit()
    args.onInteractionFrame?.()

    if (!(raw01 < 1)) {
      wheelZoomAnimRaf = null
      return
    }
    wheelZoomAnimRaf = requestAnimationFrame(tickWheelZoomAnimation)
  }

  const startWheelZoomAnimation = (next: {
    anchor: { sx: number; sy: number }
    toK: number
    extent: { minK: number; maxK: number }
    durationMs: number
  }) => {
    cancelWheelZoomAnimation()
    wheelZoomAnimFrom = runtime.transform || d3.zoomIdentity
    wheelZoomAnimToK = next.toK
    wheelZoomAnimAnchor = { sx: next.anchor.sx, sy: next.anchor.sy }
    wheelZoomAnimScaleExtent = { minK: next.extent.minK, maxK: next.extent.maxK }
    wheelZoomAnimDurationMs = Math.max(0, Math.floor(next.durationMs))
    wheelZoomAnimStartMs = performance.now()
    wheelZoomAnimRaf = requestAnimationFrame(tickWheelZoomAnimation)
  }

  const scheduleDragRelax = () => {
    if (!args.collisionDuringDrag) return
    if (pendingDragRelaxRaf != null) return
    pendingDragRelaxRaf = requestAnimationFrame(() => {
      pendingDragRelaxRaf = null
      const scene = runtime.scene
      if (!scene) return

      const policy = computeFlowDragRelaxPolicy({ nodeCount: scene.nodes.length, groupCount: scene.groups?.length || 0 })
      if (!policy.enabled) return

      const now = Date.now()
      if (lastDragRelaxMs && now - lastDragRelaxMs < policy.minIntervalMs) return
      lastDragRelaxMs = now

      const schema = args.collisionSchemaRef.current
      const graphDataForZoom = args.collisionGraphDataRef.current
      const flowConfig = args.collisionFlowConfigRef.current
      const flowPresentation = args.collisionPresentationRef.current
      if (!schema || !graphDataForZoom || !flowConfig || !flowPresentation) return

      const relaxed = relaxFlowSceneNodePositions({
        graphData: graphDataForZoom,
        sceneNodes: scene.nodes,
        groups: scene.groups || [],
        schema,
        nodeSize: { widthPx: flowConfig.node.widthPx, heightPx: flowConfig.node.heightPx },
        portHandles: {
          enabled: flowPresentation.portHandles.enabled,
          sizePx: flowPresentation.portHandles.sizePx,
          offsetPx: flowPresentation.portHandles.offsetPx,
        },
        steps: policy.steps,
      })
      if (relaxed) {
        for (let i = 0; i < scene.nodes.length; i += 1) {
          const n = scene.nodes[i]
          const p = relaxed[n.id]
          if (!p) continue
          if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
          n.x = p.x
          n.y = p.y
        }
        runtime.dirty = true
      }
      requestFlowNativeDraw(runtime, args.buildDrawArgs())
    })
  }

  const flushPendingWheelZoom = () => {
    pendingWheelZoomRaf = null
    const deltaYpx = pendingWheelZoomDeltaYpx
    pendingWheelZoomDeltaYpx = 0
    const anchor = pendingWheelZoomAnchor
    pendingWheelZoomAnchor = null
    const extent = pendingWheelZoomScaleExtent
    pendingWheelZoomScaleExtent = null
    if (!anchor) return
    if (!Number.isFinite(deltaYpx) || Math.abs(deltaYpx) < 1e-9) return

    const t0 = runtime.transform || d3.zoomIdentity
    const minK = extent && Number.isFinite(extent.minK) ? extent.minK : 0.05
    const maxK = extent && Number.isFinite(extent.maxK) ? extent.maxK : 8
    const now = Date.now()

    const intent = deltaYpx < 0 ? 'in' : 'out'
    args.lastWheelIntentRef.current = { dir: intent, ts: now }
    {
      const guard = computeZoomWheelGuardDecision({
        currentK: t0.k,
        minK,
        maxK,
        deltaYpx,
        nowMs: now,
        state: args.zoomWheelGuardRef.current,
      })
      args.zoomWheelGuardRef.current = guard.nextState
      if (guard.block) return
    }

    const st = useGraphStore.getState()
    const increment = clampFlowWheelZoomIncrementMultiplier(st.flowWheelZoomIncrementMultiplier)
    const factor = computeWheelZoomFactor(deltaYpx * increment)
    const nextK = clampScale(t0.k * factor, { minK, maxK })
    if (!Number.isFinite(nextK) || Math.abs(nextK - t0.k) < 1e-12) return
    const durationMs = computeFlowWheelZoomDurationMs({
      deltaYpxAbs: Math.abs(deltaYpx),
      minMs: st.flowWheelZoomSmoothMinDurationMs,
      maxMs: st.flowWheelZoomSmoothMaxDurationMs,
    })
    startWheelZoomAnimation({
      anchor,
      toK: nextK,
      extent: { minK, maxK },
      durationMs,
    })
  }

  const cancelActiveDragIfStale = (drag: NonNullable<typeof args.dragRef.current>): boolean => {
    const shouldCancel = (() => {
      try {
        if (drag.type === 'pinch') {
          const a = canvasEl.hasPointerCapture(drag.pointerIdA)
          const b = canvasEl.hasPointerCapture(drag.pointerIdB)
          return !a && !b
        }
        const id = (drag as unknown as { pointerId?: unknown }).pointerId
        if (typeof id !== 'number') return true
        return canvasEl.hasPointerCapture(id) !== true
      } catch {
        return false
      }
    })()

    if (!shouldCancel) return false

    const dragPointerId = drag.type === 'pinch' ? null : drag.pointerId
    if (dragPointerId != null && args.userSelectLockPointerIdRef.current === dragPointerId) {
      args.userSelectLockPointerIdRef.current = null
      unlockGlobalUserSelect()
      try {
        if (canvasEl.hasPointerCapture(dragPointerId)) {
          canvasEl.releasePointerCapture(dragPointerId)
        }
      } catch {
        void 0
      }
    }

    args.dragRef.current = null
    edgeScroll.reset()
    args.setSelectionBox(null)
    args.requestCommit()
    return true
  }

  const shouldProxyWheelFromOverlay = (event: WheelEvent): boolean => {
    const resolved = resolveFlowEditorOverlayProxyTarget({
      target: (event as unknown as { target?: unknown }).target,
      canvasEl,
    })
    if (resolved.kind !== 'overlay') return false
    const overlayRoot = resolved.overlayRoot
    const el = resolved.targetEl
    if (isSpacePanHeld()) return true
    if (event.ctrlKey === true || event.metaKey === true) return true

    const dx = typeof (event as unknown as { deltaX?: unknown }).deltaX === 'number' ? (event as unknown as { deltaX: number }).deltaX : 0
    const dy = typeof (event as unknown as { deltaY?: unknown }).deltaY === 'number' ? (event as unknown as { deltaY: number }).deltaY : 0
    if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return false

    const canScrollForDelta = (node: HTMLElement, delta: { dx: number; dy: number }): boolean => {
      let overflowX = ''
      let overflowY = ''
      try {
        const styles = getComputedStyle(node)
        overflowX = styles.overflowX
        overflowY = styles.overflowY
      } catch {
        void 0
      }

      if (delta.dy !== 0 && (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay')) {
        const h = node.scrollHeight
        const ch = node.clientHeight
        if (h > ch + 1) {
          const top = node.scrollTop
          if (delta.dy > 0 && top + ch < h - 1) return true
          if (delta.dy < 0 && top > 0) return true
        }
      }

      if (delta.dx !== 0 && (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'overlay')) {
        const w = node.scrollWidth
        const cw = node.clientWidth
        if (w > cw + 1) {
          const left = node.scrollLeft
          if (delta.dx > 0 && left + cw < w - 1) return true
          if (delta.dx < 0 && left > 0) return true
        }
      }

      return false
    }

    const boundary = overlayRoot
    let cur: Element | null = el
    const maxHops = 30
    for (let hops = 0; cur && hops < maxHops; hops += 1) {
      const node = cur instanceof HTMLElement ? cur : null
      if (node && canScrollForDelta(node, { dx, dy })) return false
      if (boundary && cur === boundary) break
      cur = cur.parentElement
    }

    return true
  }

  const handleWheel = (e: WheelEvent, opts?: { skipIgnoreGuard?: boolean }) => {
    cancelFlowZoomRequestAnim(runtime)
    const drag = args.dragRef.current
    if (drag && drag.type !== 'pan') {
      if (cancelActiveDragIfStale(drag)) {
        return handleWheel(e, opts)
      }
      try {
        e.preventDefault()
      } catch {
        void 0
      }
      return
    }

    const preset = args.viewportControlsPreset
    const storeState = useGraphStore.getState()
    disableAutoZoomModesForUserGesture(storeState)
    const schemaForWheel = storeState.schema
    const wheelBehavior = schemaForWheel ? readWheelBehavior(schemaForWheel) : 'preset'
    const wheelZoom = shouldWheelZoom({ event: e, preset, wheelBehavior })

    const ignoreWheel = opts?.skipIgnoreGuard ? false : shouldIgnoreCanvasWheelEvent({ event: e, ignoreSelector: UI_SELECTORS.canvasWheelIgnore })
    const allowZoomThroughIgnore = wheelZoom && (e.ctrlKey === true || e.metaKey === true)
    if (ignoreWheel && !allowZoomThroughIgnore) {
      const isFlowEditor = String(storeState.canvas2dRenderer || '') === 'flowEditor'
      if (isFlowEditor && !opts?.skipIgnoreGuard) {
        const cx = (e as unknown as { clientX?: unknown }).clientX
        const cy = (e as unknown as { clientY?: unknown }).clientY
        if (typeof cx === 'number' && Number.isFinite(cx) && typeof cy === 'number' && Number.isFinite(cy)) {
          const top = typeof document !== 'undefined' && typeof document.elementFromPoint === 'function'
            ? document.elementFromPoint(cx, cy)
            : null
          if (top && (top === canvasEl || canvasEl.contains(top))) {
            return handleWheel(e, { skipIgnoreGuard: true })
          }
        }
      }
      try {
        e.preventDefault()
      } catch {
        void 0
      }
      return
    }
    if (!wheelZoom) {
      cancelWheelZoomAnimation()
      const t0 = runtime.transform || d3.zoomIdentity
      const panSpeed = schemaForWheel ? readPanSpeed(schemaForWheel) : 1
      const interactionSpeed =
        clampCanvasPanSpeedMultiplier(storeState.canvasPanSpeedMultiplier)
        * clampCanvasInteractionSpeedMultiplier(storeState.canvasInteractionSpeedMultiplier)
      const d = computeWheelPanDeltaPx(e)
      const dx = d.dx * panSpeed * interactionSpeed
      const dy = d.dy * panSpeed * interactionSpeed
      if (dx !== 0 || dy !== 0) {
        setFlowNativeTransform(runtime, d3.zoomIdentity.translate(t0.x - dx, t0.y - dy).scale(t0.k))
        requestFlowNativeDraw(runtime, args.buildDrawArgs())
        args.requestCommit()
        args.onInteractionFrame?.()
      }
      try {
        e.preventDefault()
      } catch {
        void 0
      }
      return
    }
    const state = storeState
    const schema = state.schema
    const [schemaMinScale, schemaMaxScale] = readZoomScaleExtent(schema)
    const autoMinScale = getFlowAutoMinScale(runtime)
    const minScale = autoMinScale != null ? Math.min(schemaMinScale, autoMinScale) : schemaMinScale
    const maxScale = schemaMaxScale
    const local = readCanvasLocalPoint({ canvasEl, event: e })
    const rect = local ? null : canvasEl.getBoundingClientRect()
    const now = Date.now()
    const fallback = coerceWheelFallback({
      fallback: args.lastPointerInCanvasRef.current,
      nowMs: now,
      maxAgeMs: 800,
    })
    const anchor =
      local && local.inBounds
        ? { sx: local.sx, sy: local.sy, source: 'pointer' as const }
        : resolveWheelAnchor({
            rect: rect || canvasEl.getBoundingClientRect(),
            clientX: e.clientX,
            clientY: e.clientY,
            fallback,
          })
    const sx = anchor.sx
    const sy = anchor.sy
    if (anchor.source !== 'center') {
      args.lastPointerInCanvasRef.current = { sx, sy, ts: now }
    }
    const zoomSpeed = schema ? readZoomSpeed(schema) : 1
    const speed = clampFlowWheelZoomSpeedMultiplier(storeState.flowWheelZoomSpeedMultiplier)
    const interactionSpeed = clampCanvasInteractionSpeedMultiplier(storeState.canvasInteractionSpeedMultiplier)
    const deltaYpx = computeZoomWheelDeltaYpx(
      e,
      zoomSpeed * speed * interactionSpeed,
      storeState.wheelZoomCtrlMetaBoostMultiplier,
    )
    pendingWheelZoomDeltaYpx += deltaYpx
    pendingWheelZoomAnchor = { sx, sy }
    pendingWheelZoomScaleExtent = { minK: minScale, maxK: maxScale }
    if (pendingWheelZoomRaf == null) {
      pendingWheelZoomRaf = requestAnimationFrame(flushPendingWheelZoom)
    }
    try {
      e.preventDefault()
    } catch {
      void 0
    }
  }

  const onWheel = (e: WheelEvent) => {
    handleWheel(e)
  }

  const onWindowWheelCapture = (e: WheelEvent) => {
    if (!args.active) return
    if (useGraphStore.getState().flowEditorOverlayWheelProxyEnabled === false) return
    if (!shouldProxyWheelFromOverlay(e)) return
    handleWheel(e, { skipIgnoreGuard: true })
  }

  const shouldProxyGestureToCanvas = (event: Event): boolean => {
    const resolved = resolveFlowEditorOverlayProxyTarget({
      target: (event as unknown as { target?: unknown }).target,
      canvasEl,
    })
    if (resolved.kind === 'none') return false
    return true
  }

  let gestureScalePrev: number | null = null

  const onWindowGestureStartCapture = (event: Event) => {
    if (!args.active) return
    if (!shouldProxyGestureToCanvas(event)) return
    cancelWheelZoomAnimation()
    cancelFlowZoomRequestAnim(runtime)
    const scaleRaw = (event as unknown as { scale?: unknown }).scale
    const scale = typeof scaleRaw === 'number' && Number.isFinite(scaleRaw) && scaleRaw > 0 ? scaleRaw : 1
    gestureScalePrev = scale
    try {
      event.preventDefault()
    } catch {
      void 0
    }
  }

  const onWindowGestureChangeCapture = (event: Event) => {
    if (!args.active) return
    if (!shouldProxyGestureToCanvas(event)) return
    const prev = gestureScalePrev
    if (prev == null) {
      onWindowGestureStartCapture(event)
      return
    }
    const scaleRaw = (event as unknown as { scale?: unknown }).scale
    const scale = typeof scaleRaw === 'number' && Number.isFinite(scaleRaw) && scaleRaw > 0 ? scaleRaw : 1
    const ratio = scale / prev
    gestureScalePrev = scale
    if (!Number.isFinite(ratio) || Math.abs(ratio - 1) < 1e-6) {
      try {
        event.preventDefault()
      } catch {
        void 0
      }
      return
    }

    const storeState = useGraphStore.getState()
    disableAutoZoomModesForUserGesture(storeState)
    const schema = storeState.schema
    const [schemaMinScale, schemaMaxScale] = readZoomScaleExtent(schema)
    const autoMinScale = getFlowAutoMinScale(runtime)
    const minScale = autoMinScale != null ? Math.min(schemaMinScale, autoMinScale) : schemaMinScale
    const maxScale = schemaMaxScale
    const t0 = runtime.transform || d3.zoomIdentity
    const nextK = clampScale(t0.k * ratio, { minK: minScale, maxK: maxScale })
    if (!Number.isFinite(nextK) || Math.abs(nextK - t0.k) < 1e-10) {
      try {
        event.preventDefault()
      } catch {
        void 0
      }
      return
    }

    const local = readCanvasLocalPoint({ canvasEl, event: event as unknown as { clientX?: unknown; clientY?: unknown } })
    const rect = local ? null : canvasEl.getBoundingClientRect()
    const now = Date.now()
    const fallback = coerceWheelFallback({
      fallback: args.lastPointerInCanvasRef.current,
      nowMs: now,
      maxAgeMs: 800,
    })
    const rectForAnchor = rect || canvasEl.getBoundingClientRect()
    const cxRaw = (event as unknown as { clientX?: unknown }).clientX
    const cyRaw = (event as unknown as { clientY?: unknown }).clientY
    const clientX = typeof cxRaw === 'number' && Number.isFinite(cxRaw) ? cxRaw : rectForAnchor.left + rectForAnchor.width / 2
    const clientY = typeof cyRaw === 'number' && Number.isFinite(cyRaw) ? cyRaw : rectForAnchor.top + rectForAnchor.height / 2

    const anchor =
      local && local.inBounds
        ? { sx: local.sx, sy: local.sy, source: 'pointer' as const }
        : resolveWheelAnchor({
            rect: rectForAnchor,
            clientX,
            clientY,
            fallback,
          })
    const sx = anchor.sx
    const sy = anchor.sy
    if (anchor.source !== 'center') {
      args.lastPointerInCanvasRef.current = { sx, sy, ts: now }
    }

    setFlowNativeTransform(runtime, computeAnchoredZoomTransform({ transform: t0, anchor: { sx, sy }, nextK }))
    requestFlowNativeDraw(runtime, args.buildDrawArgs())
    args.requestCommit()
    args.onInteractionFrame?.()
    try {
      event.preventDefault()
    } catch {
      void 0
    }
  }

  const onWindowGestureEndCapture = (event: Event) => {
    if (!args.active) return
    if (gestureScalePrev == null) return
    if (!shouldProxyGestureToCanvas(event)) return
    gestureScalePrev = null
    try {
      event.preventDefault()
    } catch {
      void 0
    }
  }

  const onPointerDown = (e: PointerEvent) => {
    if (!args.active) return

    cancelWheelZoomAnimation()
    cancelFlowZoomRequestAnim(runtime)

    const preset = args.viewportControlsPreset
    const allowButton = e.pointerType === 'touch' || e.button === 0 || isPanDragButton(e.button, preset)
    if (!allowButton) return
    try {
      disableAutoZoomModesForUserGesture(useGraphStore.getState())
    } catch {
      void 0
    }
    lockGlobalUserSelect()
    const local = readCanvasLocalPoint({ canvasEl, event: e })
    if (!local) {
      unlockGlobalUserSelect()
      return
    }
    args.lastPointerInCanvasRef.current = { sx: local.sx, sy: local.sy, ts: Date.now() }
    const sx = local.sx
    const sy = local.sy
    const drawArgs = args.buildDrawArgs()
    const allowNodeHit = drawArgs.renderNodes !== false
    const allowGroupHit = drawArgs.renderGroups !== false
    const hit = allowNodeHit ? hitTestNode(runtime, { sx, sy }) : null
    const pointerId = e.pointerId
    args.userSelectLockPointerIdRef.current = pointerId
    try {
      canvasEl.setPointerCapture(pointerId)
    } catch {
      void 0
    }
    try {
      e.preventDefault()
    } catch {
      void 0
    }

    const storeStateAtDown = useGraphStore.getState()
    const isFlowEditor = String(storeStateAtDown.canvas2dRenderer || '') === 'flowEditor'

    if (e.pointerType === 'touch') {
      touchPointsById.set(pointerId, { sx, sy })
      if (touchPointsById.size >= 2) {
        const entries = Array.from(touchPointsById.entries())
        const first = entries[0]
        const second = entries[1]
        const a = first ? first[1] : { sx, sy }
        const b = second ? second[1] : { sx, sy }
        args.setSelectionBox(null)
        args.dragRef.current = {
          type: 'pinch',
          pointerIdA: first ? first[0] : pointerId,
          pointerIdB: second ? second[0] : pointerId,
          startTransform: runtime.transform || d3.zoomIdentity,
          startA: { sx: a.sx, sy: a.sy },
          startB: { sx: b.sx, sy: b.sy },
          pointerId,
        }
        return
      }
    }

    if (isSpacePanHeld()) {
      args.dragRef.current = {
        type: 'pan',
        startSx: sx,
        startSy: sy,
        startTx: runtime.transform.x,
        startTy: runtime.transform.y,
        pointerId,
      }
      return
    }

    if (isFlowEditor && !hit && e.pointerType !== 'touch') {
      const selectionDrag = e.shiftKey === true
      if (!selectionDrag) {
        args.dragRef.current = {
          type: 'pan',
          startSx: sx,
          startSy: sy,
          startTx: runtime.transform.x,
          startTy: runtime.transform.y,
          pointerId,
        }
        return
      }
    }
    if (hit) {
      const state = storeStateAtDown
      state.setSelectionSource('canvas')
      state.selectEdge(null)
      state.selectNode(hit)

      const allowDrag = typeof args.allowNodeDragOverride === 'boolean' ? args.allowNodeDragOverride : state.schema?.behavior?.allowNodeDrag !== false

      if (!allowDrag) {
        args.setSelectionBox(null)
        args.dragRef.current = {
          type: 'pan',
          startSx: sx,
          startSy: sy,
          startTx: runtime.transform.x,
          startTy: runtime.transform.y,
          pointerId,
        }
        requestFlowNativeDraw(runtime, args.buildDrawArgs())
        args.requestCommit()
        return
      }
      if (allowDrag) {
        const t0 = runtime.transform || d3.zoomIdentity
        const wx = (sx - t0.x) / t0.k
        const wy = (sy - t0.y) / t0.k
        const node = runtime.scene?.nodeById.get(hit)
        if (node) {
          args.dragRef.current = {
            type: 'node',
            nodeId: hit,
            startWorldX: wx,
            startWorldY: wy,
            startNodeX: node.x,
            startNodeY: node.y,
            pointerId,
          }
        }
      }
      requestFlowNativeDraw(runtime, args.buildDrawArgs())
      args.requestCommit()
      return
    }

    const groupHit = allowGroupHit ? hitTestGroup(runtime, { sx, sy }) : null
    if (groupHit) {
      const state = storeStateAtDown
      const allowDrag =
        typeof args.allowNodeDragOverride === 'boolean'
          ? args.allowNodeDragOverride
          : state.schema?.behavior?.allowNodeDrag !== false

      if (!allowDrag) {
        args.setSelectionBox(null)
        args.dragRef.current = {
          type: 'pan',
          startSx: sx,
          startSy: sy,
          startTx: runtime.transform.x,
          startTy: runtime.transform.y,
          pointerId,
        }
        return
      }
      if (allowDrag) {
        const scene = runtime.scene
        const group = scene?.groups?.find(g => String(g.id || '') === groupHit) || null
        if (scene && group) {
          const membersRaw = Array.isArray(group.memberNodeIds) ? group.memberNodeIds : []
          const memberNodeIds = membersRaw.map(v => String(v || '').trim()).filter(Boolean)
          const startNodePosById: Record<string, { x: number; y: number }> = {}
          for (let i = 0; i < memberNodeIds.length; i += 1) {
            const id = memberNodeIds[i]
            const node = scene.nodeById.get(id)
            if (!node) continue
            startNodePosById[id] = { x: node.x, y: node.y }
          }
          const t0 = runtime.transform || d3.zoomIdentity
          const wx = (sx - t0.x) / t0.k
          const wy = (sy - t0.y) / t0.k
          args.dragRef.current = {
            type: 'group',
            groupId: groupHit,
            memberNodeIds,
            startWorldX: wx,
            startWorldY: wy,
            startNodePosById,
            pointerId,
          }
          return
        }
      }
    }

    {
      const state = useGraphStore.getState()
      const isFlowEditor = String(state.canvas2dRenderer || '') === 'flowEditor'
      const selectMode = state.schema?.behavior?.selectMode || 'single'
      const selectionOnDrag = args.selectionOnDrag === true
      const allowLasso = selectMode === 'lasso' || (selectionOnDrag === true && preset === 'design')
      const wantLasso =
        allowLasso &&
        e.pointerType !== 'touch' &&
        (!isFlowEditor || e.shiftKey === true) &&
        shouldStartSelectionDragForPreset({
          preset,
          button: e.button,
          shiftKey: e.shiftKey === true,
          spacePanHeld: isSpacePanHeld(),
          selectionOnDrag,
        })
      if (wantLasso) {
        state.setSelectionSource('canvas')
        state.selectEdge(null)
        state.selectGroup(null)
        args.setSelectionBox({ left: sx, top: sy, width: 1, height: 1 })
        args.dragRef.current = { type: 'lasso', startSx: sx, startSy: sy, lastSx: sx, lastSy: sy, pointerId }
        return
      }
    }

    if (e.pointerType === 'touch') {
      args.dragRef.current = {
        type: 'pan',
        startSx: sx,
        startSy: sy,
        startTx: runtime.transform.x,
        startTy: runtime.transform.y,
        pointerId,
      }
      return
    }

    if (preset === 'design' && isPanDragButton(e.button, preset)) {
      args.dragRef.current = {
        type: 'pan',
        startSx: sx,
        startSy: sy,
        startTx: runtime.transform.x,
        startTy: runtime.transform.y,
        pointerId,
      }
      return
    }

    if (preset === 'design') {
      args.userSelectLockPointerIdRef.current = null
      unlockGlobalUserSelect()
      try {
        canvasEl.releasePointerCapture(pointerId)
      } catch {
        void 0
      }
      return
    }

    args.dragRef.current = {
      type: 'pan',
      startSx: sx,
      startSy: sy,
      startTx: runtime.transform.x,
      startTy: runtime.transform.y,
      pointerId,
    }
  }

  const onPointerMove = (e: PointerEvent) => {
    const drag = args.dragRef.current
    const local = readCanvasLocalPoint({ canvasEl, event: e })
    if (local && local.inBounds) args.lastPointerInCanvasRef.current = { sx: local.sx, sy: local.sy, ts: Date.now() }
    if (!drag) return
    if (e.pointerType !== 'touch' && e.buttons === 0) {
      if (args.userSelectLockPointerIdRef.current === e.pointerId) {
        args.userSelectLockPointerIdRef.current = null
        unlockGlobalUserSelect()
      }
      try {
        if (canvasEl.hasPointerCapture(e.pointerId)) {
          canvasEl.releasePointerCapture(e.pointerId)
        }
      } catch {
        void 0
      }
      args.dragRef.current = null
      edgeScroll.reset()
      args.setSelectionBox(null)
      args.requestCommit()
      return
    }
    if (drag.type === 'pinch') {
      if (e.pointerId !== drag.pointerIdA && e.pointerId !== drag.pointerIdB) return
    } else {
      if (drag.pointerId !== e.pointerId) return
    }
    if (!local) return
    const sx = local.sx
    const sy = local.sy

    if (drag.type === 'node' || drag.type === 'group' || drag.type === 'lasso') {
      const state = useGraphStore.getState()
      const locked = state.viewPinned === true
      const d = edgeScroll.update({
        nowMs: Date.now(),
        pointer: {
          sx,
          sy,
          kind: e.pointerType === 'touch' ? 'touch' : e.pointerType === 'pen' ? 'pen' : 'mouse',
        },
        viewport: { w: runtime.viewportW, h: runtime.viewportH },
        zoomK: runtime.transform?.k || 1,
        enabled: local.inBounds === true && !locked,
      })
      if (Math.abs(d.dx) > 1e-6 || Math.abs(d.dy) > 1e-6) {
        setFlowNativeTransform(
          runtime,
          d3.zoomIdentity.translate(runtime.transform.x + d.dx, runtime.transform.y + d.dy).scale(runtime.transform.k),
        )
        requestFlowNativeDraw(runtime, args.buildDrawArgs())
        args.requestCommit()
        args.onInteractionFrame?.()
      }
    }

    if (e.pointerType === 'touch') {
      touchPointsById.set(e.pointerId, { sx, sy })
    }

    if (drag.type === 'pinch') {
      const a = touchPointsById.get(drag.pointerIdA)
      const b = touchPointsById.get(drag.pointerIdB)
      if (!a || !b) return
      const state = useGraphStore.getState()
      disableAutoZoomModesForUserGesture(state)
      const [schemaMinScale, schemaMaxScale] = readZoomScaleExtent(state.schema)
      const autoMinScale = getFlowAutoMinScale(runtime)
      const minScale = autoMinScale != null ? Math.min(schemaMinScale, autoMinScale) : schemaMinScale
      const maxScale = schemaMaxScale
      const zoomSpeedRaw = readZoomSpeed(state.schema)
      const zoomSpeed = Number.isFinite(zoomSpeedRaw) && zoomSpeedRaw > 0 ? zoomSpeedRaw : 1
      const speed = clampFlowWheelZoomSpeedMultiplier(state.flowWheelZoomSpeedMultiplier)
      const increment = clampFlowWheelZoomIncrementMultiplier(state.flowWheelZoomIncrementMultiplier)
      const interactionSpeed = clampCanvasInteractionSpeedMultiplier(state.canvasInteractionSpeedMultiplier)
      setFlowNativeTransform(
        runtime,
        computePinchZoomTransform({
          startTransform: drag.startTransform,
          startA: drag.startA,
          startB: drag.startB,
          curA: a,
          curB: b,
          scaleExtent: { minK: minScale, maxK: maxScale },
          zoomExponentMultiplier: zoomSpeed * speed * increment * interactionSpeed,
        }),
      )
      requestFlowNativeDraw(runtime, args.buildDrawArgs())
      args.requestCommit()
      args.onInteractionFrame?.()
      try {
        e.preventDefault()
      } catch {
        void 0
      }
      return
    }
    if (drag.type === 'lasso') {
      const left = Math.min(drag.startSx, sx)
      const top = Math.min(drag.startSy, sy)
      const right = Math.max(drag.startSx, sx)
      const bottom = Math.max(drag.startSy, sy)
      args.dragRef.current = { ...drag, lastSx: sx, lastSy: sy }
      args.setSelectionBox({ left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) })
      args.onInteractionFrame?.()
      try {
        e.preventDefault()
      } catch {
        void 0
      }
      return
    }
    if (drag.type === 'pan') {
      const st = useGraphStore.getState()
      const interactionSpeed =
        clampCanvasPanSpeedMultiplier(st.canvasPanSpeedMultiplier) * clampCanvasInteractionSpeedMultiplier(st.canvasInteractionSpeedMultiplier)
      const dx = (sx - drag.startSx) * interactionSpeed
      const dy = (sy - drag.startSy) * interactionSpeed
      setFlowNativeTransform(
        runtime,
        d3.zoomIdentity.translate(drag.startTx + dx, drag.startTy + dy).scale(runtime.transform.k),
      )
      requestFlowNativeDraw(runtime, args.buildDrawArgs())
      args.requestCommit()
      args.onInteractionFrame?.()
      try {
        e.preventDefault()
      } catch {
        void 0
      }
      return
    }

    if (drag.type === 'group') {
      const t0 = runtime.transform || d3.zoomIdentity
      const wx = (sx - t0.x) / t0.k
      const wy = (sy - t0.y) / t0.k
      const dx = wx - drag.startWorldX
      const dy = wy - drag.startWorldY
      const scene = runtime.scene
      if (!scene) return
      for (let i = 0; i < drag.memberNodeIds.length; i += 1) {
        const id = drag.memberNodeIds[i]
        const node = scene.nodeById.get(id)
        const start = drag.startNodePosById[id]
        if (!node || !start) continue
        node.x = start.x + dx
        node.y = start.y + dy
      }
      runtime.dirty = true
      args.positionsDirtySinceCommitRef.current = true
      scheduleDragRelax()
      requestFlowNativeDraw(runtime, args.buildDrawArgs())
      args.onInteractionFrame?.()
      return
    }

    const t0 = runtime.transform || d3.zoomIdentity
    const wx = (sx - t0.x) / t0.k
    const wy = (sy - t0.y) / t0.k
    const dx = wx - drag.startWorldX
    const dy = wy - drag.startWorldY
    const scene = runtime.scene
    const node = scene?.nodeById.get(drag.nodeId)
    if (!scene || !node) return
    node.x = drag.startNodeX + dx
    node.y = drag.startNodeY + dy
    runtime.dirty = true
    args.positionsDirtySinceCommitRef.current = true
    scheduleDragRelax()
    requestFlowNativeDraw(runtime, args.buildDrawArgs())
    args.onInteractionFrame?.()
    try {
      e.preventDefault()
    } catch {
      void 0
    }
  }

  const onPointerUp = (e: PointerEvent) => {
    if (args.userSelectLockPointerIdRef.current === e.pointerId) {
      args.userSelectLockPointerIdRef.current = null
      unlockGlobalUserSelect()
    }
    const drag = args.dragRef.current
    if (!drag) return

    if (e.pointerType === 'touch') {
      touchPointsById.delete(e.pointerId)
    }

    if (drag.type === 'pinch') {
      if (e.pointerId !== drag.pointerIdA && e.pointerId !== drag.pointerIdB) return
      args.dragRef.current = null
      edgeScroll.reset()
      args.requestCommit()
      try {
        e.preventDefault()
      } catch {
        void 0
      }
      return
    }

    if (drag.pointerId !== e.pointerId) return

    if (drag.type === 'lasso') {
      args.dragRef.current = null
      edgeScroll.reset()
      args.setSelectionBox(null)
      const scene = runtime.scene
      if (!scene) {
        args.requestCommit()
        return
      }
      const t0 = runtime.transform || d3.zoomIdentity
      const leftSx = Math.min(drag.startSx, drag.lastSx)
      const topSy = Math.min(drag.startSy, drag.lastSy)
      const rightSx = Math.max(drag.startSx, drag.lastSx)
      const bottomSy = Math.max(drag.startSy, drag.lastSy)
      const minX = (leftSx - t0.x) / t0.k
      const minY = (topSy - t0.y) / t0.k
      const maxX = (rightSx - t0.x) / t0.k
      const maxY = (bottomSy - t0.y) / t0.k
      const selected: string[] = []
      for (let i = 0; i < scene.nodes.length; i += 1) {
        const n = scene.nodes[i]
        const nMinX = n.x
        const nMinY = n.y
        const nMaxX = n.x + n.width
        const nMaxY = n.y + n.height
        const intersects = nMinX <= maxX && nMaxX >= minX && nMinY <= maxY && nMaxY >= minY
        if (intersects) selected.push(String(n.id))
      }
      const state = useGraphStore.getState()
      state.setSelectionSource('canvas')
      state.selectNodesExpanded({ nodeIds: selected })
      requestFlowNativeDraw(runtime, args.buildDrawArgs())
      args.requestCommit()
      args.onInteractionFrame?.()
      try {
        e.preventDefault()
      } catch {
        void 0
      }
      return
    }
    args.dragRef.current = null
    edgeScroll.reset()
    args.requestCommit()
    try {
      e.preventDefault()
    } catch {
      void 0
    }
  }

  const onContextMenu = (e: MouseEvent) => {
    if (!shouldSuppressContextMenuForPreset(args.viewportControlsPreset)) return
    try {
      e.preventDefault()
    } catch {
      void 0
    }
  }

  let proxyPanPointerId: number | null = null
  let pendingProxyPan:
    | null
    | {
        pointerId: number
        startClientX: number
        startClientY: number
        startSx: number
        startSy: number
        startTx: number
        startTy: number
      } = null
  const spacePanProxyTargetSelector = [FLOW_EDITOR_OVERLAY_ROOT_SELECTOR, UI_SELECTORS.canvasWheelIgnore, UI_SELECTORS.canvasPointerIgnore]
    .filter(Boolean)
    .join(', ')

  const lastHandledPointerMoveKeyById = new Map<number, string>()
  const lastHandledPointerUpKeyById = new Map<number, string>()
  const shouldSkipDuplicatePointerEvent = (map: Map<number, string>, e: PointerEvent): boolean => {
    const id = typeof e.pointerId === 'number' ? e.pointerId : -1
    if (id < 0) return false
    const cx = typeof e.clientX === 'number' && Number.isFinite(e.clientX) ? e.clientX : 0
    const cy = typeof e.clientY === 'number' && Number.isFinite(e.clientY) ? e.clientY : 0
    const buttons = typeof e.buttons === 'number' && Number.isFinite(e.buttons) ? e.buttons : -1
    const button = typeof e.button === 'number' && Number.isFinite(e.button) ? e.button : -1
    const key = `${e.type}|${cx}|${cy}|${buttons}|${button}`
    const prev = map.get(id)
    if (prev != null && prev === key) return true
    map.set(id, key)
    return false
  }

  const handlePointerMoveOnce = (e: PointerEvent) => {
    if (shouldSkipDuplicatePointerEvent(lastHandledPointerMoveKeyById, e)) return
    onPointerMove(e)
  }

  const handlePointerUpOnce = (e: PointerEvent) => {
    if (shouldSkipDuplicatePointerEvent(lastHandledPointerUpKeyById, e)) return
    onPointerUp(e)
  }

  const onWindowPointerDownCapture = (e: PointerEvent) => {
    if (!args.active) return
    if (e.pointerType === 'touch') return
    if (proxyPanPointerId != null) return
    if (pendingProxyPan != null) return
    if (args.dragRef.current) return

    const target = e.target
    const targetEl = target instanceof Element ? target : null
    if (!targetEl) return
    if (canvasEl.contains(targetEl)) return
    if (!spacePanProxyTargetSelector || !targetEl.closest(spacePanProxyTargetSelector)) return

    const storeState = useGraphStore.getState()
    const isFlowEditor = String(storeState.canvas2dRenderer || '') === 'flowEditor'
    const preset = args.viewportControlsPreset
    const button = typeof e.button === 'number' ? e.button : 0
    const shiftKey = e.shiftKey === true
    const spacePanHeld = isSpacePanHeld()

    const resolved = resolveFlowEditorOverlayProxyTarget({ target: targetEl, canvasEl })
    if (resolved.kind === 'overlay' && resolved.isInteractive && spacePanHeld !== true) return

    const overlayPinnedToNode =
      resolved.kind === 'overlay' &&
      String((resolved.overlayRoot as HTMLElement | null)?.dataset?.kgNodeQuickEditorPinned || '') === '1'

    if (resolved.kind === 'overlay' && !overlayPinnedToNode && spacePanHeld !== true) return

    const allowPan = shouldAllowPanDragForPointerEvent({
      preset,
      eventType: 'pointerdown',
      button,
      shiftKey,
      spacePanHeld,
    })
    const selectionDrag = shouldStartSelectionDragForPreset({
      preset,
      button,
      shiftKey,
      spacePanHeld,
      selectionOnDrag: args.selectionOnDrag,
    })
    if (!allowPan || selectionDrag) return
    if (resolved.kind === 'overlay' && resolved.isInteractive && !(spacePanHeld === true && button === 0)) return

    cancelWheelZoomAnimation()
    cancelFlowZoomRequestAnim(runtime)
    try {
      disableAutoZoomModesForUserGesture(useGraphStore.getState())
    } catch {
      void 0
    }

    const local = readCanvasLocalPoint({ canvasEl, event: e })
    if (!local) return

    args.lastPointerInCanvasRef.current = { sx: local.sx, sy: local.sy, ts: Date.now() }
    pendingProxyPan = {
      pointerId: e.pointerId,
      startClientX: Number.isFinite(e.clientX) ? e.clientX : 0,
      startClientY: Number.isFinite(e.clientY) ? e.clientY : 0,
      startSx: local.sx,
      startSy: local.sy,
      startTx: runtime.transform.x,
      startTy: runtime.transform.y,
    }
  }

  const onWindowPointerMoveCapture = (e: PointerEvent) => {
    if (!args.active) return
    if (proxyPanPointerId != null) {
      if (e.pointerId !== proxyPanPointerId) return
      handlePointerMoveOnce(e)
      return
    }
    const pending = pendingProxyPan
    if (!pending) return
    if (e.pointerId !== pending.pointerId) return
    if (typeof e.buttons === 'number' && e.buttons === 0) {
      pendingProxyPan = null
      return
    }
    const cx = Number.isFinite(e.clientX) ? e.clientX : 0
    const cy = Number.isFinite(e.clientY) ? e.clientY : 0
    const dx = cx - pending.startClientX
    const dy = cy - pending.startClientY
    if (dx * dx + dy * dy < 9) return

    pendingProxyPan = null
    lockGlobalUserSelect()
    args.userSelectLockPointerIdRef.current = pending.pointerId
    args.dragRef.current = {
      type: 'pan',
      startSx: pending.startSx,
      startSy: pending.startSy,
      startTx: pending.startTx,
      startTy: pending.startTy,
      pointerId: pending.pointerId,
    }
    proxyPanPointerId = pending.pointerId
    try {
      canvasEl.setPointerCapture(pending.pointerId)
    } catch {
      void 0
    }
    handlePointerMoveOnce(e)
    try {
      e.preventDefault()
    } catch {
      void 0
    }
  }

  const onWindowPointerUpCapture = (e: PointerEvent) => {
    if (!args.active) return
    if (pendingProxyPan && e.pointerId === pendingProxyPan.pointerId) {
      pendingProxyPan = null
    }
    if (proxyPanPointerId != null && e.pointerId === proxyPanPointerId) {
      proxyPanPointerId = null
      handlePointerUpOnce(e)
      return
    }

    const drag = args.dragRef.current
    if (!drag) return
    if (drag.type === 'pinch') {
      if (e.pointerId !== drag.pointerIdA && e.pointerId !== drag.pointerIdB) return
    } else {
      if (e.pointerId !== drag.pointerId) return
    }
    handlePointerUpOnce(e)
  }

  const onLostPointerCapture = (e: PointerEvent) => {
    if (pendingProxyPan && e.pointerId === pendingProxyPan.pointerId) {
      pendingProxyPan = null
    }
    if (proxyPanPointerId != null && e.pointerId === proxyPanPointerId) {
      proxyPanPointerId = null
    }
    if (args.userSelectLockPointerIdRef.current === e.pointerId) {
      args.userSelectLockPointerIdRef.current = null
      unlockGlobalUserSelect()
    }
    const drag = args.dragRef.current
    if (!drag) return

    if (drag.type === 'pinch') {
      if (e.pointerType === 'touch') {
        touchPointsById.delete(e.pointerId)
      }
      if (e.pointerId !== drag.pointerIdA && e.pointerId !== drag.pointerIdB) return
      args.dragRef.current = null
      edgeScroll.reset()
      args.setSelectionBox(null)
      args.requestCommit()
      return
    }

    if (drag.pointerId !== e.pointerId) return
    args.dragRef.current = null
    edgeScroll.reset()
    if (drag.type === 'lasso') {
      args.setSelectionBox(null)
    }
    args.requestCommit()
  }

  canvasEl.addEventListener('wheel', onWheel, { passive: false })
  canvasEl.addEventListener('pointerdown', onPointerDown, { passive: false })
  canvasEl.addEventListener('pointermove', onPointerMove, { passive: false })
  canvasEl.addEventListener('pointerup', onPointerUp, { passive: false })
  canvasEl.addEventListener('pointercancel', onPointerUp, { passive: false })
  canvasEl.addEventListener('lostpointercapture', onLostPointerCapture, { passive: false })
  canvasEl.addEventListener('contextmenu', onContextMenu, { passive: false })

  if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', onWindowPointerDownCapture, { passive: false, capture: true })
    window.addEventListener('pointermove', onWindowPointerMoveCapture, { passive: false, capture: true })
    window.addEventListener('pointerup', onWindowPointerUpCapture, { passive: false, capture: true })
    window.addEventListener('pointercancel', onWindowPointerUpCapture, { passive: false, capture: true })
    window.addEventListener('wheel', onWindowWheelCapture, { passive: false, capture: true })
    window.addEventListener('gesturestart', onWindowGestureStartCapture, { passive: false, capture: true })
    window.addEventListener('gesturechange', onWindowGestureChangeCapture, { passive: false, capture: true })
    window.addEventListener('gestureend', onWindowGestureEndCapture, { passive: false, capture: true })
  }

  return () => {
    pendingProxyPan = null
    proxyPanPointerId = null
    if (args.userSelectLockPointerIdRef.current != null) {
      try {
        const pointerId = args.userSelectLockPointerIdRef.current
        if (canvasEl.hasPointerCapture(pointerId)) {
          canvasEl.releasePointerCapture(pointerId)
        }
      } catch {
        void 0
      }
      args.userSelectLockPointerIdRef.current = null
      unlockGlobalUserSelect()
    }
    {
      const drag = args.dragRef.current
      if (drag) {
        const pointerIds = (() => {
          if (drag.type === 'pinch') return [drag.pointerIdA, drag.pointerIdB, drag.pointerId]
          return [drag.pointerId]
        })()
        const unique = Array.from(new Set(pointerIds.filter(v => typeof v === 'number' && Number.isFinite(v))))
        for (let i = 0; i < unique.length; i += 1) {
          const pointerId = unique[i]
          try {
            if (canvasEl.hasPointerCapture(pointerId)) {
              canvasEl.releasePointerCapture(pointerId)
            }
          } catch {
            void 0
          }
        }
        args.dragRef.current = null
        touchPointsById.clear()
        edgeScroll.reset()
      }
    }
    args.setSelectionBox(null)
    cancelWheelZoomAnimation()
    if (pendingWheelZoomRaf != null) {
      try {
        cancelAnimationFrame(pendingWheelZoomRaf)
      } catch {
        void 0
      }
      pendingWheelZoomRaf = null
    }
    if (pendingDragRelaxRaf != null) {
      try {
        cancelAnimationFrame(pendingDragRelaxRaf)
      } catch {
        void 0
      }
      pendingDragRelaxRaf = null
    }
    canvasEl.removeEventListener('wheel', onWheel)
    canvasEl.removeEventListener('pointerdown', onPointerDown)
    canvasEl.removeEventListener('pointermove', onPointerMove)
    canvasEl.removeEventListener('pointerup', onPointerUp)
    canvasEl.removeEventListener('pointercancel', onPointerUp)
    canvasEl.removeEventListener('lostpointercapture', onLostPointerCapture)
    canvasEl.removeEventListener('contextmenu', onContextMenu)

    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', onWindowPointerDownCapture, true)
      window.removeEventListener('pointermove', onWindowPointerMoveCapture, true)
      window.removeEventListener('pointerup', onWindowPointerUpCapture, true)
      window.removeEventListener('pointercancel', onWindowPointerUpCapture, true)
      window.removeEventListener('wheel', onWindowWheelCapture, true)
      window.removeEventListener('gesturestart', onWindowGestureStartCapture, true)
      window.removeEventListener('gesturechange', onWindowGestureChangeCapture, true)
      window.removeEventListener('gestureend', onWindowGestureEndCapture, true)
    }
  }
}
