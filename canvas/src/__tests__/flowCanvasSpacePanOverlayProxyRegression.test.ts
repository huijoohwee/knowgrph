import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowCanvasSpacePanCanStartFromOverlay() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'listeners.ts')
  const text = readFileSync(p, 'utf8')
  const proxyPath = resolve(process.cwd(), 'src', 'lib', 'canvas', 'storyboard-widget-overlay-proxy.ts')
  const proxyText = readFileSync(proxyPath, 'utf8')
  if (!text.includes('onWindowPointerDownCapture')) {
    throw new Error('expected FlowCanvas to install a window pointerdown capture handler for overlay space-pan')
  }
  if (!text.includes('[data-kg-widget]') && !text.includes('storyboard-widget-overlay-proxy')) {
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
  const screenAuthorityPath = resolve(process.cwd(), 'src', 'lib', 'storyboardWidget', 'screenAuthorityCollectivePan.ts')
  const screenAuthorityText = readFileSync(screenAuthorityPath, 'utf8')
  if (!text.includes('shouldUseStoryboardWidgetScreenAuthorityCollectivePan(st)') || !screenAuthorityText.includes('isStoryboardWidgetFrontmatterDocumentModeRequested')) {
    throw new Error('expected FlowCanvas overlay space-pan proxy to reuse the shared Storyboard Widget screen-authority gate SSOT')
  }
  if (!text.includes('const storyboardWidgetOverlayInteractionMode =')
    || !text.includes('isStoryboardWidgetSurfaceRenderer(st.canvas2dRenderer)')) {
    throw new Error('expected FlowCanvas overlay pan proxy to activate for shared Storyboard Widget surface renderers, not frontmatter-only documents')
  }
  if (!text.includes('storyboardWidgetSurfaceId: ctx.args.storyboardWidgetSurfaceId')) {
    throw new Error('expected FlowCanvas overlay space-pan proxy to forward the active Storyboard Widget surface identity into shared overlay proxy resolution')
  }
  if (!text.includes('capture: true')) {
    throw new Error('expected FlowCanvas overlay space-pan proxy listeners to use capture')
  }
}

export function testFlowCanvasOverlayBodyPanUsesViewportPanIntent() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'listeners.ts')
  const text = readFileSync(p, 'utf8')
  const proxyPath = resolve(process.cwd(), 'src', 'lib', 'canvas', 'storyboard-widget-overlay-proxy.ts')
  const proxyText = readFileSync(proxyPath, 'utf8')
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
    throw new Error('expected unpinned Storyboard Widget overlay drag handles to remain local owner interactions without Space-pan')
  }
  if (text.includes("resolved.kind === 'overlay' && !overlayPinnedToNode && button === 0 && spacePanHeld !== true) return")) {
    throw new Error('expected unpinned Storyboard Widget overlay body pan to use viewport pan intent instead of an unconditional return')
  }
  if (text.includes("resolved.kind === 'overlay' && !overlayPinnedToNode && button === 0 && spacePanHeld !== true && (allowPan !== true || selectionDrag === true)")) {
    throw new Error('expected unpinned Storyboard Widget overlay body pan to avoid stale allowPan/selectionDrag-only gating')
  }
  if (!text.includes('const overlayPanOwnerCanvas =')
    || !text.includes('isCanvasOverlayPanOwnedByCanvas(resolved.overlayRoot)')
    || !text.includes('if (overlayBodyViewportPan && storyboardWidgetOverlayInteractionMode && !overlayPanOwnerCanvas) return')) {
    throw new Error('expected FlowCanvas overlay body pan to yield only when the overlay has no shared canvas-pan owner')
  }
  if (!text.includes('shouldUseCanvasOverlayBodyPan({ target: resolved.targetEl, overlayRoot: resolved.overlayRoot })')) {
    throw new Error('expected FlowCanvas overlay body pan to reuse the shared body-pan target helper')
  }
  if (!proxyText.includes('export const STORYBOARD_WIDGET_OVERLAY_CONTROL_SELECTOR')
    || !proxyText.includes('export function shouldUseCanvasOverlayBodyPan')
    || !proxyText.includes('isCanvasOverlayPanOwnedByCanvas(args.overlayRoot)')
    || !proxyText.includes('isStoryboardWidgetOverlayControlTarget(args.target)')) {
    throw new Error('expected shared overlay proxy to separate real controls from broad inline/media wrappers for canvas-owned body pan')
  }
  if (!text.includes("resolved.kind === 'overlay' && !overlayPinnedToNode && button === 0 && spacePanHeld !== true && (overlayViewportPanIntent !== true || overlaySelectionDrag === true)")) {
    throw new Error('expected unpinned Storyboard Widget overlay body pan to proceed when overlay body viewport-pan intent is active')
  }
}

