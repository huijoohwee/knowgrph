import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testWheelZoomUsesCtrlKeyBoostHelper() {
  const zoomP = resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'zoom.ts')
  const zoomText = readFileSync(zoomP, 'utf8')
  if (!zoomText.includes('computeZoomWheelDeltaYpx')) {
    throw new Error('expected D3 wheel zoom to use computeZoomWheelDeltaYpx helper')
  }

  const flowP = resolve(process.cwd(), 'src', 'lib', 'canvas', 'infinite-canvas-engine', 'controller.ts')
  const flowText = readFileSync(flowP, 'utf8')
  if (!flowText.includes('computeZoomWheelDeltaYpx')) {
    throw new Error('expected Flow wheel zoom to use computeZoomWheelDeltaYpx helper')
  }
}
