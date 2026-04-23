import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorRichMediaOverlaySizingClampsToWidgetScale() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('computeSizingZoomK')) {
    throw new Error('expected FlowCanvas to provide computeSizingZoomK to rich media overlay layout loop')
  }
  if (!text.includes('computeWidgetScale')) {
    throw new Error('expected FlowCanvas to reuse widget scale clamping for rich media overlay sizing')
  }
}

