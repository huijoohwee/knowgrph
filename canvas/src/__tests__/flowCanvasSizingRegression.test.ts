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
}

