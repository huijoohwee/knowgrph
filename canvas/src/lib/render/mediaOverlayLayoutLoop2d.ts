import type * as d3 from 'd3'
import type { MediaPanelDensity } from '@/lib/render/mediaPanelSpec'
import { applyMediaPanelCssVars, applyPanelBox, computePanelRect } from '@/lib/render/mediaPanelLayout'
import { applyMediaEagerLoadingOnce } from '@/lib/render/mediaEagerLoading'
import { computeMediaOverlaySizing, type MediaOverlaySizingConfig, type MediaOverlaySizing } from '@/lib/render/mediaOverlaySizing'

export type MediaOverlayLayoutItem = { id: string }

export type MediaOverlayLayoutLoop = {
  schedule: () => void
  stop: () => void
}

export function startMediaOverlayLayoutLoop2d(args: {
  enabled: boolean
  loop: 'always' | 'onDemand'
  items: readonly MediaOverlayLayoutItem[]
  density: MediaPanelDensity
  viewportW: number
  viewportH: number
  readTransform: () => d3.ZoomTransform | null
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

  const update = () => {
    const t = args.readTransform()
    if (!t) return
    const k = typeof t.k === 'number' && Number.isFinite(t.k) && t.k > 0 ? t.k : 1

    const density = args.density === 'compact' ? 'compact' : 'default'
    const sizing = computeMediaOverlaySizing({
      density,
      viewportW: args.viewportW,
      zoomK: k,
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

    for (let i = 0; i < args.items.length; i += 1) {
      const id = String(args.items[i]?.id || '').trim()
      if (!id) continue
      const el = args.getElementForId(id)
      if (!el) continue
      const center = args.getNodeWorldCenterForId(id)
      if (!center) continue
      const cx = t.applyX(center.x)
      const cy = t.applyY(center.y)
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue
      const rect = computePanelRect({ cx, cy, w: useSizing.panelW, h: useSizing.panelH, clamp })
      applyMediaPanelCssVars(el, useSizing.vars)
      applyMediaEagerLoadingOnce(el)
      applyPanelBox(el, { left: Math.round(rect.left), top: Math.round(rect.top), w: useSizing.panelW, h: useSizing.panelH, display: 'block' })
      try {
        ;(el as unknown as { dataset?: Record<string, string> }).dataset!.kgOverlayHasPos = '1'
      } catch {
        void 0
      }
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
