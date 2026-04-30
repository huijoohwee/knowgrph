import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowCanvasSpacePanCanStartFromOverlay() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'listeners.ts')
  const text = readFileSync(p, 'utf8')
  const proxyPath = resolve(process.cwd(), 'src', 'lib', 'canvas', 'flow-editor-overlay-proxy.ts')
  const proxyText = readFileSync(proxyPath, 'utf8')
  if (!text.includes('onWindowPointerDownCapture')) {
    throw new Error('expected FlowCanvas to install a window pointerdown capture handler for overlay space-pan')
  }
  if (!text.includes('[data-kg-widget]') && !text.includes('flow-editor-overlay-proxy')) {
    throw new Error('expected FlowCanvas overlay space-pan proxy to target widget and Rich Media Panel overlays (direct selector or shared proxy helper)')
  }
  if (!proxyText.includes('[data-kg-canvas-overlay-drag-handle="true"]')) {
    throw new Error('expected shared overlay drag-handle selector to include Rich Media Panel headers')
  }
  if (!text.includes('shouldAllowPanDragForPointerEvent')) {
    throw new Error('expected FlowCanvas overlay pan proxy to reuse viewport pan gating SSOT')
  }
  if (!text.includes('readCanvasOverlayPinnedState')) {
    throw new Error('expected FlowCanvas overlay space-pan proxy to reuse shared pinned-state resolution')
  }
  if (!text.includes('CANVAS_OVERLAY_RESIZE_HANDLE_SELECTOR')) {
    throw new Error('expected FlowCanvas overlay space-pan proxy to import shared overlay resize-handle selector')
  }
  if (!text.includes('if (overlayResizeHandle) return')) {
    throw new Error('expected FlowCanvas overlay space-pan proxy to never hijack resize-handle pointerdown events')
  }
  if (!text.includes('__flowCanvasDebug.lastOverlayProxyPointerDown')) {
    throw new Error('expected FlowCanvas overlay proxy pointerdown path to expose live trace details in flowCanvasDebug')
  }
  if (!text.includes('isFlowEditorFrontmatterDocumentModeRequested')) {
    throw new Error('expected FlowCanvas overlay space-pan proxy to reuse shared frontmatter-document mode gate SSOT')
  }
  if (!text.includes('flowEditorSurfaceId: ctx.args.flowEditorSurfaceId')) {
    throw new Error('expected FlowCanvas overlay space-pan proxy to forward the active Flow Editor surface identity into shared overlay proxy resolution')
  }
  if (!text.includes('capture: true')) {
    throw new Error('expected FlowCanvas overlay space-pan proxy listeners to use capture')
  }
}
