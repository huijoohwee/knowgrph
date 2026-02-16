import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowCanvasWheelCanRecoverFromStaleDrag() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'bindNativeInteractions.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('cancelActiveDragIfStale')) {
    throw new Error('expected FlowCanvas to include stale-drag recovery helper')
  }
  if (!text.includes('if (cancelActiveDragIfStale(drag))')) {
    throw new Error('expected wheel handling to cancel stale drag and retry')
  }
}

