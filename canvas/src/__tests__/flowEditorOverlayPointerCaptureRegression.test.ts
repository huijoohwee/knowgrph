import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorOverlayDoesNotFreezePanOrZoomAfterOverlayDrag() {
  const interactions = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'bindNativeInteractions.ts')
  const text = readFileSync(interactions, 'utf8')
  if (!text.includes('lostpointercapture')) {
    throw new Error('expected FlowCanvas interactions to clear drag state on lostpointercapture')
  }
  if (!text.includes('buttons === 0')) {
    throw new Error('expected FlowCanvas interactions to clear stuck drags when buttons===0')
  }
  if (!text.includes('hasPointerCapture') || !text.includes('releasePointerCapture')) {
    throw new Error('expected FlowCanvas interactions to release pointer capture on cleanup')
  }
}
