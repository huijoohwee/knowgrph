import type React from 'react'
import { JSDOM } from 'jsdom'

import { startFlowPortHandleMouseDrag, startFlowPortHandlePointerDrag } from '@/components/FlowEditor/flowPortHandlePointerDrag'

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

export function testFlowPortHandleMouseDragCompletesOnSemanticInputHandle() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  const previousDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: dom.window.document })
  const target = document.createElement('button')
  target.dataset.kgPortHandle = '1'
  target.dataset.kgPortDir = 'in'
  target.dataset.kgPortNodeId = 'target-node'
  target.dataset.kgPortKey = 'videoUrl'
  document.body.appendChild(target)

  let clickCount = 0
  target.addEventListener('click', () => { clickCount += 1 })
  const originalElementFromPoint = document.elementFromPoint
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => target })

  try {
    startFlowPortHandleMouseDrag({
      event: { button: 0 } as React.MouseEvent<HTMLButtonElement>,
      sourceNodeId: 'source-node',
    })
    const mouseUp = new dom.window.MouseEvent('mouseup', { clientX: 10, clientY: 20 })
    document.dispatchEvent(mouseUp)
    if (clickCount !== 1) throw new Error(`expected semantic target handle click after mouse drag, got ${clickCount}`)
  } finally {
    target.remove()
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: originalElementFromPoint })
    dom.window.close()
    if (previousDocumentDescriptor) Object.defineProperty(globalThis, 'document', previousDocumentDescriptor)
    else delete (globalThis as { document?: Document }).document
  }
}

export function testFlowPortHandlePointerDragCompletesNearSemanticInputHandle() {
  const dom = new JSDOM('<!doctype html><html><body><section id="miss"></section></body></html>')
  const previousDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: dom.window.document })
  const target = document.createElement('button')
  target.dataset.kgPortHandle = '1'
  target.dataset.kgPortDir = 'in'
  target.dataset.kgPortNodeId = 'target-node'
  target.dataset.kgPortKey = 'imageUrl'
  Object.defineProperty(target, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ left: 100, top: 100, width: 8, height: 8, right: 108, bottom: 108, x: 100, y: 100, toJSON: () => ({}) }),
  })
  document.body.appendChild(target)

  let clickCount = 0
  target.addEventListener('click', () => { clickCount += 1 })
  const miss = document.getElementById('miss')
  const originalElementFromPoint = document.elementFromPoint
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => miss })

  try {
    startFlowPortHandlePointerDrag({
      event: { button: 0, pointerId: 7 } as React.PointerEvent<HTMLButtonElement>,
      sourceNodeId: 'source-node',
    })
    const pointerUp = new dom.window.Event('pointerup')
    Object.defineProperties(pointerUp, {
      pointerId: { value: 7 },
      clientX: { value: 118 },
      clientY: { value: 104 },
    })
    document.dispatchEvent(pointerUp)
    if (clickCount !== 1) throw new Error(`expected nearest semantic target handle click after drag, got ${clickCount}`)
  } finally {
    target.remove()
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: originalElementFromPoint })
    dom.window.close()
    if (previousDocumentDescriptor) Object.defineProperty(globalThis, 'document', previousDocumentDescriptor)
    else delete (globalThis as { document?: Document }).document
  }
}
