import * as d3 from 'd3'
import type { GraphSchema } from '@/lib/graph/schema'
import type { ViewportControlsPreset } from '@/lib/config.viewport-controls'
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'

import { computeWheelZoomFactor, computeZoomWheelDeltaYpx } from '@/lib/canvas/zoom-input'
import { computeZoomWheelGuardDecision, createZoomWheelGuardState, type ZoomWheelGuardState } from '@/lib/canvas/zoom-wheel-guard'
import { coerceWheelFallback, resolveWheelAnchor } from '@/lib/canvas/wheel-anchor'
import { computeFlowWheelZoomDurationMs, easeOutCubic01, lerpNumber } from '@/lib/canvas/zoom-smoothing'
import {
  computeWheelPanDeltaPx,
  shouldAllowPanDragForPointerEvent,
  shouldSuppressContextMenuForPreset,
} from '@/lib/canvas/viewport-controls'
import {
  clampCanvasInteractionSpeedMultiplier,
  clampCanvasPanSpeedMultiplier,
  readPanSpeed,
  readWheelBehavior,
  readZoomSpeed,
  shouldWheelZoom,
} from '@/lib/canvas/camera-options-2d'
import { clampFlowWheelZoomIncrementMultiplier, clampFlowWheelZoomSpeedMultiplier } from '@/lib/canvas/flow-zoom-tuning'
import { clampScale, computeAnchoredZoomTransform, computePinchZoomTransform } from '@/lib/canvas/viewport-transform'
import { mergeScaleExtentWithCurrent } from '@/lib/zoom/scaleExtent'

export type InfiniteCanvasTransformAdapter = {
  getTransform: () => d3.ZoomTransform
  setTransform: (t: d3.ZoomTransform) => void
}

export type InfiniteCanvasViewportController = {
  handleWheel: (e: WheelEvent) => boolean
  handlePointerDown: (e: PointerEvent) => boolean
  handlePointerMove: (e: PointerEvent) => boolean
  handlePointerUp: (e: PointerEvent) => boolean
  handlePointerCancel: (e: PointerEvent) => boolean
  handleLostPointerCapture: (e: PointerEvent) => boolean
  handleContextMenu: (e: MouseEvent) => boolean
  handleMouseDown: (e: MouseEvent) => boolean
  destroy: () => void
}

type PanDrag = {
  type: 'pan'
  pointerId: number
  startSx: number
  startSy: number
  startTransform: d3.ZoomTransform
}

type PinchDrag = {
  type: 'pinch'
  pointerIdA: number
  pointerIdB: number
  startTransform: d3.ZoomTransform
  startA: { sx: number; sy: number }
  startB: { sx: number; sy: number }
}

type ViewDrag = null | PanDrag | PinchDrag

type RafApi = { request: (cb: (now: number) => void) => number; cancel: (id: number) => void; now: () => number }

type LocalPointReader = (e: { clientX?: unknown; clientY?: unknown; offsetX?: unknown; offsetY?: unknown; target?: unknown; currentTarget?: unknown }) =>
  | null
  | {
      sx: number
      sy: number
      inBounds: boolean
    }
