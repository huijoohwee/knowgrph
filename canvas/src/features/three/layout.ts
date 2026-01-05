import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { getThreeConfig } from '@/lib/graph/schema'

export type Vec3 = [number, number, number]

export function fibSphere(n: number, radius: number, seed?: number, minSpacing?: number): Vec3[] {
  if (n <= 0) return []
  const out: Vec3[] = []
  let s = typeof seed === 'number' ? Math.floor(seed) : 1
  const rnd = () => {
    s = (1103515245 * s + 12345) & 0x7fffffff
    return (s % 10000) / 10000
  }
  const offset = 2 / n
  const inc = Math.PI * (3 - Math.sqrt(5))
  const jit = radius > 0 && typeof minSpacing === 'number' && minSpacing > 0 ? Math.max(0, Math.min(0.3, (minSpacing / radius) * 0.5)) : 0
  for (let i = 0; i < n; i++) {
    let y = (i * offset - 1) + (offset * 0.5)
    if (jit > 0) {
      y = Math.max(-1, Math.min(1, y + ((rnd() * 2) - 1) * jit))
    }
    const r = Math.max(0, 1 - y * y) ** 0.5
    let phi = i * inc
    if (jit > 0) {
      phi = phi + ((rnd() * 2) - 1) * (jit * inc)
    }
    const x = Math.cos(phi) * r
    const z = Math.sin(phi) * r
    out.push([x * radius, y * radius, z * radius])
  }
  return out
}

export function asVec3(v: unknown): Vec3 | null {
  if (!Array.isArray(v)) return null
  if (v.length !== 3) return null
  const a = v[0], b = v[1], c = v[2]
  if (typeof a !== 'number' || typeof b !== 'number' || typeof c !== 'number') return null
  return [a, b, c]
}

export function usePositions(nodes: GraphNode[], schema: GraphSchema | null): Record<string, Vec3> {
  return useMemo(() => {
    const out: Record<string, Vec3> = {}
    const n = Math.max(1, nodes.length)
    const cfg = getThreeConfig(schema || undefined)
    const radiusCfg = typeof cfg.sphereRadius === 'number' ? cfg.sphereRadius : undefined
    const seedCfg = typeof cfg.seed === 'number' ? cfg.seed : undefined
    const minSpacingCfg = typeof cfg.minSpacing === 'number' ? cfg.minSpacing : undefined
    const radiusAuto = Math.max(60, Math.min(140, n * 2.2))
    const radius = radiusCfg && radiusCfg > 0 ? radiusCfg : radiusAuto
    const sphere = fibSphere(n, radius, seedCfg, minSpacingCfg)
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      const p = asVec3((node.properties || {})['pos3d'])
      if (p) { out[node.id] = p; continue }
      const s = sphere[i] || [0, 0, 0]
      out[node.id] = s
    }
    return out
  }, [nodes, schema])
}

