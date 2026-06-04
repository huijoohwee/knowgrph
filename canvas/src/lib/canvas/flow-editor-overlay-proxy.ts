export const FLOW_EDITOR_OVERLAY_MODE_SELECTOR = '[data-kg-flow-editor-mode="1"]'
export const FLOW_EDITOR_OVERLAY_SURFACE_ATTR = 'data-kg-flow-editor-surface'
export const FLOW_EDITOR_OVERLAY_SURFACE_ROOT_ATTR = 'data-kg-flow-editor-surface-root'
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

export function escapeFlowEditorOverlaySelectorAttrValue(value: string): string {
  const text = String(value || '')
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(text)
  return text.replace(/["\\\]]/g, '\\$&')
}

export function findFlowEditorOverlaySurfaceRoot(surfaceId: string | null | undefined): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const normalizedSurfaceId = String(surfaceId || '').trim()
  if (!normalizedSurfaceId) return null
  return document.querySelector<HTMLElement>(
    `[${FLOW_EDITOR_OVERLAY_SURFACE_ROOT_ATTR}="${escapeFlowEditorOverlaySelectorAttrValue(normalizedSurfaceId)}"]`,
  )
}

export function queryFlowEditorOverlayRootsForSurface(args: {
  surfaceId: string | null | undefined
  selector: string
  root?: ParentNode | null
}): HTMLElement[] {
  if (typeof document === 'undefined') return []
  const surfaceId = String(args.surfaceId || '').trim()
  if (!surfaceId) return []
  const queryRoot = args.root || document
  return Array.from(queryRoot.querySelectorAll(args.selector))
    .filter((el): el is HTMLElement => el instanceof HTMLElement)
    .filter(el => readFlowEditorOverlaySurfaceId(el) === surfaceId)
}

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

export function readFlowEditorElementSurfaceId(el: Element | null | undefined): string {
  if (!(el instanceof HTMLElement)) return ''
  const ownSurfaceId = String(el.dataset.kgFlowEditorSurface || '').trim()
  if (ownSurfaceId) return ownSurfaceId
  try {
    const closestSurface = el.closest(`[${FLOW_EDITOR_OVERLAY_SURFACE_ATTR}]`)
    if (closestSurface instanceof HTMLElement) {
      const closestSurfaceId = String(closestSurface.dataset.kgFlowEditorSurface || '').trim()
      if (closestSurfaceId) return closestSurfaceId
    }
    const closestSurfaceRoot = el.closest(`[${FLOW_EDITOR_OVERLAY_SURFACE_ROOT_ATTR}]`)
    if (closestSurfaceRoot instanceof HTMLElement) {
      return String(closestSurfaceRoot.getAttribute(FLOW_EDITOR_OVERLAY_SURFACE_ROOT_ATTR) || '').trim()
    }
  } catch {
    void 0
  }
  return ''
}

export function readFlowEditorOverlaySurfaceId(overlayRoot: HTMLElement | null | undefined): string {
  return readFlowEditorElementSurfaceId(overlayRoot)
}

export function isTransientOffscreenRichMediaOverlayRoot(overlayRoot: HTMLElement | null | undefined, rect: DOMRect | null | undefined): boolean {
  if (!overlayRoot || !rect) return false
  if (String(overlayRoot.dataset.kgRichMediaOverlay || '').trim() !== '1') return false
  const tiny = rect.width <= 2 && rect.height <= 2
  const farOffscreen = rect.left < -10000 || rect.top < -10000
  const parkedOffscreen = rect.right <= 0 || rect.bottom <= 0
  return tiny && (farOffscreen || parkedOffscreen)
}

export function isUsableFlowEditorOverlayRectCandidate(overlayRoot: HTMLElement | null | undefined, rect: DOMRect | null | undefined): boolean {
  if (!overlayRoot || !rect) return false
  if (isTransientOffscreenRichMediaOverlayRoot(overlayRoot, rect)) return false
  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    const style = window.getComputedStyle(overlayRoot)
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') === 0) return false
  }
  return Number.isFinite(rect.left) && Number.isFinite(rect.top) && rect.width > 0 && rect.height > 0
}

