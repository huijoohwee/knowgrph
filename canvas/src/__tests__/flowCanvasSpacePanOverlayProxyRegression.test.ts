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
  const screenAuthorityPath = resolve(process.cwd(), 'src', 'lib', 'flowEditor', 'screenAuthorityCollectivePan.ts')
  const screenAuthorityText = readFileSync(screenAuthorityPath, 'utf8')
  if (!text.includes('shouldUseFlowEditorScreenAuthorityCollectivePan(st)') || !screenAuthorityText.includes('isFlowEditorFrontmatterDocumentModeRequested')) {
    throw new Error('expected FlowCanvas overlay space-pan proxy to reuse the shared Flow Editor screen-authority gate SSOT')
  }
  if (!text.includes('const flowEditorOverlayInteractionMode =')
    || !text.includes("String(st.canvas2dRenderer || '') === 'flowEditor'")) {
    throw new Error('expected FlowCanvas overlay pan proxy to activate for the Flow Editor renderer, not frontmatter-only documents')
  }
  if (!text.includes('flowEditorSurfaceId: ctx.args.flowEditorSurfaceId')) {
    throw new Error('expected FlowCanvas overlay space-pan proxy to forward the active Flow Editor surface identity into shared overlay proxy resolution')
  }
  if (!text.includes('capture: true')) {
    throw new Error('expected FlowCanvas overlay space-pan proxy listeners to use capture')
  }
}

export function testFlowCanvasOverlayBodyPanUsesViewportPanIntent() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'listeners.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes("const pointerMode2d = String(storeStateAtDown.canvasPointerMode2d || '')")) {
    throw new Error('expected FlowCanvas overlay pan proxy to capture the active 2D pointer mode at pointerdown')
  }
  if (!text.includes('pointerMode2d,')) {
    throw new Error('expected FlowCanvas overlay pan proxy to pass pointer mode through the shared pan-intent helper')
  }
  if (!text.includes('const selectionDrag = pointerModePan ? false : shouldStartSelectionDragForPreset')) {
    throw new Error('expected FlowCanvas overlay pan proxy to suppress selection drag while the pan tool owns the gesture')
  }
  if (!text.includes('const overlayBodyViewportPan =')) {
    throw new Error('expected FlowCanvas overlay pan proxy to classify non-interactive overlay bodies as viewport pan intent')
  }
  if (!text.includes('const overlayViewportPanIntent = allowPan || overlayBodyViewportPan')) {
    throw new Error('expected FlowCanvas overlay body pan to bypass canvas selection-drag gating through a named viewport-pan intent')
  }
  if (!text.includes('const overlaySelectionDrag = overlayBodyViewportPan ? false : selectionDrag')) {
    throw new Error('expected FlowCanvas overlay body pan to suppress canvas selection drag because overlays have no lasso owner')
  }
  if (!text.includes("resolved.kind === 'overlay' && !overlayPinnedToNode && overlayDragHandle && button === 0 && spacePanHeld !== true")) {
    throw new Error('expected unpinned Flow Editor overlay drag handles to remain local owner interactions without Space-pan')
  }
  if (text.includes("resolved.kind === 'overlay' && !overlayPinnedToNode && button === 0 && spacePanHeld !== true) return")) {
    throw new Error('expected unpinned Flow Editor overlay body pan to use viewport pan intent instead of an unconditional return')
  }
  if (text.includes("resolved.kind === 'overlay' && !overlayPinnedToNode && button === 0 && spacePanHeld !== true && (allowPan !== true || selectionDrag === true)")) {
    throw new Error('expected unpinned Flow Editor overlay body pan to avoid stale allowPan/selectionDrag-only gating')
  }
  if (!text.includes('if (overlayBodyViewportPan && flowEditorOverlayInteractionMode) return')) {
    throw new Error('expected FlowCanvas overlay body pan to yield to the Flow Editor surface owner in active renderer mode')
  }
  if (!text.includes("resolved.kind === 'overlay' && !overlayPinnedToNode && button === 0 && spacePanHeld !== true && (overlayViewportPanIntent !== true || overlaySelectionDrag === true)")) {
    throw new Error('expected unpinned Flow Editor overlay body pan to proceed when overlay body viewport-pan intent is active')
  }
}
