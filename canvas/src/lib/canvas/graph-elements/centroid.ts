import {
  measureLayoutRectSet,
  resolveBoundedLayoutCenterShift,
  type LayoutRectLike,
  type LayoutRectSetMetrics,
} from '@/lib/canvas/layoutCentroid'
import { computeCenteredTransformToWorldPoint } from '@/lib/canvas/centerTransform'

export type GraphElementPointLike = {
  x?: unknown
  y?: unknown
  fx?: unknown
  fy?: unknown
  properties?: unknown
}

export type GraphElementCoordinateMode = 'center' | 'topLeftVisualRect'

export type GraphElementPoint = { x: number; y: number }

export type GraphElementCentroidMetrics = {
  count: number
  minX: number
  minY: number
  maxX: number
  maxY: number
  centroidX: number
  centroidY: number
}

export type GraphElementCentroidAccumulator = {
  count: number
  weightSum: number
  weightedX: number
  weightedY: number
}

const readFiniteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const readGraphElementVisualSize = (element: GraphElementPointLike): { width: number; height: number } => {
  const props = element.properties && typeof element.properties === 'object' && !Array.isArray(element.properties)
    ? element.properties as Record<string, unknown>
    : {}
  const width = readFiniteNumber(props['visual:width'])
  const height = readFiniteNumber(props['visual:height'])
  return {
    width: width != null && width > 0 ? width : 0,
    height: height != null && height > 0 ? height : 0,
  }
}

export const readGraphElementCenterPoint = (
  element: GraphElementPointLike | null | undefined,
  options?: {
    coordinateMode?: GraphElementCoordinateMode
    fallbackToFixedPosition?: boolean
  },
): GraphElementPoint | null => {
  if (!element) return null
  let x = readFiniteNumber(element.x)
  let y = readFiniteNumber(element.y)
  if ((x == null || y == null) && options?.fallbackToFixedPosition !== false) {
    const fx = readFiniteNumber(element.fx)
    const fy = readFiniteNumber(element.fy)
    if (fx != null && fy != null) {
      x = fx
      y = fy
    }
  }
  if (x == null || y == null) return null
  if (options?.coordinateMode === 'topLeftVisualRect') {
    const size = readGraphElementVisualSize(element)
    return { x: x + size.width / 2, y: y + size.height / 2 }
  }
  return { x, y }
}

export const measureGraphElementCenterSet = (
  elements: readonly GraphElementPointLike[],
  options?: {
    coordinateMode?: GraphElementCoordinateMode
    fallbackToFixedPosition?: boolean
  },
): GraphElementCentroidMetrics | null => {
  const input = Array.isArray(elements) ? elements : []
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let sumX = 0
  let sumY = 0
  let count = 0

  for (let i = 0; i < input.length; i += 1) {
    const point = readGraphElementCenterPoint(input[i], options)
    if (!point) continue
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
    sumX += point.x
    sumY += point.y
    count += 1
  }

  if (count <= 0 || !Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null
  }

  return {
    count,
    minX,
    minY,
    maxX,
    maxY,
    centroidX: sumX / count,
    centroidY: sumY / count,
  }
}

export const createGraphElementCentroidAccumulator = (): GraphElementCentroidAccumulator => ({
  count: 0,
  weightSum: 0,
  weightedX: 0,
  weightedY: 0,
})

