import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorOverlayDragDoesNotStartCanvasPanProxyWithoutSpace() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'listeners.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('onWindowPointerDownCapture')) {
    throw new Error('expected FlowCanvas to include window pointerdown capture handler')
  }
  if (!text.includes("resolved.kind === 'overlay'")) {
    throw new Error('expected FlowCanvas to detect overlay targets when deciding whether to proxy pan')
  }
  if (!text.includes('spacePanHeld !== true')) {
    throw new Error('expected FlowCanvas to require Space-pan when starting pan from overlay targets')
  }
}
