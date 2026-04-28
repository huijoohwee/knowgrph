export function computeOverlayMaxAnchorShiftPx(viewportW: number, viewportH: number): number {
  const w = Math.max(1, Math.floor(viewportW))
  const h = Math.max(1, Math.floor(viewportH))
  return Math.max(120, Math.min(520, Math.floor(Math.min(w, h) * 0.45)))
}