export const addGraphElementCentroidSample = (
  accumulator: GraphElementCentroidAccumulator,
  point: GraphElementPoint,
  weightRaw: number = 1,
): void => {
  if (!accumulator || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return
  const weight = Number.isFinite(weightRaw) && weightRaw > 0 ? weightRaw : 1
  accumulator.count += 1
  accumulator.weightSum += weight
  accumulator.weightedX += point.x * weight
  accumulator.weightedY += point.y * weight
}

export const readGraphElementCentroidFromAccumulator = (
  accumulator: GraphElementCentroidAccumulator,
): GraphElementPoint | null => {
  if (!accumulator || accumulator.count <= 0 || accumulator.weightSum <= 0) return null
  return {
    x: accumulator.weightedX / accumulator.weightSum,
    y: accumulator.weightedY / accumulator.weightSum,
  }
}

export const computeViewportCenteredTransformForGraphElements = (args: {
  elements: readonly GraphElementPointLike[]
  viewportW: number
  viewportH: number
  scale?: number
  coordinateMode?: GraphElementCoordinateMode
  fallbackToFixedPosition?: boolean
}): { k: number; x: number; y: number } | null => {
  const metrics = measureGraphElementCenterSet(args.elements, {
    coordinateMode: args.coordinateMode,
    fallbackToFixedPosition: args.fallbackToFixedPosition,
  })
  if (!metrics) return null
  const k = readFiniteNumber(args.scale) ?? 1
  return computeCenteredTransformToWorldPoint({
    transform: { k: Math.max(0.001, k), x: 0, y: 0 },
    viewportW: args.viewportW,
    viewportH: args.viewportH,
    worldX: metrics.centroidX,
    worldY: metrics.centroidY,
  })
}

export const computeGraphElementCentroidShiftToViewportCenter = (args: {
  elements: readonly GraphElementPointLike[]
  viewportW: number
  viewportH: number
  targetCenter?: { x?: unknown; y?: unknown } | null
  coordinateMode?: GraphElementCoordinateMode
  fallbackToFixedPosition?: boolean
}): { dx: number; dy: number; metrics: GraphElementCentroidMetrics } | null => {
  const metrics = measureGraphElementCenterSet(args.elements, {
    coordinateMode: args.coordinateMode,
    fallbackToFixedPosition: args.fallbackToFixedPosition,
  })
  if (!metrics) return null
  const viewportW = Math.max(1, readFiniteNumber(args.viewportW) ?? 1)
  const viewportH = Math.max(1, readFiniteNumber(args.viewportH) ?? 1)
  const targetX = readFiniteNumber(args.targetCenter?.x) ?? viewportW / 2
  const targetY = readFiniteNumber(args.targetCenter?.y) ?? viewportH / 2
  return {
    dx: targetX - metrics.centroidX,
    dy: targetY - metrics.centroidY,
    metrics,
  }
}

export const measureTransformedGraphElementScreenRectSet = (args: {
  elements: readonly GraphElementPointLike[]
  transform: { k?: unknown; x?: unknown; y?: unknown } | null
  elementWidth: number | ((element: GraphElementPointLike) => number)
  elementHeight: number | ((element: GraphElementPointLike) => number)
  coordinateMode?: GraphElementCoordinateMode
}): LayoutRectSetMetrics | null => {
  const input = Array.isArray(args.elements) ? args.elements : []
  const k = Math.max(0.001, readFiniteNumber(args.transform?.k) ?? 1)
  const tx = readFiniteNumber(args.transform?.x) ?? 0
  const ty = readFiniteNumber(args.transform?.y) ?? 0
  const rects: LayoutRectLike[] = []

  for (let i = 0; i < input.length; i += 1) {
    const element = input[i]
    const point = readGraphElementCenterPoint(element, { coordinateMode: 'center' })
    if (!point) continue
    const widthRaw = typeof args.elementWidth === 'function' ? args.elementWidth(element) : args.elementWidth
    const heightRaw = typeof args.elementHeight === 'function' ? args.elementHeight(element) : args.elementHeight
    const width = Math.max(1, readFiniteNumber(widthRaw) ?? 1) * k
    const height = Math.max(1, readFiniteNumber(heightRaw) ?? 1) * k
    const x = point.x * k + tx
    const y = point.y * k + ty
    const centerX = args.coordinateMode === 'topLeftVisualRect' ? x + width / 2 : x
    const centerY = args.coordinateMode === 'topLeftVisualRect' ? y + height / 2 : y
    rects.push({
      left: centerX - width / 2,
      top: centerY - height / 2,
      width,
      height,
    })
  }

  return measureLayoutRectSet(rects)
}

export const computeLayoutRectSetViewportCenterShift = (args: {
  metrics: LayoutRectSetMetrics | null
  clampMetrics?: LayoutRectSetMetrics | null
  viewportW: number
  viewportH: number
  viewportLeft?: number
  viewportTop?: number
  viewportRight?: number
  viewportBottom?: number
  viewportCenterX?: number
  viewportCenterY?: number
}): { dx: number; dy: number; targetCenterX: number; targetCenterY: number } | null => {
  const metrics = args.metrics
  if (!metrics) return null
  const clampMetrics = args.clampMetrics || metrics
  const viewportW = Math.max(1, readFiniteNumber(args.viewportW) ?? 1)
  const viewportH = Math.max(1, readFiniteNumber(args.viewportH) ?? 1)
  const left = readFiniteNumber(args.viewportLeft) ?? 0
  const top = readFiniteNumber(args.viewportTop) ?? 0
  const right = readFiniteNumber(args.viewportRight) ?? left + viewportW
  const bottom = readFiniteNumber(args.viewportBottom) ?? top + viewportH
  const targetCenterX = readFiniteNumber(args.viewportCenterX) ?? left + (right - left) / 2
  const targetCenterY = readFiniteNumber(args.viewportCenterY) ?? top + (bottom - top) / 2
  const desiredDeltaX = targetCenterX - metrics.centroidX
  const desiredDeltaY = targetCenterY - metrics.centroidY
  return {
    dx: resolveBoundedLayoutCenterShift({
      preferredShift: desiredDeltaX,
      minShift: left - clampMetrics.minLeft,
      maxShift: right - clampMetrics.maxRight,
    }),
    dy: resolveBoundedLayoutCenterShift({
      preferredShift: desiredDeltaY,
      minShift: top - clampMetrics.minTop,
      maxShift: bottom - clampMetrics.maxBottom,
    }),
    targetCenterX,
    targetCenterY,
  }
}

export const layoutRectSetCentroidWithinViewport = (args: {
  metrics: LayoutRectSetMetrics | null
  viewportW: number
  viewportH: number
  viewportCenterX?: number
  viewportCenterY?: number
  toleranceXRatio: number
  toleranceYRatio: number
}): boolean => {
  const metrics = args.metrics
  if (!metrics) return false
  const viewportW = Math.max(1, readFiniteNumber(args.viewportW) ?? 1)
  const viewportH = Math.max(1, readFiniteNumber(args.viewportH) ?? 1)
  const targetCenterX = readFiniteNumber(args.viewportCenterX) ?? viewportW / 2
  const targetCenterY = readFiniteNumber(args.viewportCenterY) ?? viewportH / 2
  const toleranceX = viewportW * Math.max(0, readFiniteNumber(args.toleranceXRatio) ?? 0)
  const toleranceY = viewportH * Math.max(0, readFiniteNumber(args.toleranceYRatio) ?? 0)
  return (
    Math.abs(metrics.centroidX - targetCenterX) <= toleranceX
    && Math.abs(metrics.centroidY - targetCenterY) <= toleranceY
  )
}