export function Physics3D({ positions, nodes, edges, schema, dragOverrides }: { positions: Record<string, Vec3>; nodes: GraphNode[]; edges: GraphData['edges']; schema: GraphSchema; dragOverrides?: React.MutableRefObject<Record<string, Vec3>> }) {
  const n = nodes.length
  const idxById = useMemo(() => {
    const m = new Map<string, number>()
    for (let i = 0; i < n; i++) m.set(nodes[i].id, i)
    return m
  }, [nodes, n])
  const posX = useRef<Float32Array>(new Float32Array(Math.max(1, n)))
  const posY = useRef<Float32Array>(new Float32Array(Math.max(1, n)))
  const posZ = useRef<Float32Array>(new Float32Array(Math.max(1, n)))
  const velX = useRef<Float32Array>(new Float32Array(Math.max(1, n)))
  const velY = useRef<Float32Array>(new Float32Array(Math.max(1, n)))
  const velZ = useRef<Float32Array>(new Float32Array(Math.max(1, n)))
  const threeCfg = (schema as unknown as { three?: Record<string, number> }).three || {}
  const chargeVal = (schema.layout && schema.layout.forces && typeof schema.layout.forces.charge === 'number') ? schema.layout.forces.charge! : -300
  const radiusCfg = typeof threeCfg['sphereRadius'] === 'number' ? threeCfg['sphereRadius'] : undefined
  const radiusAuto = Math.max(60, Math.min(140, n * 2.2))
  const sphereRadius = radiusCfg && radiusCfg > 0 ? radiusCfg : radiusAuto
  const repelRadius = Math.max(10, Math.min(sphereRadius, (typeof threeCfg['minSpacing'] === 'number' ? Math.max(threeCfg['minSpacing'], 18) : 24)))
  const repelStrength = Math.max(10, Math.abs(chargeVal))
  const springStrength = 0.06
  const sphereStrength = 0.12
  const damping = 0.85
  const maxSpeed = 6.0
  const edgePairs = useMemo(() => {
    const linkDistanceByLabel = (schema.layout && schema.layout.forces && schema.layout.forces.linkDistanceByLabel) || {}
    const arr: Array<[number, number, number]> = []
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i]
      const si = idxById.get(String(e.source))
      const ti = idxById.get(String(e.target))
      if (si == null || ti == null) continue
      const dist = (linkDistanceByLabel && typeof linkDistanceByLabel[e.label] === 'number') ? linkDistanceByLabel[e.label]! : Math.max(28, Math.min(140, sphereRadius * 0.5))
      arr.push([si, ti, dist])
    }
    return arr
  }, [edges, idxById, schema, sphereRadius])
  React.useEffect(() => {
    const px = posX.current, py = posY.current, pz = posZ.current
    for (let i = 0; i < n; i++) {
      const id = nodes[i].id
      const p = positions[id] || [0, 0, 0]
      px[i] = p[0]; py[i] = p[1]; pz[i] = p[2]
    }
    velX.current.fill(0); velY.current.fill(0); velZ.current.fill(0)
  }, [nodes, positions, n])
  useFrame((_, delta) => {
    const dt = Math.max(0.008, Math.min(0.033, delta || 0.016))
    const px = posX.current, py = posY.current, pz = posZ.current
    const vx = velX.current, vy = velY.current, vz = velZ.current
    const overrides = dragOverrides ? dragOverrides.current : undefined
    if (overrides) {
      const behavior = schema.behavior || { allowEdgeCreation: true, allowNodeDrag: true }
      const gridEnabled = !!behavior.snapGrid?.enabled
      const gridSize = Math.max(1, behavior.snapGrid?.size ?? 10)
      const constraint = behavior.dragConstraint || 'free'
      for (let i = 0; i < n; i++) {
        const id = nodes[i].id
        const ov = overrides[id]
        if (!ov) continue
        let nx = ov[0]
        let ny = ov[1]
        const nz = ov[2]
        if (gridEnabled) {
          nx = Math.round(nx / gridSize) * gridSize
          ny = Math.round(ny / gridSize) * gridSize
        }
        if (constraint === 'axis-x') {
          ny = py[i]
        } else if (constraint === 'axis-y') {
          nx = px[i]
        } else if (constraint === 'none') {
          nx = px[i]
          ny = py[i]
        }
        px[i] = nx; py[i] = ny; pz[i] = nz
        vx[i] = 0; vy[i] = 0; vz[i] = 0
      }
    }
    const cellSize = repelRadius
    const grid = new Map<string, number[]>()
    for (let i = 0; i < n; i++) {
      const cx = Math.floor(px[i] / cellSize)
      const cy = Math.floor(py[i] / cellSize)
      const cz = Math.floor(pz[i] / cellSize)
      const key = `${cx}:${cy}:${cz}`
      const arr = grid.get(key)
      if (arr) { arr.push(i) } else { grid.set(key, [i]) }
    }
    const neigh = [-1, 0, 1]
    for (const [key, list] of grid) {
      const parts = key.split(':')
      const cx = Number(parts[0]), cy = Number(parts[1]), cz = Number(parts[2])
      for (let xi = 0; xi < neigh.length; xi++) {
        for (let yi = 0; yi < neigh.length; yi++) {
          for (let zi = 0; zi < neigh.length; zi++) {
            const nk = `${cx + neigh[xi]}:${cy + neigh[yi]}:${cz + neigh[zi]}`
            const other = grid.get(nk)
            if (!other) continue
            for (let a = 0; a < list.length; a++) {
              const i = list[a]
              for (let b = 0; b < other.length; b++) {
                const j = other[b]
                if (j <= i && nk === key) continue
                const dx = px[i] - px[j]
                const dy = py[i] - py[j]
                const dz = pz[i] - pz[j]
                const d2 = dx * dx + dy * dy + dz * dz
                const rr = repelRadius * repelRadius
                if (d2 > rr || d2 < 1e-6) continue
                const inv = 1 / Math.sqrt(d2)
                const f = (repelStrength * dt) / (d2 + 1)
                const fx = dx * inv * f
                const fy = dy * inv * f
                const fz = dz * inv * f
                vx[i] += fx; vy[i] += fy; vz[i] += fz
                vx[j] -= fx; vy[j] -= fy; vz[j] -= fz
              }
            }
          }
        }
      }
    }
    for (let k = 0; k < edgePairs.length; k++) {
      const si = edgePairs[k][0], ti = edgePairs[k][1], L = edgePairs[k][2]
      const dx = px[ti] - px[si]
      const dy = py[ti] - py[si]
      const dz = pz[ti] - pz[si]
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (len < 1e-6) continue
      const diff = len - L
      const f = springStrength * diff * dt
      const inv = 1 / len
      const fx = dx * inv * f
      const fy = dy * inv * f
      const fz = dz * inv * f
      vx[si] += fx; vy[si] += fy; vz[si] += fz
      vx[ti] -= fx; vy[ti] -= fy; vz[ti] -= fz
    }
    for (let i = 0; i < n; i++) {
      const rx = px[i], ry = py[i], rz = pz[i]
      const rlen = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1
      const diff = rlen - sphereRadius
      const f = sphereStrength * diff * dt
      const inv = 1 / rlen
      vx[i] -= rx * inv * f
      vy[i] -= ry * inv * f
      vz[i] -= rz * inv * f
    }
    for (let i = 0; i < n; i++) {
      vx[i] *= damping; vy[i] *= damping; vz[i] *= damping
      const s = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i] + vz[i] * vz[i])
      if (s > maxSpeed) {
        const inv = maxSpeed / s
        vx[i] *= inv; vy[i] *= inv; vz[i] *= inv
      }
      px[i] += vx[i]; py[i] += vy[i]; pz[i] += vz[i]
    }
    for (let i = 0; i < n; i++) {
      const id = nodes[i].id
      const p = positions[id]
      if (!p) continue
      p[0] = px[i]; p[1] = py[i]; p[2] = pz[i]
    }
  })
  return null
}
