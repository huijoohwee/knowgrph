import fs from 'node:fs'
import path from 'node:path'

import { computeCollectiveFollowPinnedScale, computeCollectiveFollowZoomK, computeWidgetScaledSize } from '@/lib/canvas/overlayWidgetZoom'
import { computeMediaOverlaySizing } from '@/lib/render/mediaOverlaySizing'
import { coerceRichMediaPanelSizePx } from '@/lib/render/richMediaSsot'
import { computeTransformScaleAboutScreenPoint, screenToWorld } from '@/lib/zoom/viewport'

function readSourceFilesUnder(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...readSourceFilesUnder(full))
      continue
    }
    if (/\.[cm]?[tj]sx?$/.test(entry.name)) files.push(full)
  }
  return files
}

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

export function testFlowEditorCollectiveScaleUsesRequestedLayoutAspect() {
  const srcRoot = path.resolve(process.cwd(), 'src')
  const neutralZoomPath = path.join(srcRoot, 'lib', 'canvas', 'overlayWidgetZoom.ts')
  const neutralText = fs.readFileSync(neutralZoomPath, 'utf8')
  const collectiveStart = neutralText.indexOf('export function computeCollectiveFollowPinnedScale')
  if (collectiveStart < 0) {
    throw new Error('expected neutral overlay zoom owner to expose collective scale helper')
  }
  const collectiveBody = neutralText.slice(collectiveStart)
  if (!collectiveBody.includes('width: baseWidth * candidate') || !collectiveBody.includes('height: baseHeight * candidate')) {
    throw new Error('expected collective zoom fit loop to measure the requested base layout size instead of widget-only dimensions')
  }
  if (collectiveBody.includes('const panel = computeWidgetScaledSize(candidate)')) {
    throw new Error('expected collective zoom fit loop to avoid widget-only sizing for rich-media panel collectives')
  }

  const landscapeScale = computeCollectiveFollowPinnedScale({
    zoomK: 1,
    viewportW: 1280,
    viewportH: 720,
    count: 12,
    baseWidth: 320,
    baseHeight: 180,
    hardMinScale: 0.05,
    hardMaxScale: 1,
  })
  const portraitScale = computeCollectiveFollowPinnedScale({
    zoomK: 1,
    viewportW: 1280,
    viewportH: 720,
    count: 12,
    baseWidth: 180,
    baseHeight: 320,
    hardMinScale: 0.05,
    hardMaxScale: 1,
  })
  if (Math.abs(landscapeScale - portraitScale) <= 0.01) {
    throw new Error(`expected collective zoom scale to react to caller-provided layout aspect, got landscape=${landscapeScale} portrait=${portraitScale}`)
  }
}

