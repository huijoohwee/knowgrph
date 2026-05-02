import fs from 'node:fs'
import path from 'node:path'

import { JSDOM } from 'jsdom'

import { subscribeGlobalCancelIntervalWatchdog } from '@/lib/browser/globalCancelEvents'

const readUtf8 = (relativePath: string): string => {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

export const testGlobalCancelIntervalWatchdogAddsLostPointerCaptureAndIntervalCleanup = async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  let count = 0
  const unsubscribe = subscribeGlobalCancelIntervalWatchdog({
    listener: () => {
      count += 1
    },
    capture: true,
    includePointerDown: true,
    includeLostPointerCapture: true,
    visibilityBehavior: 'hidden-only',
    intervalMs: 5,
  })

  dom.window.dispatchEvent(new dom.window.Event('lostpointercapture'))
  await new Promise<void>(resolve => setTimeout(resolve, 10))

  if (count < 2) {
    throw new Error(`expected shared global cancel interval watchdog to react to lostpointercapture and interval, got ${count}`)
  }

  unsubscribe()
}

export const testDesignCanvasCleanupUsesSharedIntervalWatchdogBoundary = () => {
  const helperText = readUtf8('src/lib/browser/globalCancelEvents.ts')
  const cleanupText = readUtf8('src/components/DesignCanvas/useGlobalInteractionCleanup.ts')

  if (!helperText.includes('export function subscribeGlobalCancelIntervalWatchdog')) {
    throw new Error('expected shared global cancel helper to expose interval watchdog subscription')
  }
  if (!helperText.includes("window.addEventListener('lostpointercapture', handle, useCapture)")) {
    throw new Error('expected shared global cancel helper to own lostpointercapture listener wiring')
  }
  if (!helperText.includes('const watchdog = window.setInterval(() => {')) {
    throw new Error('expected shared global cancel interval helper to own interval watchdog wiring')
  }
  if (!cleanupText.includes('subscribeGlobalCancelIntervalWatchdog({')) {
    throw new Error('expected DesignCanvas global cleanup hook to use the shared interval watchdog helper')
  }
  if (!cleanupText.includes('includeLostPointerCapture: true')) {
    throw new Error('expected DesignCanvas global cleanup hook to preserve lostpointercapture support')
  }
  if (cleanupText.includes("window.addEventListener('lostpointercapture'")) {
    throw new Error('expected DesignCanvas global cleanup hook to avoid raw lostpointercapture listener wiring')
  }
}
