import { consumeScrollablePanelWheelEvent, shouldKeepWheelOnScrollableTarget } from 'grph-shared/dom/wheelGuards'
import type { WheelEvent as ReactWheelEvent } from 'react'

export const WIDGET_INNER_PANEL_SCROLL_SURFACE_SELECTOR = '[data-kg-media-scroll-surface="1"]'

const isDomElement = (value: unknown): value is Element => {
  if (!value || typeof value !== 'object') return false
  const localCtor = ((value as { ownerDocument?: { defaultView?: { Element?: typeof Element } | null } }).ownerDocument?.defaultView?.Element)
    || (typeof Element !== 'undefined' ? Element : null)
  if (localCtor) return value instanceof localCtor
  return typeof (value as Element).closest === 'function' && typeof (value as Element).getBoundingClientRect === 'function'
}

const readEventTargetElement = (event: { target?: unknown; composedPath?: () => unknown[] }): Element | null => {
  try {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : []
    for (const item of path) {
      if (isDomElement(item)) return item
    }
  } catch {
    void 0
  }
  const target = event.target
  return isDomElement(target) ? target : null
}

const isPointInsideRect = (clientX: number, clientY: number, rect: DOMRect): boolean =>
  clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom

const isSurfaceInsideBoundary = (surface: Element, boundary?: Element | null): boolean => {
  if (!boundary) return true
  return surface === boundary || boundary.contains(surface)
}

function findWidgetInnerPanelSurfaceAtWheelPoint(event: WheelEvent, boundary?: Element | null): Element | null {
  const clientX = (event as unknown as { clientX?: unknown }).clientX
  const clientY = (event as unknown as { clientY?: unknown }).clientY
  if (typeof clientX !== 'number' || !Number.isFinite(clientX)) return null
  if (typeof clientY !== 'number' || !Number.isFinite(clientY)) return null

  try {
    const top = typeof document !== 'undefined' && typeof document.elementFromPoint === 'function'
      ? document.elementFromPoint(clientX, clientY)
      : null
    const topSurface = top?.closest?.(WIDGET_INNER_PANEL_SCROLL_SURFACE_SELECTOR) || null
    if (topSurface && isSurfaceInsideBoundary(topSurface, boundary)) return topSurface
  } catch {
    void 0
  }

  if (typeof document === 'undefined') return null
  const surfaces = document.querySelectorAll(WIDGET_INNER_PANEL_SCROLL_SURFACE_SELECTOR)
  for (let i = 0; i < surfaces.length; i += 1) {
    const surface = surfaces[i]
    if (!isSurfaceInsideBoundary(surface, boundary)) continue
    const rect = surface.getBoundingClientRect()
    if (!(rect.width > 0 && rect.height > 0)) continue
    if (isPointInsideRect(clientX, clientY, rect)) return surface
  }
  return null
}

export function isWidgetInnerPanelWheelTarget(event: WheelEvent, boundary?: Element | null): boolean {
  const target = readEventTargetElement(event)
  if (target && typeof target.closest === 'function') {
    const surface = target.closest(WIDGET_INNER_PANEL_SCROLL_SURFACE_SELECTOR)
    if (surface && isSurfaceInsideBoundary(surface, boundary)) return true
  }
  return !!findWidgetInnerPanelSurfaceAtWheelPoint(event, boundary)
}

export function shouldKeepWidgetInnerPanelWheel(event: WheelEvent, boundary?: Element | null): boolean {
  if (isWidgetInnerPanelWheelTarget(event, boundary)) return true
  return shouldKeepWheelOnScrollableTarget(event, boundary, { allowModifierZoom: false })
}

export function handleWidgetInnerPanelWheelCapture(
  event: ReactWheelEvent,
  emitInteractionFrame: () => void,
): void {
  consumeScrollablePanelWheelEvent(event)
  try {
    emitInteractionFrame()
  } catch {
    void 0
  }
}

export function handleWidgetInnerPanelScrollCapture(emitInteractionFrame: () => void): void {
  try {
    emitInteractionFrame()
  } catch {
    void 0
  }
}
