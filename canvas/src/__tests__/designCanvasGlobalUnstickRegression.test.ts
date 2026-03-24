import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testDesignCanvasInstallsGlobalUnstickFailsafe() {
  const p = resolve(process.cwd(), 'src', 'components', 'DesignCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes("window.addEventListener('lostpointercapture'")) {
    throw new Error('expected DesignCanvas to listen for lostpointercapture to unstick interactions')
  }
  if (!text.includes("window.addEventListener('pointercancel'")) {
    throw new Error('expected DesignCanvas to listen for pointercancel to unstick interactions')
  }
  if (!text.includes('designMediaHeaderDragRef')) {
    throw new Error('expected DesignCanvas to include media header drag state in unstick cancellation')
  }
}

