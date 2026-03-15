import type { GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { getThreeConfig } from '@/lib/graph/schema'
import { resolveGroupCollisions, type CollisionGroupItem } from '@/lib/graph/collision/boxCollision'

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

export function computePositions3d(
  nodes: GraphNode[],
  schema: GraphSchema | null,
  opts?: { seed2dPositions?: Record<string, { x: number; y: number }> | null },
): Record<string, Vec3> {
  const out: Record<string, Vec3> = {}
  const n = Math.max(1, nodes.length)
  const cfg = getThreeConfig(schema || undefined)
  const radiusCfg = typeof cfg.sphereRadius === 'number' ? cfg.sphereRadius : undefined
  const seedCfg = typeof cfg.seed === 'number' ? cfg.seed : undefined
  const minSpacingCfg = typeof cfg.minSpacing === 'number' ? cfg.minSpacing : undefined
  const radiusAuto = Math.max(60, Math.min(140, n * 2.2))
  const radius = radiusCfg && radiusCfg > 0 ? radiusCfg : radiusAuto
  const sphere = fibSphere(n, radius, seedCfg, minSpacingCfg)
  const layerValues = (() => {
    const vals: number[] = []
    for (let i = 0; i < nodes.length; i += 1) {
      const raw = (nodes[i]?.properties || {})['visual:layer']
      if (typeof raw === 'number' && Number.isFinite(raw)) vals.push(raw)
      else if (typeof raw === 'string') {
        const parsed = Number(raw.trim())
        if (Number.isFinite(parsed)) vals.push(parsed)
      }
    }
    const unique = Array.from(new Set(vals)).sort((a, b) => a - b)
    const map = new Map<number, number>()
    const mid = (unique.length - 1) / 2
    for (let i = 0; i < unique.length; i += 1) {
      map.set(unique[i]!, i - mid)
    }
    return map
  })()
  const layerSpacing = 20
  const canRelax = typeof minSpacingCfg === 'number' && Number.isFinite(minSpacingCfg) && minSpacingCfg > 0
  const nodeIndexById = new Map<string, number>()
  const relaxNodes: Array<{ vx: number; vy: number; vz: number }> = []
  const relaxGroups: CollisionGroupItem[] = []

  const seed2d = opts?.seed2dPositions || null
  const readSeedXy = (id: string): { x: number; y: number } | null => {
    if (seed2d) {
      const p = seed2d[id]
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return { x: p.x, y: p.y }
    }
    return null
  }

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const p = asVec3((node.properties || {})['pos3d'])
    if (p) {
      out[node.id] = p
      continue
    }

    const rawLayer = (node.properties || {})['visual:layer']
    const layerVal =
      typeof rawLayer === 'number'
        ? rawLayer
        : typeof rawLayer === 'string'
          ? Number(rawLayer.trim())
          : null
    const offsetIndex =
      typeof layerVal === 'number' && Number.isFinite(layerVal)
        ? (layerValues.get(layerVal) ?? 0)
        : 0
    const z = offsetIndex * layerSpacing

    const seed = readSeedXy(String(node.id || '').trim())
    const nx = typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : null
    const ny = typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : null
    if (seed) {
      out[node.id] = [seed.x, seed.y, z]
    } else if (nx != null && ny != null) {
      out[node.id] = [nx, ny, z]
    } else {
      const s = sphere[i] || [0, 0, 0]
      out[node.id] = [s[0], s[1], s[2] + z]
    }
    if (canRelax) {
      const id = String(node.id || '').trim()
      nodeIndexById.set(id, relaxGroups.length)
      relaxNodes.push({ vx: 0, vy: 0, vz: 0 })
      const half = Math.max(1e-6, Number(minSpacingCfg) * 0.5)
      const cur = out[id] || [0, 0, 0]
      relaxGroups.push({
        id,
        cx: cur[0],
        cy: cur[1],
        cz: cur[2],
        halfW: half,
        halfH: half,
        halfD: half,
        hasZ: true,
        gap: 0,
        movableIdxs: [relaxGroups.length],
      })
    }
  }


  if (canRelax && relaxGroups.length >= 2) {
    const applyBackToOut = () => {
      for (let i = 0; i < relaxGroups.length; i += 1) {
        const g = relaxGroups[i]
        const id = String(g.id || '').trim()
        if (!id) continue
        const prev = out[id]
        if (!prev) continue
        out[id] = [g.cx, g.cy, typeof g.cz === 'number' && Number.isFinite(g.cz) ? g.cz : prev[2]]
      }
    }

    for (let k = 0; k < 14; k += 1) {
      for (let i = 0; i < relaxNodes.length; i += 1) {
        relaxNodes[i].vx = 0
        relaxNodes[i].vy = 0
        relaxNodes[i].vz = 0
      }

      resolveGroupCollisions({
        groups: relaxGroups,
        nodes: relaxNodes as unknown as any,
        strength: 0.9,
        touchEpsilon: 1,
        skipSameGroup: true,
      })

      for (let i = 0; i < relaxGroups.length; i += 1) {
        const g = relaxGroups[i]
        const v = relaxNodes[i]
        const vx = typeof v?.vx === 'number' && Number.isFinite(v.vx) ? v.vx : 0
        const vy = typeof v?.vy === 'number' && Number.isFinite(v.vy) ? v.vy : 0
        const vz = typeof v?.vz === 'number' && Number.isFinite(v.vz) ? v.vz : 0
        if (!vx && !vy && !vz) continue
        g.cx += vx
        g.cy += vy
        g.cz = (typeof g.cz === 'number' && Number.isFinite(g.cz) ? g.cz : 0) + vz
      }
    }

    applyBackToOut()
  }
  return out
}
