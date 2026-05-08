import type { MediaPanelDensity } from '@/lib/render/mediaPanelSpec'
import { computeMediaPanelCssVars3d, computePanelSizeFromContent16x9 } from '@/lib/render/mediaPanelLayout'
import { clampBalancedCollectiveScaleToViewport } from '@/lib/ui/overlayBalancedSpread'
import { COLLECTIVE_OVERLAY_SCALE_LIMITS_16X9 } from '@/lib/ui/overlayScaleLimits'

export type MediaOverlaySizingConfig = {
  widthRatio: number
  widthMinPx: number
  widthMaxPx: number
  maxPanelPx?: number
  quantizeStepPx?: number
}

export type MediaOverlaySizing = {
  key: string
  contentW: number
  panelW: number
  panelH: number
  vars: Record<string, string>
  metrics: ReturnType<typeof computeMediaPanelCssVars3d>['metrics']
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function quantize(px: number, stepPx: number): number {
  const step = Math.max(1, Math.floor(stepPx))
  return Math.round(px / step) * step
}

export function computeMediaOverlaySizing(args: {
  density: MediaPanelDensity
  viewportW: number
  viewportH: number
  zoomK: number
  itemCount?: number
  config: MediaOverlaySizingConfig
}): MediaOverlaySizing {
  const density: MediaPanelDensity = args.density === 'compact' ? 'compact' : 'default'
  const viewportW = Math.max(1, Number(args.viewportW) || 1)
  const viewportH = Math.max(1, Number(args.viewportH) || 1)
  const zoomK = Number.isFinite(args.zoomK) ? Math.max(0.001, Number(args.zoomK)) : 1
  const itemCount = Math.max(1, Math.floor(Number(args.itemCount) || 1))

  const widthRatio = Number.isFinite(args.config.widthRatio) ? Math.max(0.001, Number(args.config.widthRatio)) : 0.2
  const widthMinPx = Number.isFinite(args.config.widthMinPx) ? Math.max(1, Math.floor(args.config.widthMinPx)) : 210
  const widthMaxPx = Number.isFinite(args.config.widthMaxPx) ? Math.max(1, Math.floor(args.config.widthMaxPx)) : 360
  const maxPanelPx = Number.isFinite(args.config.maxPanelPx) ? Math.max(64, Math.floor(args.config.maxPanelPx!)) : 2048
  const quantizeStepPx = Number.isFinite(args.config.quantizeStepPx) ? Math.max(1, Math.floor(args.config.quantizeStepPx!)) : 16

  const baseW = clamp(viewportW * widthRatio, widthMinPx, widthMaxPx)
  const baseComputed = computeMediaPanelCssVars3d({ density, sizeScale: 1 })
  const basePanel = computePanelSizeFromContent16x9({ contentW: baseW, metrics: baseComputed.metrics })
  const adaptiveScale = clampBalancedCollectiveScaleToViewport({
    scale: zoomK,
    viewportW,
    viewportH,
    count: itemCount,
    baseWidth: basePanel.panelW,
    baseHeight: basePanel.panelH,
    quantizeStep: Math.max(0.01, quantizeStepPx / Math.max(1, baseW)),
    hardMinScale: COLLECTIVE_OVERLAY_SCALE_LIMITS_16X9.richMedia.min,
    hardMaxScale: COLLECTIVE_OVERLAY_SCALE_LIMITS_16X9.richMedia.max,
    viewportPreset: 'richMedia',
  })
  const contentW = Math.max(2, Math.min(maxPanelPx, quantize(baseW * adaptiveScale, quantizeStepPx)))
  const sizeScale = Math.max(0.001, contentW / Math.max(1, baseW))
  const computed = computeMediaPanelCssVars3d({ density, sizeScale })
  const panel = computePanelSizeFromContent16x9({ contentW, metrics: computed.metrics })
  const key = `${density}|${contentW}`

  return { key, contentW, panelW: panel.panelW, panelH: panel.panelH, vars: computed.vars, metrics: computed.metrics }
}
