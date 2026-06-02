import { computeCollectiveFollowPinnedScale, computeWidgetScale, computeWidgetScaleKey, computeWidgetScaledSize } from '@/lib/canvas/overlayWidgetZoom'
import { COLLECTIVE_OVERLAY_SCALE_LIMITS_16X9 } from '@/lib/ui/overlayScaleLimits'
import {
  clampBalancedCollectiveScaleToViewport,
  computeBalancedSpreadBaseGapPx,
  computeBalancedSpreadLayout,
  computeBalancedSpreadSpacingPx,
  computeBalancedSpreadGrid,
  computeBalancedSpreadViewportMargins,
} from '@/lib/ui/overlayBalancedSpread'

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
  if (!(balancedCollectiveScale >= 0.68 && balancedCollectiveScale <= 1)) {
    throw new Error(`expected balanced collective scale to stay within explicit bounds on 1920x1080, got ${balancedCollectiveScale}`)
  }
  const widgetMargins = computeBalancedSpreadViewportMargins({
    viewportW: 1920,
    viewportH: 1080,
    preset: 'widgetCanvas',
  })
  const usableW = 1920 - widgetMargins.left - widgetMargins.right
  const usableH = 1080 - widgetMargins.top - widgetMargins.bottom
  const gapPx = computeBalancedSpreadSpacingPx({
    baseGapPx: computeBalancedSpreadBaseGapPx({
      viewportW: 1920,
      viewportH: 1080,
      preset: 'widgetCanvas',
      margins: widgetMargins,
    }),
    zoomK: 1,
    count: 4,
  })
  const panelW = 360 * balancedCollectiveScale
  const panelH = 520 * balancedCollectiveScale
  const balancedLayout = computeBalancedSpreadLayout({
    count: 4,
    viewportW: 1920,
    viewportH: 1080,
    cellW: panelW + gapPx,
    cellH: panelH + gapPx,
    gapPx,
    zoomK: 1,
    marginLeftPx: widgetMargins.left,
    marginRightPx: widgetMargins.right,
    marginTopPx: widgetMargins.top,
    marginBottomPx: widgetMargins.bottom,
  })
  if (balancedLayout.gridW > usableW + 1 || balancedLayout.gridH > usableH + 1) {
    throw new Error(
      `expected 4-up balanced collective footprint to fit usable 16:9 viewport, grid=${balancedLayout.gridW}x${balancedLayout.gridH}, usable=${usableW}x${usableH}`,
    )
  }
  const activeCells = balancedLayout.cells.slice(0, 4)
  const center = activeCells.reduce(
    (acc, cell) => ({ x: acc.x + (cell.left + panelW / 2), y: acc.y + (cell.top + panelH / 2) }),
    { x: 0, y: 0 },
  )
  const centroid = { x: center.x / activeCells.length, y: center.y / activeCells.length }
  const expectedCenter = {
    x: widgetMargins.left + usableW / 2,
    y: widgetMargins.top + usableH / 2,
  }
  if (Math.abs(centroid.x - expectedCenter.x) > 2 || Math.abs(centroid.y - expectedCenter.y) > 2) {
    throw new Error(`expected 4-up balanced collective centroid near ${expectedCenter.x},${expectedCenter.y}, got ${centroid.x},${centroid.y}`)
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

  const followPinnedDense16x9 = computeCollectiveFollowPinnedScale({
    zoomK: 1,
    extent,
    viewportW: 1920,
    viewportH: 1080,
    count: 36,
    baseWidth: 360,
    baseHeight: 520,
  })
  if (!(followPinnedDense16x9 >= 0.28 && followPinnedDense16x9 <= 1)) {
    throw new Error(`expected dense 36-up pinned collective scale to stay within explicit 16:9 bounds, got ${followPinnedDense16x9}`)
  }
  const denseGapPx = computeBalancedSpreadSpacingPx({
    baseGapPx: computeBalancedSpreadBaseGapPx({
      viewportW: 1920,
      viewportH: 1080,
      preset: 'widgetCanvas',
      margins: widgetMargins,
    }),
    zoomK: 1,
    count: 36,
  })
  const denseFrontmatterGapPx = computeBalancedSpreadSpacingPx({
    baseGapPx: computeBalancedSpreadBaseGapPx({
      viewportW: 1920,
      viewportH: 1080,
      preset: 'widgetFrontmatter',
      margins: computeBalancedSpreadViewportMargins({
        viewportW: 1920,
        viewportH: 1080,
        preset: 'widgetFrontmatter',
      }),
    }),
    zoomK: 1,
    count: 36,
    preset: 'widgetFrontmatter',
  })
  if (!(denseFrontmatterGapPx > denseGapPx)) {
    throw new Error(`expected dense frontmatter widget spacing to exceed generic widget-canvas spacing, got frontmatter=${denseFrontmatterGapPx} canvas=${denseGapPx}`)
  }
  const densePanelW = 360 * followPinnedDense16x9
  const densePanelH = 520 * followPinnedDense16x9
  const denseLayout = computeBalancedSpreadLayout({
    count: 36,
    viewportW: 1920,
    viewportH: 1080,
    cellW: densePanelW + denseGapPx,
    cellH: densePanelH + denseGapPx,
    gapPx: denseGapPx,
    zoomK: 1,
    marginLeftPx: widgetMargins.left,
    marginRightPx: widgetMargins.right,
    marginTopPx: widgetMargins.top,
    marginBottomPx: widgetMargins.bottom,
  })
  if (denseLayout.gridW > usableW + 1 || denseLayout.gridH > usableH + 1) {
    throw new Error(
      `expected dense 36-up balanced collective footprint to fit usable 16:9 viewport, grid=${denseLayout.gridW}x${denseLayout.gridH}, usable=${usableW}x${usableH}`,
    )
  }
}

