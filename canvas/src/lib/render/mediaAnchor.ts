export function readNodeCenterWorld2d(
  node: { x?: unknown; y?: unknown; fx?: unknown; fy?: unknown; width?: unknown; height?: unknown } | null | undefined,
  opts?: { coords?: 'center' | 'topLeft' },
): { x: number; y: number } | null {
  if (!node) return null
  const xRaw = node.x
  const yRaw = node.y
  const fxRaw = node.fx
  const fyRaw = node.fy
  const x = typeof xRaw === 'number' && Number.isFinite(xRaw) ? xRaw : typeof fxRaw === 'number' && Number.isFinite(fxRaw) ? fxRaw : null
  const y = typeof yRaw === 'number' && Number.isFinite(yRaw) ? yRaw : typeof fyRaw === 'number' && Number.isFinite(fyRaw) ? fyRaw : null
  if (x == null || y == null) return null
  const coords = opts?.coords === 'topLeft' ? 'topLeft' : 'center'
  if (coords === 'center') return { x, y }
  const w = node.width
  const h = node.height
  if (typeof w !== 'number' || typeof h !== 'number' || !Number.isFinite(w) || !Number.isFinite(h)) return { x, y }
  return { x: x + w / 2, y: y + h / 2 }
}
