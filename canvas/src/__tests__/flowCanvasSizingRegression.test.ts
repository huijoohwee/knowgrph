import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const testFlowCanvasUsesAbsoluteSurfaceSizing = () => {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('className={CANVAS_SURFACE_CLASS}')) {
    throw new Error('FlowCanvas must use CANVAS_SURFACE_CLASS directly so it fills its parent and can be measured')
  }
  if (text.includes('${CANVAS_SURFACE_CLASS} relative')) {
    throw new Error('FlowCanvas must not override CANVAS_SURFACE_CLASS position with relative; this collapses the container and blanks the canvas')
  }
  const surfaceText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'canvas', 'surface.ts'), 'utf8')
  const infiniteGridText = readFileSync(resolve(process.cwd(), 'src', 'components', 'InfiniteGridCanvasOverlay.tsx'), 'utf8')
  if (!surfaceText.includes('CANVAS_PASSIVE_OVERLAY_CLASS') || !infiniteGridText.includes('CANVAS_PASSIVE_OVERLAY_CLASS') || infiniteGridText.includes("style={{ width: '100%', height: '100%' }}")) {
    throw new Error('InfiniteGridCanvasOverlay must reuse the shared passive canvas overlay sizing class instead of local full-size styles')
  }
}
