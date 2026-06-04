export const FLOATING_PANEL_CANVAS_INSET_PX = 8
export const FLOATING_PANEL_CANVAS_TOP_INSET_CSS = 'calc(var(--kg-safe-top) + var(--kg-canvas-viewport-edge-gap))'
export const FLOATING_PANEL_CANVAS_RIGHT_INSET_CSS = 'calc(var(--kg-safe-right) + var(--kg-canvas-viewport-edge-gap))'
export const FLOATING_PANEL_CANVAS_INLINE_CLEARANCE_CSS = 'calc(var(--kg-safe-left) + var(--kg-safe-right) + var(--kg-canvas-viewport-edge-gap) + var(--kg-canvas-viewport-edge-gap))'
export const FLOATING_PANEL_CANVAS_PANEL_HEIGHT_CSS = 'calc(100% - var(--kg-safe-top) - var(--kg-safe-bottom) - var(--kg-canvas-viewport-edge-gap) - var(--kg-canvas-viewport-edge-gap))'
export const FLOATING_PANEL_DEFAULT_WIDTH_RATIO = 0.3
export const FLOATING_PANEL_DEFAULT_MIN_WIDTH_CSS = '21.6rem'
export const FLOATING_PANEL_DEFAULT_WIDTH_FALLBACK_PX = 384
export const FLOATING_PANEL_DEFAULT_HEIGHT_FALLBACK_PX = 420

export type FloatingPanelTopRightPositionArgs = {
  viewportWidth: number
  panelWidth: number
  insetPx?: number
}

export const resolveFloatingPanelTopRightDefaultPosition = (args: FloatingPanelTopRightPositionArgs): {
  top: number
  left: number
} => {
  const insetPx = Number.isFinite(args.insetPx) ? Math.max(0, args.insetPx || 0) : FLOATING_PANEL_CANVAS_INSET_PX
  const viewportWidth = Number.isFinite(args.viewportWidth) ? Math.max(0, args.viewportWidth) : 0
  const panelWidth = Number.isFinite(args.panelWidth) ? Math.max(0, args.panelWidth) : FLOATING_PANEL_DEFAULT_WIDTH_FALLBACK_PX
  return {
    top: insetPx,
    left: Math.max(insetPx, viewportWidth - insetPx - panelWidth),
  }
}
