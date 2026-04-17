import * as d3 from 'd3'

import { useGraphStore } from '@/hooks/useGraphStore'
import { computeFlowGroupAabb, hitTestGroup, requestFlowNativeDraw, setFlowNativeTransform } from '@/components/FlowCanvas/nativeRuntime'
import { unlockGlobalUserSelect } from '@/lib/canvas/interaction-user-select'
import { readCanvasLocalPoint } from '@/lib/canvas/canvas-event-coords'
import { disableAutoZoomModesForUserGesture } from '@/lib/canvas/auto-zoom-modes'
import { DEFAULT_ZOOM_MIN_SCALE_HARD_CAP, readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import { clampScale, computePinchZoomTransform } from '@/lib/canvas/viewport-transform'
import { readZoomSpeed, clampCanvasInteractionSpeedMultiplier, clampCanvasPanSpeedMultiplier } from '@/lib/canvas/camera-options-2d'
import { clampFlowWheelZoomIncrementMultiplier, clampFlowWheelZoomSpeedMultiplier } from '@/lib/canvas/flow-zoom-tuning'
import { clampFlowDelta, clampFlowNodeTopLeft } from '@/components/FlowCanvas/groupContainment'
import { readSnapGridConfigFromSchema, snapDeltaToGridByAnchor, snapScalarToGrid } from '@/lib/canvas/gridSnap'
import { computeGroupResizeBottomRight } from '@/lib/canvas/groupResizeMath2d'
import { applyGroupResizeDragSensitivity, computeDynamicGroupResizeHandlePx, pxToWorld } from '@/lib/canvas/groupResizeHandleConfig'

import type { FlowNativeInteractionsContext } from '@/components/FlowCanvas/interactions/context'

const FLOW_ZOOM_MAX_VISUAL_CAP = 24

export function createFlowNativePointerMoveHandler(ctx: FlowNativeInteractionsContext) {
  const canvasEl = ctx.canvasEl
  const runtime = ctx.runtime

  return (e: PointerEvent) => {
    const setCursor = (value: string) => {
      if (canvasEl.style.cursor !== value) canvasEl.style.cursor = value
    }
    const drag = ctx.args.dragRef.current
    const local = readCanvasLocalPoint({ canvasEl, event: e })
    if (local && local.inBounds) ctx.args.lastPointerInCanvasRef.current = { sx: local.sx, sy: local.sy, ts: Date.now() }
    if (!drag) {
      if (!local || !local.inBounds) {
        setCursor('default')
        return
      }
      const sx = local.sx
      const sy = local.sy
      const groupId = hitTestGroup(runtime, { sx, sy })
      if (!groupId) {
        setCursor('default')
        return
      }
      const scene = runtime.scene
      const group = scene?.groups?.find(g => String(g.id || '').trim() === String(groupId || '').trim()) || null
      if (!scene || !group) {
        setCursor('default')
        return
      }
      const gCfg = runtime.presentation.groups
      const aabb = computeFlowGroupAabb({
        scene,
        group,
        paddingPx: Math.max(0, gCfg.paddingPx),
        labelTopExtraPx: Math.max(0, gCfg.labelTopExtraPx),
      })
      if (!aabb) {
        setCursor('default')
        return
      }
      const t0 = runtime.transform || d3.zoomIdentity
      const wx = (sx - t0.x) / t0.k
      const wy = (sy - t0.y) / t0.k
      const rh = runtime.presentation.groups.resizeHandle
      if (rh) {
        const s = computeDynamicGroupResizeHandlePx({
          dotRadiusPx: rh.dotRadiusPx,
          hitRadiusPx: rh.hitRadiusPx,
          strokeWidthPx: rh.strokeWidthPx,
          groupWidth: Math.max(1, aabb.maxX - aabb.minX),
          groupHeight: Math.max(1, aabb.maxY - aabb.minY),
        })
        const hw = pxToWorld(s.hitRadiusPx, t0.k)
        const inHandle = wx >= aabb.maxX - hw && wx <= aabb.maxX + hw && wy >= aabb.maxY - hw && wy <= aabb.maxY + hw
        if (inHandle) {
          setCursor('nwse-resize')
          return
        }
      }
      const headerHeightPxRaw = Math.max(
        16,
        runtime.presentation.labels.groupFontSizePx + 10,
        runtime.presentation.groups.labelTopExtraPx + 8,
      )
      const headerHeightWorld = pxToWorld(headerHeightPxRaw, t0.k)
      const maxHeaderWorld = Math.max(1, (aabb.maxY - aabb.minY) * 0.45)
      const headerH = Math.min(headerHeightWorld, maxHeaderWorld)
      const inHeader = wx >= aabb.minX && wx <= aabb.maxX && wy >= aabb.minY && wy <= aabb.minY + headerH
      setCursor(inHeader ? 'grab' : 'default')
      return
    }

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

    if (drag.type === 'group') setCursor('grabbing')
    else if (drag.type === 'groupResize') setCursor('nwse-resize')
    else setCursor('default')

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
      const scene = runtime.scene
      if (!scene || !scene.groups) return
      const group = scene.groups.find(g => String(g.id || '').trim() === String(drag.groupId || '').trim()) || null
      if (!group) return
      const minW = typeof drag.minWidth === 'number' && Number.isFinite(drag.minWidth) ? drag.minWidth : 24
      const minH = typeof drag.minHeight === 'number' && Number.isFinite(drag.minHeight) ? drag.minHeight : 24
      const snapGrid = readSnapGridConfigFromSchema(useGraphStore.getState().schema)
      const dragCfg = runtime.presentation.groups.resizeHandle || null
      const adjustedWorld = applyGroupResizeDragSensitivity({
        startWorld: { x: drag.startWorldX, y: drag.startWorldY },
        world: { x: wx, y: wy },
        zoomK: t0.k,
        dragSensitivity: dragCfg && Number.isFinite(dragCfg.dragSensitivity) ? dragCfg.dragSensitivity : 0.72,
        dragDeadzonePx: dragCfg && Number.isFinite(dragCfg.dragDeadzonePx) ? dragCfg.dragDeadzonePx : 3,
      })
      const next = computeGroupResizeBottomRight({
        startBounds: { x: drag.startBounds.x, y: drag.startBounds.y, w: drag.startBounds.width, h: drag.startBounds.height },
        startWorld: { x: drag.startWorldX, y: drag.startWorldY },
        world: adjustedWorld,
        minW,
        minH,
        snapGrid,
        altDown: e.altKey === true,
      })
      const previous = (group as unknown as { bounds?: { x?: number; y?: number; width?: number; height?: number } }).bounds
      if (
        previous &&
        previous.x === next.x &&
        previous.y === next.y &&
        previous.width === next.w &&
        previous.height === next.h
      ) {
        return
      }
      ;(group as unknown as { bounds?: unknown }).bounds = { x: next.x, y: next.y, width: next.w, height: next.h }
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
      const maxScale = Math.min(schemaMaxScale, FLOW_ZOOM_MAX_VISUAL_CAP)
      const minScaleBase = Math.min(schemaMinScale, DEFAULT_ZOOM_MIN_SCALE_HARD_CAP)
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
