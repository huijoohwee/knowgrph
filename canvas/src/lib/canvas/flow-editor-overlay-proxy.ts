export const FLOW_EDITOR_OVERLAY_MODE_SELECTOR = '[data-kg-flow-editor-mode="1"]'
export const FLOW_EDITOR_OVERLAY_SURFACE_ATTR = 'data-kg-flow-editor-surface'
export const FLOW_EDITOR_OVERLAY_ROOT_SELECTOR = `[data-kg-widget]${FLOW_EDITOR_OVERLAY_MODE_SELECTOR}`
export const RICH_MEDIA_OVERLAY_ROOT_SELECTOR = `[data-kg-rich-media-overlay="1"]${FLOW_EDITOR_OVERLAY_MODE_SELECTOR}`
export const CANVAS_OVERLAY_PROXY_ROOT_SELECTOR = [
  FLOW_EDITOR_OVERLAY_ROOT_SELECTOR,
  RICH_MEDIA_OVERLAY_ROOT_SELECTOR,
].join(', ')
export const CANVAS_OVERLAY_RESIZE_HANDLE_SELECTOR = '[data-kg-resize-handle]'
export const CANVAS_OVERLAY_DRAG_HANDLE_SELECTOR =
  `[data-kg-flow-node-drag-handle="true"],[data-kg-canvas-overlay-drag-handle="true"],${CANVAS_OVERLAY_RESIZE_HANDLE_SELECTOR}`

export const FLOW_EDITOR_OVERLAY_INTERACTIVE_SELECTOR =
  'input,textarea,select,button,a,[role="textbox"],[role="button"],[contenteditable="true"]'

export const FLOW_EDITOR_INTERACTION_FRAME_EVENT = 'kg-flow-editor-interaction-frame'

let flowEditorInteractionFrameRaf: number | null = null

export function emitFlowEditorInteractionFrame(): void {
  if (typeof window === 'undefined') return
  if (flowEditorInteractionFrameRaf != null) return
  flowEditorInteractionFrameRaf = window.requestAnimationFrame(() => {
    flowEditorInteractionFrameRaf = null
    try {
      window.dispatchEvent(new Event(FLOW_EDITOR_INTERACTION_FRAME_EVENT))
    } catch {
      void 0
    }
  })
}

export type FlowEditorOverlayProxyTarget =
  | { kind: 'none' }
  | { kind: 'canvas'; targetEl: Element }
  | { kind: 'overlay'; targetEl: Element; overlayRoot: HTMLElement; isInteractive: boolean }

export function readCanvasOverlayPinnedState(overlayRoot: HTMLElement | null | undefined): boolean {
  if (!overlayRoot) return false
  const widgetPinned = String(overlayRoot.dataset.kgWidgetPinned || '').trim()
  if (widgetPinned === '1') return true
  const richMediaPinned = String(overlayRoot.dataset.kgCanvasOverlayPinned || '').trim()
  return richMediaPinned === '1'
}

export function readCanvasOverlayNodeId(overlayRoot: HTMLElement | null | undefined): string {
  if (!overlayRoot) return ''
  const widgetId = String(overlayRoot.dataset.kgWidget || '').trim()
  if (widgetId) return widgetId
  return String(overlayRoot.dataset.nodeId || '').trim()
}

export function readFlowEditorOverlaySurfaceId(overlayRoot: HTMLElement | null | undefined): string {
  if (!overlayRoot) return ''
  return String(overlayRoot.dataset.kgFlowEditorSurface || '').trim()
}

export function resolveFlowEditorOverlayProxyTarget(args: { target: unknown; canvasEl: Element; flowEditorSurfaceId?: string | null }): FlowEditorOverlayProxyTarget {
  const el = args.target instanceof Element ? args.target : null
  if (!el) return { kind: 'none' }
  if (args.canvasEl.contains(el)) return { kind: 'canvas', targetEl: el }

  const root = el.closest(CANVAS_OVERLAY_PROXY_ROOT_SELECTOR)
  const overlayRoot = root instanceof HTMLElement ? root : null
  if (!overlayRoot) return { kind: 'none' }
  const activeSurfaceId = String(args.flowEditorSurfaceId || '').trim()
  if (activeSurfaceId) {
    const overlaySurfaceId = readFlowEditorOverlaySurfaceId(overlayRoot)
    if (!overlaySurfaceId || overlaySurfaceId !== activeSurfaceId) return { kind: 'none' }
  }

  const isInteractive = !!el.closest(FLOW_EDITOR_OVERLAY_INTERACTIVE_SELECTOR)
  return { kind: 'overlay', targetEl: el, overlayRoot, isInteractive }
}