export function testFrontmatterLiveCollectiveScaleHonorsConfiguredMinimum() {
  const scale = computeCollectiveFollowPinnedScale({
    zoomK: 0.08,
    viewportW: 943,
    viewportH: 998,
    count: 36,
    baseWidth: 360,
    baseHeight: 520,
    hardMinScale: COLLECTIVE_OVERLAY_SCALE_LIMITS_16X9.widget.min,
    hardMaxScale: COLLECTIVE_OVERLAY_SCALE_LIMITS_16X9.widget.max,
    viewportPreset: 'widgetFrontmatter',
    fitToViewport: false,
  })
  const scaled = computeWidgetScaledSize(scale)

  if (scale < COLLECTIVE_OVERLAY_SCALE_LIMITS_16X9.widget.min) {
    throw new Error(`expected frontmatter live collective scale to honor configured minimum, got ${scale}`)
  }
  if (scaled.width < 96) {
    throw new Error(`expected Source Files frontmatter widgets to remain readable instead of collapsing to tiny cards, got width=${scaled.width}`)
  }
}

export function testBalancedSpreadPrefersWide16x9CollectiveLayout() {
  const fourUp = computeBalancedSpreadGrid({
    count: 4,
    viewportW: 1920,
    viewportH: 1080,
    cellW: 360,
    cellH: 420,
    zoomK: 1,
  })
  if (!(fourUp.cols === 2 && fourUp.rows === 2)) {
    throw new Error(`expected 4-up 16:9 collective layout to stay balanced at 2x2, got ${fourUp.cols}x${fourUp.rows}`)
  }

  const sixUp = computeBalancedSpreadGrid({
    count: 6,
    viewportW: 1920,
    viewportH: 1080,
    cellW: 320,
    cellH: 420,
    zoomK: 1,
  })
  if (!(sixUp.cols === 3 && sixUp.rows === 2)) {
    throw new Error(`expected 6-up 16:9 collective layout to stay balanced at 3x2, got ${sixUp.cols}x${sixUp.rows}`)
  }

  const elevenUp = computeBalancedSpreadGrid({
    count: 11,
    viewportW: 1920,
    viewportH: 1080,
    cellW: 360,
    cellH: 420,
    zoomK: 1,
  })
  if (!(elevenUp.cols >= 4 && elevenUp.rows <= 3)) {
    throw new Error(`expected dense 11-up 16:9 collective layout to keep a wide multi-column fallback, got ${elevenUp.cols}x${elevenUp.rows}`)
  }

  const twelveUp = computeBalancedSpreadGrid({
    count: 12,
    viewportW: 1920,
    viewportH: 1080,
    cellW: 360,
    cellH: 420,
    zoomK: 1,
  })
  if (!(twelveUp.cols >= 4 && twelveUp.rows <= 3)) {
    throw new Error(`expected dense 12-up 16:9 collective layout to keep a wide multi-column fallback, got ${twelveUp.cols}x${twelveUp.rows}`)
  }

  const mediaMargins = computeBalancedSpreadViewportMargins({
    viewportW: 1920,
    viewportH: 1080,
    preset: 'richMedia',
    minLeftPx: 16,
    minRightPx: 16,
    minTopPx: 16,
    minBottomPx: 16,
  })
  if (!(mediaMargins.left >= 24 && mediaMargins.right >= 24 && mediaMargins.top > mediaMargins.bottom)) {
    throw new Error(`expected rich-media 16:9 margins to stay edge-safe with top emphasis, got ${JSON.stringify(mediaMargins)}`)
  }
}
