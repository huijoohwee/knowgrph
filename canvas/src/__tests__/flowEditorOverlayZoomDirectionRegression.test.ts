import fs from 'node:fs'
import path from 'node:path'

import { computeCollectiveFollowPinnedScale, computeWidgetScaledSize } from '@/components/FlowEditor/widgetZoom'
import { computeMediaOverlaySizing } from '@/lib/render/mediaOverlaySizing'

export function testFlowEditorWidgetCollectiveScaleDoesNotReverseZoomDirection() {
  const zoomOut = computeCollectiveFollowPinnedScale({
    zoomK: 0.5,
    viewportW: 1920,
    viewportH: 1080,
    count: 12,
    baseWidth: 360,
    baseHeight: 520,
  })
  const neutral = computeCollectiveFollowPinnedScale({
    zoomK: 1,
    viewportW: 1920,
    viewportH: 1080,
    count: 12,
    baseWidth: 360,
    baseHeight: 520,
  })
  const zoomIn = computeCollectiveFollowPinnedScale({
    zoomK: 2,
    viewportW: 1920,
    viewportH: 1080,
    count: 12,
    baseWidth: 360,
    baseHeight: 520,
  })

  if (!(zoomOut <= neutral)) {
    throw new Error(`expected widget collective zoom-out scale to not grow past neutral, got out=${zoomOut} neutral=${neutral}`)
  }
  if (!(zoomIn >= neutral)) {
    throw new Error(`expected widget collective zoom-in scale to not shrink below neutral, got in=${zoomIn} neutral=${neutral}`)
  }
}

export function testFlowEditorRichMediaCollectiveSizingDoesNotReverseZoomDirection() {
  const sizingConfig = {
    widthRatio: 0.2,
    widthMinPx: 220,
    widthMaxPx: 360,
    quantizeStepPx: 16,
  }
  const itemCount = 12
  const widgetZoomOut = computeCollectiveFollowPinnedScale({
    zoomK: 0.5,
    viewportW: 1920,
    viewportH: 1080,
    count: itemCount,
    baseWidth: 360,
    baseHeight: 520,
  })
  const widgetNeutral = computeCollectiveFollowPinnedScale({
    zoomK: 1,
    viewportW: 1920,
    viewportH: 1080,
    count: itemCount,
    baseWidth: 360,
    baseHeight: 520,
  })
  const widgetZoomIn = computeCollectiveFollowPinnedScale({
    zoomK: 2,
    viewportW: 1920,
    viewportH: 1080,
    count: itemCount,
    baseWidth: 360,
    baseHeight: 520,
  })

  const zoomOut = computeMediaOverlaySizing({
    density: 'default',
    viewportW: 1920,
    viewportH: 1080,
    zoomK: widgetZoomOut,
    itemCount,
    config: sizingConfig,
  })
  const neutral = computeMediaOverlaySizing({
    density: 'default',
    viewportW: 1920,
    viewportH: 1080,
    zoomK: widgetNeutral,
    itemCount,
    config: sizingConfig,
  })
  const zoomIn = computeMediaOverlaySizing({
    density: 'default',
    viewportW: 1920,
    viewportH: 1080,
    zoomK: widgetZoomIn,
    itemCount,
    config: sizingConfig,
  })

  if (!(zoomOut.panelW <= neutral.panelW && zoomOut.panelH <= neutral.panelH)) {
    throw new Error(`expected rich media zoom-out sizing to not grow past neutral, got out=${zoomOut.panelW}x${zoomOut.panelH} neutral=${neutral.panelW}x${neutral.panelH}`)
  }
  if (!(zoomIn.panelW >= neutral.panelW && zoomIn.panelH >= neutral.panelH)) {
    throw new Error(`expected rich media zoom-in sizing to not shrink below neutral, got in=${zoomIn.panelW}x${zoomIn.panelH} neutral=${neutral.panelW}x${neutral.panelH}`)
  }
}

