import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { resolveGroupCollisions, type CollisionGroupItem } from '@/lib/graph/collision/boxCollision'
import { isRadarHubNode, isRadarSpokeEdge } from '@/lib/graph/radarForces'

import { resolveMinSpacing, resolveSphereEllipsoidAxes, resolveSphereLayerSpacing, resolveSphereRadius, resolveThreeSeed, resolveVoxelGridStep, quantizeVoxelCoordToGridLine } from './threeLayoutConfig'
import { readThreeRenderOrderOffset } from './zOrder'

export type Vec3 = [number, number, number]

const computeLayerOffsetMap = (nodes: GraphNode[]): Map<number, number> => {
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
}

export const computeLayerOffsetIndices = (nodes: GraphNode[]): Float32Array => {
  const out = new Float32Array(Math.max(1, nodes.length))
  if (!nodes || nodes.length === 0) return out
  const layerValues = computeLayerOffsetMap(nodes)
  for (let i = 0; i < nodes.length; i += 1) {
    const rawLayer = (nodes[i]?.properties || {})['visual:layer']
    const layerVal =
      typeof rawLayer === 'number'
        ? rawLayer
        : typeof rawLayer === 'string'
          ? Number(rawLayer.trim())
          : null
    out[i] =
      typeof layerVal === 'number' && Number.isFinite(layerVal)
        ? (layerValues.get(layerVal) ?? 0)
        : 0
  }
  return out
}

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

