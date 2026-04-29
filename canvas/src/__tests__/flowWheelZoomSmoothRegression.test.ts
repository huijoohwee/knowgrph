import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowWheelZoomUsesSmoothFactorNotDiscreteSteps() {
  const p = resolve(process.cwd(), 'src', 'lib', 'canvas', 'infinite-canvas-engine', 'controller.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('computeWheelZoomFactor')) {
    throw new Error('expected Flow wheel zoom to use computeWheelZoomFactor for smooth zooming')
  }
  if (text.includes('applyWheelStepAccumulator') || text.includes('computeSteppedZoomTarget')) {
    throw new Error('expected Flow wheel zoom to avoid discrete step accumulator')
  }
  if (!text.includes('resolveScaleExtentForInteractiveZoom')) {
    throw new Error('expected Flow wheel zoom to reuse shared interactive scale-extent expansion at zoom bounds')
  }
}
