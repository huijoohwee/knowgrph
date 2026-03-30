import fs from 'node:fs'

import type { GraphNode } from '@/lib/graph/types'
import { computePositionsVoxel } from '@/features/three/positions'
import { resolveVoxelGridStep, quantizeVoxelCoordToGridLine } from '@/features/three/threeLayoutConfig'

type FullStackJson = {
  meta?: {
    layout?: {
      clusterAngles?: Record<string, number>
      orbitRadii?: Record<string, number>
    }
  }
  nodes?: Array<{ id?: string; label?: string; type?: string; cluster?: string }>
}

const snapToGrid = (v: number, grid: number) => quantizeVoxelCoordToGridLine(v, grid)

export function testVoxelModeSeedsOntoSnappedXyGroundPlaneFromFullStackJson() {
  const inputPath = '/Users/huijoohwee/Documents/GitHub/huijoohwee/content/full-stack/full-stack.json'
  const raw = fs.readFileSync(inputPath, 'utf8')
  const parsed = JSON.parse(raw) as FullStackJson

  const clusterAngles = parsed.meta?.layout?.clusterAngles || {}
  const orbitRadii = parsed.meta?.layout?.orbitRadii || {}
  const srcNodes = Array.isArray(parsed.nodes) ? parsed.nodes : []
  if (srcNodes.length === 0) throw new Error('expected nodes from full-stack.json')

  const grid = resolveVoxelGridStep(null)

  const picked = srcNodes.filter(n => String(n.type || '').toLowerCase() !== 'hub').slice(0, 40)
  if (picked.length < 10) throw new Error('expected at least 10 non-hub nodes for voxel seed test')

  const nodes: GraphNode[] = picked.map((n, idx) => ({
    id: String(n.id || ''),
    label: String(n.label || n.id || ''),
    type: String(n.type || 'node'),
    properties: {
      cluster: String(n.cluster || ''),
      'visual:layer': idx * 10,
    },
  }))

  const seed2dPositions: Record<string, { x: number; y: number }> = {}
  for (let i = 0; i < picked.length; i += 1) {
    const n = picked[i]!
    const id = String(n.id || '')
    if (!id) continue
    const clusterId = String(n.cluster || '')
    const deg = typeof clusterAngles[clusterId] === 'number' ? clusterAngles[clusterId]! : 0
    const angle = (deg * Math.PI) / 180
    const t = String(n.type || '').toLowerCase()
    const r =
      t.includes('problem')
        ? (typeof orbitRadii.problem === 'number' ? orbitRadii.problem : 200)
        : t.includes('solution')
          ? (typeof orbitRadii.solution === 'number' ? orbitRadii.solution : 380)
          : (typeof orbitRadii.concept === 'number' ? orbitRadii.concept : 280)

    const baseX = Math.cos(angle) * r
    const baseY = Math.sin(angle) * r
    const offsetX = ((i % 7) - 3) * grid * 3
    const offsetY = (Math.floor(i / 7) - 2) * grid * 3
    seed2dPositions[id] = { x: baseX + offsetX, y: baseY + offsetY }
  }

  const seedShift = (() => {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let count = 0
    for (const v of Object.values(seed2dPositions)) {
      if (!v) continue
      const x = v.x
      const y = v.y
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
      count += 1
    }
    if (count < 2 || minX === Infinity) return { x: 0, y: 0 }
    return { x: (minX + maxX) * 0.5, y: (minY + maxY) * 0.5 }
  })()

  const pos = computePositionsVoxel(nodes, null, { seed2dPositions })
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]!
    const id = node.id
    const seed = seed2dPositions[id]
    if (!seed) throw new Error(`missing seed for ${id}`)
    const p = pos[id]
    if (!p) throw new Error(`missing voxel position for ${id}`)
    const expectedX = snapToGrid(seed.x - seedShift.x, grid)
    const expectedY = snapToGrid(seed.y - seedShift.y, grid)
    if (p[0] !== expectedX) throw new Error(`expected snapped X for ${id}: ${p[0]} vs ${expectedX}`)
    if (p[1] !== expectedY) throw new Error(`expected snapped Y for ${id}: ${p[1]} vs ${expectedY}`)
    if (!(p[2] >= grid)) throw new Error(`expected Z height above ground for ${id}: ${p[2]} >= ${grid}`)
    if (p[2] % grid !== 0) throw new Error(`expected snapped Z height for ${id}: ${p[2]} multiple of ${grid}`)
  }
}
