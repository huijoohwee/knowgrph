import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testD3WheelZoomOverridesDesignPresetToZoom() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'zoom.ts')
  const text = readFileSync(p, 'utf8')
  if (text.includes("wheelBehavior === 'preset' && viewportControlsPreset === 'design'")) {
    throw new Error('expected D3 wheel behavior to respect shouldWheelZoomForPreset (no design override)')
  }
  if (!text.includes('shouldWheelZoom({ event: e, preset: viewportControlsPreset, wheelBehavior })')) {
    throw new Error('expected D3 wheel zoom to use shouldWheelZoom helper for preset behavior')
  }
  if (!text.includes('gesturestart.kgGestureZoom') || !text.includes('gesturechange.kgGestureZoom')) {
    throw new Error('expected D3 zoom to support gesture events for trackpad pinch zoom')
  }
  if (!text.includes('UI_SELECTORS.canvasPointerIgnore')) {
    throw new Error('expected D3 zoom filter to respect UI_SELECTORS.canvasPointerIgnore')
  }

  const uiMetaPath = resolve(process.cwd(), 'src', 'lib', 'config-copy', 'uiMeta.ts')
  const uiMeta = readFileSync(uiMetaPath, 'utf8')
  if (!uiMeta.includes('canvasPointerIgnore')) {
    throw new Error('expected UI_SELECTORS to define canvasPointerIgnore selector')
  }
}
