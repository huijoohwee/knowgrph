import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowCanvasSchedulesRichMediaOverlayOnInteractionFrame() {
  const flowCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const overlaysPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx')
  const flowText = readFileSync(flowCanvasPath, 'utf8')
  const overlaysText = readFileSync(overlaysPath, 'utf8')
  if (!flowText.includes('const handleInteractionFrame')) {
    throw new Error('expected FlowCanvas to define handleInteractionFrame')
  }
  if (!flowText.includes('onInteractionFrame={handleInteractionFrame}')) {
    throw new Error('expected FlowCanvas to forward interaction frames to FlowCanvasMediaOverlays')
  }
  if (!flowText.includes("if (canvas2dRenderer === 'flowEditor') mediaOverlayInteractionFrameSchedulerRef.current?.()")) {
    throw new Error('expected FlowCanvas to schedule rich-media layout from live Flow Editor interaction frames without affecting Flow Canvas')
  }
  if (!flowText.includes('registerInteractionFrameLayoutScheduler={registerMediaOverlayInteractionFrameScheduler}')) {
    throw new Error('expected FlowCanvas to register the Flow Editor rich-media interaction-frame layout scheduler')
  }
  if (!overlaysText.includes('registerInteractionFrameLayoutScheduler?: (scheduler: null | (() => void)) => void')) {
    throw new Error('expected FlowCanvas media overlays to expose an interaction-frame layout scheduler registration hook')
  }
  if (!overlaysText.includes("if (canvas2dRenderer !== 'flowEditor')")) {
    throw new Error('expected rich-media interaction-frame scheduling to stay scoped to Flow Editor')
  }
  if (!overlaysText.includes('mediaOverlayLayoutScheduleRef.current?.()')) {
    throw new Error('expected FlowCanvas media overlays to schedule layout on interaction frames')
  }
}

export function testMediaOverlayLayoutLoopQuantizesAndSkipsNoopBoxWrites() {
  const p = resolve(process.cwd(), 'src', 'lib', 'render', 'mediaOverlayLayoutLoop2d.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('const lastAppliedBoxById = new Map<string, { left: number; top: number; w: number; h: number }>()')) {
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
