import type * as d3 from 'd3'

import { applyMediaPanelCssVars, applyPanelBox, computePanelRect } from '@/lib/render/mediaPanelLayout'
import { computeMediaOverlaySizing, type MediaOverlaySizingConfig, type MediaOverlaySizing } from '@/lib/render/mediaOverlaySizing'
import type { MediaPanelDensity } from '@/lib/render/mediaPanelSpec'

export type MarkdownOverlayPanelItem = {
  id: string
  cx: number
  cy: number
}

export type MarkdownOverlayPanelLoop = {
  schedule: () => void
  stop: () => void
}

export function startMarkdownPanelOverlayLoop2d(args: {
  enabled: boolean
  loop: 'always' | 'onDemand'
  getItems: () => readonly MarkdownOverlayPanelItem[]
  getViewport: () => { w: number; h: number }
  readTransform: () => d3.ZoomTransform | null
  getElementForId: (id: string) => HTMLElement | null
  getDensity: () => MediaPanelDensity
  getSizingConfig: () => MediaOverlaySizingConfig
  clampToViewport?: { margin: number } | null
}): MarkdownOverlayPanelLoop {
  if (!args.enabled) return { schedule: () => void 0, stop: () => void 0 }

  let rafOnce: number | null = null
  let rafLoop: number | null = null
  let lastSizingKey = ''
  let lastSizing: MediaOverlaySizing | null = null

  const update = () => {
    const t = args.readTransform()
    if (!t) return

    const viewport = args.getViewport()
    const vw = Math.max(1, Math.floor(Number(viewport.w) || 1))
    const vh = Math.max(1, Math.floor(Number(viewport.h) || 1))
    const density = args.getDensity() === 'compact' ? 'compact' : 'default'
    const k = typeof t.k === 'number' && Number.isFinite(t.k) && t.k > 0 ? t.k : 1
    const sizing = computeMediaOverlaySizing({ density, viewportW: vw, zoomK: k, config: args.getSizingConfig() })
    if (sizing.key !== lastSizingKey) {
      lastSizingKey = sizing.key
      lastSizing = sizing
    }
    const useSizing = lastSizing || sizing
    const clamp = args.clampToViewport
      ? { viewportW: vw, viewportH: vh, margin: Math.max(0, Number(args.clampToViewport.margin) || 0) }
      : undefined

    const items = args.getItems()
    if (!items || items.length === 0) return

    for (let i = 0; i < items.length; i += 1) {
      const it = items[i]
      const id = String(it?.id || '').trim()
      if (!id) continue
      const el = args.getElementForId(id)
      if (!el) continue

      const sx = t.applyX(it.cx)
      const sy = t.applyY(it.cy)
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) continue

      const rect = computePanelRect({ cx: sx, cy: sy, w: useSizing.panelW, h: useSizing.panelH, clamp })
      applyMediaPanelCssVars(el, useSizing.vars)
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

  if (args.loop === 'always') rafLoop = requestAnimationFrame(loop)

  return {
    schedule,
    stop: () => {
      if (rafOnce != null) cancelAnimationFrame(rafOnce)
      if (rafLoop != null) cancelAnimationFrame(rafLoop)
      rafOnce = null
      rafLoop = null
    },
  }
}

