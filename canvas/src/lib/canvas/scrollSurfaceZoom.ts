import type { GraphSchema } from '@/lib/graph/schema'
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import type { ZoomRequest } from '@/lib/zoom/requests'
import { clampScale } from '@/lib/zoom/scaleExtent'
import { resolveScaleExtentForZoomRequest } from '@/lib/zoom/resolveScaleExtentForRequest'
import { pickNextZoomStep, readZoomStepPolicy } from '@/lib/zoom/steps'

export const DEFAULT_SCROLL_SURFACE_ZOOM = 1

const readFinitePositive = (value: unknown, fallback: number): number => {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

export const readScrollSurfaceZoomScale = (value: unknown): number => {
  return readFinitePositive(value, DEFAULT_SCROLL_SURFACE_ZOOM)
}

export const computeScrollSurfaceZoomScaleFromRequest = (args: {
  zoomRequest: ZoomRequest
  currentScale: number
  schema: GraphSchema
}): number => {
  const currentScale = readScrollSurfaceZoomScale(args.currentScale)
  const [schemaMinK, schemaMaxK] = readZoomScaleExtent(args.schema)
  const scaleExtent = resolveScaleExtentForZoomRequest({
    zoomRequest: args.zoomRequest,
    schemaScaleExtent: { minK: schemaMinK, maxK: schemaMaxK },
    currentTransform: { k: currentScale },
  })
  const type = args.zoomRequest.type
  if (type === 'in' || type === 'out') {
    const stepPolicy = readZoomStepPolicy(args.schema)
    if (stepPolicy.enabled) {
      return pickNextZoomStep({
        dir: type,
        currentK: currentScale,
        steps: stepPolicy.steps,
        minK: scaleExtent.minK,
        maxK: scaleExtent.maxK,
      })
    }
    return clampScale(type === 'in' ? currentScale * 1.2 : currentScale / 1.2, scaleExtent)
  }
  if (type === 'transform') {
    return clampScale(args.zoomRequest.payload?.k ?? currentScale, scaleExtent)
  }
  if (type === 'reset' || type === 'fit' || type === 'selection') {
    return clampScale(DEFAULT_SCROLL_SURFACE_ZOOM, scaleExtent)
  }
  return currentScale
}

export const buildScrollSurfaceZoomTransform = (scale: number): { k: number; x: number; y: number } => ({
  k: readScrollSurfaceZoomScale(scale),
  x: 0,
  y: 0,
})

export const buildZoomScaledCssLength = (args: {
  basePx: number
  scale: number
  minPx: number
  maxPx: number
}): string => {
  const basePx = readFinitePositive(args.basePx, args.minPx)
  const scale = readScrollSurfaceZoomScale(args.scale)
  const minPx = readFinitePositive(args.minPx, 1)
  const maxPx = Math.max(minPx, readFinitePositive(args.maxPx, basePx))
  const next = Math.round(Math.max(minPx, Math.min(maxPx, basePx * scale)))
  return `${next}px`
}
