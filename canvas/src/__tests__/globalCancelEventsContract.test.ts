import fs from 'node:fs'
import path from 'node:path'

import { JSDOM } from 'jsdom'

import { subscribeGlobalCancelEvents } from '@/lib/browser/globalCancelEvents'

const readUtf8 = (relativePath: string): string => {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

export const testGlobalCancelEventsHelperCentralizesPointerBlurAndVisibilityFallbacks = async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  let pointerCount = 0
  const unsubscribePointer = subscribeGlobalCancelEvents({
    listener: () => {
      pointerCount += 1
    },
    capture: true,
    visibilityBehavior: 'off',
  })
  dom.window.dispatchEvent(new dom.window.Event('pointerup', { bubbles: true }))
  dom.window.dispatchEvent(new dom.window.Event('pointercancel', { bubbles: true }))
  dom.window.dispatchEvent(new dom.window.Event('blur'))
  await new Promise<void>(resolve => setTimeout(resolve, 0))
  if (pointerCount !== 3) {
    throw new Error(`expected shared global cancel helper to react to pointerup, pointercancel, and blur, got ${pointerCount}`)
  }
  unsubscribePointer()

  const originalDescriptor = Object.getOwnPropertyDescriptor(dom.window.document, 'visibilityState')
  Object.defineProperty(dom.window.document, 'visibilityState', {
    configurable: true,
    get: () => 'hidden',
  })

  let visibilityCount = 0
  const unsubscribeVisibility = subscribeGlobalCancelEvents({
    listener: () => {
      visibilityCount += 1
    },
    visibilityBehavior: 'hidden-only',
  })
  dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'))
  await new Promise<void>(resolve => setTimeout(resolve, 0))
  if (visibilityCount !== 1) {
    throw new Error(`expected shared global cancel helper to react to hidden visibilitychange once, got ${visibilityCount}`)
  }
  unsubscribeVisibility()

  if (originalDescriptor) {
    Object.defineProperty(dom.window.document, 'visibilityState', originalDescriptor)
  }
}

export const testGlobalCancelEventsCallsitesUseSharedHelperBoundary = () => {
  const helperText = readUtf8('src/lib/browser/globalCancelEvents.ts')
  const editorText = readUtf8('src/components/FlowEditor/NodeOverlayEditorView.tsx')

  if (!helperText.includes('export function subscribeGlobalCancelEvents')) {
    throw new Error('expected global cancel helper module to expose shared pointer/blur/visibility subscription')
  }
  if (!helperText.includes("window.addEventListener('pointerup', handle, useCapture)")) {
    throw new Error('expected global cancel helper to own pointerup listener wiring')
  }
  if (!helperText.includes("document.addEventListener('visibilitychange', onVisibility, useCapture)")) {
    throw new Error('expected global cancel helper to own visibilitychange listener wiring')
  }
  if (!editorText.includes('subscribeGlobalCancelEvents({')) {
    throw new Error('expected NodeOverlayEditor to subscribe through the shared global cancel helper')
  }
  if (editorText.includes("window.addEventListener('pointerup', unlock, true)")) {
    throw new Error('expected NodeOverlayEditor to avoid raw pointerup unlock listener wiring')
  }
  if (editorText.includes("document.addEventListener('visibilitychange', unlock, true)")) {
    throw new Error('expected NodeOverlayEditor to avoid raw visibilitychange unlock listener wiring')
  }
}
