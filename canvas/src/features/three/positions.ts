import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { resolveGroupCollisions, type CollisionGroupItem } from '@/lib/graph/collision/boxCollision'
import { isRadarHubNode, isRadarSpokeEdge } from '@/lib/graph/radarForces'

import { resolveMinSpacing, resolveSphereEllipsoidAxes, resolveSphereLayerSpacing, resolveSphereRadius, resolveThreeSeed, resolveVoxelGridStep, quantizeVoxelCoordToGridLine } from './threeLayoutConfig'

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
  opts?: { seed2dPositions?: Record<string, { x: number; y: number }> | null; seedAxis?: { flipY?: boolean; normalizeToVoxelSpan?: boolean; centerToBounds?: boolean } },
): Record<string, Vec3> {
  const out: Record<string, Vec3> = {}
  if (!nodes.length) return out
  const seed2d = opts?.seed2dPositions || null
  const seedAxis = opts?.seedAxis || null
  const grid = resolveVoxelGridStep(schema)
  const seedShift = (() => {
    if (seedAxis?.centerToBounds === false) return { x: 0, y: 0 }
    if (!seed2d) return { x: 0, y: 0 }
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let count = 0
    for (const v of Object.values(seed2d)) {
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
  const seedScale = (() => {
    if (!seed2d || seedAxis?.normalizeToVoxelSpan !== true) return 1
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let count = 0
    for (const v of Object.values(seed2d)) {
      if (!v) continue
      const x = v.x - seedShift.x
      const y0 = v.y - seedShift.y
      const y = seedAxis?.flipY === true ? -y0 : y0
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
      count += 1
    }
    if (count < 2 || minX === Infinity) return 1
    const halfSpan = Math.max((maxX - minX) * 0.5, (maxY - minY) * 0.5)
    if (!Number.isFinite(halfSpan) || halfSpan < 1e-6) return 1

    const nodeCount = nodes.length
    const approxSpan = Math.max(200, Math.min(2400, Math.ceil(Math.sqrt(Math.max(1, nodeCount))) * grid * 6))
    let divisions = Math.max(4, Math.min(120, Math.round(approxSpan / Math.max(1, grid))))
    if (divisions % 2 !== 0) divisions = Math.min(120, divisions + 1)
    const span = divisions * grid
    const targetHalfSpan = Math.max(grid * 4, span * 0.5)
    const s = targetHalfSpan / halfSpan
    if (!Number.isFinite(s) || s <= 0) return 1
    return Math.max(0.05, Math.min(1, s))
  })()
  const heightByType = (_node: GraphNode): number => 0
  const readSeed = (id: string): { x: number; y: number } | null => {
    if (!seed2d) return null
    const s = seed2d[id]
    if (!s) return null
    if (!Number.isFinite(s.x) || !Number.isFinite(s.y)) return null
    const x = s.x - seedShift.x
    const y0 = s.y - seedShift.y
    const y = seedAxis?.flipY === true ? -y0 : y0
    return { x: x * seedScale, y: y * seedScale }
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
  const placeSeeded = (planeX: number, planeY: number, height: number): Vec3 => {
    const x = quantizeVoxelCoordToGridLine(planeX, grid)
    const y = quantizeVoxelCoordToGridLine(planeY, grid)
    const z = quantizeVoxelCoordToGridLine(height, grid)
    occupancy.add(`${x}:${y}:${z}`)
    return [x, y, z]
  }
  const reserve = (planeX: number, planeY: number, height: number): Vec3 => {
    const baseX = quantizeVoxelCoordToGridLine(planeX, grid)
    const baseY = quantizeVoxelCoordToGridLine(planeY, grid)
    const baseZ = quantizeVoxelCoordToGridLine(height, grid)

    const tryReserve = (x: number, y: number, z: number): Vec3 | null => {
      const key = `${x}:${y}:${z}`
      if (occupancy.has(key)) return null
      occupancy.add(key)
      return [x, y, z]
    }

    const direct = tryReserve(baseX, baseY, baseZ)
    if (direct) return direct

    const maxRing = Math.max(24, Math.ceil(Math.sqrt(Math.max(1, nodes.length))) * 8)
    for (let ring = 1; ring <= maxRing; ring += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        const x = baseX + dx * grid
        const yTop = baseY + ring * grid
        const yBottom = baseY - ring * grid
        const top = tryReserve(x, yTop, baseZ)
        if (top) return top
        const bottom = tryReserve(x, yBottom, baseZ)
        if (bottom) return bottom
      }
      for (let dy = -ring + 1; dy <= ring - 1; dy += 1) {
        const y = baseY + dy * grid
        const xRight = baseX + ring * grid
        const xLeft = baseX - ring * grid
        const right = tryReserve(xRight, y, baseZ)
        if (right) return right
        const left = tryReserve(xLeft, y, baseZ)
        if (left) return left
      }
    }

    let ring = maxRing + 1
    while (ring < maxRing + 256) {
      const x = baseX + ring * grid
      const fallback = tryReserve(x, baseY, baseZ)
      if (fallback) return fallback
      ring += 1
    }
    return [baseX, baseY, baseZ]
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
      const seed = seededPosByNodeId.get(String(node.id || ''))
      const p = seed
        ? placeSeeded(seed.x, seed.y, heightByType(node))
        : reserve(center.x + i * grid * 2, center.y, heightByType(node))
      out[node.id] = p
    }
    for (let i = 0; i < nonHubs.length; i += 1) {
      const node = nonHubs[i]
      const id = String(node.id || '')
      let px = center.x
      let py = center.y
      const seed = seededPosByNodeId.get(id)
      if (seed) {
        out[node.id] = placeSeeded(seed.x, seed.y, heightByType(node))
        continue
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
    const s = readSeed(node.id)
    if (s && Number.isFinite(s.x) && Number.isFinite(s.y)) {
      out[node.id] = placeSeeded(s.x, s.y, heightByType(node))
      continue
    }
    out[node.id] = reserve(i * grid, 0, heightByType(node))
  }
  return out
}
