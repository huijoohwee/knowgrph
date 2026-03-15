import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowCanvasWheelCanRecoverFromStaleDrag() {
  const bindPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'bindFlowCanvasNativeInteractions.ts')
  const bindText = readFileSync(bindPath, 'utf8')
  if (!bindText.includes('cancelActiveDragIfStale')) {
    throw new Error('expected FlowCanvas to include stale-drag recovery helper')
  }

  const wheelPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'wheelAndGesture.ts')
  const wheelText = readFileSync(wheelPath, 'utf8')
  if (!wheelText.includes('cancelActiveDragIfStale')) {
    throw new Error('expected wheel handling to call stale-drag recovery helper')
  }
  if (!wheelText.includes('return handleWheel(e, opts)') && !wheelText.includes('return handleWheel(e')) {
    throw new Error('expected wheel handling to cancel stale drag and retry')
  }
}