export function testFlowEditorLiveCollectiveScaleFollowsZoomWithoutViewportFitClamp() {
  const viewport = { viewportW: 909, viewportH: 801, count: 19, baseWidth: 360, baseHeight: 520 }
  const followNeutral = computeCollectiveFollowPinnedScale({
    ...viewport,
    zoomK: 1,
    fitToViewport: false,
  })
  const followZoomIn = computeCollectiveFollowPinnedScale({
    ...viewport,
    zoomK: 1.25,
    fitToViewport: false,
  })
  const fittedZoomIn = computeCollectiveFollowPinnedScale({
    ...viewport,
    zoomK: 1.25,
  })
  if (!(followZoomIn > followNeutral)) {
    throw new Error(`expected Flow Editor live collective scale to grow with zoom, neutral=${followNeutral} zoomIn=${followZoomIn}`)
  }
  if (!(fittedZoomIn <= followZoomIn)) {
    throw new Error(`expected viewport-fit collective scale to remain the fit/reset path, fitted=${fittedZoomIn} follow=${followZoomIn}`)
  }
  const fitBaselineK = 0.18
  const baselineRelative = computeCollectiveFollowPinnedScale({
    ...viewport,
    zoomK: computeCollectiveFollowZoomK({ zoomK: fitBaselineK, baselineZoomK: fitBaselineK }),
    fitToViewport: false,
  })
  const zoomedRelative = computeCollectiveFollowPinnedScale({
    ...viewport,
    zoomK: computeCollectiveFollowZoomK({ zoomK: fitBaselineK * 1.25, baselineZoomK: fitBaselineK }),
    fitToViewport: false,
  })
  if (!(zoomedRelative > baselineRelative)) {
    throw new Error(`expected baseline-normalized Flow Editor zoom to change visible collective scale while native fit k is below 1, baseline=${baselineRelative} zoomed=${zoomedRelative}`)
  }

  const srcRoot = path.resolve(process.cwd(), 'src')
  const placementText = fs.readFileSync(path.join(srcRoot, 'components', 'FlowEditor', 'useNodeOverlayPlacementRuntime.ts'), 'utf8')
  if (!placementText.includes('fitToViewport: false')) {
    throw new Error('expected Flow Editor widget placement to follow zoom instead of fitting every zoom step back into the viewport')
  }
  if (!placementText.includes('computeCollectiveFollowZoomK({')) {
    throw new Error('expected screen-authority Flow Editor widgets to normalize viewport zoom against their live baseline')
  }
  if (placementText.includes('const frontmatterPanelScaleZoomK = frontmatterVisibleViewportAuthority ? 1 : zoomK')) {
    throw new Error('expected Flow Editor widget zoom to avoid stale neutral-scale screen-authority gating')
  }
  const mediaText = fs.readFileSync(path.join(srcRoot, 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx'), 'utf8')
  if (!mediaText.includes("fitToViewport: canvas2dRenderer === 'flowEditor' ? false : undefined")) {
    throw new Error('expected rich-media zoom follow mode to stay scoped to Flow Editor and avoid Flow Canvas seepage')
  }
  if (!mediaText.includes('computeCollectiveFollowZoomK({')) {
    throw new Error('expected rich-media Flow Editor overlays to reuse baseline-normalized zoom follow mode')
  }
}

export function testFlowEditorRichMediaZoomCoercionMaintainsIndividualAspectRatio() {
  const samples = [
    { width: 96, height: 54, viewportW: 640, viewportH: 360 },
    { width: 960, height: 540, viewportW: 640, viewportH: 360 },
    { width: 54, height: 96, viewportW: 640, viewportH: 900 },
  ]
  for (const sample of samples) {
    const targetAspect = sample.width / sample.height
    const coerced = coerceRichMediaPanelSizePx({
      width: sample.width,
      height: sample.height,
      viewportW: sample.viewportW,
      viewportH: sample.viewportH,
      minWidthPx: 220,
      minHeightPx: 160,
    })
    const actualAspect = coerced.width / coerced.height
    if (Math.abs(actualAspect - targetAspect) > 0.01) {
      throw new Error(`expected zoom-bound rich-media panel size to preserve individual aspect, target=${targetAspect} actual=${actualAspect}`)
    }
    if (coerced.width < 220 || coerced.height < 160) {
      throw new Error(`expected rich-media zoom coercion to preserve minimum usable panel size, got ${coerced.width}x${coerced.height}`)
    }
  }
}

export function testFlowEditorZoomInOutUsesVisibleCanvasCenterAsContextualAnchor() {
  const applyZoomPath = path.resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'applyZoomRequestNative.ts')
  const applyZoomText = fs.readFileSync(applyZoomPath, 'utf8')
  for (const snippet of [
    'computeTransformScaleAboutScreenPoint',
    'const isFlowEditorContextualZoomRequest =',
    'focalX: visibleViewport.centerX',
    'focalY: visibleViewport.centerY',
    'const shouldRecenterFlowEditorCollectiveAfterZoom =',
    'const resolved = isFlowEditorFitLikeRequest && flowEditorOverlayFitResolved',
  ]) {
    if (!applyZoomText.includes(snippet)) {
      throw new Error(`expected Flow Editor zoom in/out to use visible canvas center contextual zoom behavior: ${snippet}`)
    }
  }

  const current = { k: 0.8, x: -120, y: 36 }
  const focal = { x: 612, y: 360 }
  const beforeWorld = screenToWorld({ transform: current, sx: focal.x, sy: focal.y })
  const next = computeTransformScaleAboutScreenPoint({
    transform: current,
    focalX: focal.x,
    focalY: focal.y,
    nextK: 1.25,
  })
  const afterWorld = screenToWorld({ transform: next, sx: focal.x, sy: focal.y })
  if (Math.abs(afterWorld.x - beforeWorld.x) > 1e-9 || Math.abs(afterWorld.y - beforeWorld.y) > 1e-9) {
    throw new Error(`expected contextual zoom focal world point to remain stable, before=${JSON.stringify(beforeWorld)} after=${JSON.stringify(afterWorld)}`)
  }
}

export function testRuntimeZoomDispatchDoesNotGate2dZoomOnGeospatialBridge() {
  const dispatchPath = path.resolve(process.cwd(), 'src', 'lib', 'canvas', 'runtimeZoomDispatch.ts')
  const text = fs.readFileSync(dispatchPath, 'utf8')
  const zoomBranch = text.indexOf("if (store.canvasRenderMode === '2d') {\n    store.requestZoom(type)")
  const geospatialRead = text.indexOf('const geospatialEnabled = await readGeospatialModeEnabled()')
  if (zoomBranch < 0 || geospatialRead < 0 || zoomBranch > geospatialRead) {
    throw new Error('expected 2D runtime zoom dispatch to request zoom before awaiting the geospatial bridge')
  }
  const fitBranch = text.indexOf("if (store.canvasRenderMode === '2d') {\n    store.requestZoom('fit', { intent })")
  const fitGeospatialRead = text.indexOf('const geospatialEnabled = await readGeospatialModeEnabled().catch(() => false)', geospatialRead + 1)
  if (fitBranch < 0 || fitGeospatialRead < 0 || fitBranch > fitGeospatialRead) {
    throw new Error('expected 2D runtime fit dispatch to request zoom before awaiting the geospatial bridge')
  }
}

export function testFlowCanvasZoomHelpersStayRendererNeutral() {
  const srcRoot = path.resolve(process.cwd(), 'src')
  const neutralZoomPath = path.join(srcRoot, 'lib', 'canvas', 'overlayWidgetZoom.ts')
  const legacyFlowEditorZoomPath = path.join(srcRoot, 'components', 'FlowEditor', 'widgetZoom.ts')
  const flowCanvasFiles = readSourceFilesUnder(path.join(srcRoot, 'components', 'FlowCanvas'))
  const forbiddenFlowEditorOwners = [
    '@/components/FlowEditor/widgetZoom',
    '@/components/FlowEditor/useNodeOverlayPlacementRuntime',
    'components/FlowEditor/widgetZoom',
    'components/FlowEditor/useNodeOverlayPlacementRuntime',
  ]

  if (!fs.existsSync(neutralZoomPath)) {
    throw new Error('expected overlay zoom sizing to live in the neutral canvas helper owner')
  }
  if (fs.existsSync(legacyFlowEditorZoomPath)) {
    throw new Error('expected legacy Flow Editor widget zoom owner to be removed instead of kept as a renderer alias')
  }

  const neutralText = fs.readFileSync(neutralZoomPath, 'utf8')
  if (!neutralText.includes('export function computeCollectiveFollowPinnedScale') || !neutralText.includes('export function computeWidgetScaledSize')) {
    throw new Error('expected neutral overlay zoom owner to export collective scale and widget size helpers')
  }

  for (const file of flowCanvasFiles) {
    const text = fs.readFileSync(file, 'utf8')
    for (const owner of forbiddenFlowEditorOwners) {
      if (text.includes(owner)) {
        throw new Error(`expected Flow Canvas to avoid Flow Editor overlay owner seepage in ${path.relative(srcRoot, file)}`)
      }
    }
  }

  const flowCanvasZoomUsers = flowCanvasFiles.filter(file => {
    const text = fs.readFileSync(file, 'utf8')
    return text.includes('computeCollectiveFollowPinnedScale') || text.includes('computeWidgetScale') || text.includes('WIDGET_BASE_SIZE')
  })
  if (flowCanvasZoomUsers.length > 0) {
    const nonNeutralUsers = flowCanvasZoomUsers.filter(file => !fs.readFileSync(file, 'utf8').includes('@/lib/canvas/overlayWidgetZoom'))
    if (nonNeutralUsers.length > 0) {
      throw new Error(`expected Flow Canvas zoom helper users to import the neutral canvas owner: ${nonNeutralUsers.map(file => path.relative(srcRoot, file)).join(', ')}`)
    }
  }
}

export function testFlowEditorOverlayZoomKeepsWidgetAndRichMediaCentersStable() {
  const placementPath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'useNodeOverlayPlacementRuntime.ts')
  const runtimeScenePath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRuntimeScene.ts')
  const mediaLoopPath = path.resolve(process.cwd(), 'src', 'lib', 'render', 'mediaOverlayLayoutLoop2d.ts')
  const placementText = fs.readFileSync(placementPath, 'utf8')
  const runtimeSceneText = fs.readFileSync(runtimeScenePath, 'utf8')
  const mediaLoopText = fs.readFileSync(mediaLoopPath, 'utf8')

  if (placementText.includes('stabilizePinnedWorldPosForZoom')
    || placementText.includes('resolvePinnedZoomCenterPreservingPlacement')
    || placementText.includes('liveZoomCenterPreservingPlacement')) {
    throw new Error('expected pinned widget zoom to resize from stable world positions without mutating layout to preserve individual screen centers')
  }
  if (!placementText.includes(': { top: worldPinnedScreen.sy, left: worldPinnedScreen.sx }')) {
    throw new Error('expected pinned widget placement to render directly from stable world positions during zoom')
  }
  if (!runtimeSceneText.includes("if (bucketId === viewportBucketId) return `${bucketId}:visible-viewport`")) {
    throw new Error('expected flow editor runtime scene to keep viewport auto-seed signatures stable across zoom changes')
  }
  if (!runtimeSceneText.includes('const currentLayoutSignature = `${args.overlayTopologyLayoutSignature}|${visibleViewport.left},${visibleViewport.top},${visibleViewport.width}x${visibleViewport.height}|${bucketSignature}`')) {
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
