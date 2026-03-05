import type { GraphNode } from '@/lib/graph/types'
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

export function computePositions3d(nodes: GraphNode[], schema: GraphSchema | null): Record<string, Vec3> {
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
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const p = asVec3((node.properties || {})['pos3d'])
    if (p) {
      out[node.id] = p
      continue
    }
    const s = sphere[i] || [0, 0, 0]
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
    const z = s[2] + offsetIndex * layerSpacing
    out[node.id] = [s[0], s[1], z]
  }
  return out
}

