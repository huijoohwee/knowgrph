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
import { readPanSpeed, readWheelBehavior, readZoomSpeed, shouldWheelZoom } from '@/lib/canvas/camera-options-2d'
import { disableAutoZoomModesForUserGesture } from '@/lib/canvas/auto-zoom-modes'

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

  const onWheel = (e: WheelEvent) => {
    if (shouldIgnoreCanvasWheelEvent({ event: e, ignoreSelector: UI_SELECTORS.canvasWheelIgnore })) {
      try {
        e.preventDefault()
      } catch {
        void 0
      }
      return
    }

    cancelFlowZoomRequestAnim(runtime)
    const drag = args.dragRef.current
    if (drag && drag.type !== 'pan') {
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
    if (!wheelZoom) {
      cancelWheelZoomAnimation()
      const t0 = runtime.transform || d3.zoomIdentity
      const panSpeed = schemaForWheel ? readPanSpeed(schemaForWheel) : 1
      const d = computeWheelPanDeltaPx(e)
      const dx = d.dx * panSpeed
      const dy = d.dy * panSpeed
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
    const deltaYpx = computeZoomWheelDeltaYpx(e, zoomSpeed * speed, storeState.wheelZoomCtrlMetaBoostMultiplier)
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
    if (hit) {
      const state = useGraphStore.getState()
      state.setSelectionSource('canvas')
      state.selectEdge(null)
      state.selectNode(hit)

      const allowDrag = typeof args.allowNodeDragOverride === 'boolean' ? args.allowNodeDragOverride : state.schema?.behavior?.allowNodeDrag !== false
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
      const state = useGraphStore.getState()
      const allowDrag = typeof args.allowNodeDragOverride === 'boolean' ? args.allowNodeDragOverride : state.schema?.behavior?.allowNodeDrag !== false
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
      const selectMode = state.schema?.behavior?.selectMode || 'single'
      const selectionOnDrag = args.selectionOnDrag === true
      const allowLasso = selectMode === 'lasso' || (selectionOnDrag === true && preset === 'design')
      const wantLasso =
        allowLasso &&
        e.pointerType !== 'touch' &&
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
      setFlowNativeTransform(
        runtime,
        computePinchZoomTransform({
          startTransform: drag.startTransform,
          startA: drag.startA,
          startB: drag.startB,
          curA: a,
          curB: b,
          scaleExtent: { minK: minScale, maxK: maxScale },
          zoomExponentMultiplier: zoomSpeed * speed * increment,
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
      const dx = sx - drag.startSx
      const dy = sy - drag.startSy
      setFlowNativeTransform(runtime, d3.zoomIdentity.translate(drag.startTx + dx, drag.startTy + dy).scale(runtime.transform.k))
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

  const onLostPointerCapture = (e: PointerEvent) => {
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

  return () => {
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
  }
}
