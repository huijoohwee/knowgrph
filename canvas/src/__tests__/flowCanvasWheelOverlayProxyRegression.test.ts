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
  if (!proxyText.includes('[data-kg-flow-editor-mode="1"]')) {
    throw new Error('expected shared overlay proxy selector to scope overlay roots to explicit Flow Editor mode')
  }
  if (!proxyText.includes('flowEditorSurfaceId?: string | null')) {
    throw new Error('expected shared overlay proxy resolver to accept the active Flow Editor surface identity')
  }
  if (!proxyText.includes("if (!overlaySurfaceId || overlaySurfaceId !== activeSurfaceId) return { kind: 'none' }")) {
    throw new Error('expected shared overlay proxy resolver to reject stale or null-surface overlay roots')
  }

  const wheelPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'wheelAndGesture.ts')
  const wheelText = readFileSync(wheelPath, 'utf8')
  if (!wheelText.includes('[data-kg-widget]') && !wheelText.includes('flow-editor-overlay-proxy')) {
    throw new Error('expected FlowCanvas wheel proxy to target widget and Rich Media Panel overlays (direct selector or shared proxy helper)')
  }

  if (!wheelText.includes('skipIgnoreGuard: true')) {
    throw new Error('expected FlowCanvas wheel proxy to bypass canvas wheel ignore guard when proxied')
  }
  if (!wheelText.includes('if (ignoreWheelTarget && !proxyOverlayWheel) return')) {
    throw new Error('expected FlowCanvas wheel proxy to let explicit overlay proxying bypass the generic ignore-guard early return')
  }
  const explicitZoomIndex = wheelText.indexOf('if (event.ctrlKey === true || event.metaKey === true) return true')
  const innerWheelIndex = wheelText.indexOf('if (shouldKeepWidgetInnerPanelWheel(event, overlayRoot)) return false')
  if (explicitZoomIndex < 0 || innerWheelIndex < 0 || explicitZoomIndex > innerWheelIndex) {
    throw new Error('expected explicit Flow Editor overlay zoom intent to bypass widget/rich-media inner scroll guards')
  }
  if (!wheelText.includes('const explicitOverlayZoomIntent = opts?.skipIgnoreGuard === true && (e.ctrlKey === true || e.metaKey === true)')) {
    throw new Error('expected proxied overlay wheel handling to preserve explicit zoom through handleWheel inner-scroll guard')
  }
  if (!wheelText.includes('if (shouldKeepWidgetInnerPanelWheel(e) && !explicitOverlayZoomIntent) return')) {
    throw new Error('expected handleWheel to keep ordinary inner scroll local while allowing explicit overlay zoom')
  }
  const screenAuthorityPath = resolve(process.cwd(), 'src', 'lib', 'flowEditor', 'screenAuthorityCollectivePan.ts')
  const screenAuthorityText = readFileSync(screenAuthorityPath, 'utf8')
  if (!wheelText.includes('isFlowEditorSharedSurfaceRenderer')
    || !wheelText.includes('const flowEditorOverlayInteractionMode = shouldUseFlowEditorScreenAuthorityCollectivePan(st)')) {
    throw new Error('expected FlowCanvas wheel proxy to use the shared Flow Editor screen-authority predicate')
  }
  if (!screenAuthorityText.includes('isFlowEditorFrontmatterDocumentModeRequested')
    || !screenAuthorityText.includes('isFlowEditorSharedSurfaceRenderer(canvas2dRenderer)')
    || !screenAuthorityText.includes('|| isFlowEditorFrontmatterDocumentModeRequested({')) {
    throw new Error('expected the shared Flow Editor screen-authority predicate to own the frontmatter-document mode gate')
  }
  if (!wheelText.includes('flowEditorSurfaceId: ctx.args.flowEditorSurfaceId')) {
    throw new Error('expected FlowCanvas wheel proxy to forward the active Flow Editor surface identity into shared overlay proxy resolution')
  }
}
