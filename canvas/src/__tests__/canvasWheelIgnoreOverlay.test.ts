import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { shouldIgnoreCanvasWheelEvent } from '@/lib/canvas/wheel-target-guard'
import { UI_SELECTORS } from '@/lib/config'

export async function testCanvasWheelIgnoreOverlayPreventsZoom() {
  const { dom, restore } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const canvas = doc.createElement('canvas')
    doc.body.appendChild(canvas)

    const overlay = doc.createElement('aside')
    overlay.setAttribute('data-kg-canvas-wheel-ignore', 'true')
    doc.body.appendChild(overlay)

    ;(overlay as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200 } as DOMRect)

    ;(canvas as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 } as DOMRect)

    ;(doc as unknown as { elementFromPoint?: (x: number, y: number) => Element | null }).elementFromPoint = () => canvas

    const event = new dom.window.WheelEvent('wheel', { clientX: 100, clientY: 100, deltaY: 10 })
    const ignored = shouldIgnoreCanvasWheelEvent({ event: event as unknown as WheelEvent, ignoreSelector: UI_SELECTORS.canvasWheelIgnore })
    if (ignored !== true) throw new Error('expected wheel guard to ignore overlay region')

    const event2 = new dom.window.WheelEvent('wheel', { clientX: 500, clientY: 500, deltaY: 10 })
    const ignored2 = shouldIgnoreCanvasWheelEvent({ event: event2 as unknown as WheelEvent, ignoreSelector: UI_SELECTORS.canvasWheelIgnore })
    if (ignored2 !== false) throw new Error('expected wheel guard to allow wheel outside overlay region')
  } finally {
    restore()
  }
}

