import * as d3 from 'd3'

import { useGraphStore } from '@/hooks/useGraphStore'
import { requestFlowNativeDraw, setFlowNativeTransform } from '@/components/FlowCanvas/nativeRuntime'
import { unlockGlobalUserSelect } from '@/lib/canvas/interaction-user-select'
import { readCanvasLocalPoint } from '@/lib/canvas/canvas-event-coords'
import { disableAutoZoomModesForUserGesture } from '@/lib/canvas/auto-zoom-modes'
import { DEFAULT_ZOOM_MIN_SCALE_HARD_CAP, readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import { getFlowAutoMinScale } from '@/components/FlowCanvas/flowScaleExtentOverride'
import { clampScale, computePinchZoomTransform } from '@/lib/canvas/viewport-transform'
import { readZoomSpeed, clampCanvasInteractionSpeedMultiplier, clampCanvasPanSpeedMultiplier } from '@/lib/canvas/camera-options-2d'
import { clampFlowWheelZoomIncrementMultiplier, clampFlowWheelZoomSpeedMultiplier } from '@/lib/canvas/flow-zoom-tuning'
import { clampFlowDelta, clampFlowNodeTopLeft } from '@/components/FlowCanvas/groupContainment'
import { readSnapGridConfigFromSchema, snapDeltaToGridByAnchor, snapScalarToGrid } from '@/lib/canvas/gridSnap'

import type { FlowNativeInteractionsContext } from '@/components/FlowCanvas/interactions/context'

export function createFlowNativePointerMoveHandler(ctx: FlowNativeInteractionsContext) {
  const canvasEl = ctx.canvasEl
  const runtime = ctx.runtime

  return (e: PointerEvent) => {
    const drag = ctx.args.dragRef.current
    const local = readCanvasLocalPoint({ canvasEl, event: e })
    if (local && local.inBounds) ctx.args.lastPointerInCanvasRef.current = { sx: local.sx, sy: local.sy, ts: Date.now() }
    if (!drag) return

    if (e.pointerType !== 'touch' && e.buttons === 0) {
      if (ctx.args.userSelectLockPointerIdRef.current === e.pointerId) {
        ctx.args.userSelectLockPointerIdRef.current = null
        unlockGlobalUserSelect()
      }
      try {
        if (canvasEl.hasPointerCapture(e.pointerId)) {
          canvasEl.releasePointerCapture(e.pointerId)
        }
      } catch {
        void 0
      }
      ctx.args.dragRef.current = null
      ctx.edgeScroll.reset()
      ctx.args.setSelectionBox(null)
      ctx.args.requestCommit()
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

    if (drag.type === 'node' || drag.type === 'nodes' || drag.type === 'group' || drag.type === 'lasso') {
      const state = useGraphStore.getState()
      const locked = state.viewPinned === true
      const d = ctx.edgeScroll.update({
        nowMs: Date.now(),
        pointer: { sx, sy, kind: e.pointerType === 'touch' ? 'touch' : e.pointerType === 'pen' ? 'pen' : 'mouse' },
        viewport: { w: runtime.viewportW, h: runtime.viewportH },
        zoomK: runtime.transform?.k || 1,
        enabled: local.inBounds === true && !locked,
      })
      if (Math.abs(d.dx) > 1e-6 || Math.abs(d.dy) > 1e-6) {
        setFlowNativeTransform(runtime, d3.zoomIdentity.translate(runtime.transform.x + d.dx, runtime.transform.y + d.dy).scale(runtime.transform.k))
        requestFlowNativeDraw(runtime, ctx.args.buildDrawArgs())
        ctx.args.requestCommit()
        ctx.args.onInteractionFrame?.()
      }
    }

    if (drag.type === 'groupResize') {
      const t0 = runtime.transform || d3.zoomIdentity
      const wx = (sx - t0.x) / t0.k
      const wy = (sy - t0.y) / t0.k
      const dx = wx - drag.startWorldX
      const dy = wy - drag.startWorldY
      const scene = runtime.scene
      if (!scene || !scene.groups) return
      const group = scene.groups.find(g => String(g.id || '').trim() === String(drag.groupId || '').trim()) || null
      if (!group) return
      const minW = typeof drag.minWidth === 'number' && Number.isFinite(drag.minWidth) ? drag.minWidth : 24
      const minH = typeof drag.minHeight === 'number' && Number.isFinite(drag.minHeight) ? drag.minHeight : 24
      const rawW = Math.max(minW, drag.startBounds.width + dx)
      const rawH = Math.max(minH, drag.startBounds.height + dy)
      const snapGrid = readSnapGridConfigFromSchema(useGraphStore.getState().schema)
      const allowSnap = snapGrid.enabled && e.altKey !== true
      const nextW = allowSnap ? Math.max(minW, snapScalarToGrid(rawW, snapGrid.size)) : rawW
      const nextH = allowSnap ? Math.max(minH, snapScalarToGrid(rawH, snapGrid.size)) : rawH
      ;(group as unknown as { bounds?: unknown }).bounds = { x: drag.startBounds.x, y: drag.startBounds.y, width: nextW, height: nextH }
      runtime.dirty = true
      requestFlowNativeDraw(runtime, ctx.args.buildDrawArgs())
      ctx.args.onInteractionFrame?.()
      try {
        e.preventDefault()
      } catch {
        void 0
      }
      return
    }

    if (e.pointerType === 'touch') {
      ctx.touchPointsById.set(e.pointerId, { sx, sy })
    }

    if (drag.type === 'pinch') {
      const a = ctx.touchPointsById.get(drag.pointerIdA)
      const b = ctx.touchPointsById.get(drag.pointerIdB)
      if (!a || !b) return
      const state = useGraphStore.getState()
      disableAutoZoomModesForUserGesture(state)
      const [schemaMinScale, schemaMaxScale] = readZoomScaleExtent(state.schema)
      const autoMinScale = getFlowAutoMinScale(runtime)
      const maxScale = schemaMaxScale
      const minScaleBase = autoMinScale != null ? autoMinScale : schemaMinScale
      const minScale = clampScale(minScaleBase, { minK: DEFAULT_ZOOM_MIN_SCALE_HARD_CAP, maxK: maxScale })
      const minK = Math.min(minScale, drag.startTransform.k)
      const zoomSpeedRaw = readZoomSpeed(state.schema)
      const zoomSpeed = Number.isFinite(zoomSpeedRaw) && zoomSpeedRaw > 0 ? zoomSpeedRaw : 1
      const speed = clampFlowWheelZoomSpeedMultiplier(state.flowWheelZoomSpeedMultiplier)
      const increment = clampFlowWheelZoomIncrementMultiplier(state.flowWheelZoomIncrementMultiplier)
      const interactionSpeed = clampCanvasInteractionSpeedMultiplier(state.canvasInteractionSpeedMultiplier)
      const next = computePinchZoomTransform({
        startTransform: drag.startTransform,
        startA: drag.startA,
        startB: drag.startB,
        curA: a,
        curB: b,
        scaleExtent: { minK, maxK: maxScale },
        zoomExponentMultiplier: zoomSpeed * speed * increment * interactionSpeed,
      })
      setFlowNativeTransform(runtime, next)
      requestFlowNativeDraw(runtime, ctx.args.buildDrawArgs())
      ctx.args.requestCommit()
      ctx.args.onInteractionFrame?.()
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
      ctx.args.dragRef.current = { ...drag, lastSx: sx, lastSy: sy }
      ctx.args.setSelectionBox({ left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) })
      ctx.args.onInteractionFrame?.()
      try {
        e.preventDefault()
      } catch {
        void 0
      }
      return
    }

    if (drag.type === 'pan') {
      const st = useGraphStore.getState()
      const interactionSpeed = clampCanvasPanSpeedMultiplier(st.canvasPanSpeedMultiplier) * clampCanvasInteractionSpeedMultiplier(st.canvasInteractionSpeedMultiplier)
      const dx = (sx - drag.startSx) * interactionSpeed
      const dy = (sy - drag.startSy) * interactionSpeed
      setFlowNativeTransform(runtime, d3.zoomIdentity.translate(drag.startTx + dx, drag.startTy + dy).scale(runtime.transform.k))
      requestFlowNativeDraw(runtime, ctx.args.buildDrawArgs())
      ctx.args.requestCommit()
      ctx.args.onInteractionFrame?.()
      try {
        e.preventDefault()
      } catch {
        void 0
      }
      return
    }

    if (drag.type === 'nodes') {
      const t0 = runtime.transform || d3.zoomIdentity
      const wx = (sx - t0.x) / t0.k
      const wy = (sy - t0.y) / t0.k
      const dx = wx - drag.startWorldX
      const dy = wy - drag.startWorldY
      const st = useGraphStore.getState()
      const grid = readSnapGridConfigFromSchema(st.schema)
      const allowSnap = grid.enabled && e.altKey !== true
      const scene = runtime.scene
      if (!scene) return
      const anchorId = drag.memberNodeIds[0] || ''
      const anchorStart = anchorId ? drag.startNodePosById[anchorId] : null
      const snappedDelta = allowSnap ? snapDeltaToGridByAnchor({ anchorStart, rawDelta: { dx, dy }, gridSize: grid.size }) : { dx, dy }
      const clampedDelta = drag.deltaClamp ? clampFlowDelta({ clamp: drag.deltaClamp, dx: snappedDelta.dx, dy: snappedDelta.dy }) : snappedDelta
      for (let i = 0; i < drag.memberNodeIds.length; i += 1) {
        const id = drag.memberNodeIds[i]
        const node = scene.nodeById.get(id)
        const start = drag.startNodePosById[id]
        if (!node || !start) continue
        node.x = start.x + clampedDelta.dx
        node.y = start.y + clampedDelta.dy
      }
      runtime.dirty = true
      ctx.args.positionsDirtySinceCommitRef.current = true
      ctx.scheduleDragRelax()
      requestFlowNativeDraw(runtime, ctx.args.buildDrawArgs())
      ctx.args.onInteractionFrame?.()
      return
    }

    if (drag.type === 'group') {
      const t0 = runtime.transform || d3.zoomIdentity
      const wx = (sx - t0.x) / t0.k
      const wy = (sy - t0.y) / t0.k
      const dx = wx - drag.startWorldX
      const dy = wy - drag.startWorldY
      const st = useGraphStore.getState()
      const grid = readSnapGridConfigFromSchema(st.schema)
      const allowSnap = grid.enabled && e.altKey !== true
      const scene = runtime.scene
      if (!scene) return
      const anchorId = drag.memberNodeIds[0] || ''
      const anchorStart = anchorId ? drag.startNodePosById[anchorId] : null
      const snappedDelta = allowSnap ? snapDeltaToGridByAnchor({ anchorStart, rawDelta: { dx, dy }, gridSize: grid.size }) : { dx, dy }
      for (let i = 0; i < drag.memberNodeIds.length; i += 1) {
        const id = drag.memberNodeIds[i]
        const node = scene.nodeById.get(id)
        const start = drag.startNodePosById[id]
        if (!node || !start) continue
        node.x = start.x + snappedDelta.dx
        node.y = start.y + snappedDelta.dy
      }
      runtime.dirty = true
      ctx.args.positionsDirtySinceCommitRef.current = true
      ctx.scheduleDragRelax()
      requestFlowNativeDraw(runtime, ctx.args.buildDrawArgs())
      ctx.args.onInteractionFrame?.()
      return
    }

    const t0 = runtime.transform || d3.zoomIdentity
    const wx = (sx - t0.x) / t0.k
    const wy = (sy - t0.y) / t0.k
    const dx = wx - drag.startWorldX
    const dy = wy - drag.startWorldY
    const st = useGraphStore.getState()
    const grid = readSnapGridConfigFromSchema(st.schema)
    const allowSnap = grid.enabled && e.altKey !== true
    const scene = runtime.scene
    const node = scene?.nodeById.get(drag.nodeId)
    if (!scene || !node) return
    const nextX0 = drag.startNodeX + dx
    const nextY0 = drag.startNodeY + dy
    let nextX = allowSnap ? snapScalarToGrid(nextX0, grid.size) : nextX0
    let nextY = allowSnap ? snapScalarToGrid(nextY0, grid.size) : nextY0
    if (drag.clamp) {
      const clamped = clampFlowNodeTopLeft({ clamp: drag.clamp, x: nextX, y: nextY })
      nextX = clamped.x
      nextY = clamped.y
    }
    node.x = nextX
    node.y = nextY
    runtime.dirty = true
    ctx.args.positionsDirtySinceCommitRef.current = true
    ctx.scheduleDragRelax()
    requestFlowNativeDraw(runtime, ctx.args.buildDrawArgs())
    ctx.args.onInteractionFrame?.()
    try {
      e.preventDefault()
    } catch {
      void 0
    }
  }
}

