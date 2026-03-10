export function readNodeCenterWorld2d(
  node: { x?: unknown; y?: unknown; width?: unknown; height?: unknown } | null | undefined,
  opts?: { coords?: 'center' | 'topLeft' },
): { x: number; y: number } | null {
  if (!node) return null
  const x = node.x
  const y = node.y
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null
  const coords = opts?.coords === 'topLeft' ? 'topLeft' : 'center'
  if (coords === 'center') return { x, y }
  const w = node.width
  const h = node.height
  if (typeof w !== 'number' || typeof h !== 'number' || !Number.isFinite(w) || !Number.isFinite(h)) return { x, y }
  return { x: x + w / 2, y: y + h / 2 }
}

