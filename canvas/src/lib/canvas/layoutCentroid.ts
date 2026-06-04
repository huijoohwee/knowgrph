export type LayoutBounds = { minX: number; minY: number; maxX: number; maxY: number }

export type LayoutRectLike = {
  left: number
  top: number
  width: number
  height: number
}

export type LayoutRectSetMetrics = {
  count: number
  minLeft: number
  minTop: number
  maxRight: number
  maxBottom: number
  centroidX: number
  centroidY: number
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeBounds(bounds: LayoutBounds): LayoutBounds {
  const minX = readFiniteNumber(bounds?.minX) ?? 0
  const minY = readFiniteNumber(bounds?.minY) ?? 0
  const rawMaxX = readFiniteNumber(bounds?.maxX) ?? minX
  const rawMaxY = readFiniteNumber(bounds?.maxY) ?? minY
  return {
    minX,
    minY,
    maxX: Math.max(minX, rawMaxX),
    maxY: Math.max(minY, rawMaxY),
  }
}

export function resolveBoundedLayoutCenterShift(args: {
  preferredShift: number
  minShift: number
  maxShift: number
}): number {
  const preferred = readFiniteNumber(args.preferredShift) ?? 0
  const min = readFiniteNumber(args.minShift) ?? 0
  const max = readFiniteNumber(args.maxShift) ?? 0
  if (min > max) return preferred
  return Math.max(min, Math.min(max, preferred))
}

export function measureLayoutRectSet(items: readonly LayoutRectLike[]): LayoutRectSetMetrics | null {
  const input = Array.isArray(items) ? items : []
  let minLeft = Number.POSITIVE_INFINITY
  let minTop = Number.POSITIVE_INFINITY
  let maxRight = Number.NEGATIVE_INFINITY
  let maxBottom = Number.NEGATIVE_INFINITY
  let sumCenterX = 0
  let sumCenterY = 0
  let count = 0

  for (let i = 0; i < input.length; i += 1) {
    const item = input[i]
    const left = readFiniteNumber(item?.left)
    const top = readFiniteNumber(item?.top)
    if (left == null || top == null) continue
    const width = Math.max(1, readFiniteNumber(item?.width) ?? 1)
    const height = Math.max(1, readFiniteNumber(item?.height) ?? 1)
    const right = left + width
    const bottom = top + height
    minLeft = Math.min(minLeft, left)
    minTop = Math.min(minTop, top)
    maxRight = Math.max(maxRight, right)
    maxBottom = Math.max(maxBottom, bottom)
    sumCenterX += left + width / 2
    sumCenterY += top + height / 2
    count += 1
  }

  if (count <= 0 || !Number.isFinite(minLeft) || !Number.isFinite(minTop) || !Number.isFinite(maxRight) || !Number.isFinite(maxBottom)) {
    return null
  }

  return {
    count,
    minLeft,
    minTop,
    maxRight,
    maxBottom,
    centroidX: sumCenterX / count,
    centroidY: sumCenterY / count,
  }
}

export function centerLayoutRectsByCentroid<T extends LayoutRectLike>(args: {
  items: readonly T[]
  bounds: LayoutBounds
  snap?: (value: number) => number
}): {
  items: T[]
  shiftX: number
  shiftY: number
  metrics: LayoutRectSetMetrics | null
  centeredMetrics: LayoutRectSetMetrics | null
} {
  const input = Array.isArray(args.items) ? args.items : []
  const metrics = measureLayoutRectSet(input)
  if (!metrics) {
    return {
      items: input.slice(),
      shiftX: 0,
      shiftY: 0,
      metrics: null,
      centeredMetrics: null,
    }
  }

  const bounds = normalizeBounds(args.bounds)
  const targetCenterX = bounds.minX + (bounds.maxX - bounds.minX) / 2
  const targetCenterY = bounds.minY + (bounds.maxY - bounds.minY) / 2
  const snap = typeof args.snap === 'function' ? args.snap : null
  const shiftX = snap
    ? snap(resolveBoundedLayoutCenterShift({
        preferredShift: targetCenterX - metrics.centroidX,
        minShift: bounds.minX - metrics.minLeft,
        maxShift: bounds.maxX - metrics.maxRight,
      }))
    : resolveBoundedLayoutCenterShift({
        preferredShift: targetCenterX - metrics.centroidX,
        minShift: bounds.minX - metrics.minLeft,
        maxShift: bounds.maxX - metrics.maxRight,
      })
  const shiftY = snap
    ? snap(resolveBoundedLayoutCenterShift({
        preferredShift: targetCenterY - metrics.centroidY,
        minShift: bounds.minY - metrics.minTop,
        maxShift: bounds.maxY - metrics.maxBottom,
      }))
    : resolveBoundedLayoutCenterShift({
        preferredShift: targetCenterY - metrics.centroidY,
        minShift: bounds.minY - metrics.minTop,
        maxShift: bounds.maxY - metrics.maxBottom,
      })

  const centeredItems = input.map(item => {
    const left = readFiniteNumber(item?.left)
    const top = readFiniteNumber(item?.top)
    if (left == null || top == null) return { ...item }
    const nextLeft = snap ? snap(left + shiftX) : left + shiftX
    const nextTop = snap ? snap(top + shiftY) : top + shiftY
    return { ...item, left: nextLeft, top: nextTop }
  })

  return {
    items: centeredItems,
    shiftX,
    shiftY,
    metrics,
    centeredMetrics: measureLayoutRectSet(centeredItems),
  }
}
