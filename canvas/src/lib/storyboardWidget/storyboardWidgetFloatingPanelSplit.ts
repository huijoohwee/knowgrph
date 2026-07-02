export type StoryboardWidgetFloatingPanelSplitHeightsPx = {
  rows: number
  details: number
}

export const STORYBOARD_WIDGET_FLOATING_PANEL_ROWS_MIN_HEIGHT_PX = 144
export const STORYBOARD_WIDGET_FLOATING_PANEL_DETAILS_MIN_HEIGHT_PX = 112

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))

const readElementHeightPx = (element: HTMLElement | null): number | null => {
  if (!element || typeof element.getBoundingClientRect !== 'function') return null
  const height = Math.round(element.getBoundingClientRect().height)
  return Number.isFinite(height) && height > 0 ? height : null
}

export function readStoryboardWidgetFloatingPanelSplitHeightsPx(args: {
  rowsElement: HTMLElement | null
  detailsElement: HTMLElement | null
}): StoryboardWidgetFloatingPanelSplitHeightsPx | null {
  const rows = readElementHeightPx(args.rowsElement)
  const details = readElementHeightPx(args.detailsElement)
  if (rows == null || details == null) return null
  return { rows, details }
}

export function resolveStoryboardWidgetFloatingPanelSplitResize(args: {
  startHeightsPx: StoryboardWidgetFloatingPanelSplitHeightsPx
  deltaY: number
  minRowsHeightPx?: number
  minDetailsHeightPx?: number
}): StoryboardWidgetFloatingPanelSplitHeightsPx {
  const minRowsHeightPx = Math.max(1, Math.round(args.minRowsHeightPx ?? STORYBOARD_WIDGET_FLOATING_PANEL_ROWS_MIN_HEIGHT_PX))
  const minDetailsHeightPx = Math.max(1, Math.round(args.minDetailsHeightPx ?? STORYBOARD_WIDGET_FLOATING_PANEL_DETAILS_MIN_HEIGHT_PX))
  const rowsStart = Math.max(minRowsHeightPx, Math.round(args.startHeightsPx.rows || minRowsHeightPx))
  const detailsStart = Math.max(minDetailsHeightPx, Math.round(args.startHeightsPx.details || minDetailsHeightPx))
  const total = Math.max(minRowsHeightPx + minDetailsHeightPx, rowsStart + detailsStart)
  const rows = clamp(Math.round(rowsStart + args.deltaY), minRowsHeightPx, total - minDetailsHeightPx)
  return {
    rows,
    details: total - rows,
  }
}
