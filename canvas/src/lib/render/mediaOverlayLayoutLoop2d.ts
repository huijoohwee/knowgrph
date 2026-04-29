import type * as d3 from 'd3'
import type { MediaPanelDensity } from '@/lib/render/mediaPanelSpec'
import type { GraphSchema } from '@/lib/graph/schema'
import { applyMediaPanelCssVars, applyPanelBox, computePanelRect } from '@/lib/render/mediaPanelLayout'
import { applyMediaEagerLoadingOnce } from '@/lib/render/mediaEagerLoading'
import { computeMediaOverlaySizing, type MediaOverlaySizingConfig, type MediaOverlaySizing } from '@/lib/render/mediaOverlaySizing'
import { relaxOverlayPanelsWithCollision } from '@/lib/ui/relaxOverlayPanelsWithCollision'
import { computeOverlayMaxAnchorShiftPx } from '@/lib/ui/overlayAnchorShift'

export type MediaOverlayLayoutItem = { id: string }

export type MediaOverlayLayoutLoop = {
  schedule: () => void
  stop: () => void
}

export function startMediaOverlayLayoutLoop2d(args: {
  enabled: boolean
  loop: 'always' | 'onDemand'
  items: readonly MediaOverlayLayoutItem[]
  manualPlacement?: boolean
  density: MediaPanelDensity
  viewportW: number
  viewportH: number
  schema?: GraphSchema | null
  collision?: {
    enabled?: boolean
    gapPx?: number
    strength?: number
    iterations?: number
    steps?: number
    anchorStrength?: number
    maxAnchorShiftPx?: number
    maxSpeedPxPerStep?: number
  } | null
  readTransform: () => d3.ZoomTransform | null
  computeSizingZoomK?: (zoomK: number) => number
  getPanelSizeForId?: (id: string) => { w: number; h: number } | null
  getElementForId: (id: string) => HTMLElement | null
  getNodeWorldCenterForId: (id: string) => { x: number; y: number } | null
  sizingConfig: MediaOverlaySizingConfig
  clampToViewport?: { margin: number } | null
}): MediaOverlayLayoutLoop {
  if (!args.enabled || args.items.length === 0) {
    return { schedule: () => void 0, stop: () => void 0 }
  }

  let rafOnce: number | null = null
  let rafLoop: number | null = null
  let lastSizingKey = ''
  let lastSizing: MediaOverlaySizing | null = null
  const lastWorldCenterById = new Map<string, { x: number; y: number }>()
  const lastAppliedBoxById = new Map<string, { left: number; top: number; w: number; h: number }>()

  const quantizePanelPos = (v: number) => {
    if (!Number.isFinite(v)) return 0
    return Math.round(v)
  }

  const update = () => {
    const t = args.readTransform()
    if (!t) return
    const rawK = typeof t.k === 'number' && Number.isFinite(t.k) && t.k > 0 ? t.k : 1
    const k = typeof args.computeSizingZoomK === 'function' ? args.computeSizingZoomK(rawK) : rawK

    const density = args.density === 'compact' ? 'compact' : 'default'
    const sizing = computeMediaOverlaySizing({
      density,
      viewportW: args.viewportW,
      viewportH: args.viewportH,
      zoomK: k,
      itemCount: args.items.length,
      config: args.sizingConfig,
    })
    if (sizing.key !== lastSizingKey) {
      lastSizingKey = sizing.key
      lastSizing = sizing
    }
    const useSizing = lastSizing || sizing
    const clamp = args.clampToViewport
      ? { viewportW: args.viewportW, viewportH: args.viewportH, margin: args.clampToViewport.margin }
      : undefined

    const keepIds = new Set<string>()

    const preferred: Array<{ id: string; left: number; top: number; w: number; h: number; el: HTMLElement }> = []

    for (let i = 0; i < args.items.length; i += 1) {
      const id = String(args.items[i]?.id || '').trim()
      if (!id) continue
      keepIds.add(id)
      const el = args.getElementForId(id)
      if (!el) continue

      const centerNow = args.getNodeWorldCenterForId(id)
      if (centerNow && Number.isFinite(centerNow.x) && Number.isFinite(centerNow.y)) {
        lastWorldCenterById.set(id, centerNow)
      }
      const center = centerNow || lastWorldCenterById.get(id) || null
      if (!center) continue
      const cx = t.applyX(center.x)
      const cy = t.applyY(center.y)
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue

      const overrideSize = typeof args.getPanelSizeForId === 'function' ? args.getPanelSizeForId(id) : null
      const w = overrideSize && Number.isFinite(overrideSize.w) ? Math.max(1, overrideSize.w) : useSizing.panelW
      const h = overrideSize && Number.isFinite(overrideSize.h) ? Math.max(1, overrideSize.h) : useSizing.panelH
      const rect = computePanelRect({ cx, cy, w, h, clamp })
      preferred.push({ id, left: quantizePanelPos(rect.left), top: quantizePanelPos(rect.top), w, h, el })
    }

    const hasOverlaps = (items: Array<{ left: number; top: number; w: number; h: number }>, gapPx: number): boolean => {
      const gap = Number.isFinite(gapPx) ? Math.max(0, gapPx) : 0
      for (let i = 0; i < items.length; i += 1) {
        const a = items[i]
        if (!a) continue
        const ax2 = a.left + a.w + gap
        const ay2 = a.top + a.h + gap
        for (let j = i + 1; j < items.length; j += 1) {
          const b = items[j]
          if (!b) continue
          const bx2 = b.left + b.w + gap
          const by2 = b.top + b.h + gap
          if (a.left < bx2 && b.left < ax2 && a.top < by2 && b.top < ay2) return true
        }
      }
      return false
    }

    const clampWithMargin = (pos: { left: number; top: number }, size: { w: number; h: number }, margin: number) => {
      const m = Number.isFinite(margin) ? Math.max(0, margin) : 0
      const vw = Math.max(1, Number(args.viewportW) || 1)
      const vh = Math.max(1, Number(args.viewportH) || 1)
      const w = Math.max(1, Number(size.w) || 1)
      const h = Math.max(1, Number(size.h) || 1)
      const left = Math.max(m, Math.min(vw - m - w, pos.left))
      const top = Math.max(m, Math.min(vh - m - h, pos.top))
      return { left, top }
    }

    const collisionEnabled = args.manualPlacement === true
      ? false
      : args.collision?.enabled !== false
    const schema = args.schema || null
    const clampMargin = clamp ? Math.max(0, Number(clamp.margin) || 0) : 0

    const preferredById = new Map<string, { id: string; left: number; top: number; w: number; h: number; el: HTMLElement }>()
    for (let i = 0; i < preferred.length; i += 1) {
      const p = preferred[i]!
      preferredById.set(p.id, p)
    }

    const buildBalancedSeedForVerticalCluster = (
      items: Array<{ id: string; left: number; top: number; w: number; h: number }>,
      gapPx: number,
    ): Array<{ id: string; left: number; top: number; w: number; h: number }> | null => {
      if (items.length < 4) return null
      let minCx = Number.POSITIVE_INFINITY
      let maxCx = Number.NEGATIVE_INFINITY
      let sumW = 0
      let sumH = 0
      for (let i = 0; i < items.length; i += 1) {
        const it = items[i]!
        const cx = it.left + it.w * 0.5
        if (cx < minCx) minCx = cx
        if (cx > maxCx) maxCx = cx
        sumW += it.w
        sumH += it.h
      }
      const avgW = Math.max(1, sumW / Math.max(1, items.length))
      const avgH = Math.max(1, sumH / Math.max(1, items.length))
      const spanX = Math.max(0, maxCx - minCx)
      const oneColumnCluster = spanX < Math.max(24, avgW * 0.65)
      if (!oneColumnCluster) return null

      const vw = Math.max(1, Number(args.viewportW) || 1)
      const vh = Math.max(1, Number(args.viewportH) || 1)
      const usableW = Math.max(1, vw - clampMargin * 2)
      const usableH = Math.max(1, vh - clampMargin * 2)
      const cellW = Math.max(1, avgW + gapPx)
      const cellH = Math.max(1, avgH + gapPx)
      const colsCap = Math.max(1, Math.floor((usableW + gapPx) / Math.max(1, cellW)))
      const rowsCap = Math.max(1, Math.floor((usableH + gapPx) / Math.max(1, cellH)))
      const n = items.length
      const aspect = usableW / Math.max(1, usableH)
      const boundedAspect = Math.max(0.5, Math.min(2.5, aspect))
      const minCols = colsCap >= 2 ? 2 : 1
      let cols = Math.max(minCols, Math.min(colsCap, Math.ceil(Math.sqrt(n * boundedAspect))))
      let rows = Math.max(1, Math.ceil(n / cols))
      if (rows > rowsCap) {
        cols = Math.max(minCols, Math.min(colsCap, Math.ceil(n / rowsCap)))
        rows = Math.max(1, Math.ceil(n / Math.max(1, cols)))
      }
      const gridW = cols * cellW - gapPx
      const gridH = rows * cellH - gapPx
      const baseLeft = clampMargin + Math.max(0, Math.floor((usableW - gridW) * 0.5))
      const baseTop = clampMargin + Math.max(0, Math.floor((usableH - gridH) * 0.5))
      const ordered = [...items].sort((a, b) => a.id.localeCompare(b.id))
      const out: Array<{ id: string; left: number; top: number; w: number; h: number }> = []
      for (let i = 0; i < ordered.length; i += 1) {
        const it = ordered[i]!
        const col = i % cols
        const row = Math.floor(i / cols)
        const left = baseLeft + col * cellW
        const top = baseTop + row * cellH
        out.push({ ...it, left, top })
      }
      return out
    }

    const nextById = new Map<string, { left: number; top: number }>()
    if (preferred.length > 0) {
      for (let i = 0; i < preferred.length; i += 1) {
        const p = preferred[i]!
        nextById.set(p.id, { left: p.left, top: p.top })
      }
    }

    if (collisionEnabled && schema && preferred.length > 1) {
      const derivedGap = Math.max(0, Math.round(Math.max(6, useSizing.metrics.padding + useSizing.metrics.borderW)))
      const gapPx = typeof args.collision?.gapPx === 'number' && Number.isFinite(args.collision.gapPx) ? Math.max(0, Math.floor(args.collision.gapPx)) : derivedGap
      const boxes = preferred.map(p => ({ left: p.left, top: p.top, w: p.w, h: p.h }))
      if (hasOverlaps(boxes, gapPx)) {
        const seedItems = buildBalancedSeedForVerticalCluster(
          preferred.map(p => ({ id: p.id, left: p.left, top: p.top, w: p.w, h: p.h })),
          gapPx,
        ) || preferred.map(p => ({ id: p.id, left: p.left, top: p.top, w: p.w, h: p.h }))
        const strength = typeof args.collision?.strength === 'number' && Number.isFinite(args.collision.strength) ? Math.max(0, args.collision.strength) : 0.82
        const iterations = typeof args.collision?.iterations === 'number' && Number.isFinite(args.collision.iterations) ? Math.max(1, Math.floor(args.collision.iterations)) : 10
        const steps = typeof args.collision?.steps === 'number' && Number.isFinite(args.collision.steps) ? Math.max(1, Math.floor(args.collision.steps)) : 12
        const anchorStrength =
          typeof args.collision?.anchorStrength === 'number' && Number.isFinite(args.collision.anchorStrength) ? Math.max(0, args.collision.anchorStrength) : 0.075
        const maxAnchorShiftPx =
          typeof args.collision?.maxAnchorShiftPx === 'number' && Number.isFinite(args.collision.maxAnchorShiftPx)
            ? Math.max(40, args.collision.maxAnchorShiftPx)
            : computeOverlayMaxAnchorShiftPx(args.viewportW, args.viewportH)
        const maxSpeedPxPerStep =
          typeof args.collision?.maxSpeedPxPerStep === 'number' && Number.isFinite(args.collision.maxSpeedPxPerStep)
            ? Math.max(0, args.collision.maxSpeedPxPerStep)
            : 200
        const resolved = relaxOverlayPanelsWithCollision({
          schema,
          items: seedItems.map(p => ({ id: p.id, left: p.left, top: p.top, width: p.w, height: p.h, movable: true })),
          gapPx,
          strength,
          iterations,
          steps,
          anchorStrength,
          maxAnchorShiftPx,
          maxSpeedPxPerStep,
        })
        for (let i = 0; i < resolved.length; i += 1) {
          const r = resolved[i]!
          const src = preferredById.get(r.id) || null
          if (!src) continue
          const clamped = clampWithMargin({ left: r.left, top: r.top }, { w: src.w, h: src.h }, clampMargin)
          nextById.set(r.id, { left: quantizePanelPos(clamped.left), top: quantizePanelPos(clamped.top) })
        }
      }
    }

    for (let i = 0; i < preferred.length; i += 1) {
      const p = preferred[i]!
      const pos = nextById.get(p.id) || { left: p.left, top: p.top }
      applyMediaPanelCssVars(p.el, useSizing.vars)
      applyMediaEagerLoadingOnce(p.el)
      const nextBox = { left: quantizePanelPos(pos.left), top: quantizePanelPos(pos.top), w: p.w, h: p.h }
      const prevBox = lastAppliedBoxById.get(p.id) || null
      const boxChanged = !prevBox
        || Math.abs(prevBox.left - nextBox.left) >= 1
        || Math.abs(prevBox.top - nextBox.top) >= 1
        || Math.abs(prevBox.w - nextBox.w) >= 0.5
        || Math.abs(prevBox.h - nextBox.h) >= 0.5
      if (boxChanged) {
        applyPanelBox(p.el, { left: nextBox.left, top: nextBox.top, w: nextBox.w, h: nextBox.h, display: 'block' })
        lastAppliedBoxById.set(p.id, nextBox)
      }
      try {
        ;(p.el as unknown as { dataset?: Record<string, string> }).dataset!.kgOverlayHasPos = '1'
      } catch {
        void 0
      }
    }

    for (const id of Array.from(lastWorldCenterById.keys())) {
      if (!keepIds.has(id)) lastWorldCenterById.delete(id)
    }
    for (const id of Array.from(lastAppliedBoxById.keys())) {
      if (!keepIds.has(id)) lastAppliedBoxById.delete(id)
    }
  }

  const schedule = () => {
    if (rafOnce != null) return
    rafOnce = requestAnimationFrame(() => {
      rafOnce = null
      update()
    })
  }

  const loop = () => {
    rafLoop = requestAnimationFrame(loop)
    update()
  }

  if (args.loop === 'always') {
    rafLoop = requestAnimationFrame(loop)
  }

  return {
    schedule,
    stop: () => {
      if (rafOnce != null) {
        try {
          cancelAnimationFrame(rafOnce)
        } catch {
          void 0
        }
      }
      if (rafLoop != null) {
        try {
          cancelAnimationFrame(rafLoop)
        } catch {
          void 0
        }
      }
      rafOnce = null
      rafLoop = null
    },
  }
}
