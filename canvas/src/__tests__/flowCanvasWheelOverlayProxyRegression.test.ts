import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowCanvasWheelZoomCanStartFromFlowEditorOverlay() {
  const listenersPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'listeners.ts')
  const listenersText = readFileSync(listenersPath, 'utf8')
  if (!listenersText.includes("window.addEventListener('wheel'")) {
    throw new Error('expected FlowCanvas to install a window wheel capture handler for Flow Editor overlays')
  }

  const proxyPath = resolve(process.cwd(), 'src', 'lib', 'canvas', 'flow-editor-overlay-proxy.ts')
  const proxyText = readFileSync(proxyPath, 'utf8')
  if (!proxyText.includes('[data-kg-rich-media-overlay="1"]')) {
    throw new Error('expected shared overlay proxy selector to include Rich Media Panel overlay roots')
  }

  const wheelPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'wheelAndGesture.ts')
  const wheelText = readFileSync(wheelPath, 'utf8')
  if (!wheelText.includes('[data-kg-widget]') && !wheelText.includes('flow-editor-overlay-proxy')) {
    throw new Error('expected FlowCanvas wheel proxy to target widget and Rich Media Panel overlays (direct selector or shared proxy helper)')
  }

  if (!wheelText.includes('skipIgnoreGuard: true')) {
    throw new Error('expected FlowCanvas wheel proxy to bypass canvas wheel ignore guard when proxied')
  }
  if (!wheelText.includes('if (ignoreWheelTarget) return')) {
    throw new Error('expected FlowCanvas wheel proxy to keep explicit ignore-guard early return in window capture path')
  }
  if (!wheelText.includes('isFlowEditorFrontmatterDocumentModeRequested')) {
    throw new Error('expected FlowCanvas wheel proxy to reuse shared frontmatter-document mode gate SSOT')
  }
}
