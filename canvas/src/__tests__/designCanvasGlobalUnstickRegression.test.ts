import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testDesignCanvasInstallsGlobalUnstickFailsafe() {
  const helperPath = resolve(process.cwd(), 'src', 'lib', 'browser', 'globalCancelEvents.ts')
  const helperText = readFileSync(helperPath, 'utf8')
  const hookPath = resolve(process.cwd(), 'src', 'components', 'DesignCanvas', 'useGlobalInteractionCleanup.ts')
  const hookText = readFileSync(hookPath, 'utf8')
  if (!helperText.includes('includeLostPointerCapture?: boolean')) {
    throw new Error('expected shared global cancel helper to expose lostpointercapture support')
  }
  if (!helperText.includes("window.addEventListener('lostpointercapture', handle, useCapture)")) {
    throw new Error('expected shared global cancel helper to own lostpointercapture listener wiring')
  }
  if (!hookText.includes('subscribeGlobalCancelIntervalWatchdog({')) {
    throw new Error('expected DesignCanvas global cleanup hook to use the shared interval watchdog helper')
  }
  if (!hookText.includes('includeLostPointerCapture: true')) {
    throw new Error('expected DesignCanvas global cleanup hook to preserve lostpointercapture unstick behavior')
  }
  if (!hookText.includes('visibilityBehavior: \'hidden-only\'')) {
    throw new Error('expected DesignCanvas global cleanup hook to preserve hidden-only visibility cleanup')
  }
  if (!hookText.includes('intervalMs: 12000')) {
    throw new Error('expected DesignCanvas global cleanup hook to preserve the 12s interval watchdog')
  }
  if (hookText.includes("window.addEventListener('pointercancel'")) {
    throw new Error('expected DesignCanvas global cleanup hook to avoid raw pointercancel listener boilerplate')
  }
  if (!hookText.includes('designMediaHeaderDragRef')) {
    throw new Error('expected DesignCanvas to include media header drag state in unstick cancellation')
  }
}