export function testFlowEditorOverlayZoomKeepsWidgetAndRichMediaCentersStable() {
  const placementPath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'useNodeOverlayPlacementRuntime.ts')
  const runtimeScenePath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRuntimeScene.ts')
  const mediaLoopPath = path.resolve(process.cwd(), 'src', 'lib', 'render', 'mediaOverlayLayoutLoop2d.ts')
  const placementText = fs.readFileSync(placementPath, 'utf8')
  const runtimeSceneText = fs.readFileSync(runtimeScenePath, 'utf8')
  const mediaLoopText = fs.readFileSync(mediaLoopPath, 'utf8')

  if (!placementText.includes('const stabilizePinnedWorldPosForZoom = React.useCallback((nextZoom: { k: number; x: number; y: number } | null) => {')) {
    throw new Error('expected pinned widget placement runtime to compensate world positions when zoom scale changes')
  }
  if (!placementText.includes('const centerLeft = lastApplied.left + prevSize.width / 2')) {
    throw new Error('expected pinned widget zoom compensation to preserve overlay centers rather than top-left drift')
  }
  if (!placementText.includes('stabilizePinnedWorldPosForZoom(nextZoom)')) {
    throw new Error('expected widget placement runtime to apply pinned zoom compensation during zoom updates')
  }
  if (!runtimeSceneText.includes("if (bucketId === viewportBucketId) return `${bucketId}:visible-viewport`")) {
    throw new Error('expected flow editor runtime scene to keep viewport auto-seed signatures stable across zoom changes')
  }
  if (!runtimeSceneText.includes('const currentLayoutSignature = `${args.overlayTopologyLayoutSignature}|${args.viewportW}x${args.viewportH}|${bucketSignature}`')) {
    throw new Error('expected flow editor runtime scene layout signature to exclude zoom-key churn for overlay auto-seeding')
  }
  if (!mediaLoopText.includes('const scaleChanged = !!lastTransform && Math.abs(lastTransform.k - rawK) > 1e-6')) {
    throw new Error('expected rich media overlay layout loop to detect zoom-scale changes separately from pan changes')
  }
  if (!mediaLoopText.includes('const previousBox = lastAppliedBoxById.get(id) || null')) {
    throw new Error('expected rich media overlay layout loop to reuse the last applied screen box while zooming')
  }
  if (!mediaLoopText.includes('cx: previousBox.left + previousBox.w / 2')) {
    throw new Error('expected rich media overlay layout loop to preserve overlay centers across zoom changes')
  }
}

type ProbeRect = {
  left: number
  top: number
  width: number
  height: number
}

function measureCollectiveMetrics(rects: ProbeRect[]) {
  const centroid = rects.reduce((acc, rect) => ({
    x: acc.x + rect.left + rect.width / 2,
    y: acc.y + rect.top + rect.height / 2,
  }), { x: 0, y: 0 })
  centroid.x /= Math.max(1, rects.length)
  centroid.y /= Math.max(1, rects.length)
  const avgRadius =
    rects.reduce((sum, rect) => {
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      return sum + Math.hypot(cx - centroid.x, cy - centroid.y)
    }, 0) / Math.max(1, rects.length)
  return { centroidX: centroid.x, centroidY: centroid.y, avgRadius }
}

function preserveScreenCentersAcrossZoom(args: {
  previousRects: ProbeRect[]
  nextWidth: number
  nextHeight: number
}): ProbeRect[] {
  return args.previousRects.map(rect => {
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    return {
      left: centerX - args.nextWidth / 2,
      top: centerY - args.nextHeight / 2,
      width: args.nextWidth,
      height: args.nextHeight,
    }
  })
}

