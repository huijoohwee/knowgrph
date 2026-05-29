import {
  clampCanvasInteractionSpeedMultiplier,
  clampCanvasPanSpeedMultiplier,
  readZoomSpeed,
} from '@/lib/canvas/camera-options-2d'
import { clampFlowWheelZoomIncrementMultiplier, clampFlowWheelZoomSpeedMultiplier } from '@/lib/canvas/flow-zoom-tuning'
import { DEFAULT_ZOOM_MIN_SCALE_HARD_CAP, readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import { clampScale } from '@/lib/canvas/viewport-transform'
import type { GraphSchema } from '@/lib/graph/schema'

const FLOW_ZOOM_MAX_VISUAL_CAP = 24

export function readFlowPanInteractionSpeed(state: {
  canvasInteractionSpeedMultiplier?: unknown
  canvasPanSpeedMultiplier?: unknown
}): number {
  return clampCanvasPanSpeedMultiplier(Number(state.canvasPanSpeedMultiplier))
    * clampCanvasInteractionSpeedMultiplier(Number(state.canvasInteractionSpeedMultiplier))
}

export function readFlowPinchZoomSessionSettings(
  state: {
    canvasInteractionSpeedMultiplier?: unknown
    flowWheelZoomIncrementMultiplier?: unknown
    flowWheelZoomSpeedMultiplier?: unknown
    schema?: GraphSchema | null
  },
  startTransform: { k: number },
): {
  scaleExtent: { minK: number; maxK: number }
  zoomExponentMultiplier: number
} {
  const [schemaMinScale, schemaMaxScale] = readZoomScaleExtent(state.schema ?? null)
  const maxK = Math.min(schemaMaxScale, FLOW_ZOOM_MAX_VISUAL_CAP)
  const minScaleBase = Math.min(schemaMinScale, DEFAULT_ZOOM_MIN_SCALE_HARD_CAP)
  const minScale = clampScale(minScaleBase, { minK: DEFAULT_ZOOM_MIN_SCALE_HARD_CAP, maxK })
  const startK = Number.isFinite(startTransform.k) ? startTransform.k : 1
  const minK = Math.min(minScale, startK)
  const zoomSpeedRaw = readZoomSpeed(state.schema ?? null)
  const zoomSpeed = Number.isFinite(zoomSpeedRaw) && zoomSpeedRaw > 0 ? zoomSpeedRaw : 1
  const speed = clampFlowWheelZoomSpeedMultiplier(Number(state.flowWheelZoomSpeedMultiplier))
  const increment = clampFlowWheelZoomIncrementMultiplier(Number(state.flowWheelZoomIncrementMultiplier))
  const interactionSpeed = clampCanvasInteractionSpeedMultiplier(Number(state.canvasInteractionSpeedMultiplier))
  return {
    scaleExtent: { minK, maxK },
    zoomExponentMultiplier: zoomSpeed * speed * increment * interactionSpeed,
  }
}
