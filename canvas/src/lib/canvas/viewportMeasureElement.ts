export const CANVAS_VIEWPORT_ROOT_SELECTOR = '[data-kg-canvas-viewport-root="1"]'
export const WORKSPACE_LEFT_PANE_SELECTOR = '[data-kg-workspace-left-pane="1"]'

export function resolveCanvasViewportMeasureElement(self: HTMLElement | null): HTMLElement | null {
  if (!self) return null
  const viewportRoot = self.closest(CANVAS_VIEWPORT_ROOT_SELECTOR)
  const HTMLElementCtor = self.ownerDocument?.defaultView?.HTMLElement
  return HTMLElementCtor && viewportRoot instanceof HTMLElementCtor ? viewportRoot as HTMLElement : self
}
