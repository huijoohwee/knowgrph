import { computeMediaOverlaySizing, type MediaOverlaySizingConfig } from '@/lib/render/mediaOverlaySizing'
import { RICH_MEDIA_PANEL_DEFAULT_WIDTH_PX } from '@/lib/render/richMediaPanelDefaults'
import type { MediaPanelDensity } from '@/lib/render/mediaPanelSpec'

export const DEFAULT_OVERLAY_SIZING_CONFIG: Readonly<MediaOverlaySizingConfig> = {
  widthRatio: 0.2,
  widthMinPx: 210,
  widthMaxPx: RICH_MEDIA_PANEL_DEFAULT_WIDTH_PX,
}

export type OverlayDensitySizingConfigInput = {
  overlayBaseWidthRatioDefault?: number
  overlayBaseWidthRatioCompact?: number
  overlayBaseWidthMinPxDefault?: number
  overlayBaseWidthMinPxCompact?: number
  overlayBaseWidthMaxPxDefault?: number
  overlayBaseWidthMaxPxCompact?: number
}

export type OverlaySizingStoreStateLike = {
  threeIframeOverlayBaseWidthRatioDefault?: unknown
  threeIframeOverlayBaseWidthRatioCompact?: unknown
  threeIframeOverlayBaseWidthMinPxDefault?: unknown
  threeIframeOverlayBaseWidthMinPxCompact?: unknown
  threeIframeOverlayBaseWidthMaxPxDefault?: unknown
  threeIframeOverlayBaseWidthMaxPxCompact?: unknown
}

type StableOverlaySizingSnapshot = Readonly<OverlayDensitySizingConfigInput>

const EMPTY_OVERLAY_SIZING_INPUT: StableOverlaySizingSnapshot = Object.freeze({})

let lastOverlaySizingSnapshot: {
  ratioDefault?: number
  ratioCompact?: number
  minDefault?: number
  minCompact?: number
  maxDefault?: number
  maxCompact?: number
  value: StableOverlaySizingSnapshot
} | null = null

function readFiniteOverlaySizingValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function readOverlaySizingInputFromStoreState(
  source: OverlaySizingStoreStateLike | null | undefined,
): OverlayDensitySizingConfigInput {
  const ratioDefault = readFiniteOverlaySizingValue(source?.threeIframeOverlayBaseWidthRatioDefault)
  const ratioCompact = readFiniteOverlaySizingValue(source?.threeIframeOverlayBaseWidthRatioCompact)
  const minDefault = readFiniteOverlaySizingValue(source?.threeIframeOverlayBaseWidthMinPxDefault)
  const minCompact = readFiniteOverlaySizingValue(source?.threeIframeOverlayBaseWidthMinPxCompact)
  const maxDefault = readFiniteOverlaySizingValue(source?.threeIframeOverlayBaseWidthMaxPxDefault)
  const maxCompact = readFiniteOverlaySizingValue(source?.threeIframeOverlayBaseWidthMaxPxCompact)

  if (
    lastOverlaySizingSnapshot
    && lastOverlaySizingSnapshot.ratioDefault === ratioDefault
    && lastOverlaySizingSnapshot.ratioCompact === ratioCompact
    && lastOverlaySizingSnapshot.minDefault === minDefault
    && lastOverlaySizingSnapshot.minCompact === minCompact
    && lastOverlaySizingSnapshot.maxDefault === maxDefault
    && lastOverlaySizingSnapshot.maxCompact === maxCompact
  ) {
    return lastOverlaySizingSnapshot.value
  }

  const next =
    ratioDefault == null
      && ratioCompact == null
      && minDefault == null
      && minCompact == null
      && maxDefault == null
      && maxCompact == null
      ? EMPTY_OVERLAY_SIZING_INPUT
      : Object.freeze({
          overlayBaseWidthRatioDefault: ratioDefault,
          overlayBaseWidthRatioCompact: ratioCompact,
          overlayBaseWidthMinPxDefault: minDefault,
          overlayBaseWidthMinPxCompact: minCompact,
          overlayBaseWidthMaxPxDefault: maxDefault,
          overlayBaseWidthMaxPxCompact: maxCompact,
        })

  lastOverlaySizingSnapshot = {
    ratioDefault,
    ratioCompact,
    minDefault,
    minCompact,
    maxDefault,
    maxCompact,
    value: next,
  }

  return next
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

export function readOverlaySizingConfigForDensity(args: {
  density: MediaPanelDensity
  sizing?: OverlayDensitySizingConfigInput | null
}): MediaOverlaySizingConfig {
  const density: MediaPanelDensity = args.density === 'compact' ? 'compact' : 'default'
  const sizing = args.sizing || null
  return normalizeOverlaySizingConfig({
    widthRatio:
      density === 'compact'
        ? typeof sizing?.overlayBaseWidthRatioCompact === 'number' && Number.isFinite(sizing.overlayBaseWidthRatioCompact)
          ? sizing.overlayBaseWidthRatioCompact
          : DEFAULT_OVERLAY_SIZING_CONFIG.widthRatio
        : typeof sizing?.overlayBaseWidthRatioDefault === 'number' && Number.isFinite(sizing.overlayBaseWidthRatioDefault)
          ? sizing.overlayBaseWidthRatioDefault
          : DEFAULT_OVERLAY_SIZING_CONFIG.widthRatio,
    widthMinPx:
      density === 'compact'
        ? typeof sizing?.overlayBaseWidthMinPxCompact === 'number' && Number.isFinite(sizing.overlayBaseWidthMinPxCompact)
          ? sizing.overlayBaseWidthMinPxCompact
          : DEFAULT_OVERLAY_SIZING_CONFIG.widthMinPx
        : typeof sizing?.overlayBaseWidthMinPxDefault === 'number' && Number.isFinite(sizing.overlayBaseWidthMinPxDefault)
          ? sizing.overlayBaseWidthMinPxDefault
          : DEFAULT_OVERLAY_SIZING_CONFIG.widthMinPx,
    widthMaxPx:
      density === 'compact'
        ? typeof sizing?.overlayBaseWidthMaxPxCompact === 'number' && Number.isFinite(sizing.overlayBaseWidthMaxPxCompact)
          ? sizing.overlayBaseWidthMaxPxCompact
          : DEFAULT_OVERLAY_SIZING_CONFIG.widthMaxPx
        : typeof sizing?.overlayBaseWidthMaxPxDefault === 'number' && Number.isFinite(sizing.overlayBaseWidthMaxPxDefault)
          ? sizing.overlayBaseWidthMaxPxDefault
          : DEFAULT_OVERLAY_SIZING_CONFIG.widthMaxPx,
  })
}

export function computeOverlayHalfExtentsWorld(args: {
  density: MediaPanelDensity
  viewportW: number
  viewportH: number
  zoomK: number
  config?: Partial<MediaOverlaySizingConfig> | null
}): { halfW: number; halfH: number } {
  const density: MediaPanelDensity = args.density === 'compact' ? 'compact' : 'default'
  const viewportW = Math.max(1, Math.floor(Number(args.viewportW) || 1))
  const viewportH = Math.max(1, Math.floor(Number(args.viewportH) || 1))
  const zoomK = Number.isFinite(args.zoomK) ? Math.max(0.001, Number(args.zoomK)) : 1
  const config = normalizeOverlaySizingConfig(args.config)
  const sizing = computeMediaOverlaySizing({ density, viewportW, viewportH, zoomK, itemCount: 1, config })
  return {
    halfW: Math.max(1, sizing.panelW / zoomK / 2),
    halfH: Math.max(1, sizing.panelH / zoomK / 2),
  }
}