export function shouldReplaceFlowEditorOverlayRectCandidate(
  current: { el: HTMLElement; rect: DOMRect } | null | undefined,
  next: { el: HTMLElement; rect: DOMRect },
): boolean {
  if (!isUsableFlowEditorOverlayRectCandidate(next.el, next.rect)) return false
  if (!current || !isUsableFlowEditorOverlayRectCandidate(current.el, current.rect)) return true
  const currentArea = Math.max(0, current.rect.width) * Math.max(0, current.rect.height)
  const nextArea = Math.max(0, next.rect.width) * Math.max(0, next.rect.height)
  return nextArea > currentArea + 1
}

function readOverlayRectCandidateRank(el: HTMLElement): number {
  const surfaceId = readFlowEditorOverlaySurfaceId(el)
  const hasWidgetShellId = String(el.dataset.kgWidget || '').trim().length > 0
  const isRichMediaOverlay = String(el.dataset.kgRichMediaOverlay || '').trim() === '1'
  const isPinnedCanvasProxy = readCanvasOverlayPinnedState(el)
  if (surfaceId && hasWidgetShellId) return 3
  if (surfaceId && isRichMediaOverlay && !isPinnedCanvasProxy) return 3
  if (surfaceId && isPinnedCanvasProxy) return 1
  if (surfaceId) return 2
  if (isRichMediaOverlay) return 1
  return 0
}

export function collectCanonicalFlowEditorOverlayRectEntries(
  overlayRoots: Iterable<HTMLElement>,
): Array<{ id: string; el: HTMLElement; rect: DOMRect }> {
  const selectedById = new Map<string, { el: HTMLElement; rect: DOMRect }>()
  for (const el of overlayRoots) {
    const id = readCanvasOverlayNodeId(el)
    if (!id) continue
    const rect = el.getBoundingClientRect()
    if (!isUsableFlowEditorOverlayRectCandidate(el, rect)) continue
    const next = { el, rect }
    const current = selectedById.get(id)
    const nextRank = readOverlayRectCandidateRank(el)
    const currentRank = current ? readOverlayRectCandidateRank(current.el) : -1
    if (nextRank > currentRank) {
      selectedById.set(id, next)
      continue
    }
    if (nextRank < currentRank) continue
    if (shouldReplaceFlowEditorOverlayRectCandidate(current, next)) selectedById.set(id, next)
  }
  return Array.from(selectedById.entries())
    .map(([id, entry]) => ({ id, el: entry.el, rect: entry.rect }))
}

export function resolveFlowEditorOverlayProxyTarget(args: { target: unknown; canvasEl: Element; flowEditorSurfaceId?: string | null }): FlowEditorOverlayProxyTarget {
  const el = args.target instanceof Element ? args.target : null
  if (!el) return { kind: 'none' }
  if (args.canvasEl.contains(el)) return { kind: 'canvas', targetEl: el }

  const root = el.closest(CANVAS_OVERLAY_PROXY_ROOT_SELECTOR)
  const overlayRoot = root instanceof HTMLElement ? root : null
  if (!overlayRoot) return { kind: 'none' }
  const activeSurfaceId =
    String(args.flowEditorSurfaceId || '').trim()
    || readFlowEditorElementSurfaceId(args.canvasEl)
  if (!activeSurfaceId) return { kind: 'none' }
  if (activeSurfaceId) {
    const overlaySurfaceId = readFlowEditorOverlaySurfaceId(overlayRoot)
    if (!overlaySurfaceId || overlaySurfaceId !== activeSurfaceId) return { kind: 'none' }
  }

  const isInteractive = !!el.closest(FLOW_EDITOR_OVERLAY_INTERACTIVE_SELECTOR)
  return { kind: 'overlay', targetEl: el, overlayRoot, isInteractive }
}
