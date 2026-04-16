import { placeFlowFallbackSeedPositions } from '@/components/FlowCanvas/seedFallbackPositions'

export function testFlowFallbackSeedPositionsAreViewportInvariant() {
  const ids = ['d', 'a', 'c', 'b'].sort((a, b) => a.localeCompare(b))
  const first = placeFlowFallbackSeedPositions({ ids, cellW: 180, cellH: 120 })
  const second = placeFlowFallbackSeedPositions({ ids, cellW: 180, cellH: 120 })

  if (JSON.stringify(first) !== JSON.stringify(second)) {
    throw new Error('expected deterministic fallback seed positions')
  }
}

export function testFlowFallbackSeedPositionsStayCenteredAtWorldOrigin() {
  const ids = ['a', 'b', 'c', 'd']
  const cellW = 180
  const cellH = 120
  const positions = placeFlowFallbackSeedPositions({ ids, cellW, cellH })
  const centers = ids.map(id => {
    const p = positions[id]!
    return { x: p.x + cellW / 2, y: p.y + cellH / 2 }
  })
  const centroid = centers.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
  centroid.x /= centers.length
  centroid.y /= centers.length

  if (Math.abs(centroid.x) > 0.0001 || Math.abs(centroid.y) > 0.0001) {
    throw new Error(`expected fallback seed positions centered at world origin, got ${centroid.x},${centroid.y}`)
  }
}
