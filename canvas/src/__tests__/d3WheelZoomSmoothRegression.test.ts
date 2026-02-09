import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testD3WheelZoomIsContinuousAndUsesSharedWheelFactor() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'zoom.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('computeWheelZoomFactor')) {
    throw new Error('expected D3 wheel zoom to use computeWheelZoomFactor for continuous zooming')
  }
  if (!text.includes('computeFlowWheelZoomDurationMs')) {
    throw new Error('expected D3 wheel zoom to use shared smoothing duration (computeFlowWheelZoomDurationMs)')
  }
  if (!text.includes('resolveWheelAnchor') || !text.includes('coerceWheelFallback')) {
    throw new Error('expected D3 wheel zoom to reuse Flow wheel anchor utils (resolveWheelAnchor/coerceWheelFallback)')
  }
  if (!text.includes('computeWheelZoomFactor(deltaYpx * increment)')) {
    throw new Error('expected D3 wheel zoom to apply increment multiplier at factor stage (like Flow)')
  }
  if (text.includes('applyWheelStepAccumulator') || text.includes('computeSteppedZoomTarget')) {
    throw new Error('expected D3 wheel zoom to avoid discrete step accumulator')
  }
}
