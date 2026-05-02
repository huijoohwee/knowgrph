import fs from 'node:fs'
import path from 'node:path'

import { JSDOM } from 'jsdom'

import { subscribeGlobalCancelWatchdog } from '@/lib/browser/globalCancelEvents'

const readUtf8 = (relativePath: string): string => {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

export const testGlobalCancelWatchdogHelperAddsTimeoutOnTopOfSharedCancelEvents = async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  let count = 0
  const unsubscribe = subscribeGlobalCancelWatchdog({
    listener: () => {
      count += 1
    },
    capture: true,
    includePointerDown: true,
    visibilityBehavior: 'hidden-only',
    timeoutMs: 5,
  })

  dom.window.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }))
  await new Promise<void>(resolve => setTimeout(resolve, 10))

  if (count < 2) {
    throw new Error(`expected shared global cancel watchdog to react to pointerdown and timeout, got ${count}`)
  }

  unsubscribe()
}

export const testGraphCanvasRootWatchdogUsesSharedHelperBoundary = () => {
  const helperText = readUtf8('src/lib/browser/globalCancelEvents.ts')
  const rootText = readUtf8('src/components/GraphCanvasRoot/GraphCanvasRootImpl.tsx')

  if (!helperText.includes('export function subscribeGlobalCancelWatchdog')) {
    throw new Error('expected global cancel helper module to expose a shared watchdog subscription helper')
  }
  if (!helperText.includes('const watchdog = window.setTimeout(() => {')) {
    throw new Error('expected shared global cancel watchdog helper to own timeout wiring')
  }
  if (!rootText.includes('subscribeGlobalCancelWatchdog({')) {
    throw new Error('expected GraphCanvasRootImpl to subscribe through the shared global cancel watchdog helper')
  }
  if (!rootText.includes("visibilityBehavior: 'hidden-only'")) {
    throw new Error('expected GraphCanvasRootImpl watchdog to preserve hidden-only visibility behavior')
  }
  if (!rootText.includes('includePointerDown: true')) {
    throw new Error('expected GraphCanvasRootImpl watchdog to preserve pointerdown cancellation')
  }
  if (!rootText.includes('timeoutMs: 12000')) {
    throw new Error('expected GraphCanvasRootImpl watchdog to preserve the 12s watchdog timeout')
  }
  if (rootText.includes("window.addEventListener('pointerup', end, { capture: true })")) {
    throw new Error('expected GraphCanvasRootImpl to avoid raw pointerup watchdog listener wiring')
  }
  if (rootText.includes("document.addEventListener('visibilitychange', onVisibility)")) {
    throw new Error('expected GraphCanvasRootImpl to avoid raw visibilitychange watchdog wiring')
  }
}
