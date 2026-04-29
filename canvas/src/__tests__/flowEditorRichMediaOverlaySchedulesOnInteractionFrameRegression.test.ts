import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowCanvasSchedulesRichMediaOverlayOnInteractionFrame() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('const handleInteractionFrame')) {
    throw new Error('expected FlowCanvas to define handleInteractionFrame')
  }
  if (!text.includes('mediaOverlayLayoutScheduleRef.current?.()')) {
    throw new Error('expected FlowCanvas interaction frames to schedule media overlay layout')
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