export function testFlowCanvasStoryboardWidgetCanvasPanMovesNativeAndOverlaySurfaces() {
  const pointerMovePath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'pointerMove.ts')
  const pointerMoveText = readFileSync(pointerMovePath, 'utf8')
  const screenAuthorityPath = resolve(process.cwd(), 'src', 'lib', 'storyboardWidget', 'screenAuthorityCollectivePan.ts')
  const screenAuthorityText = readFileSync(screenAuthorityPath, 'utf8')
  if (!pointerMoveText.includes('const nextTransform = d3.zoomIdentity.translate(drag.startTx + dx, drag.startTy + dy).scale(runtime.transform.k)')) {
    throw new Error('expected Storyboard Widget collective pan to compute one shared native transform for canvas-pane pan')
  }
  if (!pointerMoveText.includes('setFlowNativeTransform(runtime, nextTransform)')
    || !pointerMoveText.includes('requestFlowNativeDraw(runtime, ctx.args.buildDrawArgs())')
    || !pointerMoveText.includes('canvasTransformShifted: true')) {
    throw new Error('expected canvas-pane pan to move FlowCanvas and Storyboard Widget overlays in the same interaction frame')
  }
  if (!screenAuthorityText.includes('canvasTransformShifted?: boolean')
    || !screenAuthorityText.includes('const canvasTransformShifted = args.canvasTransformShifted === true')
    || !screenAuthorityText.includes('if (canvasTransformShifted) {')) {
    throw new Error('expected shared screen-authority helper to distinguish native-transform pan from overlay-only pan')
  }
  if (!screenAuthorityText.includes('const changedVisual = Object.keys(shiftedScreenByNodeId).length > 0')
    || !screenAuthorityText.includes('if (!changedScreen && !changedWorld && !changedVisual) return false')) {
    throw new Error('expected shared screen-authority helper to apply DOM overlay positions even when persisted world coordinates do not change')
  }
}

export function testStoryboardWidgetSharedPanDoesNotConsumeClickActivation() {
  const sharedPanPath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'useStoryboardSharedSurfacePan.ts')
  const sharedPanText = readFileSync(sharedPanPath, 'utf8')
  const pointerDownStart = sharedPanText.indexOf('const onPointerDown = (event: PointerEvent | MouseEvent) => {')
  const pointerMoveStart = sharedPanText.indexOf('const onPointerMove = (event: PointerEvent | MouseEvent) => {')
  if (pointerDownStart < 0 || pointerMoveStart < 0 || pointerMoveStart <= pointerDownStart) {
    throw new Error('expected shared Storyboard Widget pan listener to keep explicit pointerdown and pointermove phases')
  }
  const pointerDownText = sharedPanText.slice(pointerDownStart, pointerMoveStart)
  if (pointerDownText.includes('event.preventDefault()') || pointerDownText.includes('event.stopPropagation()')) {
    throw new Error('expected shared Storyboard Widget pan listener to arm collective drag without consuming Rich Media click activation')
  }
  if (!sharedPanText.includes('if (!pending.started && dx * dx + dy * dy < 9) return')
    || !sharedPanText.includes('pending.started = true')) {
    throw new Error('expected shared Storyboard Widget pan listener to consume events only after drag threshold')
  }
  if (!sharedPanText.includes('if (!pending.started) return')) {
    throw new Error('expected shared Storyboard Widget pan listener to let non-drag pointerup/click activation finish')
  }
}
