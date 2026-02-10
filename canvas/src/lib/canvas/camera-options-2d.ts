import type { GraphSchema } from '@/lib/graph/schema'
import type { ViewportControlsPreset } from '@/lib/config.viewport-controls'
import { computeWheelZoomFactor, normalizeWheelDeltaYpx } from '@/lib/canvas/zoom-input'
import { shouldWheelZoomForPreset } from '@/lib/canvas/viewport-controls'

export type WheelBehavior = 'pan' | 'zoom' | 'preset'

export const CANVAS_PAN_SPEED_MULTIPLIER_DEFAULT = 1
export const CANVAS_PAN_SPEED_MULTIPLIER_MIN = 0.25
export const CANVAS_PAN_SPEED_MULTIPLIER_MAX = 3

export function clampCanvasPanSpeedMultiplier(v: number): number {
  const safe = typeof v === 'number' && Number.isFinite(v) ? v : CANVAS_PAN_SPEED_MULTIPLIER_DEFAULT
  return Math.max(CANVAS_PAN_SPEED_MULTIPLIER_MIN, Math.min(CANVAS_PAN_SPEED_MULTIPLIER_MAX, safe))
}

export function readWheelBehavior(schema: GraphSchema): WheelBehavior {
  const v = schema.performance?.zoom?.wheelBehavior
  if (v === 'pan' || v === 'zoom') return v
  return 'preset'
}

export function shouldWheelZoom(args: {
  event: Pick<WheelEvent, 'ctrlKey' | 'metaKey'>
  preset: ViewportControlsPreset
  wheelBehavior: WheelBehavior
}): boolean {
  if (args.wheelBehavior === 'zoom') return true
  if (args.wheelBehavior === 'pan') return false
  return shouldWheelZoomForPreset(args.event, args.preset)
}

export function readPanSpeed(schema: GraphSchema): number {
  const v = schema.performance?.zoom?.panSpeed
  if (typeof v !== 'number' || !Number.isFinite(v)) return 1
  return Math.max(0.1, Math.min(5, v))
}

export function readZoomSpeed(schema: GraphSchema): number {
  const v = schema.performance?.zoom?.zoomSpeed
  if (typeof v !== 'number' || !Number.isFinite(v)) return 1
  return Math.max(0.1, Math.min(5, v))
}

export function computeWheelZoomFactorWithSpeed(e: Pick<WheelEvent, 'deltaY' | 'deltaMode'>, zoomSpeed: number): number {
  const deltaYpx = normalizeWheelDeltaYpx(e)
  const s = typeof zoomSpeed === 'number' && Number.isFinite(zoomSpeed) ? zoomSpeed : 1
  return computeWheelZoomFactor(deltaYpx * s)
}
