function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo
  return Math.max(lo, Math.min(hi, v))
}

export function clampOverlayTopLeftToViewport(args: {
  pos: { top: number; left: number }
  size: { width: number; height: number }
  viewport: { width: number; height: number }
  visiblePx?: number
  snapPx?: number
}): { top: number; left: number } {
  const visible = Number.isFinite(args.visiblePx) ? Math.max(0, Math.floor(args.visiblePx as number)) : 32
  const w = Number.isFinite(args.size.width) ? Math.max(1, args.size.width) : 1
  const h = Number.isFinite(args.size.height) ? Math.max(1, args.size.height) : 1
  const viewportW = Number.isFinite(args.viewport.width) ? Math.max(1, Math.floor(args.viewport.width as number)) : 1
  const viewportH = Number.isFinite(args.viewport.height) ? Math.max(1, Math.floor(args.viewport.height as number)) : 1

  const minLeft = visible - w
  const maxLeft = viewportW - visible
  const minTop = visible - h
  const maxTop = viewportH - visible

  const rawTop = clamp(args.pos.top, minTop, maxTop)
  const rawLeft = clamp(args.pos.left, minLeft, maxLeft)
  const snapPx = Number.isFinite(args.snapPx) ? Math.max(0, args.snapPx as number) : 0
  if (!(snapPx > 0)) {
    return { top: rawTop, left: rawLeft }
  }
  return {
    top: Math.round(rawTop / snapPx) * snapPx,
    left: Math.round(rawLeft / snapPx) * snapPx,
  }
}