type PointerCaptureApi = { setPointerCapture: (pointerId: number) => void; releasePointerCapture: (pointerId: number) => void; hasPointerCapture: (pointerId: number) => boolean }
export function createInfiniteCanvasViewportController(args: {
  active: () => boolean
  adapter: InfiniteCanvasTransformAdapter
  getSchema: () => GraphSchema
  computeScaleExtent?: (args: { schema: GraphSchema; currentK: number }) => { minK: number; maxK: number }
  getPreset: () => ViewportControlsPreset
  getPointerMode2d: () => 'pan' | 'select'
  getWheelZoomCtrlMetaBoostMultiplier: () => number
  getCanvasPanSpeedMultiplier: () => number
  getCanvasInteractionSpeedMultiplier: () => number
  getFlowWheelZoomSpeedMultiplier: () => number
  getFlowWheelZoomIncrementMultiplier: () => number
  getFlowWheelZoomSmoothDuration: () => { minMs: number; maxMs: number }
  isSpacePanHeld: () => boolean
  shouldIgnorePointerTarget: (target: EventTarget | null) => boolean
  shouldIgnoreWheelEvent: (e: WheelEvent) => boolean
  shouldBlockPanStart?: (e: PointerEvent) => boolean
  lockUserSelect: () => void
  unlockUserSelect: () => void
  disableAutoZoomModes: () => void
  onInteractionFrame?: () => void
  onCommit?: () => void
  getWheelAnchorFallback: () => { sx: number; sy: number; ts: number } | null
  setWheelAnchorFallback: (p: { sx: number; sy: number; ts: number }) => void
  readLocalPoint: LocalPointReader
  getBoundingRect: () => DOMRect
  pointerCapture: PointerCaptureApi
  raf?: Partial<RafApi>
}) : InfiniteCanvasViewportController {
  const raf: RafApi = {
    request: (cb) => {
      const fn = args.raf?.request || ((x: FrameRequestCallback) => requestAnimationFrame(x))
      return fn(cb)
    },
    cancel: (id) => {
      const fn = args.raf?.cancel || ((x: number) => cancelAnimationFrame(x))
      fn(id)
    },
    now: () => {
      const fn = args.raf?.now || (() => performance.now())
      return fn()
    },
  }
  let drag: ViewDrag = null
  let userSelectLockedPointerId: number | null = null
  const touchPointsById = new Map<number, { sx: number; sy: number }>()
  let wheelGuardState: ZoomWheelGuardState = createZoomWheelGuardState()
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
  let wheelZoomAnimLastCommitMs = 0

  const clearUserSelectLock = () => {
    const lockedPointerId = userSelectLockedPointerId
    if (lockedPointerId == null) return
    userSelectLockedPointerId = null
    try {
      args.unlockUserSelect()
    } catch {
      void 0
    }
    try {
      if (args.pointerCapture.hasPointerCapture(lockedPointerId)) args.pointerCapture.releasePointerCapture(lockedPointerId)
    } catch {
      void 0
    }
  }

  const cancelWheelZoomAnimation = () => {
    if (wheelZoomAnimRaf == null) return
    raf.cancel(wheelZoomAnimRaf)
    wheelZoomAnimRaf = null
  }

  const applyTransform = (t: d3.ZoomTransform, opts?: { commit?: boolean; commitMinIntervalMs?: number }) => {
    args.adapter.setTransform(t)
    args.onInteractionFrame?.()
    if (!opts?.commit || typeof args.onCommit !== 'function') return
    const now = Date.now()
    const interval = typeof opts.commitMinIntervalMs === 'number' && Number.isFinite(opts.commitMinIntervalMs) ? opts.commitMinIntervalMs : 0
    if (interval <= 0) {
      args.onCommit()
      return
    }
    if (!wheelZoomAnimLastCommitMs || now - wheelZoomAnimLastCommitMs >= interval) {
      wheelZoomAnimLastCommitMs = now
      args.onCommit()
    }
  }

  const tickWheelZoomAnimation = (nowMs: number) => {
    const t0 = wheelZoomAnimFrom
    const minK = wheelZoomAnimScaleExtent.minK
    const maxK = wheelZoomAnimScaleExtent.maxK
    const toK = clampScale(wheelZoomAnimToK, { minK, maxK })
    const elapsed = (Number.isFinite(nowMs) ? nowMs : raf.now()) - wheelZoomAnimStartMs
    const raw01 = wheelZoomAnimDurationMs > 0 ? elapsed / wheelZoomAnimDurationMs : 1
    const eased01 = easeOutCubic01(raw01)
    const k = clampScale(lerpNumber(t0.k, toK, eased01), { minK, maxK })
    const anchor = wheelZoomAnimAnchor

    applyTransform(computeAnchoredZoomTransform({ transform: t0, anchor, nextK: k }), { commit: true, commitMinIntervalMs: 60 })

    if (!(raw01 < 1)) {
      wheelZoomAnimRaf = null
      args.onCommit?.()
      return
    }
    wheelZoomAnimRaf = raf.request(tickWheelZoomAnimation)
  }

  const startWheelZoomAnimation = (next: {
    anchor: { sx: number; sy: number }
    toK: number
    extent: { minK: number; maxK: number }
    durationMs: number
  }) => {
    cancelWheelZoomAnimation()
    wheelZoomAnimFrom = args.adapter.getTransform() || d3.zoomIdentity
    wheelZoomAnimToK = next.toK
    wheelZoomAnimAnchor = { sx: next.anchor.sx, sy: next.anchor.sy }
    wheelZoomAnimScaleExtent = { minK: next.extent.minK, maxK: next.extent.maxK }
    wheelZoomAnimDurationMs = Math.max(0, Math.floor(next.durationMs))
    wheelZoomAnimStartMs = raf.now()
    wheelZoomAnimLastCommitMs = 0
    wheelZoomAnimRaf = raf.request(tickWheelZoomAnimation)
  }

  const readScaleExtent = (schema: GraphSchema, currentK: number): { minK: number; maxK: number } =>
    typeof args.computeScaleExtent === 'function'
      ? args.computeScaleExtent({ schema, currentK })
      : (() => {
          const [schemaMinK, schemaMaxK] = readZoomScaleExtent(schema)
          return mergeScaleExtentWithCurrent({ schemaMinK, schemaMaxK, curMinK: currentK, curMaxK: currentK })
        })()

  const flushPendingWheelZoom = () => {
    pendingWheelZoomRaf = null
    const anchor = pendingWheelZoomAnchor
    pendingWheelZoomAnchor = null
    const deltaYpx = pendingWheelZoomDeltaYpx
    pendingWheelZoomDeltaYpx = 0
    const extent = pendingWheelZoomScaleExtent
    pendingWheelZoomScaleExtent = null
    if (!anchor) return
    if (!Number.isFinite(deltaYpx) || Math.abs(deltaYpx) < 1e-9) return

    const t0 = args.adapter.getTransform() || d3.zoomIdentity
    const baseMinK = extent && Number.isFinite(extent.minK) ? extent.minK : 0.05
    const maxK = extent && Number.isFinite(extent.maxK) ? extent.maxK : 8
    const now = Date.now()
    const intent = deltaYpx < 0 ? 'in' : 'out'
    const minK = intent === 'out' ? Math.min(baseMinK, t0.k) : baseMinK

    const guard = computeZoomWheelGuardDecision({
      currentK: t0.k,
      minK,
      maxK,
      deltaYpx,
      nowMs: now,
      state: wheelGuardState,
    })
    wheelGuardState = guard.nextState
    if (guard.block) return

    const stateIncrement = clampFlowWheelZoomIncrementMultiplier(args.getFlowWheelZoomIncrementMultiplier())
    const factor = computeWheelZoomFactor(deltaYpx * stateIncrement)
    const nextK = clampScale(t0.k * factor, { minK, maxK })
    if (!Number.isFinite(nextK) || Math.abs(nextK - t0.k) < 1e-12) return

    const durationCfg = args.getFlowWheelZoomSmoothDuration()
    const durationMs = computeFlowWheelZoomDurationMs({
      deltaYpxAbs: Math.abs(deltaYpx),
      minMs: durationCfg.minMs,
      maxMs: durationCfg.maxMs,
    })

    startWheelZoomAnimation({
      anchor,
      toK: nextK,
      extent: { minK, maxK },
      durationMs,
    })
  }

  const handleWheel: InfiniteCanvasViewportController['handleWheel'] = (e) => {
    if (!args.active()) return false
    if (args.shouldIgnoreWheelEvent(e)) {
      try {
        e.preventDefault()
      } catch {
        void 0
      }
      return true
    }
    if (drag && drag.type !== 'pan') {
      try {
        e.preventDefault()
      } catch {
        void 0
      }
      return true
    }

    const schema = args.getSchema()
    const preset = args.getPreset()
    args.disableAutoZoomModes()
    const wheelBehavior = readWheelBehavior(schema)
    const wheelZoom = shouldWheelZoom({ event: e, preset, wheelBehavior })

    if (!wheelZoom) {
      cancelWheelZoomAnimation()
      const t0 = args.adapter.getTransform() || d3.zoomIdentity
      const panSpeed = readPanSpeed(schema)
      const interactionSpeed =
        clampCanvasPanSpeedMultiplier(args.getCanvasPanSpeedMultiplier()) * clampCanvasInteractionSpeedMultiplier(args.getCanvasInteractionSpeedMultiplier())
      const d = computeWheelPanDeltaPx(e)
      const dx = d.dx * panSpeed * interactionSpeed
      const dy = d.dy * panSpeed * interactionSpeed
      if (dx !== 0 || dy !== 0) {
        applyTransform(d3.zoomIdentity.translate(t0.x - dx, t0.y - dy).scale(t0.k), { commit: true })
      }
      try {
        e.preventDefault()
      } catch {
        void 0
      }
      return true
    }

    const t0 = args.adapter.getTransform() || d3.zoomIdentity
    const extent = readScaleExtent(schema, t0.k)
    const nowMs = Date.now()
    const local = args.readLocalPoint(e)
    const rect = local ? null : args.getBoundingRect()
    const fallback = coerceWheelFallback({ fallback: args.getWheelAnchorFallback(), nowMs, maxAgeMs: 800 })
    const anchor =
      local && local.inBounds
        ? { sx: local.sx, sy: local.sy, source: 'pointer' as const }
        : resolveWheelAnchor({
            rect: rect || args.getBoundingRect(),
            clientX: e.clientX,
            clientY: e.clientY,
            fallback,
          })
    if (anchor.source !== 'center') args.setWheelAnchorFallback({ sx: anchor.sx, sy: anchor.sy, ts: nowMs })

    const zoomSpeed = readZoomSpeed(schema)
    const speed = clampFlowWheelZoomSpeedMultiplier(args.getFlowWheelZoomSpeedMultiplier())
    const interactionSpeed = clampCanvasInteractionSpeedMultiplier(args.getCanvasInteractionSpeedMultiplier())
    const deltaYpx = computeZoomWheelDeltaYpx(e, zoomSpeed * speed * interactionSpeed, args.getWheelZoomCtrlMetaBoostMultiplier())
    pendingWheelZoomDeltaYpx += deltaYpx
    pendingWheelZoomAnchor = { sx: anchor.sx, sy: anchor.sy }
    pendingWheelZoomScaleExtent = extent
    if (pendingWheelZoomRaf == null) pendingWheelZoomRaf = raf.request(() => flushPendingWheelZoom())

    try {
      e.preventDefault()
    } catch {
      void 0
    }
    return true
  }

  const readPointerLocal = (e: PointerEvent): { sx: number; sy: number; inBounds: boolean } | null => {
    return args.readLocalPoint(e)
  }

  const startPanDrag = (e: PointerEvent) => {
    const local = readPointerLocal(e)
    if (!local) return false
    cancelWheelZoomAnimation()
    args.disableAutoZoomModes()
    drag = { type: 'pan', pointerId: e.pointerId, startSx: local.sx, startSy: local.sy, startTransform: args.adapter.getTransform() || d3.zoomIdentity }
    userSelectLockedPointerId = e.pointerId
    try {
      args.lockUserSelect()
    } catch {
      void 0
    }
    try {
      args.pointerCapture.setPointerCapture(e.pointerId)
    } catch {
      void 0
    }
    return true
  }

  const startPinchDrag = (pointerIdA: number, pointerIdB: number) => {
    const a = touchPointsById.get(pointerIdA)
    const b = touchPointsById.get(pointerIdB)
    if (!a || !b) return false
    cancelWheelZoomAnimation()
    args.disableAutoZoomModes()
    if (userSelectLockedPointerId == null) {
      userSelectLockedPointerId = pointerIdA
      try {
        args.lockUserSelect()
      } catch {
        void 0
      }
    }
    drag = {
      type: 'pinch',
      pointerIdA,
      pointerIdB,
      startTransform: args.adapter.getTransform() || d3.zoomIdentity,
      startA: { sx: a.sx, sy: a.sy },
      startB: { sx: b.sx, sy: b.sy },
    }
    return true
  }

  const handlePointerDown: InfiniteCanvasViewportController['handlePointerDown'] = (e) => {
    if (!args.active()) return false
    if (args.shouldIgnorePointerTarget(e.target)) return false
    const preset = args.getPreset()
    const pointerMode2d = args.getPointerMode2d()
    const button = typeof e.button === 'number' ? e.button : 0
    const shiftKey = e.shiftKey === true
    const allow = shouldAllowPanDragForPointerEvent({
      preset,
      eventType: 'pointerdown',
      button,
      shiftKey,
      spacePanHeld: args.isSpacePanHeld(),
    })
    if (!allow) return false
    if (pointerMode2d !== 'pan' && args.isSpacePanHeld() !== true && typeof args.shouldBlockPanStart === 'function') {
      if (args.shouldBlockPanStart(e)) return false
    }

    const local = readPointerLocal(e)
    if (!local) return false
    if (e.pointerType === 'touch') {
      touchPointsById.set(e.pointerId, { sx: local.sx, sy: local.sy })
      try {
        args.pointerCapture.setPointerCapture(e.pointerId)
      } catch {
        void 0
      }
      const ids = Array.from(touchPointsById.keys())
      if (ids.length >= 2) {
        startPinchDrag(ids[0]!, ids[1]!)
      } else {
        startPanDrag(e)
      }
      try {
        e.preventDefault()
      } catch {
        void 0
      }
      return true
    }
    const started = startPanDrag(e)
    if (started) {
      try {
        e.preventDefault()
      } catch {
        void 0
      }
    }
    return started
  }

  const handlePointerMove: InfiniteCanvasViewportController['handlePointerMove'] = (e) => {
    if (!args.active()) return false
    const local = readPointerLocal(e)
    if (local && local.inBounds && e.pointerType !== 'touch') args.setWheelAnchorFallback({ sx: local.sx, sy: local.sy, ts: Date.now() })

    if (!drag) {
      if (e.pointerType === 'touch' && local) touchPointsById.set(e.pointerId, { sx: local.sx, sy: local.sy })
      return false
    }
    if (drag.type === 'pan') {
      if (e.pointerId !== drag.pointerId) return false
      if (typeof e.buttons === 'number' && e.buttons === 0 && e.pointerType !== 'touch') {
        clearUserSelectLock()
        drag = null
        return true
      }
      if (!local) return false
      args.disableAutoZoomModes()
      const interactionSpeed =
        clampCanvasPanSpeedMultiplier(args.getCanvasPanSpeedMultiplier()) * clampCanvasInteractionSpeedMultiplier(args.getCanvasInteractionSpeedMultiplier())
      const dx = (local.sx - drag.startSx) * interactionSpeed
      const dy = (local.sy - drag.startSy) * interactionSpeed
      applyTransform(d3.zoomIdentity.translate(drag.startTransform.x + dx, drag.startTransform.y + dy).scale(drag.startTransform.k), { commit: true })
      try {
        e.preventDefault()
      } catch {
        void 0
      }
      return true
    }
    if (drag.type === 'pinch') {
      if (!local) return false
      touchPointsById.set(e.pointerId, { sx: local.sx, sy: local.sy })
      const a = touchPointsById.get(drag.pointerIdA)
      const b = touchPointsById.get(drag.pointerIdB)
      if (!a || !b) return false
      args.disableAutoZoomModes()
      const schema = args.getSchema()
      const extent = readScaleExtent(schema, drag.startTransform.k)
      const zoomSpeed = readZoomSpeed(schema)
      const speed = clampFlowWheelZoomSpeedMultiplier(args.getFlowWheelZoomSpeedMultiplier())
      const increment = clampFlowWheelZoomIncrementMultiplier(args.getFlowWheelZoomIncrementMultiplier())
      const interactionSpeed = clampCanvasInteractionSpeedMultiplier(args.getCanvasInteractionSpeedMultiplier())
      const zoomExponentMultiplier = Math.max(0.01, zoomSpeed * speed * increment * interactionSpeed)
      applyTransform(
        computePinchZoomTransform({
          startTransform: drag.startTransform,
          startA: drag.startA,
          startB: drag.startB,
          curA: a,
          curB: b,
          scaleExtent: extent,
          zoomExponentMultiplier,
        }),
        { commit: true },
      )
      try {
        e.preventDefault()
      } catch {
        void 0
      }
      return true
    }
    return false
  }

  const endPointer = (pointerId?: number) => {
    if (pointerId != null && userSelectLockedPointerId === pointerId) clearUserSelectLock()
    if (drag?.type === 'pan' && pointerId != null && drag.pointerId === pointerId) drag = null
  }

  const handlePointerUp: InfiniteCanvasViewportController['handlePointerUp'] = (e) => {
    let nextLockPointerId: number | null = null
    if (e.pointerType === 'touch') {
      touchPointsById.delete(e.pointerId)
      if (drag?.type === 'pinch' && (drag.pointerIdA === e.pointerId || drag.pointerIdB === e.pointerId)) {
        const ids = Array.from(touchPointsById.keys())
        if (ids.length >= 2) {
          startPinchDrag(ids[0]!, ids[1]!)
        } else if (ids.length === 1) {
          const remainingId = ids[0]!
          const pt = touchPointsById.get(remainingId)!
          drag = { type: 'pan', pointerId: remainingId, startSx: pt.sx, startSy: pt.sy, startTransform: args.adapter.getTransform() || d3.zoomIdentity }
          nextLockPointerId = remainingId
        } else {
          drag = null
        }
      }
    }
    if (!nextLockPointerId && drag?.type === 'pan') nextLockPointerId = drag.pointerId
    if (!nextLockPointerId && drag?.type === 'pinch') nextLockPointerId = drag.pointerIdA
    endPointer(e.pointerId)
    if (nextLockPointerId != null && userSelectLockedPointerId == null && drag != null) {
      userSelectLockedPointerId = nextLockPointerId
      try {
        args.lockUserSelect()
      } catch {
        void 0
      }
      try {
        args.pointerCapture.setPointerCapture(nextLockPointerId)
      } catch {
        void 0
      }
    }
    return false
  }

  const handlePointerCancel: InfiniteCanvasViewportController['handlePointerCancel'] = (e) => {
    let nextLockPointerId: number | null = null
    touchPointsById.delete(e.pointerId)
    endPointer(e.pointerId)
    if (drag?.type === 'pinch' && (drag.pointerIdA === e.pointerId || drag.pointerIdB === e.pointerId)) drag = null
    if (!nextLockPointerId && drag?.type === 'pan') nextLockPointerId = drag.pointerId
    if (!nextLockPointerId && drag?.type === 'pinch') nextLockPointerId = drag.pointerIdA
    if (nextLockPointerId != null && userSelectLockedPointerId == null && drag != null) {
      userSelectLockedPointerId = nextLockPointerId
      try {
        args.lockUserSelect()
      } catch {
        void 0
      }
      try {
        args.pointerCapture.setPointerCapture(nextLockPointerId)
      } catch {
        void 0
      }
    }
    return false
  }

  const handleLostPointerCapture: InfiniteCanvasViewportController['handleLostPointerCapture'] = (e) => {
    if (drag?.type === 'pan' && drag.pointerId === e.pointerId) {
      drag = null
      clearUserSelectLock()
    }
    if (drag?.type === 'pinch' && (drag.pointerIdA === e.pointerId || drag.pointerIdB === e.pointerId)) {
      drag = null
      clearUserSelectLock()
    }
    return false
  }

  const handleContextMenu: InfiniteCanvasViewportController['handleContextMenu'] = (e) => {
    const preset = args.getPreset()
    if (!shouldSuppressContextMenuForPreset(preset)) return false
    try {
      e.preventDefault()
    } catch {
      void 0
    }
    return true
  }

  const handleMouseDown: InfiniteCanvasViewportController['handleMouseDown'] = (_e) => {
    cancelWheelZoomAnimation()
    return false
  }

  const destroy = () => {
    cancelWheelZoomAnimation()
    if (pendingWheelZoomRaf != null) {
      raf.cancel(pendingWheelZoomRaf)
      pendingWheelZoomRaf = null
    }
    pendingWheelZoomDeltaYpx = 0
    pendingWheelZoomAnchor = null
    pendingWheelZoomScaleExtent = null
    drag = null
    touchPointsById.clear()
    clearUserSelectLock()
  }

  return {
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleLostPointerCapture,
    handleContextMenu,
    handleMouseDown,
    destroy,
  }
}
