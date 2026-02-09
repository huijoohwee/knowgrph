export const isFlowTransformShowingGraph = (
  t: { k: number; x: number; y: number },
  args: {
    nodes: Array<{ x?: unknown; y?: unknown }>
    viewportW: number
    viewportH: number
    nodeW: number
    nodeH: number
  },
): boolean => {
  const nodes = args.nodes
  if (!nodes || nodes.length === 0) return true
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const nodeW = Math.max(1, args.nodeW)
  const nodeH = Math.max(1, args.nodeH)

  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i] as { x?: unknown; y?: unknown }
    const x = n?.x
    const y = n?.y
    if (typeof x !== 'number' || typeof y !== 'number') continue
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + nodeW)
    maxY = Math.max(maxY, y + nodeH)
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return false

  const k = typeof t.k === 'number' && Number.isFinite(t.k) ? t.k : 1
  const tx = typeof t.x === 'number' && Number.isFinite(t.x) ? t.x : 0
  const ty = typeof t.y === 'number' && Number.isFinite(t.y) ? t.y : 0
  const sx0 = minX * k + tx
  const sx1 = maxX * k + tx
  const sy0 = minY * k + ty
  const sy1 = maxY * k + ty
  const left = Math.min(sx0, sx1)
  const right = Math.max(sx0, sx1)
  const top = Math.min(sy0, sy1)
  const bottom = Math.max(sy0, sy1)
  const margin = 80
  const vw = Math.max(1, args.viewportW)
  const vh = Math.max(1, args.viewportH)
  if (right < -margin) return false
  if (bottom < -margin) return false
  if (left > vw + margin) return false
  if (top > vh + margin) return false
  return true
}

