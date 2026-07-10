import * as d3 from 'd3'

import {
  buildStoryboardTransformCss,
  resolveStoryboardPaintScale,
} from '@/components/StoryboardCanvas/storyboardInfiniteZoomMetrics'
import { computeBoundedOverlayPaintScale } from '@/lib/canvas/overlayWidgetZoom'
import { projectVectorPaintedOverlayScaleBox, projectVectorPaintedOverlayZoomBox } from '@/lib/canvas/vectorPaintedOverlayProjection'
import { computeStoryboardWidgetOverlayScreenBox } from '@/lib/storyboardWidget/overlayWorldDrag'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export function testStoryboardCanvasPaintScaleBoundsD3ZoomInterference() {
  const zoomOutScale = resolveStoryboardPaintScale(0.44)
  const neutralScale = resolveStoryboardPaintScale(0.98)
  const zoomInScale = resolveStoryboardPaintScale(1.48)
  const sharedZoomOutScale = computeBoundedOverlayPaintScale(0.44)

  assert(zoomOutScale > 0.44, `expected Storyboard paint scale to avoid raw zoom-out collapse, got ${zoomOutScale}`)
  assert(zoomOutScale === sharedZoomOutScale, `expected Storyboard canvas to reuse shared bounded overlay paint scale, got storyboard=${zoomOutScale} shared=${sharedZoomOutScale}`)
  assert(zoomOutScale >= 0.8, `expected Storyboard paint scale to keep cards readable near 44%, got ${zoomOutScale}`)
  assert(neutralScale >= 0.9 && neutralScale <= 1.05, `expected Storyboard neutral paint scale near 100%, got ${neutralScale}`)
  assert(zoomInScale < 1.48, `expected Storyboard paint scale to avoid raw zoom-in expansion, got ${zoomInScale}`)
  assert(zoomInScale <= 1.12, `expected Storyboard paint scale to keep zoom-in cards bounded near 148%, got ${zoomInScale}`)

  const zoomOutCss = buildStoryboardTransformCss(d3.zoomIdentity.translate(100, 48).scale(0.44))
  const zoomInCss = buildStoryboardTransformCss(d3.zoomIdentity.translate(876, 195).scale(1.48))
  assert(zoomOutCss.includes(`scale(${zoomOutScale})`), `expected zoom-out CSS to use bounded paint scale, got ${zoomOutCss}`)
  assert(zoomInCss.includes(`scale(${zoomInScale})`), `expected zoom-in CSS to use bounded paint scale, got ${zoomInCss}`)
  assert(!zoomOutCss.includes('scale(0.44)'), `expected zoom-out CSS not to paint cards at raw D3 scale, got ${zoomOutCss}`)
  assert(!zoomInCss.includes('scale(1.48)'), `expected zoom-in CSS not to paint cards at raw D3 scale, got ${zoomInCss}`)

  const rawTransform = d3.zoomIdentity.translate(100, 48).scale(0.44)
  const centerWorld = { x: 640, y: 360 }
  const cardSize = { width: 360, height: 220 }
  const rawCenterScreen = {
    x: centerWorld.x * rawTransform.k + rawTransform.x,
    y: centerWorld.y * rawTransform.k + rawTransform.y,
  }
  const box = computeStoryboardWidgetOverlayScreenBox({
    transform: rawTransform,
    centerWorld,
    paintScale: zoomOutScale,
    width: cardSize.width,
    height: cardSize.height,
  })
  const paintedCenterScreen = {
    x: box.left + cardSize.width * box.scale / 2,
    y: box.top + cardSize.height * box.scale / 2,
  }
  assert(Math.abs(paintedCenterScreen.x - rawCenterScreen.x) < 1e-6, `expected bounded paint scale not to move raw card center x, got raw=${rawCenterScreen.x} painted=${paintedCenterScreen.x}`)
  assert(Math.abs(paintedCenterScreen.y - rawCenterScreen.y) < 1e-6, `expected bounded paint scale not to move raw card center y, got raw=${rawCenterScreen.y} painted=${paintedCenterScreen.y}`)
  assert(box.scale === zoomOutScale, `expected card paint box to use bounded paint scale, got ${box.scale}`)

  const anchor = { x: 537, y: 481 }
  const baseBox = { left: 650, top: 340, scale: 1 }
  const centerDistance = (boxLike: { left: number; top: number; scale: number }) => Math.hypot(
    boxLike.left + cardSize.width * boxLike.scale / 2 - anchor.x,
    boxLike.top + cardSize.height * boxLike.scale / 2 - anchor.y,
  )
  const zoomedOutBox = projectVectorPaintedOverlayScaleBox({
    previousBox: baseBox,
    scale: 0.86,
    anchorX: anchor.x,
    anchorY: anchor.y,
    width: cardSize.width,
    height: cardSize.height,
  })
  const zoomedInBox = projectVectorPaintedOverlayScaleBox({
    previousBox: baseBox,
    scale: 1.06,
    anchorX: anchor.x,
    anchorY: anchor.y,
    width: cardSize.width,
    height: cardSize.height,
  })
  assert(centerDistance(zoomedOutBox) < centerDistance(baseBox), 'expected zoom-out collective screen projection to move card centers toward the viewport anchor instead of flying outward')
  assert(centerDistance(zoomedInBox) > centerDistance(baseBox), 'expected zoom-in collective screen projection to move card centers away from the viewport anchor instead of converging inward')

  const lowRawBox = computeStoryboardWidgetOverlayScreenBox({
    transform: d3.zoomIdentity.translate(100, 48).scale(0.44),
    centerWorld,
    paintScale: zoomOutScale,
    width: cardSize.width,
    height: cardSize.height,
  })
  const lowProjected = projectVectorPaintedOverlayZoomBox({
    previousTransform: null,
    currentTransform: d3.zoomIdentity.translate(100, 48).scale(0.44),
    rawBox: lowRawBox,
    anchorX: anchor.x,
    anchorY: anchor.y,
    width: cardSize.width,
    height: cardSize.height,
  }).box
  assert(lowProjected.scale === lowRawBox.scale, 'expected normalized low-zoom projection to preserve bounded paint scale')
  assert(centerDistance(lowProjected) > centerDistance(lowRawBox), 'expected low raw zoom to expand centers into painted layout scale instead of compressing cards under bounded panels')

  const highRawBox = computeStoryboardWidgetOverlayScreenBox({
    transform: d3.zoomIdentity.translate(876, 195).scale(1.48),
    centerWorld,
    paintScale: zoomInScale,
    width: cardSize.width,
    height: cardSize.height,
  })
  const highProjected = projectVectorPaintedOverlayZoomBox({
    previousTransform: null,
    currentTransform: d3.zoomIdentity.translate(876, 195).scale(1.48),
    rawBox: highRawBox,
    anchorX: anchor.x,
    anchorY: anchor.y,
    width: cardSize.width,
    height: cardSize.height,
  }).box
  assert(highProjected.scale === highRawBox.scale, 'expected normalized high-zoom projection to preserve bounded paint scale')
  assert(centerDistance(highProjected) < centerDistance(highRawBox), 'expected capped high raw zoom to contract centers into painted layout scale instead of letting cards diverge from edges')

  const hydrated = projectVectorPaintedOverlayZoomBox({
    previousTransform: null,
    currentTransform: d3.zoomIdentity.translate(420, 160).scale(4),
    previousBox: baseBox,
    rawBox: highRawBox,
    anchorX: anchor.x,
    anchorY: anchor.y,
    width: cardSize.width,
    height: cardSize.height,
  }).box
  assert(hydrated.left === baseBox.left && hydrated.top === baseBox.top && hydrated.scale === baseBox.scale, 'expected fixed-card projection to preserve the painted box when the real transform hydrates after initial render')
}
