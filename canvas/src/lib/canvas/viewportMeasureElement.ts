export const CANVAS_VIEWPORT_ROOT_SELECTOR = '[data-kg-canvas-viewport-root="1"]'

export function resolveCanvasViewportMeasureElement(self: HTMLElement | null): HTMLElement | null {
  if (!self) return null
  const viewportRoot = self.closest(CANVAS_VIEWPORT_ROOT_SELECTOR)
  return viewportRoot instanceof HTMLElement ? viewportRoot : self
}
