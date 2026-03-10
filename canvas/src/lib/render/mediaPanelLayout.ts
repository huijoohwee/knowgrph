import type { MediaPanelDensity } from '@/lib/render/mediaPanelSpec'

export type MediaPanelCssMetrics = {
  headerH: number
  borderW: number
  radius: number
  padding: number
  titleSize: number
}

export type MediaPanelCssVars = Record<string, string>

const VARS_CACHE = new WeakMap<HTMLElement, string>()
const BOX_CACHE = new WeakMap<HTMLElement, string>()

export function computeMediaPanelCssVars2d(args: {
  zoomK: number
  dimsWorld: { headerHeight: number; padding: number; corner: number; borderWidth: number }
}): { metrics: MediaPanelCssMetrics; vars: MediaPanelCssVars } {
  const k = Number.isFinite(args.zoomK) ? Math.max(0.001, Number(args.zoomK)) : 1
  const headerH = Math.max(10, Number(args.dimsWorld.headerHeight) * k)
  const borderW = Math.max(0.5, Number(args.dimsWorld.borderWidth) * k)
  const radius = Math.max(2, Number(args.dimsWorld.corner) * k)
  const padding = Math.max(1, Number(args.dimsWorld.padding) * k)
  const titleSize = Math.max(10, Math.min(40, 10 * k))
  const metrics: MediaPanelCssMetrics = { headerH, borderW, radius, padding, titleSize }
  const vars: MediaPanelCssVars = {
    '--kg-media-panel-header-h': `${headerH}px`,
    '--kg-media-panel-border-w': `${borderW}px`,
    '--kg-media-panel-radius': `${radius}px`,
    '--kg-media-panel-padding': `${padding}px`,
    '--kg-media-panel-title-size': `${titleSize}px`,
  }
  return { metrics, vars }
}

export function computeMediaPanelCssVars3d(args: { density: MediaPanelDensity; sizeScale: number }): { metrics: MediaPanelCssMetrics; vars: MediaPanelCssVars } {
  const s = Number.isFinite(args.sizeScale) ? Math.max(0.001, Number(args.sizeScale)) : 1
  const density = args.density === 'compact' ? 'compact' : 'default'
  const headerBase = density === 'compact' ? 22 : 28
  const paddingBase = density === 'compact' ? 6 : 8
  const radiusBase = density === 'compact' ? 9 : 10
  const borderBase = 1
  const titleBase = density === 'compact' ? 11 : 12
  const headerH = Math.max(14, Math.round(headerBase * s))
  const padding = Math.max(2, Math.round(paddingBase * s))
  const radius = Math.max(3, Math.round(radiusBase * s))
  const borderW = Math.max(1, Math.round(borderBase * s))
  const titleSize = Math.max(10, Math.round(titleBase * s))
  const metrics: MediaPanelCssMetrics = { headerH, borderW, radius, padding, titleSize }
  const vars: MediaPanelCssVars = {
    '--kg-media-panel-header-h': `${headerH}px`,
    '--kg-media-panel-border-w': `${borderW}px`,
    '--kg-media-panel-radius': `${radius}px`,
    '--kg-media-panel-padding': `${padding}px`,
    '--kg-media-panel-title-size': `${titleSize}px`,
  }
  return { metrics, vars }
}

export function computePanelSizeFromContent16x9(args: { contentW: number; metrics: Pick<MediaPanelCssMetrics, 'headerH' | 'padding'> }): {
  panelW: number
  panelH: number
  contentW: number
  contentH: number
} {
  const contentW = Math.max(2, Number(args.contentW) || 2)
  const contentH = Math.max(2, (contentW * 9) / 16)
  const padding = Math.max(0, Number(args.metrics.padding) || 0)
  const headerH = Math.max(0, Number(args.metrics.headerH) || 0)
  const panelW = Math.max(2, contentW + padding * 2)
  const panelH = Math.max(2, contentH + headerH + padding * 2)
  return { panelW, panelH, contentW, contentH }
}

export function computeMediaPanelPixelSize2d(args: { zoomK: number; dimsWorld: { panelWidth: number; panelHeight: number } }): {
  panelW: number
  panelH: number
} {
  const k = Number.isFinite(args.zoomK) ? Math.max(0.001, Number(args.zoomK)) : 1
  const panelW = Math.max(2, Number(args.dimsWorld.panelWidth) * k)
  const panelH = Math.max(2, Number(args.dimsWorld.panelHeight) * k)
  return { panelW, panelH }
}

export function computePanelRect(args: {
  cx: number
  cy: number
  w: number
  h: number
  clamp?: { viewportW: number; viewportH: number; margin: number }
}): { left: number; top: number; w: number; h: number } {
  const w = Math.max(1, Number(args.w) || 1)
  const h = Math.max(1, Number(args.h) || 1)
  let left = (Number(args.cx) || 0) - w / 2
  let top = (Number(args.cy) || 0) - h / 2
  const clamp = args.clamp || null
  if (clamp) {
    const vw = Math.max(1, Number(clamp.viewportW) || 1)
    const vh = Math.max(1, Number(clamp.viewportH) || 1)
    const m = Math.max(0, Number(clamp.margin) || 0)
    left = Math.max(m, Math.min(vw - m - w, left))
    top = Math.max(m, Math.min(vh - m - h, top))
  }
  return { left, top, w, h }
}

export function applyMediaPanelCssVars(el: HTMLElement, vars: MediaPanelCssVars): void {
  let sig = ''
  for (const k of Object.keys(vars)) sig += `${k}:${vars[k]};`
  if (VARS_CACHE.get(el) === sig) return
  for (const k of Object.keys(vars)) el.style.setProperty(k, vars[k]!)
  VARS_CACHE.set(el, sig)
}

export function applyPanelBox(el: HTMLElement, args: { left: number; top: number; w: number; h: number; zIndex?: number | string; display?: 'block' | 'none' }): void {
  const left = Number.isFinite(args.left) ? args.left : 0
  const top = Number.isFinite(args.top) ? args.top : 0
  const w = Number.isFinite(args.w) ? args.w : 1
  const h = Number.isFinite(args.h) ? args.h : 1
  const display = args.display === 'none' ? 'none' : 'block'
  const mode = (() => {
    try {
      const d = (el as unknown as { dataset?: Record<string, string> }).dataset
      return d && d.kgPanelBox === 'leftTop' ? 'leftTop' : 'transform'
    } catch {
      return 'transform'
    }
  })()
  const z = args.zIndex != null ? String(args.zIndex) : ''
  const sig = `${mode}|${display}|${z}|${left}|${top}|${w}|${h}`
  if (BOX_CACHE.get(el) === sig) return
  el.style.display = display
  if (display !== 'none') {
    if (mode === 'leftTop') {
      el.style.left = `${left}px`
      el.style.top = `${top}px`
      el.style.transform = 'translate3d(0px, 0px, 0px)'
    } else {
      el.style.transform = `translate3d(${left}px, ${top}px, 0px)`
    }
    el.style.width = `${w}px`
    el.style.height = `${h}px`
    if (z) el.style.zIndex = z
  }
  BOX_CACHE.set(el, sig)
}
