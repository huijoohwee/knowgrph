import * as d3 from 'd3';
import { GraphNode } from '@/lib/graph/types';
import { GraphSchema } from '@/lib/graph/schema';
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import { computeWheelZoomFactor, computeZoomWheelDeltaYpx } from '@/lib/canvas/zoom-input'
import { shouldIgnoreCanvasWheelEvent } from '@/lib/canvas/wheel-target-guard'
import { UI_SELECTORS } from '@/lib/config'
import { computeZoomWheelGuardDecision, createZoomWheelGuardState } from '@/lib/canvas/zoom-wheel-guard'
import {
  computeWheelPanDeltaPx,
  shouldAllowPanDragForPointerEvent,
  shouldSuppressContextMenuForPreset,
} from '@/lib/canvas/viewport-controls'
import type { ViewportControlsPreset } from '@/lib/config.viewport-controls'
import { isSpacePanHeld } from '@/lib/canvas/space-pan'
import {
  clampCanvasInteractionSpeedMultiplier,
  clampCanvasPanSpeedMultiplier,
  readPanSpeed,
  readWheelBehavior,
  readZoomSpeed,
  shouldWheelZoom,
} from '@/lib/canvas/camera-options-2d'
import { useGraphStore } from '@/hooks/useGraphStore'
import { clampFlowWheelZoomIncrementMultiplier, clampFlowWheelZoomSpeedMultiplier } from '@/lib/canvas/flow-zoom-tuning'
import { computeAnchoredZoomTransform, computePinchZoomTransform } from '@/lib/canvas/viewport-transform'
import { computeFlowWheelZoomDurationMs, easeOutCubic01, lerpNumber } from '@/lib/canvas/zoom-smoothing'
import { coerceWheelFallback, resolveWheelAnchor } from '@/lib/canvas/wheel-anchor'
import { disableAutoZoomModesForUserGesture } from '@/lib/canvas/auto-zoom-modes'
import { lockGlobalUserSelect, unlockGlobalUserSelect } from '@/lib/canvas/interaction-user-select'
import { isNodePointerTarget } from '@/features/canvas/utils'
import { mergeScaleExtentWithCurrent } from '@/lib/zoom/scaleExtent'

