import { computeCollectiveFollowPinnedScale, computeWidgetScale, computeWidgetScaleKey, computeWidgetScaledSize } from '@/components/FlowEditor/widgetZoom'
import { clampBalancedCollectiveScaleToViewport } from '@/lib/ui/overlayBalancedSpread'

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
  if (!(sFloatingZoomOut >= 0.86 && sFloatingZoomOut < 1)) {
    throw new Error(`expected floating zoom-out scale to shrink gently but stay bounded, got ${sFloatingZoomOut}`)
  }
  if (!(sFloatingZoomIn > 1 && sFloatingZoomIn <= 1.06)) {
    throw new Error(`expected floating zoom-in scale to grow gently but stay bounded, got ${sFloatingZoomIn}`)
  }
  const sFloatingHugeZoomOut = computeWidgetScale(0.01, extent, { mode: 'floating' })
  const sFloatingHugeZoomIn = computeWidgetScale(99, extent, { mode: 'floating' })
  if (!approxEq(sFloatingHugeZoomOut, 0.86)) throw new Error(`expected floating zoom-out hard floor 0.86, got ${sFloatingHugeZoomOut}`)
  if (!approxEq(sFloatingHugeZoomIn, 1.06)) throw new Error(`expected floating zoom-in hard cap 1.06, got ${sFloatingHugeZoomIn}`)
  const sFloatingTinyDeltaA = computeWidgetScale(1, extent, { mode: 'floating' })
  const sFloatingTinyDeltaB = computeWidgetScale(1.01, extent, { mode: 'floating' })
  if (!approxEq(sFloatingTinyDeltaA, sFloatingTinyDeltaB)) {
    throw new Error(`expected floating scale quantization to suppress tiny zoom churn, got ${sFloatingTinyDeltaA} and ${sFloatingTinyDeltaB}`)
  }
  if (computeWidgetScaleKey(sFloatingTinyDeltaA) !== '1.00') {
    throw new Error(`expected floating scale key to stay stable at 1.00 for tiny zoom deltas, got ${computeWidgetScaleKey(sFloatingTinyDeltaA)}`)
  }

  const balancedCollectiveScale = clampBalancedCollectiveScaleToViewport({
    scale: 1,
    viewportW: 1920,
    viewportH: 1080,
    count: 4,
    baseWidth: 360,
    baseHeight: 520,
    quantizeStep: 0.02,
    hardMinScale: 0.68,
    hardMaxScale: 1.06,
  })
  if (!(balancedCollectiveScale >= 0.68 && balancedCollectiveScale < 0.82)) {
    throw new Error(`expected balanced collective scale to shrink oversized 4-up floating widgets on 1920x1080, got ${balancedCollectiveScale}`)
  }
  const singleScale = clampBalancedCollectiveScaleToViewport({
    scale: 1,
    viewportW: 1920,
    viewportH: 1080,
    count: 1,
    baseWidth: 360,
    baseHeight: 520,
    quantizeStep: 0.02,
    hardMinScale: 0.68,
    hardMaxScale: 1.06,
  })
  if (!approxEq(singleScale, 1)) {
    throw new Error(`expected single floating widget scale to remain unchanged by collective viewport fit, got ${singleScale}`)
  }

  const denseCollectiveScale = clampBalancedCollectiveScaleToViewport({
    scale: 1,
    viewportW: 1920,
    viewportH: 1080,
    count: 8,
    baseWidth: 360,
    baseHeight: 520,
    quantizeStep: 0.02,
    hardMinScale: 0.68,
    hardMaxScale: 1.06,
  })
  if (!(denseCollectiveScale < balancedCollectiveScale)) {
    throw new Error(`expected dense collective scale to shrink below 4-up scale on 1920x1080, got dense=${denseCollectiveScale} four=${balancedCollectiveScale}`)
  }

  const followPinnedZoomOut = computeCollectiveFollowPinnedScale({
    zoomK: 0.5,
    extent,
    viewportW: 1920,
    viewportH: 1080,
    count: 1,
    baseWidth: 360,
    baseHeight: 520,
  })
  if (!approxEq(followPinnedZoomOut, 0.5)) {
    throw new Error(`expected follow-pinned collective scale to reuse pinned zoom-out size, got ${followPinnedZoomOut}`)
  }

  const followPinnedZoomIn = computeCollectiveFollowPinnedScale({
    zoomK: 2,
    extent,
    viewportW: 1920,
    viewportH: 1080,
    count: 1,
    baseWidth: 360,
    baseHeight: 520,
  })
  if (!approxEq(followPinnedZoomIn, 1)) {
    throw new Error(`expected follow-pinned collective scale to cap at pinned zoom-in size, got ${followPinnedZoomIn}`)
  }
}
