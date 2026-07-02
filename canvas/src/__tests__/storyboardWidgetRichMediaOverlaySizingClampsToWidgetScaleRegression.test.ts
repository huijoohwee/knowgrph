import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testStoryboardWidgetRichMediaOverlaySizingClampsToWidgetScale() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('computeSizingZoomK')) {
    throw new Error('expected FlowCanvas media overlays to provide computeSizingZoomK to rich media overlay layout loop')
  }
  if (!text.includes('computeCollectiveFollowPinnedScale')) {
    throw new Error('expected rich media overlay sizing to reuse the shared follow-pinned scale helper')
  }
}