export const createZoom = (
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  labelsSelRef: React.MutableRefObject<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>,
  schema: GraphSchema,
  viewportControlsPreset: ViewportControlsPreset,
  onZoomTransform?: (t: { k: number; x: number; y: number }) => void,
  onLabelLodVisibilityChange?: (hidden: boolean) => void,
) => {
  let lastOpacityTs = 0;
  let lastHidden: boolean | null = null;
  let lastResponsiveTs = 0
  let lastKEffective: number | null = null
  const [schemaMinScale, schemaMaxScale] = readZoomScaleExtent(schema)
  let scaleExtent = mergeScaleExtentWithCurrent({ schemaMinK: schemaMinScale, schemaMaxK: schemaMaxScale })
  const baseFontSizeRaw = schema.labelStyles?.fontSize
  const baseFontSize = typeof baseFontSizeRaw === 'number' && Number.isFinite(baseFontSizeRaw) && baseFontSizeRaw > 0 ? baseFontSizeRaw : 12
  const haloWidthRaw = schema.labelStyles?.halo?.width
  const baseHaloWidth = typeof haloWidthRaw === 'number' && Number.isFinite(haloWidthRaw) && haloWidthRaw > 0 ? haloWidthRaw : 3
  let guardState = createZoomWheelGuardState()
  let lastK = 1
  let lastPointerInCanvas: null | { sx: number; sy: number; ts: number } = null
  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .filter(event => {
      const anyEvent = event as unknown as {
        type?: unknown
        ctrlKey?: unknown
        shiftKey?: unknown
        button?: unknown
        target?: unknown
      }
      const type = typeof anyEvent.type === 'string' ? anyEvent.type : ''
      if (type.startsWith('touch')) return false
      const target = anyEvent.target
      const targetEl = target instanceof Element ? target : null
      const ignoreSelector = [UI_SELECTORS.canvasWheelIgnore, UI_SELECTORS.canvasPointerIgnore].filter(Boolean).join(', ')
      if (ignoreSelector && targetEl && targetEl.closest(ignoreSelector)) return false
      if (anyEvent.type === 'wheel') {
        if (shouldIgnoreCanvasWheelEvent({ event: event as WheelEvent, ignoreSelector: UI_SELECTORS.canvasWheelIgnore })) {
          try {
            ;(event as WheelEvent).preventDefault()
          } catch {
            void 0
          }
          return false
        }

        return false
      }
      const ctrlKey = anyEvent.ctrlKey === true
      const shiftKey = anyEvent.shiftKey === true
      const button = typeof anyEvent.button === 'number' ? anyEvent.button : 0
      if (ctrlKey && anyEvent.type !== 'wheel') return false

      const st = useGraphStore.getState()
      const preset = (st.viewportControlsPreset || viewportControlsPreset) as ViewportControlsPreset

      return shouldAllowPanDragForPointerEvent({
        preset,
        eventType: type,
        button,
        shiftKey,
        spacePanHeld: isSpacePanHeld(),
      })
    })
    .scaleExtent([scaleExtent.minK, scaleExtent.maxK])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
      try {
        const src = (event as unknown as { sourceEvent?: unknown }).sourceEvent as { type?: unknown } | null
        const srcType = src && typeof src.type === 'string' ? src.type : ''
        if (srcType && srcType !== 'wheel') {
          disableAutoZoomModesForUserGesture(useGraphStore.getState())
        }
      } catch {
        void 0
      }
      const now = Date.now();
      const transform = event.transform as d3.ZoomTransform;
      const k = transform.k || 1;
      lastK = k

      const kEffective = Math.max(1, k)
      if (!lastResponsiveTs || now - lastResponsiveTs > 16) {
        lastResponsiveTs = now
        const rounded = Math.round(kEffective * 1000) / 1000
        if (lastKEffective == null || Math.abs(rounded - lastKEffective) > 1e-9) {
          lastKEffective = rounded
          const scaledFontSize = baseFontSize / kEffective
          const scaledHaloWidth = baseHaloWidth / kEffective

          g.selectAll<SVGTextElement, unknown>('[data-kg-layer="labels"] text.node-label')
            .attr('font-size', scaledFontSize)
            .attr('stroke-width', scaledHaloWidth)
            .attr('dx', function () {
              const raw = (this as SVGTextElement).getAttribute('data-base-dx')
              const base = raw == null ? 0 : Number(raw)
              return Number.isFinite(base) ? (base / kEffective) : 0
            })
            .attr('dy', function () {
              const raw = (this as SVGTextElement).getAttribute('data-base-dy')
              const base = raw == null ? 0 : Number(raw)
              return Number.isFinite(base) ? (base / kEffective) : 0
            })

          g.selectAll<SVGTextElement, unknown>('[data-kg-layer="group-labels"] text')
            .attr('font-size', scaledFontSize)
            .attr('stroke-width', Math.max(2 / kEffective, scaledHaloWidth * 0.85))

          g.selectAll<SVGTextElement, unknown>('[data-kg-layer="edge-labels"] text')
            .attr('font-size', Math.max(9 / kEffective, (baseFontSize * 0.9) / kEffective))
            .attr('stroke-width', Math.max(2 / kEffective, scaledHaloWidth * 0.85))
        }
      }

      const hideBelow = schema.performance?.lod?.hideLabelsBelowScale ?? 0;
      const hidden = hideBelow > 0 && k < hideBelow;
      if (!lastOpacityTs || now - lastOpacityTs > 16) {
        lastOpacityTs = now;
        if (hidden !== lastHidden) {
          lastHidden = hidden;
          if (labelsSelRef.current) {
            labelsSelRef.current.attr('data-zoom-lod-hidden', hidden ? '1' : '0');
          }
          g.selectAll('[data-kg-layer="group-labels"]').style('display', hidden ? 'none' : '')
          g.selectAll('[data-kg-layer="edge-labels"]').style('display', hidden ? 'none' : '')
          if (onLabelLodVisibilityChange) onLabelLodVisibilityChange(hidden);
        }
      }
      if (onZoomTransform) {
        onZoomTransform({ k: transform.k ?? 1, x: transform.x ?? 0, y: transform.y ?? 0 });
      }
    });

  const syncScaleExtent = (schemaNow: GraphSchema) => {
    const [schemaMinK, schemaMaxK] = readZoomScaleExtent(schemaNow)
    const [curMinK, curMaxK] = zoom.scaleExtent()
    const next = mergeScaleExtentWithCurrent({ schemaMinK, schemaMaxK, curMinK, curMaxK })
    if (next.minK !== curMinK || next.maxK !== curMaxK) {
      zoom.scaleExtent([next.minK, next.maxK])
    }
    scaleExtent = next
    return next
  }
  svg.call(zoom);

  let pointerDrag: null | { pointerId: number; startClientX: number; startClientY: number; startTransform: d3.ZoomTransform } = null
  const cancelPointerDrag = (svgEl: SVGSVGElement) => {
    const drag = pointerDrag
    if (!drag) return
    pointerDrag = null
    try {
      unlockGlobalUserSelect()
    } catch {
      void 0
    }
    try {
      svgEl.releasePointerCapture(drag.pointerId)
    } catch {
      void 0
    }
  }

  svg.on('pointerdown.kgPointerPan', (event: unknown) => {
    const e = event as PointerEvent
    if (!e) return
    if (e.pointerType === 'touch') return

    const svgEl = svg.node()
    if (!svgEl) return

    const target = e.target
    const targetEl = target instanceof Element ? target : null
    const ignoreSelector = [UI_SELECTORS.canvasWheelIgnore, UI_SELECTORS.canvasPointerIgnore].filter(Boolean).join(', ')
    if (ignoreSelector && targetEl && targetEl.closest(ignoreSelector)) return

    const st = useGraphStore.getState()
    const preset = (st.viewportControlsPreset || viewportControlsPreset) as ViewportControlsPreset
    const button = typeof e.button === 'number' ? e.button : 0
    const shiftKey = e.shiftKey === true
    if (button === 0 && isSpacePanHeld() !== true && isNodePointerTarget(targetEl)) return
    if (
      !shouldAllowPanDragForPointerEvent({
        preset,
        eventType: 'pointerdown',
        button,
        shiftKey,
        spacePanHeld: isSpacePanHeld(),
      })
    ) {
      return
    }

    svg.interrupt()
    cancelWheelZoomAnimation()
    disableAutoZoomModesForUserGesture(st)
    pointerDrag = {
      pointerId: e.pointerId,
      startClientX: Number.isFinite(e.clientX) ? e.clientX : 0,
      startClientY: Number.isFinite(e.clientY) ? e.clientY : 0,
      startTransform: d3.zoomTransform(svgEl),
    }
    try {
      lockGlobalUserSelect()
    } catch {
      void 0
    }
    try {
      svgEl.setPointerCapture(e.pointerId)
    } catch {
      void 0
    }
    try {
      e.preventDefault()
    } catch {
      void 0
    }
  })

  svg.on('pointermove.kgPointerPan', (event: unknown) => {
    const e = event as PointerEvent
    const drag = pointerDrag
    if (!drag) return
    if (!e || e.pointerId !== drag.pointerId) return
    const svgEl = svg.node()
    if (!svgEl) return
    if (typeof e.buttons === 'number' && e.buttons === 0) {
      cancelPointerDrag(svgEl)
      return
    }
    const st = useGraphStore.getState()
    disableAutoZoomModesForUserGesture(st)
    const interactionSpeed =
      clampCanvasPanSpeedMultiplier(st.canvasPanSpeedMultiplier) * clampCanvasInteractionSpeedMultiplier(st.canvasInteractionSpeedMultiplier)
    const clientX = Number.isFinite(e.clientX) ? e.clientX : 0
    const clientY = Number.isFinite(e.clientY) ? e.clientY : 0
    const dx = (clientX - drag.startClientX) * interactionSpeed
    const dy = (clientY - drag.startClientY) * interactionSpeed
    const next = d3.zoomIdentity.translate(drag.startTransform.x + dx, drag.startTransform.y + dy).scale(drag.startTransform.k)
    svg.call(
      zoom.transform as unknown as (sel: d3.Selection<SVGSVGElement, unknown, null, undefined>, t: d3.ZoomTransform) => void,
      next,
    )
    try {
      e.preventDefault()
    } catch {
      void 0
    }
  })

  svg.on('pointerup.kgPointerPan pointercancel.kgPointerPan lostpointercapture.kgPointerPan', (event: unknown) => {
    const e = event as PointerEvent | undefined
    const drag = pointerDrag
    if (!drag) return
    const svgEl = svg.node()
    if (!svgEl) return
    if (e && typeof e.pointerId === 'number' && e.pointerId !== drag.pointerId) return
    cancelPointerDrag(svgEl)
  })

  svg.on('pointermove.kgWheelAnchor', (event: unknown) => {
    const e = event as PointerEvent
    if (!e) return
    if (e.pointerType === 'touch') return
    const svgEl = svg.node()
    if (!svgEl) return
    const rect = svgEl.getBoundingClientRect()
    const sx = (Number.isFinite(e.clientX) ? e.clientX : 0) - (Number.isFinite(rect.left) ? rect.left : 0)
    const sy = (Number.isFinite(e.clientY) ? e.clientY : 0) - (Number.isFinite(rect.top) ? rect.top : 0)
    if (sx < 0 || sy < 0 || sx > rect.width || sy > rect.height) return
    lastPointerInCanvas = { sx, sy, ts: Date.now() }
  })

  let wheelZoomAnimRaf: number | null = null
  let wheelZoomAnimStart = 0
  let wheelZoomAnimDurationMs = 0
  let wheelZoomFrom: d3.ZoomTransform = d3.zoomIdentity
  let wheelZoomToK = 1
  let wheelZoomAnchor: { sx: number; sy: number } = { sx: 0, sy: 0 }

  const cancelWheelZoomAnimation = () => {
    if (wheelZoomAnimRaf == null) return
    try {
      cancelAnimationFrame(wheelZoomAnimRaf)
    } catch {
      void 0
    }
    wheelZoomAnimRaf = null
  }

  const tickWheelZoomAnimation = (now: number) => {
    const svgEl = svg.node()
    if (!svgEl) {
      wheelZoomAnimRaf = null
      return
    }
    const elapsed = now - wheelZoomAnimStart
    const raw01 = wheelZoomAnimDurationMs > 0 ? elapsed / wheelZoomAnimDurationMs : 1
    const eased = easeOutCubic01(raw01)
    const k = lerpNumber(wheelZoomFrom.k, wheelZoomToK, eased)
    const next = computeAnchoredZoomTransform({ transform: wheelZoomFrom, anchor: wheelZoomAnchor, nextK: k })
    svg.call(
      zoom.transform as unknown as (sel: d3.Selection<SVGSVGElement, unknown, null, undefined>, t: d3.ZoomTransform) => void,
      next,
    )
    if (!(raw01 < 1)) {
      wheelZoomAnimRaf = null
      return
    }
    wheelZoomAnimRaf = requestAnimationFrame(tickWheelZoomAnimation)
  }

  const startWheelZoomAnimation = (args: {
    from: d3.ZoomTransform
    toK: number
    anchor: { sx: number; sy: number }
    durationMs: number
  }) => {
    cancelWheelZoomAnimation()
    wheelZoomFrom = args.from
    wheelZoomToK = args.toK
    wheelZoomAnchor = { sx: args.anchor.sx, sy: args.anchor.sy }
    wheelZoomAnimDurationMs = Math.max(0, Math.floor(args.durationMs))
    wheelZoomAnimStart = performance.now()
    wheelZoomAnimRaf = requestAnimationFrame(tickWheelZoomAnimation)
  }

  svg.on('wheel.kgWheelZoom', (event: unknown) => {
    const e = event as WheelEvent
    if (!e) return
    if (shouldIgnoreCanvasWheelEvent({ event: e, ignoreSelector: UI_SELECTORS.canvasWheelIgnore })) return

    const st = useGraphStore.getState()
    disableAutoZoomModesForUserGesture(st)
    const schemaNow = st.schema || schema
    const extent = syncScaleExtent(schemaNow)
    const wheelBehavior = readWheelBehavior(schemaNow)
    const wheelZoom = shouldWheelZoom({ event: e, preset: viewportControlsPreset, wheelBehavior })
    if (!wheelZoom) return

    const svgEl = svg.node()
    if (!svgEl) return
    svg.interrupt()
    cancelWheelZoomAnimation()

    const nowMs = Date.now()
    const zoomSpeedRaw = readZoomSpeed(schemaNow)
    const zoomSpeed = Number.isFinite(zoomSpeedRaw) && zoomSpeedRaw > 0 ? zoomSpeedRaw : 1
    const speed = clampFlowWheelZoomSpeedMultiplier(st.flowWheelZoomSpeedMultiplier)
    const increment = clampFlowWheelZoomIncrementMultiplier(st.flowWheelZoomIncrementMultiplier)
    const interactionSpeed = clampCanvasInteractionSpeedMultiplier(st.canvasInteractionSpeedMultiplier)

    const rect = svgEl.getBoundingClientRect()
    const localSx = (Number.isFinite(e.clientX) ? e.clientX : 0) - (Number.isFinite(rect.left) ? rect.left : 0)
    const localSy = (Number.isFinite(e.clientY) ? e.clientY : 0) - (Number.isFinite(rect.top) ? rect.top : 0)
    const inBounds = localSx >= 0 && localSy >= 0 && localSx <= rect.width && localSy <= rect.height
    const fallback = coerceWheelFallback({ fallback: lastPointerInCanvas, nowMs, maxAgeMs: 800 })
    const anchor = inBounds
      ? { sx: localSx, sy: localSy, source: 'pointer' as const }
      : resolveWheelAnchor({ rect, clientX: e.clientX, clientY: e.clientY, fallback })
    if (anchor.source !== 'center') {
      lastPointerInCanvas = { sx: anchor.sx, sy: anchor.sy, ts: nowMs }
    }

    const deltaYpx = computeZoomWheelDeltaYpx(e, zoomSpeed * speed * interactionSpeed, st.wheelZoomCtrlMetaBoostMultiplier)
    const guard = computeZoomWheelGuardDecision({
      currentK: lastK,
      minK: extent.minK,
      maxK: extent.maxK,
      deltaYpx,
      nowMs,
      state: guardState,
    })
    guardState = guard.nextState
    if (guard.block) return

    const t0 = d3.zoomTransform(svgEl)
    const factor = computeWheelZoomFactor(deltaYpx * increment)
    const nextK = Math.max(extent.minK, Math.min(extent.maxK, t0.k * factor))
    if (!Number.isFinite(nextK) || Math.abs(nextK - t0.k) < 1e-12) return
    const durationMs = computeFlowWheelZoomDurationMs({
      deltaYpxAbs: Math.abs(deltaYpx),
      minMs: st.flowWheelZoomSmoothMinDurationMs,
      maxMs: st.flowWheelZoomSmoothMaxDurationMs,
    })
    startWheelZoomAnimation({ from: t0, toK: nextK, anchor, durationMs })
    try {
      e.preventDefault()
    } catch {
      void 0
    }
  })

  let gestureZoom: null | { startK: number; startScale: number; anchor: { sx: number; sy: number } } = null
  svg.on('gesturestart.kgGestureZoom', (event: unknown) => {
    const e = event as unknown as { scale?: unknown; clientX?: unknown; clientY?: unknown; preventDefault?: () => void }
    const svgEl = svg.node()
    if (!svgEl) return
    const scale = typeof e.scale === 'number' && Number.isFinite(e.scale) ? e.scale : 1
    const t0 = d3.zoomTransform(svgEl)
    const rect = svgEl.getBoundingClientRect()
    const clientX = typeof e.clientX === 'number' && Number.isFinite(e.clientX) ? e.clientX : rect.left + rect.width / 2
    const clientY = typeof e.clientY === 'number' && Number.isFinite(e.clientY) ? e.clientY : rect.top + rect.height / 2
    const sx = clientX - rect.left
    const sy = clientY - rect.top
    gestureZoom = { startK: t0.k, startScale: scale || 1, anchor: { sx, sy } }
    try {
      e.preventDefault?.()
    } catch {
      void 0
    }
  })
  svg.on('gesturechange.kgGestureZoom', (event: unknown) => {
    const svgEl = svg.node()
    if (!svgEl) return
    const g = gestureZoom
    if (!g) return
    const e = event as unknown as { scale?: unknown; preventDefault?: () => void }
    const scale = typeof e.scale === 'number' && Number.isFinite(e.scale) ? e.scale : 1
    const st = useGraphStore.getState()
    const schemaNow = st.schema || schema
    const extent = syncScaleExtent(schemaNow)
    const ratio = g.startScale > 0 ? scale / g.startScale : scale
    const nextK = Math.max(extent.minK, Math.min(extent.maxK, g.startK * ratio))
    const t0 = d3.zoomTransform(svgEl)
    if (!Number.isFinite(nextK) || Math.abs(nextK - t0.k) < 1e-12) return
    const next = computeAnchoredZoomTransform({ transform: t0, anchor: g.anchor, nextK })
    svg.call(
      zoom.transform as unknown as (sel: d3.Selection<SVGSVGElement, unknown, null, undefined>, t: d3.ZoomTransform) => void,
      next,
    )
    try {
      e.preventDefault?.()
    } catch {
      void 0
    }
  })
  svg.on('gestureend.kgGestureZoom gesturecancel.kgGestureZoom', (event: unknown) => {
    gestureZoom = null
    const e = event as unknown as { preventDefault?: () => void }
    try {
      e.preventDefault?.()
    } catch {
      void 0
    }
  })

  svg.on('mousedown.kgCancelWheelZoom', () => {
    cancelWheelZoomAnimation()
  })

  let touchDrag:
    | null
    | {
        type: 'pan'
        touchId: number
        startTransform: d3.ZoomTransform
        startSx: number
        startSy: number
      }
    | {
        type: 'pinch'
        touchIdA: number
        touchIdB: number
        startTransform: d3.ZoomTransform
        startA: { sx: number; sy: number }
        startB: { sx: number; sy: number }
      } = null

  const readTouchLocal = (svgEl: SVGSVGElement, t: Touch) => {
    const rect = svgEl.getBoundingClientRect()
    const sx = (Number.isFinite(t.clientX) ? t.clientX : 0) - (Number.isFinite(rect.left) ? rect.left : 0)
    const sy = (Number.isFinite(t.clientY) ? t.clientY : 0) - (Number.isFinite(rect.top) ? rect.top : 0)
    return { sx, sy }
  }

  const findTouchById = (touches: TouchList, id: number): Touch | null => {
    for (let i = 0; i < touches.length; i += 1) {
      const t = touches.item(i)
      if (t && t.identifier === id) return t
    }
    return null
  }

  const getPinchMultiplier = () => {
    const st = useGraphStore.getState()
    const zoomSpeedRaw = readZoomSpeed(st.schema || schema)
    const zoomSpeed = Number.isFinite(zoomSpeedRaw) && zoomSpeedRaw > 0 ? zoomSpeedRaw : 1
    const speed = clampFlowWheelZoomSpeedMultiplier(st.flowWheelZoomSpeedMultiplier)
    const increment = clampFlowWheelZoomIncrementMultiplier(st.flowWheelZoomIncrementMultiplier)
    const interactionSpeed = clampCanvasInteractionSpeedMultiplier(st.canvasInteractionSpeedMultiplier)
    return zoomSpeed * speed * increment * interactionSpeed
  }

  svg.on('touchstart.kgPinch', (event: unknown) => {
    const e = event as TouchEvent
    const svgEl = svg.node()
    if (!svgEl) return
    const target = e.target as Element | null
    if (target && target.closest(UI_SELECTORS.canvasWheelIgnore)) return
    const touches = e.touches
    if (!touches || touches.length <= 0) return
    try {
      disableAutoZoomModesForUserGesture(useGraphStore.getState())
    } catch {
      void 0
    }
    svg.interrupt()
    const t0 = d3.zoomTransform(svgEl)
    if (touches.length >= 2) {
      const a = touches.item(0)
      const b = touches.item(1)
      if (!a || !b) return
      touchDrag = {
        type: 'pinch',
        touchIdA: a.identifier,
        touchIdB: b.identifier,
        startTransform: t0,
        startA: readTouchLocal(svgEl, a),
        startB: readTouchLocal(svgEl, b),
      }
    } else {
      const a = touches.item(0)
      if (!a) return
      const p = readTouchLocal(svgEl, a)
      touchDrag = {
        type: 'pan',
        touchId: a.identifier,
        startTransform: t0,
        startSx: p.sx,
        startSy: p.sy,
      }
    }
    try {
      e.preventDefault()
    } catch {
      void 0
    }
  })

  svg.on('touchmove.kgPinch', (event: unknown) => {
    const e = event as TouchEvent
    const svgEl = svg.node()
    if (!svgEl) return
    const drag = touchDrag
    if (!drag) return
    const touches = e.touches
    if (!touches || touches.length <= 0) return
    svg.interrupt()
    if (drag.type === 'pinch') {
      const st = useGraphStore.getState()
      disableAutoZoomModesForUserGesture(st)
      const extent = syncScaleExtent(st.schema || schema)
      const a = findTouchById(touches, drag.touchIdA) || touches.item(0)
      const b = findTouchById(touches, drag.touchIdB) || touches.item(1)
      if (!a || !b) return
      const next = computePinchZoomTransform({
        startTransform: drag.startTransform,
        startA: drag.startA,
        startB: drag.startB,
        curA: readTouchLocal(svgEl, a),
        curB: readTouchLocal(svgEl, b),
        scaleExtent: extent,
        zoomExponentMultiplier: getPinchMultiplier(),
      })
      svg.call(
        zoom.transform as unknown as (sel: d3.Selection<SVGSVGElement, unknown, null, undefined>, t: d3.ZoomTransform) => void,
        next,
      )
    } else {
      try {
        disableAutoZoomModesForUserGesture(useGraphStore.getState())
      } catch {
        void 0
      }
      const a = findTouchById(touches, drag.touchId) || touches.item(0)
      if (!a) return
      const p = readTouchLocal(svgEl, a)
      const dx = p.sx - drag.startSx
      const dy = p.sy - drag.startSy
      const st = useGraphStore.getState()
      const interactionSpeed =
        clampCanvasPanSpeedMultiplier(st.canvasPanSpeedMultiplier) * clampCanvasInteractionSpeedMultiplier(st.canvasInteractionSpeedMultiplier)
      const next = d3.zoomIdentity
        .translate(drag.startTransform.x + dx * interactionSpeed, drag.startTransform.y + dy * interactionSpeed)
        .scale(drag.startTransform.k)
      svg.call(
        zoom.transform as unknown as (sel: d3.Selection<SVGSVGElement, unknown, null, undefined>, t: d3.ZoomTransform) => void,
        next,
      )
    }
    try {
      e.preventDefault()
    } catch {
      void 0
    }
  })

  svg.on('touchend.kgPinch touchcancel.kgPinch', (event: unknown) => {
    const e = event as TouchEvent
    const touches = e.touches
    if (!touches || touches.length <= 0) {
      touchDrag = null
      return
    }
    const svgEl = svg.node()
    if (!svgEl) {
      touchDrag = null
      return
    }
    svg.interrupt()
    const t0 = d3.zoomTransform(svgEl)
    if (touches.length >= 2) {
      const a = touches.item(0)
      const b = touches.item(1)
      if (!a || !b) {
        touchDrag = null
        return
      }
      touchDrag = {
        type: 'pinch',
        touchIdA: a.identifier,
        touchIdB: b.identifier,
        startTransform: t0,
        startA: readTouchLocal(svgEl, a),
        startB: readTouchLocal(svgEl, b),
      }
      return
    }
    const a = touches.item(0)
    if (!a) {
      touchDrag = null
      return
    }
    const p = readTouchLocal(svgEl, a)
    touchDrag = {
      type: 'pan',
      touchId: a.identifier,
      startTransform: t0,
      startSx: p.sx,
      startSy: p.sy,
    }
  })
  svg.on('wheel.kgPanOnScroll', (event: unknown) => {
    const e = event as WheelEvent
    if (!e) return
    if (shouldIgnoreCanvasWheelEvent({ event: e, ignoreSelector: UI_SELECTORS.canvasWheelIgnore })) return
    const st = useGraphStore.getState()
    disableAutoZoomModesForUserGesture(st)
    const wheelBehavior = readWheelBehavior(st.schema || schema)
    const wheelZoom = shouldWheelZoom({ event: e, preset: viewportControlsPreset, wheelBehavior })
    if (wheelZoom) return
    cancelWheelZoomAnimation()
    const d = computeWheelPanDeltaPx(e)
    const panSpeed = readPanSpeed(st.schema || schema)
    const interactionSpeed =
      clampCanvasPanSpeedMultiplier(st.canvasPanSpeedMultiplier) * clampCanvasInteractionSpeedMultiplier(st.canvasInteractionSpeedMultiplier)
    const dx = d.dx * panSpeed * interactionSpeed
    const dy = d.dy * panSpeed * interactionSpeed
    if (dx === 0 && dy === 0) return
    svg.call(zoom.translateBy as unknown as (sel: d3.Selection<SVGSVGElement, unknown, null, undefined>, x: number, y: number) => void, -dx, -dy)
    try {
      e.preventDefault()
    } catch {
      void 0
    }
  })

  svg.on('contextmenu.kgDesignViewport', (event: unknown) => {
    if (!shouldSuppressContextMenuForPreset(viewportControlsPreset)) return
    const e = event as MouseEvent
    if (!e) return
    try {
      e.preventDefault()
    } catch {
      void 0
    }
  })
  return zoom;
};
