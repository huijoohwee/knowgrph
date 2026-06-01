import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorNodeOverlayEditorUsesRafLatestSchedulerForDrags() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'useNodeOverlayDragHandlers.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('createRafLatestScheduler')) {
    throw new Error('expected NodeOverlayEditor to use createRafLatestScheduler for drag throttling')
  }
  if (text.includes('requestAnimationFrame(flush)')) {
    throw new Error('expected NodeOverlayEditor drags to avoid manual requestAnimationFrame(flush) patterns')
  }
}
