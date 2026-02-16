import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowCanvasWheelZoomCanStartFromFlowEditorOverlay() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'bindNativeInteractions.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes("window.addEventListener('wheel'")) {
    throw new Error('expected FlowCanvas to install a window wheel capture handler for Flow Editor overlays')
  }
  if (!text.includes('[data-kg-node-quick-editor]') && !text.includes('flow-editor-overlay-proxy')) {
    throw new Error('expected FlowCanvas wheel proxy to target node quick editor overlays (direct selector or shared proxy helper)')
  }
  if (!text.includes('skipIgnoreGuard: true')) {
    throw new Error('expected FlowCanvas wheel proxy to bypass canvas wheel ignore guard when proxied')
  }
}
