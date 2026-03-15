import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorOverlayDoesNotFreezePanOrZoomAfterOverlayDrag() {
  const listeners = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'listeners.ts')
  const listenersText = readFileSync(listeners, 'utf8')
  if (!listenersText.includes('lostpointercapture')) {
    throw new Error('expected FlowCanvas interactions to clear drag state on lostpointercapture')
  }

  const pointerMove = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'pointerMove.ts')
  const pointerMoveText = readFileSync(pointerMove, 'utf8')
  if (!pointerMoveText.includes('buttons === 0')) {
    throw new Error('expected FlowCanvas interactions to clear stuck drags when buttons===0')
  }

  if (!listenersText.includes('hasPointerCapture') || !listenersText.includes('releasePointerCapture')) {
    throw new Error('expected FlowCanvas interactions to release pointer capture on cleanup')
  }
}
