import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowCanvasSchedulesRichMediaOverlayOnInteractionFrame() {
  const flowCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const overlaysPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx')
  const proxyPath = resolve(process.cwd(), 'src', 'lib', 'canvas', 'storyboard-widget-overlay-proxy.ts')
  const flowText = readFileSync(flowCanvasPath, 'utf8')
  const overlaysText = readFileSync(overlaysPath, 'utf8')
  const proxyText = readFileSync(proxyPath, 'utf8')
  if (!flowText.includes('const handleInteractionFrame')) {
    throw new Error('expected FlowCanvas to define handleInteractionFrame')
  }
  if (!flowText.includes('onInteractionFrame={handleInteractionFrame}')) {
    throw new Error('expected FlowCanvas to forward interaction frames to FlowCanvasMediaOverlays')
  }
  if (!flowText.includes('if (storyboardWidgetMode) mediaOverlayInteractionFrameSchedulerRef.current?.()')) {
    throw new Error('expected FlowCanvas to schedule rich-media layout from live Storyboard Widget shared surface interaction frames without affecting Flow Canvas')
  }
  if (!flowText.includes('registerInteractionFrameLayoutScheduler={registerMediaOverlayInteractionFrameScheduler}')) {
    throw new Error('expected FlowCanvas to register the Storyboard Widget rich-media interaction-frame layout scheduler')
  }
  if (!overlaysText.includes('registerInteractionFrameLayoutScheduler?: (scheduler: null | (() => void)) => void')) {
    throw new Error('expected FlowCanvas media overlays to expose an interaction-frame layout scheduler registration hook')
  }
  if (!overlaysText.includes('if (!storyboardWidgetSurfaceRendererMode)')) {
    throw new Error('expected rich-media interaction-frame scheduling to stay scoped to Storyboard Widget shared surfaces')
  }
  if (!overlaysText.includes('mediaOverlayLayoutFlushRef.current?.()')) {
    throw new Error('expected FlowCanvas media overlays to flush layout before edge geometry reads the interaction frame')
  }
  if (!overlaysText.includes('const flushMediaOverlayLayout = React.useCallback(() => {')
    || !overlaysText.includes('mediaOverlayLayoutScheduleRef.current?.()\n    mediaOverlayLayoutFlushRef.current?.()')) {
    throw new Error('expected applied Rich Media motion to update DOM layout without emitting a duplicate trailing edge frame')
  }
  if (!overlaysText.includes('mediaOverlayLayoutFlushRef.current = loop.flush')) {
    throw new Error('expected Rich Media interaction frames to reuse the shared layout-loop flush owner')
  }
  if (!overlaysText.includes('if (mediaOverlayLayoutFlushRef.current === loop.flush) mediaOverlayLayoutFlushRef.current = null')) {
    throw new Error('expected Rich Media interaction-frame flush ownership to release with its layout loop')
  }
  if (!overlaysText.includes('mediaOverlayLayoutFlushRef.current?.()\n    emitStoryboardWidgetGeometryCommitted()')) {
    throw new Error('expected Rich Media to publish committed DOM geometry only after its shared layout flush')
  }
  if (!proxyText.includes('export function emitStoryboardWidgetGeometryCommitted(): void')
    || !proxyText.includes('STORYBOARD_WIDGET_GEOMETRY_COMMITTED_EVENT')) {
    throw new Error('expected Card, Widget, and Rich Media to share one committed-geometry signal')
  }
  if (!overlaysText.includes("loop: storyboardRichMediaWorldTransformProjectionMode ? 'always' : 'onDemand'")) {
    throw new Error('expected every Storyboard Rich Media projection mode to resize on the same animation-frame cadence as Card overlays while zooming')
  }
}

export function testMediaOverlayLayoutLoopExposesSynchronousInteractionFlush() {
  const loopPath = resolve(process.cwd(), 'src', 'lib', 'render', 'mediaOverlayLayoutLoop2d.ts')
  const loopText = readFileSync(loopPath, 'utf8')
  if (!loopText.includes('flush: () => void')) {
    throw new Error('expected the shared media layout loop contract to expose synchronous interaction flushing')
  }
  if (!loopText.includes('if (rafOnce != null) cancelAnimationFrame(rafOnce)') || !loopText.includes('rafOnce = null\n    update()')) {
    throw new Error('expected synchronous media layout flush to consume the pending frame before applying current geometry')
  }
}

export function testMediaOverlayLayoutLoopQuantizesAndSkipsNoopBoxWrites() {
  const p = resolve(process.cwd(), 'src', 'lib', 'render', 'mediaOverlayLayoutLoop2d.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('const lastAppliedBoxById = new Map<string, { left: number; top: number; w: number; h: number; scale?: number }>()')) {
    throw new Error('expected media overlay layout loop to keep last-applied panel boxes for no-op write suppression')
  }
  if (!text.includes('const quantizePanelPos = (v: number) => {')) {
    throw new Error('expected media overlay layout loop to quantize panel positions and reduce sub-pixel motion churn')
  }
  if (!text.includes('const boxChanged = !prevBox')) {
    throw new Error('expected media overlay layout loop to gate applyPanelBox behind box change checks')
  }
  if (!text.includes('if (boxChanged) {')) {
    throw new Error('expected media overlay layout loop to skip repeated applyPanelBox writes when box state is unchanged')
  }
}
