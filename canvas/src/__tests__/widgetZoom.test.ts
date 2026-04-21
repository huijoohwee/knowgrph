import { computeWidgetScale, computeWidgetScaledSize } from '@/components/FlowEditor/widgetZoom'

function approxEq(a: number, b: number, eps = 1e-6): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  return Math.abs(a - b) <= eps
}

export async function testWidgetScaledSizeShrinksOnZoomOutAndCapsOnZoomIn() {
  const extent = { minK: 0.4, maxK: 1.2 }

  const s1 = computeWidgetScale(1, extent, { mode: 'pinnedInCanvas' })
  const z1 = computeWidgetScaledSize(s1)
  if (z1.width <= 0 || z1.height <= 0) throw new Error('expected positive size at k=1')
  if (!approxEq(s1, 1)) throw new Error(`expected pinnedInCanvas scale=1 at k=1, got ${s1}`)
  if (!approxEq(z1.width, 360) || !approxEq(z1.height, 520)) throw new Error(`expected size 360x520 at k=1, got ${z1.width}x${z1.height}`)

  const sMin = computeWidgetScale(extent.minK, extent, { mode: 'pinnedInCanvas' })
  const zMin = computeWidgetScaledSize(sMin)
  if (!approxEq(sMin, extent.minK)) throw new Error(`expected pinnedInCanvas scale=minK at minK, got ${sMin}`)
  if (!approxEq(zMin.width, 360 * extent.minK) || !approxEq(zMin.height, 520 * extent.minK)) {
    throw new Error(`expected size to shrink with zoom-out at minK, got ${zMin.width}x${zMin.height}`)
  }

  const sMax = computeWidgetScale(extent.maxK, extent, { mode: 'pinnedInCanvas' })
  const zMax = computeWidgetScaledSize(sMax)
  if (!approxEq(sMax, 1)) throw new Error(`expected pinnedInCanvas scale capped at 1 on zoom-in, got ${sMax}`)
  if (!approxEq(zMax.width, 360) || !approxEq(zMax.height, 520)) throw new Error(`expected size capped at 360x520 on zoom-in, got ${zMax.width}x${zMax.height}`)

  const sZoomInHuge = computeWidgetScale(99, extent, { mode: 'pinnedInCanvas' })
  const sZoomOutHuge = computeWidgetScale(0.01, extent, { mode: 'pinnedInCanvas' })
  if (!approxEq(sZoomInHuge, 1)) throw new Error(`expected pinnedInCanvas scale capped at 1; got ${sZoomInHuge}`)
  if (!(sZoomOutHuge > 0 && sZoomOutHuge < extent.minK)) {
    throw new Error(`expected pinnedInCanvas scale to keep shrinking below minK; got ${sZoomOutHuge}`)
  }

  const sFloatingZoomOut = computeWidgetScale(0.2, extent, { mode: 'floating' })
  const sFloatingZoomIn = computeWidgetScale(5, extent, { mode: 'floating' })
  if (!approxEq(sFloatingZoomOut, 1) || !approxEq(sFloatingZoomIn, 1)) {
    throw new Error(`expected floating scale to stay zoom-invariant at 1, got ${sFloatingZoomOut} and ${sFloatingZoomIn}`)
  }
}
