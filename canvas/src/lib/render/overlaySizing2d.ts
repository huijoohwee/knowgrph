import { computeMediaOverlaySizing, type MediaOverlaySizingConfig } from '@/lib/render/mediaOverlaySizing'
import type { MediaPanelDensity } from '@/lib/render/mediaPanelSpec'

export const DEFAULT_OVERLAY_SIZING_CONFIG: Readonly<MediaOverlaySizingConfig> = {
  widthRatio: 0.2,
  widthMinPx: 210,
  widthMaxPx: 360,
}

export function normalizeOverlaySizingConfig(input?: Partial<MediaOverlaySizingConfig> | null): MediaOverlaySizingConfig {
  const src = input || null
  const widthRatioRaw = src && typeof src.widthRatio === 'number' ? src.widthRatio : DEFAULT_OVERLAY_SIZING_CONFIG.widthRatio
  const widthMinRaw = src && typeof src.widthMinPx === 'number' ? src.widthMinPx : DEFAULT_OVERLAY_SIZING_CONFIG.widthMinPx
  const widthMaxRaw = src && typeof src.widthMaxPx === 'number' ? src.widthMaxPx : DEFAULT_OVERLAY_SIZING_CONFIG.widthMaxPx
  return {
    widthRatio: Number.isFinite(widthRatioRaw) ? Math.max(0.001, Number(widthRatioRaw)) : DEFAULT_OVERLAY_SIZING_CONFIG.widthRatio,
    widthMinPx: Number.isFinite(widthMinRaw) ? Math.max(1, Math.floor(Number(widthMinRaw))) : DEFAULT_OVERLAY_SIZING_CONFIG.widthMinPx,
    widthMaxPx: Number.isFinite(widthMaxRaw) ? Math.max(1, Math.floor(Number(widthMaxRaw))) : DEFAULT_OVERLAY_SIZING_CONFIG.widthMaxPx,
  }
}

export function computeOverlayHalfExtentsWorld(args: {
  density: MediaPanelDensity
  viewportW: number
  zoomK: number
  config?: Partial<MediaOverlaySizingConfig> | null
}): { halfW: number; halfH: number } {
  const density: MediaPanelDensity = args.density === 'compact' ? 'compact' : 'default'
  const viewportW = Math.max(1, Math.floor(Number(args.viewportW) || 1))
  const zoomK = Number.isFinite(args.zoomK) ? Math.max(0.001, Number(args.zoomK)) : 1
  const config = normalizeOverlaySizingConfig(args.config)
  const sizing = computeMediaOverlaySizing({ density, viewportW, zoomK, config })
  return {
    halfW: Math.max(1, sizing.panelW / zoomK / 2),
    halfH: Math.max(1, sizing.panelH / zoomK / 2),
  }
}

