import type React from 'react'
import { JSDOM } from 'jsdom'

import { startFlowPortHandlePointerDrag } from '@/components/FlowEditor/flowPortHandlePointerDrag'

export function testFlowPortHandlePointerDragCompletesOnSemanticInputHandle() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  const previousDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: dom.window.document })
  const target = document.createElement('button')
  target.dataset.kgPortHandle = '1'
  target.dataset.kgPortDir = 'in'
  target.dataset.kgPortNodeId = 'target-node'
  target.dataset.kgPortKey = 'imageUrl'
  document.body.appendChild(target)

  let clickCount = 0
  target.addEventListener('click', () => { clickCount += 1 })
  const originalElementFromPoint = document.elementFromPoint
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => target })

  try {
    startFlowPortHandlePointerDrag({
      event: { button: 0, pointerId: 42 } as React.PointerEvent<HTMLButtonElement>,
      sourceNodeId: 'source-node',
    })
    const pointerUp = new dom.window.Event('pointerup')
    Object.defineProperties(pointerUp, {
      pointerId: { value: 42 },
      clientX: { value: 10 },
      clientY: { value: 20 },
    })
    document.dispatchEvent(pointerUp)
    if (clickCount !== 1) throw new Error(`expected semantic target handle click after drag, got ${clickCount}`)
  } finally {
    target.remove()
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: originalElementFromPoint })
    dom.window.close()
    if (previousDocumentDescriptor) Object.defineProperty(globalThis, 'document', previousDocumentDescriptor)
    else delete (globalThis as { document?: Document }).document
  }
}
