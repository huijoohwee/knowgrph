function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function computeViewportSafeInlineCenterShiftPx(args: {
  anchorCenterPx: number
  elementWidthPx: number
  viewportWidthPx: number
  marginPx?: number
}): number {
  const viewportWidth = Math.max(1, readFiniteNumber(args.viewportWidthPx, 1))
  const margin = Math.max(0, Math.min(viewportWidth / 2, readFiniteNumber(args.marginPx, 0)))
  const availableWidth = Math.max(1, viewportWidth - margin * 2)
  const elementWidth = Math.max(1, Math.min(readFiniteNumber(args.elementWidthPx, availableWidth), availableWidth))
  const anchorCenter = readFiniteNumber(args.anchorCenterPx, viewportWidth / 2)
  const halfWidth = elementWidth / 2
  const minCenter = margin + halfWidth
  const maxCenter = viewportWidth - margin - halfWidth
  const targetCenter = maxCenter >= minCenter
    ? Math.max(minCenter, Math.min(maxCenter, anchorCenter))
    : viewportWidth / 2
  const shift = targetCenter - anchorCenter
  return Math.abs(shift) < 0.001 ? 0 : shift
}
