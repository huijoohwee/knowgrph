import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorRichMediaOverlayResizeMaintainsAspectRatio() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('bodyAspect')) {
    throw new Error('expected FlowCanvas rich media overlay resize to track body aspect ratio')
  }
  if (!text.includes('nextW * bodyAspect')) {
    throw new Error('expected FlowCanvas rich media overlay resize to compute height from width using bodyAspect')
  }
}
