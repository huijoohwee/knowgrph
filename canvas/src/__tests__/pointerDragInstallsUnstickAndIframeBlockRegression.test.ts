import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'

export async function testPointerDragInstallsUnstickAndTogglesIframeBlockClass() {
  const g: any = globalThis as any
  delete g.__kgPointerDragUnstickInstalled
  delete g.__kgActivePointerDragByKey

  const bootstrap = initJsdomHarness('<!doctype html><html><body><section id="t"></section></body></html>')
  try {
    const el = bootstrap.dom.window.document.getElementById('t') as unknown as Element
    const ev = {
      target: el,
      pointerId: 123,
      clientX: 1,
      clientY: 2,
      buttons: 1,
      preventDefault: () => void 0,
      stopPropagation: () => void 0,
      composedPath: () => [el],
    } as unknown as PointerEvent

    startPointerDrag({
      ev,
      cursor: 'grabbing',
      shouldStart: () => true,
      onMove: () => void 0,
      onCancel: () => void 0,
      onEnd: () => void 0,
    })

    if (g.__kgPointerDragUnstickInstalled !== true) {
      throw new Error('expected pointerDrag to install the global unstick handler')
    }

    const body = bootstrap.dom.window.document.body
    if (!body.classList.contains('kg-pointer-drag-active')) {
      throw new Error('expected pointerDrag to set kg-pointer-drag-active body class during drag')
    }

    const map = g.__kgActivePointerDragByKey as Map<string, () => void>
    const cleanup = map.get('pid:123')
    if (typeof cleanup !== 'function') throw new Error('expected active pointer drag cleanup to be registered')
    cleanup()

    if (body.classList.contains('kg-pointer-drag-active')) {
      throw new Error('expected pointerDrag to clear kg-pointer-drag-active body class after cleanup')
    }
  } finally {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    bootstrap.restore()
  }
}

