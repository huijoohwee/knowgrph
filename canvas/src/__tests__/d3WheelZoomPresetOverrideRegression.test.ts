import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testD3WheelZoomOverridesDesignPresetToZoom() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'zoom.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes("wheelBehavior === 'preset' && viewportControlsPreset === 'design'")) {
    throw new Error('expected D3 wheel zoom to override design preset to zoom when wheelBehavior is preset')
  }
  if (!text.includes('gesturestart.kgGestureZoom') || !text.includes('gesturechange.kgGestureZoom')) {
    throw new Error('expected D3 zoom to support gesture events for trackpad pinch zoom')
  }
}