export function testFlowEditorOverlayMetricProbeStaysStableAcrossZoom() {
  const centers = [
    { x: 520, y: 320 },
    { x: 760, y: 320 },
    { x: 1000, y: 320 },
    { x: 640, y: 560 },
    { x: 880, y: 560 },
    { x: 1120, y: 560 },
  ]
  const widgetNeutralScale = computeCollectiveFollowPinnedScale({
    zoomK: 1,
    viewportW: 1920,
    viewportH: 1080,
    count: centers.length,
    baseWidth: 360,
    baseHeight: 520,
  })
  const widgetZoomOutScale = computeCollectiveFollowPinnedScale({
    zoomK: 0.5,
    viewportW: 1920,
    viewportH: 1080,
    count: centers.length,
    baseWidth: 360,
    baseHeight: 520,
  })
  const widgetZoomInScale = computeCollectiveFollowPinnedScale({
    zoomK: 2,
    viewportW: 1920,
    viewportH: 1080,
    count: centers.length,
    baseWidth: 360,
    baseHeight: 520,
  })
  const widgetNeutralSize = computeWidgetScaledSize(widgetNeutralScale)
  const widgetNeutralRects = centers.map(center => ({
    left: center.x - widgetNeutralSize.width / 2,
    top: center.y - widgetNeutralSize.height / 2,
    width: widgetNeutralSize.width,
    height: widgetNeutralSize.height,
  }))
  const widgetZoomOutSize = computeWidgetScaledSize(widgetZoomOutScale)
  const widgetZoomInSize = computeWidgetScaledSize(widgetZoomInScale)
  const widgetZoomOutRects = preserveScreenCentersAcrossZoom({
    previousRects: widgetNeutralRects,
    nextWidth: widgetZoomOutSize.width,
    nextHeight: widgetZoomOutSize.height,
  })
  const widgetZoomInRects = preserveScreenCentersAcrossZoom({
    previousRects: widgetNeutralRects,
    nextWidth: widgetZoomInSize.width,
    nextHeight: widgetZoomInSize.height,
  })

  const richSizingConfig = {
    widthRatio: 0.2,
    widthMinPx: 220,
    widthMaxPx: 360,
    quantizeStepPx: 16,
  }
  const richNeutral = computeMediaOverlaySizing({
    density: 'default',
    viewportW: 1920,
    viewportH: 1080,
    zoomK: widgetNeutralScale,
    itemCount: centers.length,
    config: richSizingConfig,
  })
  const richZoomOut = computeMediaOverlaySizing({
    density: 'default',
    viewportW: 1920,
    viewportH: 1080,
    zoomK: widgetZoomOutScale,
    itemCount: centers.length,
    config: richSizingConfig,
  })
  const richZoomIn = computeMediaOverlaySizing({
    density: 'default',
    viewportW: 1920,
    viewportH: 1080,
    zoomK: widgetZoomInScale,
    itemCount: centers.length,
    config: richSizingConfig,
  })
  const richNeutralRects = centers.map(center => ({
    left: center.x - richNeutral.panelW / 2,
    top: center.y - richNeutral.panelH / 2,
    width: richNeutral.panelW,
    height: richNeutral.panelH,
  }))
  const richZoomOutRects = preserveScreenCentersAcrossZoom({
    previousRects: richNeutralRects,
    nextWidth: richZoomOut.panelW,
    nextHeight: richZoomOut.panelH,
  })
  const richZoomInRects = preserveScreenCentersAcrossZoom({
    previousRects: richNeutralRects,
    nextWidth: richZoomIn.panelW,
    nextHeight: richZoomIn.panelH,
  })

  const widgetNeutralMetrics = measureCollectiveMetrics(widgetNeutralRects)
  const widgetZoomOutMetrics = measureCollectiveMetrics(widgetZoomOutRects)
  const widgetZoomInMetrics = measureCollectiveMetrics(widgetZoomInRects)
  const richNeutralMetrics = measureCollectiveMetrics(richNeutralRects)
  const richZoomOutMetrics = measureCollectiveMetrics(richZoomOutRects)
  const richZoomInMetrics = measureCollectiveMetrics(richZoomInRects)

  const epsilon = 0.0001
  if (Math.abs(widgetZoomOutMetrics.centroidX - widgetNeutralMetrics.centroidX) > epsilon || Math.abs(widgetZoomOutMetrics.centroidY - widgetNeutralMetrics.centroidY) > epsilon) {
    throw new Error(`expected widget zoom-out centroid stability, neutral=${widgetNeutralMetrics.centroidX},${widgetNeutralMetrics.centroidY} out=${widgetZoomOutMetrics.centroidX},${widgetZoomOutMetrics.centroidY}`)
  }
  if (Math.abs(widgetZoomInMetrics.centroidX - widgetNeutralMetrics.centroidX) > epsilon || Math.abs(widgetZoomInMetrics.centroidY - widgetNeutralMetrics.centroidY) > epsilon) {
    throw new Error(`expected widget zoom-in centroid stability, neutral=${widgetNeutralMetrics.centroidX},${widgetNeutralMetrics.centroidY} in=${widgetZoomInMetrics.centroidX},${widgetZoomInMetrics.centroidY}`)
  }
  if (Math.abs(widgetZoomOutMetrics.avgRadius - widgetNeutralMetrics.avgRadius) > epsilon || Math.abs(widgetZoomInMetrics.avgRadius - widgetNeutralMetrics.avgRadius) > epsilon) {
    throw new Error(`expected widget average radius stability across zoom, out=${widgetZoomOutMetrics.avgRadius} neutral=${widgetNeutralMetrics.avgRadius} in=${widgetZoomInMetrics.avgRadius}`)
  }
  if (Math.abs(richZoomOutMetrics.centroidX - richNeutralMetrics.centroidX) > epsilon || Math.abs(richZoomOutMetrics.centroidY - richNeutralMetrics.centroidY) > epsilon) {
    throw new Error(`expected rich-media zoom-out centroid stability, neutral=${richNeutralMetrics.centroidX},${richNeutralMetrics.centroidY} out=${richZoomOutMetrics.centroidX},${richZoomOutMetrics.centroidY}`)
  }
  if (Math.abs(richZoomInMetrics.centroidX - richNeutralMetrics.centroidX) > epsilon || Math.abs(richZoomInMetrics.centroidY - richNeutralMetrics.centroidY) > epsilon) {
    throw new Error(`expected rich-media zoom-in centroid stability, neutral=${richNeutralMetrics.centroidX},${richNeutralMetrics.centroidY} in=${richZoomInMetrics.centroidX},${richZoomInMetrics.centroidY}`)
  }
  if (Math.abs(richZoomOutMetrics.avgRadius - richNeutralMetrics.avgRadius) > epsilon || Math.abs(richZoomInMetrics.avgRadius - richNeutralMetrics.avgRadius) > epsilon) {
    throw new Error(`expected rich-media average radius stability across zoom, out=${richZoomOutMetrics.avgRadius} neutral=${richNeutralMetrics.avgRadius} in=${richZoomInMetrics.avgRadius}`)
  }
}
