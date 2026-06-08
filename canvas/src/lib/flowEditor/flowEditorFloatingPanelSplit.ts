export type FlowEditorFloatingPanelSplitHeightsPx = {
  rows: number
  details: number
}

export const FLOW_EDITOR_FLOATING_PANEL_ROWS_MIN_HEIGHT_PX = 144
export const FLOW_EDITOR_FLOATING_PANEL_DETAILS_MIN_HEIGHT_PX = 112

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))

const readElementHeightPx = (element: HTMLElement | null): number | null => {
  if (!element || typeof element.getBoundingClientRect !== 'function') return null
  const height = Math.round(element.getBoundingClientRect().height)
  return Number.isFinite(height) && height > 0 ? height : null
}

export function readFlowEditorFloatingPanelSplitHeightsPx(args: {
  rowsElement: HTMLElement | null
  detailsElement: HTMLElement | null
}): FlowEditorFloatingPanelSplitHeightsPx | null {
  const rows = readElementHeightPx(args.rowsElement)
  const details = readElementHeightPx(args.detailsElement)
  if (rows == null || details == null) return null
  return { rows, details }
}

export function resolveFlowEditorFloatingPanelSplitResize(args: {
  startHeightsPx: FlowEditorFloatingPanelSplitHeightsPx
  deltaY: number
  minRowsHeightPx?: number
  minDetailsHeightPx?: number
}): FlowEditorFloatingPanelSplitHeightsPx {
  const minRowsHeightPx = Math.max(1, Math.round(args.minRowsHeightPx ?? FLOW_EDITOR_FLOATING_PANEL_ROWS_MIN_HEIGHT_PX))
  const minDetailsHeightPx = Math.max(1, Math.round(args.minDetailsHeightPx ?? FLOW_EDITOR_FLOATING_PANEL_DETAILS_MIN_HEIGHT_PX))
  const rowsStart = Math.max(minRowsHeightPx, Math.round(args.startHeightsPx.rows || minRowsHeightPx))
  const detailsStart = Math.max(minDetailsHeightPx, Math.round(args.startHeightsPx.details || minDetailsHeightPx))
  const total = Math.max(minRowsHeightPx + minDetailsHeightPx, rowsStart + detailsStart)
  const rows = clamp(Math.round(rowsStart + args.deltaY), minRowsHeightPx, total - minDetailsHeightPx)
  return {
    rows,
    details: total - rows,
  }
}
