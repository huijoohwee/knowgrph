import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { readCanvasLocalPoint } from '@/lib/canvas/canvas-event-coords'

export async function testCanvasEventCoordsPrefersOffsetXY() {
  const { dom, restore } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const canvas = doc.createElement('canvas')
    doc.body.appendChild(canvas)

    Object.defineProperty(canvas, 'clientWidth', { value: 800 })
    Object.defineProperty(canvas, 'clientHeight', { value: 600 })

    ;(canvas as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () => {
      throw new Error('unexpected rect read')
    }

    const p = readCanvasLocalPoint({ canvasEl: canvas, event: { offsetX: 10, offsetY: 20, target: canvas } })
    if (!p) throw new Error('expected local point')
    if (p.sx !== 10 || p.sy !== 20) throw new Error(`unexpected sx/sy ${p.sx},${p.sy}`)
    if (p.inBounds !== true) throw new Error('expected inBounds')
  } finally {
    restore()
  }
}

export async function testCanvasEventCoordsFallsBackToClientRect() {
  const { dom, restore } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const canvas = doc.createElement('canvas')
    doc.body.appendChild(canvas)

    ;(canvas as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
      ({ left: 50, top: 100, width: 200, height: 150, right: 250, bottom: 250 } as DOMRect)

    const p = readCanvasLocalPoint({ canvasEl: canvas, event: { clientX: 60, clientY: 130 } })
    if (!p) throw new Error('expected local point')
    if (p.sx !== 10 || p.sy !== 30) throw new Error(`unexpected sx/sy ${p.sx},${p.sy}`)
    if (p.inBounds !== true) throw new Error('expected inBounds')
  } finally {
    restore()
  }
}

export async function testCanvasEventCoordsIgnoresOffsetXYWhenTargetNotCanvas() {
  const { dom, restore } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const canvas = doc.createElement('canvas')
    doc.body.appendChild(canvas)

    Object.defineProperty(canvas, 'clientWidth', { value: 800 })
    Object.defineProperty(canvas, 'clientHeight', { value: 600 })

    ;(canvas as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
      ({ left: 50, top: 100, width: 200, height: 150, right: 250, bottom: 250 } as DOMRect)

    const overlayEl = doc.createElement('section')
    doc.body.appendChild(overlayEl)

    const p = readCanvasLocalPoint({
      canvasEl: canvas,
      event: { offsetX: 999, offsetY: 999, clientX: 60, clientY: 130, target: overlayEl },
    })
    if (!p) throw new Error('expected local point')
    if (p.sx !== 10 || p.sy !== 30) throw new Error(`unexpected sx/sy ${p.sx},${p.sy}`)
    if (p.inBounds !== true) throw new Error('expected inBounds')
  } finally {
    restore()
  }
}
