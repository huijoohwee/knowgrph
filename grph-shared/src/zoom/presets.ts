export type ZoomViewportPreset = {
  maxWidth: number
  maxHeight: number
  aspectRatio: number
}

export const ZOOM_VIEWPORT_PRESET_16_9: ZoomViewportPreset = {
  maxWidth: 1920,
  maxHeight: 1080,
  aspectRatio: 16 / 9,
}

export const DEFAULT_FIT_TO_SCREEN_FILL_RATIO = 0.8

export const DEFAULT_FIT_PADDING = 80

export const DEFAULT_ZOOM_MIN_SCALE = 0.1
export const DEFAULT_ZOOM_MAX_SCALE = 4
export const DEFAULT_ZOOM_MAX_SCALE_HARD_CAP = 6
export const DEFAULT_ZOOM_MIN_SCALE_HARD_CAP = 0.001

export function clampFillRatio(fillRatio: number): number {
  if (!Number.isFinite(fillRatio)) return DEFAULT_FIT_TO_SCREEN_FILL_RATIO
  return Math.max(0.2, Math.min(0.95, fillRatio))
}

export function computeFitFrame(
  viewportW: number,
  viewportH: number,
  preset: ZoomViewportPreset = ZOOM_VIEWPORT_PRESET_16_9,
): { frameW: number; frameH: number } {
  const vw = Math.max(1, Math.floor(viewportW))
  const vh = Math.max(1, Math.floor(viewportH))
  const maxW = Math.max(1, Math.floor(preset.maxWidth))
  const maxH = Math.max(1, Math.floor(preset.maxHeight))
  return {
    frameW: Math.min(maxW, vw),
    frameH: Math.min(maxH, vh),
  }
}

export function clampScaleToExtent(scale: number, extent: { minScale: number; maxScale: number; maxScaleHardCap?: number }): number {
  const raw = Number.isFinite(scale) ? scale : 1
  const minScale = Math.max(DEFAULT_ZOOM_MIN_SCALE_HARD_CAP, Number.isFinite(extent.minScale) ? extent.minScale : DEFAULT_ZOOM_MIN_SCALE)
  const maxScale = Math.max(minScale, Number.isFinite(extent.maxScale) ? extent.maxScale : DEFAULT_ZOOM_MAX_SCALE)
  const hardCapRaw = extent.maxScaleHardCap
  const maxScaleHardCap = typeof hardCapRaw === 'number' && Number.isFinite(hardCapRaw)
    ? Math.max(minScale, hardCapRaw)
    : DEFAULT_ZOOM_MAX_SCALE_HARD_CAP
  const upper = Math.min(Math.max(0.1, maxScale), Math.max(0.1, maxScaleHardCap))
  const lower = Math.max(DEFAULT_ZOOM_MIN_SCALE_HARD_CAP, Math.min(minScale, upper))
  return Math.max(lower, Math.min(upper, raw))
}
