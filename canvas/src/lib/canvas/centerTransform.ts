export function computeCenteredTransformToWorldPoint(args: {
  transform: { k: number; x: number; y: number } | null
  viewportW: number
  viewportH: number
  worldX: number
  worldY: number
}): { k: number; x: number; y: number } {
  const k = args.transform && Number.isFinite(args.transform.k) && args.transform.k > 0 ? args.transform.k : 1
  const viewportW = Number.isFinite(args.viewportW) ? Math.max(1, Math.floor(args.viewportW)) : 1
  const viewportH = Number.isFinite(args.viewportH) ? Math.max(1, Math.floor(args.viewportH)) : 1
  const worldX = Number.isFinite(args.worldX) ? args.worldX : 0
  const worldY = Number.isFinite(args.worldY) ? args.worldY : 0
  return {
    k,
    x: viewportW / 2 - worldX * k,
    y: viewportH / 2 - worldY * k,
  }
}

