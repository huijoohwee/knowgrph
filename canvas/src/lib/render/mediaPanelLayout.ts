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
const BOX_POS_CACHE = new WeakMap<HTMLElement, string>()
const BOX_SIZE_CACHE = new WeakMap<HTMLElement, string>()

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

export function computePanelSizeFromContent16x9(args: {
  contentW: number
  metrics: Pick<MediaPanelCssMetrics, 'headerH' | 'padding'> & Partial<Pick<MediaPanelCssMetrics, 'borderW'>>
}): {
  panelW: number
  panelH: number
  contentW: number
  contentH: number
} {
  const contentW = Math.max(2, Number(args.contentW) || 2)
  const contentH = Math.max(2, (contentW * 9) / 16)
  const padding = Math.max(0, Number(args.metrics.padding) || 0)
  const headerH = Math.max(0, Number(args.metrics.headerH) || 0)
  const borderW = Math.max(0, Number((args.metrics as Partial<Pick<MediaPanelCssMetrics, 'borderW'>>).borderW) || 0)
  const panelW = Math.max(2, contentW + padding * 2 + borderW * 2)
  const panelH = Math.max(2, contentH + headerH + padding * 2 + borderW * 2)
  return { panelW, panelH, contentW, contentH }
}

export function computeContentBoxFromPanelFrame16x9(args: {
  panelW: number
  panelH: number
  metrics: Pick<MediaPanelCssMetrics, 'headerH' | 'padding' | 'borderW'>
}): { contentW: number; contentH: number; aspect: number } {
  const panelW = Math.max(2, Number(args.panelW) || 2)
  const panelH = Math.max(2, Number(args.panelH) || 2)
  const padding = Math.max(0, Number(args.metrics.padding) || 0)
  const headerH = Math.max(0, Number(args.metrics.headerH) || 0)
  const borderW = Math.max(0, Number(args.metrics.borderW) || 0)
  const contentW = Math.max(2, panelW - padding * 2 - borderW * 2)
  const contentH = Math.max(2, panelH - headerH - padding * 2 - borderW * 2)
  return {
    contentW,
    contentH,
    aspect: contentW / Math.max(1, contentH),
  }
}

export function computePanelFrameSizeFromWidth16x9(args: {
  panelW: number
  metrics: Pick<MediaPanelCssMetrics, 'headerH' | 'padding' | 'borderW'>
}): { panelW: number; panelH: number; contentW: number; contentH: number } {
  const panelW = Math.max(2, Number(args.panelW) || 2)
  const padding = Math.max(0, Number(args.metrics.padding) || 0)
  const headerH = Math.max(0, Number(args.metrics.headerH) || 0)
  const borderW = Math.max(0, Number(args.metrics.borderW) || 0)
  const contentW = Math.max(2, panelW - padding * 2 - borderW * 2)
  const contentH = Math.max(2, (contentW * 9) / 16)
  const panelH = Math.max(2, contentH + headerH + padding * 2 + borderW * 2)
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

function resolvePanelBoxDisplay(el: HTMLElement, display: 'block' | 'none' | 'flex' | undefined): 'block' | 'none' | 'flex' {
  if (display === 'none') return 'none'
  if (display === 'flex') return 'flex'
  if (
    el.getAttribute('data-kg-rich-media-flow-editor-chrome') === '1'
    && el.getAttribute('data-kg-rich-media-panel') === '1'
  ) {
    return 'flex'
  }
  return 'block'
}

export function applyPanelBox(el: HTMLElement, args: { left: number; top: number; w: number; h: number; zIndex?: number | string; display?: 'block' | 'none' | 'flex'; scale?: number }): void {
  const left = Number.isFinite(args.left) ? args.left : 0
  const top = Number.isFinite(args.top) ? args.top : 0
  const w = Number.isFinite(args.w) ? args.w : 1
  const h = Number.isFinite(args.h) ? args.h : 1
  const scale = Number.isFinite(args.scale) && Number(args.scale) > 0 ? Math.max(0.001, Number(args.scale)) : 1
  const display = resolvePanelBoxDisplay(el, args.display)
  const z = args.zIndex != null ? String(args.zIndex) : ''
  const posSig = `transform|${left}|${top}|${scale}`
  const sizeSig = `${display}|${z}|${w}|${h}`

  const prevPosSig = BOX_POS_CACHE.get(el) || ''
  const prevSizeSig = BOX_SIZE_CACHE.get(el) || ''
  if (prevPosSig === posSig && prevSizeSig === sizeSig) return

  if (prevSizeSig !== sizeSig) {
    el.style.display = display
    if (display !== 'none') {
      el.style.width = `${w}px`
      el.style.height = `${h}px`
      if (z) el.style.zIndex = z
      else el.style.zIndex = ''
    }
    BOX_SIZE_CACHE.set(el, sizeSig)
  }

  if (display !== 'none' && prevPosSig !== posSig) {
    el.style.transformOrigin = 'top left'
    el.style.transform = scale === 1
      ? `translate3d(${left}px, ${top}px, 0px)`
      : `translate3d(${left}px, ${top}px, 0px) scale(${scale})`
    BOX_POS_CACHE.set(el, posSig)
  }
}
