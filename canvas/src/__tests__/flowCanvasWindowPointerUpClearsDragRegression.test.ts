import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowCanvasWindowPointerUpCaptureCanEndActiveDrag() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'listeners.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('onWindowPointerUpCapture')) {
    throw new Error('expected FlowCanvas to install a window pointerup capture handler')
  }
  if (!text.includes('const drag = ctx.args.dragRef.current')) {
    throw new Error('expected FlowCanvas window pointerup handler to consult active drag state')
  }
  if (!text.includes('handlePointerUpOnce')) {
    throw new Error('expected FlowCanvas window pointerup handler to end drag via a deduped handler')
  }
}
