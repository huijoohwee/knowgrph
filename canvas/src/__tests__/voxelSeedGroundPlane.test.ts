import type { GraphNode } from '@/lib/graph/types'
import { computePositionsVoxel } from '@/lib/three/positions.impl'
import { resolveVoxelGridStep } from '@/features/three/threeLayoutConfig'

type FullStackJson = {
  meta?: {
    layout?: {
      clusterAngles?: Record<string, number>
      orbitRadii?: Record<string, number>
    }
  }
  nodes?: Array<{ id?: string; label?: string; type?: string; cluster?: string }>
}

export function testVoxelModeSeedsOntoSnappedXyGroundPlaneFromFullStackJson() {
  const parsed: FullStackJson = {
    meta: {
      layout: {
        clusterAngles: {
          A: 0,
          B: 55,
          C: 120,
          D: 210,
        },
        orbitRadii: {
          problem: 200,
          solution: 380,
          concept: 280,
        },
      },
    },
    nodes: Array.from({ length: 48 }).map((_, i) => {
      const cluster = i % 4 === 0 ? 'A' : i % 4 === 1 ? 'B' : i % 4 === 2 ? 'C' : 'D'
      const type = i % 3 === 0 ? 'problem' : i % 3 === 1 ? 'solution' : 'concept'
      return {
        id: `p-fe-${i + 1}`,
        label: `n${i + 1}`,
        type,
        cluster,
      }
    }),
  }

  const clusterAngles = parsed.meta?.layout?.clusterAngles || {}
  const orbitRadii = parsed.meta?.layout?.orbitRadii || {}
  const srcNodes = Array.isArray(parsed.nodes) ? parsed.nodes : []
  if (srcNodes.length === 0) throw new Error('expected nodes from fixture')

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

  const pos = computePositionsVoxel(nodes, null, { seed2dPositions, seedAxis: { flipY: false, normalizeToVoxelSpan: false, centerToBounds: false } })
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]!
    const id = node.id
    const seed = seed2dPositions[id]
    if (!seed) throw new Error(`missing seed for ${id}`)
    const p = pos[id]
    if (!p) throw new Error(`missing voxel position for ${id}`)
    const expectedX = seed.x
    const expectedY = seed.y
    if (p[0] !== expectedX) throw new Error(`expected parity X for ${id}: ${p[0]} vs ${expectedX}`)
    if (p[1] !== expectedY) throw new Error(`expected parity Y for ${id}: ${p[1]} vs ${expectedY}`)
    if (p[2] !== 0) throw new Error(`expected ground-plane Z for ${id}: ${p[2]} === 0`)
    if (p[2] % grid !== 0) throw new Error(`expected snapped Z height for ${id}: ${p[2]} multiple of ${grid}`)
  }
}
