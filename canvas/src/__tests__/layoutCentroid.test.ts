import { centerLayoutRectsByCentroid, measureLayoutRectSet } from '@/lib/canvas/layoutCentroid'

export function testCenterLayoutRectsByCentroidCentersCollectiveInBounds() {
  const bounds = { minX: 0, minY: 0, maxX: 1000, maxY: 600 }
  const centered = centerLayoutRectsByCentroid({
    items: [
      { id: 'alpha', left: -240, top: 20, width: 160, height: 120 },
      { id: 'beta', left: 120, top: 180, width: 220, height: 160 },
      { id: 'gamma', left: 260, top: 430, width: 180, height: 140 },
    ],
    bounds,
  })

  const metrics = centered.centeredMetrics
  if (!metrics) throw new Error('expected centered layout metrics')
  const expectedX = (bounds.minX + bounds.maxX) / 2
  const expectedY = (bounds.minY + bounds.maxY) / 2
  if (Math.abs(metrics.centroidX - expectedX) > 0.0001 || Math.abs(metrics.centroidY - expectedY) > 0.0001) {
    throw new Error(`expected centroid at ${expectedX},${expectedY}; got ${metrics.centroidX},${metrics.centroidY}`)
  }
}

export function testCenterLayoutRectsByCentroidPreservesRelativeOffsets() {
  const items = [
    { id: 'a', left: 10, top: 20, width: 100, height: 80 },
    { id: 'b', left: 240, top: 100, width: 120, height: 90 },
    { id: 'c', left: 480, top: 360, width: 140, height: 110 },
  ]
  const centered = centerLayoutRectsByCentroid({
    items,
    bounds: { minX: -300, minY: -220, maxX: 700, maxY: 380 },
  })

  if (centered.items.length !== items.length) throw new Error('expected all layout items to be returned')
  for (let i = 1; i < items.length; i += 1) {
    const beforeDx = items[i]!.left - items[0]!.left
    const beforeDy = items[i]!.top - items[0]!.top
    const afterDx = centered.items[i]!.left - centered.items[0]!.left
    const afterDy = centered.items[i]!.top - centered.items[0]!.top
    if (Math.abs(beforeDx - afterDx) > 0.0001 || Math.abs(beforeDy - afterDy) > 0.0001) {
      throw new Error('expected centroid centering to translate the collective without reshaping it')
    }
  }
}

export function testCenterLayoutRectsByCentroidAllowsOversizedCollectiveCentroidCenter() {
  const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 80 }
  const centered = centerLayoutRectsByCentroid({
    items: [
      { id: 'large-a', left: 0, top: 0, width: 260, height: 140 },
      { id: 'large-b', left: 320, top: 160, width: 260, height: 140 },
    ],
    bounds,
  })

  const metrics = measureLayoutRectSet(centered.items)
  if (!metrics) throw new Error('expected oversized centered layout metrics')
  const expectedX = (bounds.minX + bounds.maxX) / 2
  const expectedY = (bounds.minY + bounds.maxY) / 2
  if (Math.abs(metrics.centroidX - expectedX) > 0.0001 || Math.abs(metrics.centroidY - expectedY) > 0.0001) {
    throw new Error(`expected oversized collective centroid at bounds center, got ${metrics.centroidX},${metrics.centroidY}`)
  }
}