const hash01 = (input: string): number => {
  let h = 2166136261 >>> 0
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

const projectDirectionToEllipsoidShell = (
  dx: number,
  dy: number,
  dz: number,
  targetR: number,
  axisX: number,
  axisY: number,
  axisZ: number,
): Vec3 => {
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (!(len > 1e-6)) return [targetR * axisX, 0, 0]
  const nx = dx / len
  const ny = dy / len
  const nz = dz / len
  const denom = Math.sqrt(
    (nx * nx) / Math.max(1e-6, axisX * axisX) +
    (ny * ny) / Math.max(1e-6, axisY * axisY) +
    (nz * nz) / Math.max(1e-6, axisZ * axisZ),
  )
  const shellScale = denom > 1e-6 ? targetR / denom : targetR
  return [nx * shellScale, ny * shellScale, nz * shellScale]
}

export function computePositions3d(
  nodes: GraphNode[],
  schema: GraphSchema | null,
  opts?: { seed2dPositions?: Record<string, { x: number; y: number }> | null; edges?: GraphEdge[] | null },
): Record<string, Vec3> {
  const out: Record<string, Vec3> = {}
  const n = Math.max(1, nodes.length)
  const radius = resolveSphereRadius(schema, n)
  const seedCfg = resolveThreeSeed(schema)
  const minSpacingCfg = resolveMinSpacing(schema)
  const ellipsoidAxes = resolveSphereEllipsoidAxes(schema)
  const axisX = ellipsoidAxes.x
  const axisY = ellipsoidAxes.y
  const axisZ = ellipsoidAxes.z
  const sphere = fibSphere(n, radius, seedCfg, minSpacingCfg)
  const layerOffsetIndices = computeLayerOffsetIndices(nodes)
  const canRelax = typeof minSpacingCfg === 'number' && Number.isFinite(minSpacingCfg) && minSpacingCfg > 0
  const layerSpacing = resolveSphereLayerSpacing(schema)
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

    const offsetIndex = Number.isFinite(layerOffsetIndices[i]) ? layerOffsetIndices[i]! : 0
    const targetR = radius + offsetIndex * layerSpacing

    const seed = readSeedXy(String(node.id || '').trim())
    const nx = typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : null
    const ny = typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : null
    const s = sphere[i] || [0, 0, 0]
    const projectedSeed = projectDirectionToEllipsoidShell(s[0], s[1], s[2], targetR, axisX, axisY, axisZ)
    const seedZ = projectedSeed[2]
    if (seed) {
      out[node.id] = projectDirectionToEllipsoidShell(seed.x, seed.y, seedZ, targetR, axisX, axisY, axisZ)
    } else if (nx != null && ny != null) {
      out[node.id] = projectDirectionToEllipsoidShell(nx, ny, seedZ, targetR, axisX, axisY, axisZ)
    } else {
      out[node.id] = projectedSeed
    }
    if (canRelax) {
      const id = String(node.id || '').trim()
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

  const hubOrbitEnabled = schema?.three?.globeHubOrbitEnabled !== false
  if (hubOrbitEnabled && nodes.length >= 3) {
    const edges = Array.isArray(opts?.edges) ? opts!.edges! : []
    const hubOrbitRadiusFactorRaw = schema?.three?.globeHubOrbitRadiusFactor
    const hubOrbitRadiusFactor = typeof hubOrbitRadiusFactorRaw === 'number' && Number.isFinite(hubOrbitRadiusFactorRaw)
      ? Math.max(0.05, Math.min(0.8, hubOrbitRadiusFactorRaw))
      : 0.2
    const nodeById = new Map<string, GraphNode>()
    const hubIds: string[] = []
    const hubSet = new Set<string>()
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]
      const id = String(node.id || '').trim()
      if (!id) continue
      nodeById.set(id, node)
      if (isRadarHubNode(node)) {
        hubIds.push(id)
        hubSet.add(id)
      }
    }
    if (hubIds.length > 0) {
      hubIds.sort((a, b) => a.localeCompare(b))
      const hubByCluster = new Map<string, string>()
      const nodeIndexById = new Map<string, number>()
      for (let i = 0; i < hubIds.length; i += 1) {
        const hubId = hubIds[i]!
        const hubNode = nodeById.get(hubId)
        const props = ((hubNode?.properties || {}) as Record<string, unknown>)
        const cluster = String(props['kg:radarCluster'] || hubId).trim()
        if (!cluster) continue
        if (!hubByCluster.has(cluster)) hubByCluster.set(cluster, hubId)
      }
      const membersByHub = new Map<string, string[]>()
      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i]
        const id = String(node.id || '').trim()
        if (!id || hubSet.has(id)) continue
        nodeIndexById.set(id, i)
        const props = ((node.properties || {}) as Record<string, unknown>)
        const cluster = String(props['kg:radarCluster'] || '').trim()
        const owner = (cluster && hubByCluster.get(cluster)) || hubIds[i % hubIds.length]
        const arr = membersByHub.get(owner) || []
        arr.push(id)
        membersByHub.set(owner, arr)
      }
      for (let i = 0; i < edges.length; i += 1) {
        const edge = edges[i]
        if (!edge || !isRadarSpokeEdge(edge)) continue
        const src = String(edge.source || '').trim()
        const tgt = String(edge.target || '').trim()
        if (!src || !tgt) continue
        const hubId = hubSet.has(src) ? src : (hubSet.has(tgt) ? tgt : '')
        const nodeId = hubId === src ? tgt : (hubId === tgt ? src : '')
        if (!hubId || !nodeId || hubSet.has(nodeId)) continue
        const arr = membersByHub.get(hubId) || []
        if (!arr.includes(nodeId)) arr.push(nodeId)
        membersByHub.set(hubId, arr)
      }
      for (let hi = 0; hi < hubIds.length; hi += 1) {
        const hubId = hubIds[hi]!
        const hubPos = out[hubId]
        if (!hubPos) continue
        const members = [...(membersByHub.get(hubId) || [])].sort((a, b) => a.localeCompare(b))
        if (members.length === 0) continue
        const hLen = Math.sqrt(hubPos[0] * hubPos[0] + hubPos[1] * hubPos[1] + hubPos[2] * hubPos[2])
        if (!(hLen > 1e-6)) continue
        const hn: Vec3 = [hubPos[0] / hLen, hubPos[1] / hLen, hubPos[2] / hLen]
        const ref: Vec3 = Math.abs(hn[1]) < 0.92 ? [0, 1, 0] : [1, 0, 0]
        const ux = ref[1] * hn[2] - ref[2] * hn[1]
        const uy = ref[2] * hn[0] - ref[0] * hn[2]
        const uz = ref[0] * hn[1] - ref[1] * hn[0]
        const ul = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1
        const u: Vec3 = [ux / ul, uy / ul, uz / ul]
        const vx = hn[1] * u[2] - hn[2] * u[1]
        const vy = hn[2] * u[0] - hn[0] * u[2]
        const vz = hn[0] * u[1] - hn[1] * u[0]
        const v: Vec3 = [vx, vy, vz]
        const capBase = 9
        for (let mi = 0; mi < members.length; mi += 1) {
          const nodeId = members[mi]!
          const nodeIndex = nodeIndexById.get(nodeId) ?? -1
          const targetR = nodeIndex >= 0 && Number.isFinite(layerOffsetIndices[nodeIndex])
            ? radius + layerOffsetIndices[nodeIndex]! * layerSpacing
            : radius
          const ring = Math.floor(mi / capBase)
          const inRing = mi % capBase
          const ringSize = Math.min(18, Math.max(capBase, members.length - ring * capBase))
          const baseAngle = hash01(`${hubId}:${nodeId}:orbit`) * Math.PI * 2
          const angle = baseAngle + ((Math.PI * 2 * inRing) / Math.max(1, ringSize))
          const orbitR = targetR * hubOrbitRadiusFactor * (1 + ring * 0.52)
          const tangentX = u[0] * Math.cos(angle) + v[0] * Math.sin(angle)
          const tangentY = u[1] * Math.cos(angle) + v[1] * Math.sin(angle)
          const tangentZ = u[2] * Math.cos(angle) + v[2] * Math.sin(angle)
          const dirX = hn[0] * targetR + tangentX * orbitR
          const dirY = hn[1] * targetR + tangentY * orbitR
          const dirZ = hn[2] * targetR + tangentZ * orbitR
          out[nodeId] = projectDirectionToEllipsoidShell(dirX, dirY, dirZ, targetR, axisX, axisY, axisZ)
        }
      }
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

export function computePositionsVoxel(
  nodes: GraphNode[],
  schema: GraphSchema | null,
  opts?: { seed2dPositions?: Record<string, { x: number; y: number }> | null },
): Record<string, Vec3> {
  const out: Record<string, Vec3> = {}
  if (!nodes.length) return out
  const seed2d = opts?.seed2dPositions || null
  const grid = resolveVoxelGridStep(schema)
  const readNodeZBias = (node: GraphNode): number => {
    const props = (node.properties || {}) as Record<string, unknown>
    const zOffset = readThreeRenderOrderOffset(props)
    const rawLayer = props['visual:layer']
    const layer =
      typeof rawLayer === 'number'
        ? rawLayer
        : typeof rawLayer === 'string'
          ? Number(rawLayer.trim())
          : 0
    if (Number.isFinite(layer)) {
      return zOffset + layer * 0.5
    }
    return zOffset
  }
  const heightByType = (node: GraphNode): number => {
    const t = String(node.type || '').toLowerCase()
    const tierStep = Math.max(grid, Math.round(grid * 1.15))
    const bias = Math.round(readNodeZBias(node) * (grid * 0.45))
    const base = t.includes('hub')
      ? tierStep * 3
      : t.includes('concept')
        ? tierStep * 2
        : t.includes('problem')
          ? tierStep
          : t.includes('solution')
            ? 0
            : tierStep
    const minHeight = grid
    return Math.max(minHeight, base + bias)
  }
  const readSeed = (id: string): { x: number; y: number } | null => {
    if (!seed2d) return null
    const s = seed2d[id]
    if (!s) return null
    if (!Number.isFinite(s.x) || !Number.isFinite(s.y)) return null
    return { x: s.x, y: s.y }
  }
  const seededPosByNodeId = new Map<string, { x: number; y: number }>()
  for (let i = 0; i < nodes.length; i += 1) {
    const id = String(nodes[i].id || '')
    const seed = readSeed(id)
    if (!seed) continue
    seededPosByNodeId.set(id, seed)
  }

  const membersByCluster = new Map<string, GraphNode[]>()
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const id = String(node.id || '')
    const props = (node.properties || {}) as Record<string, unknown>
    const cluster = String(
      props['kg:radarCluster'] ||
      props['cluster'] ||
      props['group'] ||
      node.type ||
      'cluster',
    ).trim() || 'cluster'
    const list = membersByCluster.get(cluster) || []
    list.push(node)
    membersByCluster.set(cluster, list)
    void id
  }
  const clusterIds = Array.from(membersByCluster.keys()).sort((a, b) => a.localeCompare(b))
  const clusterCenterById = new Map<string, { x: number; y: number; seeded: boolean }>()
  const clusterRingR = Math.max(grid * 8, grid * 4 + clusterIds.length * grid * 0.9)
  for (let i = 0; i < clusterIds.length; i += 1) {
    const cid = clusterIds[i]!
    const members = membersByCluster.get(cid) || []
    let sx = 0
    let sy = 0
    let count = 0
    for (let j = 0; j < members.length; j += 1) {
      const id = String(members[j].id || '')
      const seed = seededPosByNodeId.get(id)
      if (!seed) continue
      sx += seed.x
      sy += seed.y
      count += 1
    }
    if (count > 0) {
      clusterCenterById.set(cid, {
        x: sx / count,
        y: sy / count,
        seeded: true,
      })
    } else {
      const angle = (Math.PI * 2 * i) / Math.max(1, clusterIds.length)
      clusterCenterById.set(cid, {
        x: Math.round((Math.cos(angle) * clusterRingR) / grid) * grid,
        y: Math.round((Math.sin(angle) * clusterRingR) / grid) * grid,
        seeded: false,
      })
    }
  }
  const occupancy = new Set<string>()
  const reserve = (planeX: number, planeY: number, height: number): Vec3 => {
    let qx = quantizeVoxelCoordToGridLine(planeX, grid)
    let qy = quantizeVoxelCoordToGridLine(planeY, grid)
    let qz = quantizeVoxelCoordToGridLine(height, grid)

    const baseX = qx
    const baseY = qy
    const baseZ = qz

    for (let lift = 0; lift < 24; lift += 1) {
      const zz = baseZ + lift * grid
      const key = `${baseX}:${baseY}:${zz}`
      if (!occupancy.has(key)) {
        occupancy.add(key)
        return [baseX, baseY, zz]
      }
    }

    let tries = 0
    while (tries < 80) {
      const key = `${qx}:${qy}:${qz}`
      if (!occupancy.has(key)) {
        occupancy.add(key)
        return [qx, qy, qz]
      }
      tries += 1
      const r = Math.ceil(tries / 8)
      qx += ((tries % 2) * 2 - 1) * r * grid
      qy += (((tries >> 1) % 2) * 2 - 1) * r * grid
    }
    const fallbackKey = `${qx}:${qy}:${qz}`
    occupancy.add(fallbackKey)
    return [qx, qy, qz]
  }
  const spiralCellAt = (index: number): { x: number; z: number } => {
    if (index <= 0) return { x: 0, z: 0 }
    let x = 0
    let z = 0
    let step = 1
    let i = 0
    while (i < index) {
      for (let n = 0; n < step && i < index; n += 1) { x += 1; i += 1 }
      for (let n = 0; n < step && i < index; n += 1) { z += 1; i += 1 }
      step += 1
      for (let n = 0; n < step && i < index; n += 1) { x -= 1; i += 1 }
      for (let n = 0; n < step && i < index; n += 1) { z -= 1; i += 1 }
      step += 1
    }
    return { x, z }
  }
  for (let c = 0; c < clusterIds.length; c += 1) {
    const cid = clusterIds[c]!
    const center = clusterCenterById.get(cid) || { x: 0, y: 0, seeded: false }
    const members = [...(membersByCluster.get(cid) || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)))
    const hubs = members.filter(n => String(n.type || '').toLowerCase().includes('hub'))
    const nonHubs = members.filter(n => !String(n.type || '').toLowerCase().includes('hub'))
    for (let i = 0; i < hubs.length; i += 1) {
      const node = hubs[i]
      const p = reserve(center.x + i * grid * 2, center.y, heightByType(node))
      out[node.id] = p
    }
    for (let i = 0; i < nonHubs.length; i += 1) {
      const node = nonHubs[i]
      const id = String(node.id || '')
      let px = center.x
      let py = center.y
      const seed = seededPosByNodeId.get(id)
      if (seed) {
        px = seed.x
        py = seed.y
      } else {
        const type = String(node.type || '').toLowerCase()
        const base = type.includes('problem') ? 6 : type.includes('solution') ? 3 : type.includes('concept') ? 2 : 5
        const cell = spiralCellAt(i + base)
        px = center.x + cell.x * grid
        py = center.y + cell.z * grid
      }
      const p = reserve(px, py, heightByType(node))
      out[node.id] = p
    }
  }
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    if (out[node.id]) continue
    const s = seed2d ? seed2d[node.id] : null
    if (s && Number.isFinite(s.x) && Number.isFinite(s.y)) {
      out[node.id] = reserve(s.x, s.y, heightByType(node))
      continue
    }
    out[node.id] = reserve(i * grid, 0, heightByType(node))
  }
  return out
}
