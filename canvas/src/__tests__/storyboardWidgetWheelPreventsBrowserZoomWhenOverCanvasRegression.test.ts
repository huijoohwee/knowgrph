import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testStoryboardWidgetWheelPreventsBrowserZoomWhenOverCanvas() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'wheelAndGesture.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('onWindowWheelCapture')) {
    throw new Error('expected FlowCanvas to install a window wheel capture handler')
  }
  if (!text.includes('elementFromPoint')) {
    throw new Error('expected StoryboardWidget to use elementFromPoint fallback to route wheel to canvas and prevent page zoom')
  }
  if (!text.includes('handleWheel(e, { skipIgnoreGuard: true })')) {
    throw new Error('expected StoryboardWidget to route wheel gestures over the canvas through handleWheel with skipIgnoreGuard')
  }
  if (!text.includes('const ignoreWheelTarget = shouldIgnoreCanvasWheelEvent({ event: e, ignoreSelector: UI_SELECTORS.canvasWheelIgnore })')) {
    throw new Error('expected window wheel capture path to respect canvas wheel-ignore regions (for example widget scroll surfaces)')
  }
  if (!text.includes('if (ignoreWheelTarget) return')) {
    throw new Error('expected widget wheel capture to return early so panel scroll does not zoom the canvas')
  }
}
