import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorOverlayDragHandleStaysLocalWithoutSpace() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'listeners.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('onWindowPointerDownCapture')) {
    throw new Error('expected FlowCanvas to include window pointerdown capture handler')
  }
  if (!text.includes("resolved.kind === 'overlay'")) {
    throw new Error('expected FlowCanvas to detect overlay targets when deciding whether to proxy pan')
  }
  if (!text.includes("const overlayDragHandle = resolved.kind === 'overlay' && resolved.targetEl.closest(CANVAS_OVERLAY_DRAG_HANDLE_SELECTOR)")) {
    throw new Error('expected FlowCanvas to classify overlay drag handles independently from pinned state')
  }
  if (!text.includes("resolved.kind === 'overlay' && !overlayPinnedToNode && overlayDragHandle && button === 0 && spacePanHeld !== true")) {
    throw new Error('expected unpinned Flow Editor overlay drag handles to remain local owner interactions unless Space-pan is explicit')
  }
}
