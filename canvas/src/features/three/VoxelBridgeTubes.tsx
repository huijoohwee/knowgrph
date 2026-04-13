import React from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, CatmullRomCurve3, Color, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, SphereGeometry, TubeGeometry, Vector3, type Curve, type Material } from 'three'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { Vec3 } from './layout'
import { resolveVoxelClusterColor, resolveVoxelClusterKey } from './voxelStyle'
import { resolveVoxelGridStep } from './threeLayoutConfig'
import { THREE_RENDER_ORDER } from './renderOrder'

type ClusterHub = { key: string; pos: Vec3; color: string; sample: GraphNode | null }
type Bridge = { key: string; a: ClusterHub; b: ClusterHub; count: number; sampleEdgeId: string }

const clamp = (v: number, min: number, max: number): number => {
  if (v < min) return min
  if (v > max) return max
  return v
}

function stableHash01(input: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

function mixColors(a: string, b: string): string {
  const ca = new Color(a)
  const cb = new Color(b)
  ca.lerp(cb, 0.5)
  return '#' + ca.getHexString()
}

function CurveFlowParticles({ curve, count, speed, color, size, paused }: { curve: Curve<Vector3>; count: number; speed: number; color: string; size: number; paused?: boolean }) {
  const MAX_CURVE_PARTICLE_INSTANCES = 128
  const meshRef = React.useRef<InstancedMesh | null>(null)
  const offsetsRef = React.useRef<number[]>([])
  const posRef = React.useRef(new Vector3())
  const matRef = React.useRef(new Matrix4())
  const baseSpeed = clamp(speed, 0.01, 6)
  const geom = React.useMemo(() => new SphereGeometry(Math.max(0.2, size), 8, 8), [size])
  React.useEffect(() => {
    return () => {
      try {
        geom.dispose()
      } catch {
        void 0
      }
    }
  }, [geom])
  React.useEffect(() => {
    const n = Math.max(0, Math.min(MAX_CURVE_PARTICLE_INSTANCES, Math.floor(count)))
    const next: number[] = []
    for (let i = 0; i < n; i += 1) next.push(Math.random())
    offsetsRef.current = next
    const mesh = meshRef.current
    if (!mesh) return
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
  }, [MAX_CURVE_PARTICLE_INSTANCES, count])
  useFrame(({ clock }) => {
    if (paused) return
    const mesh = meshRef.current
    if (!mesh) return
    const n = mesh.count
    if (!n) return
    const offsets = offsetsRef.current
    if (offsets.length === 0) return
    const t = clock.getElapsedTime()
    const pos = posRef.current
    const mat = matRef.current
    const limit = Math.min(n, offsets.length)
    for (let i = 0; i < limit; i += 1) {
      const phase = offsets[i] || 0
      const s = ((phase + t * baseSpeed) % 1)
      curve.getPointAt(s, pos)
      mat.makeTranslation(pos.x, pos.y, pos.z)
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  })
  if (count <= 0) return null
  return (
    <instancedMesh ref={meshRef} args={[geom, undefined as unknown as Material, MAX_CURVE_PARTICLE_INSTANCES]} renderOrder={THREE_RENDER_ORDER.edges - 1}>
      <meshBasicMaterial color={color} transparent opacity={0.75} depthWrite={false} blending={AdditiveBlending} />
    </instancedMesh>
  )
}

function VoxelBridgeTube({ bridge, radius, baseOpacity, pulseStrength, archHeightFactor, particleCount, particleSpeed, particleSize, particlesEnabled, paused, hoveredEdgeId, onSelectEdge, onHoverEdge, onHoverEdgeIdChange }: {
  bridge: Bridge
  radius: number
  baseOpacity: number
  pulseStrength: number
  archHeightFactor: number
  particleCount: number
  particleSpeed: number
  particleSize: number
  particlesEnabled: boolean
  paused?: boolean
  hoveredEdgeId?: string | null
  onSelectEdge?: (id: string) => void
  onHoverEdge?: (info: { id: string; clientX: number; clientY: number } | null) => void
  onHoverEdgeIdChange?: (id: string | null) => void
}) {
  const meshRef = React.useRef<Mesh | null>(null)
  const matRef = React.useRef<MeshStandardMaterial | null>(null)
  const colorBase = React.useMemo(() => mixColors(bridge.a.color, bridge.b.color), [bridge.a.color, bridge.b.color])
  const baseColorObj = React.useMemo(() => new Color(colorBase), [colorBase])
  const hoverColorObj = React.useMemo(() => new Color('#ffffff'), [])
  const seed01 = React.useMemo(() => stableHash01(bridge.key), [bridge.key])
  const curve = React.useMemo(() => {
    const a = bridge.a.pos
    const b = bridge.b.pos
    const ax = a[0], ay = a[1], az = a[2]
    const bx = b[0], by = b[1], bz = b[2]
    const start = new Vector3(ax, ay, az + 4)
    const end = new Vector3(bx, by, bz + 4)
    const mid = new Vector3((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5)
    const dx = bx - ax
    const dy = by - ay
    const dist = Math.sqrt(dx * dx + dy * dy)
    const lift = Math.max(10, dist * archHeightFactor)
    mid.z += lift
    const inv = dist > 1e-6 ? 1 / dist : 0
    const px = -dy * inv
    const py = dx * inv
    const side = (seed01 - 0.5) * 2
    mid.x += px * dist * 0.12 * side
    mid.y += py * dist * 0.12 * side
    return new CatmullRomCurve3([start, mid, end], false, 'catmullrom', 0.5)
  }, [archHeightFactor, bridge.a.pos, bridge.b.pos, seed01])
  const geometry = React.useMemo(() => {
    const segments = 60
    const radial = 10
    return new TubeGeometry(curve, segments, Math.max(0.2, radius), radial, false)
  }, [curve, radius])
  React.useEffect(() => {
    return () => {
      try {
        geometry.dispose()
      } catch {
        void 0
      }
    }
  }, [geometry])
  const hovered = hoveredEdgeId && String(hoveredEdgeId) === bridge.sampleEdgeId
  useFrame(({ clock }) => {
    if (paused) return
    const mat = matRef.current
    if (!mat) return
    const t = clock.getElapsedTime()
    const phase = t * (0.8 + seed01 * 0.7) + seed01 * 10
    const pulse = 1 + Math.sin(phase) * clamp(pulseStrength, 0, 1.4)
    const nextOpacity = clamp(baseOpacity * (0.7 + 0.3 * pulse), 0.02, 1)
    mat.opacity = hovered ? Math.min(1, nextOpacity * 1.18) : nextOpacity
    mat.emissiveIntensity = hovered ? 0.55 : (0.18 + 0.25 * clamp(pulseStrength, 0, 1.4) * (0.5 + 0.5 * Math.sin(phase * 1.2)))
    const base = hovered ? hoverColorObj : baseColorObj
    mat.color.copy(base)
    mat.emissive.copy(base)
  })
  return (
    <group>
      <mesh
        ref={meshRef}
        geometry={geometry}
        renderOrder={THREE_RENDER_ORDER.edges}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHoverEdgeIdChange?.(bridge.sampleEdgeId)
          onHoverEdge?.({ id: bridge.sampleEdgeId, clientX: e.clientX, clientY: e.clientY })
        }}
        onPointerMove={(e) => {
          if (!onHoverEdge) return
          onHoverEdge({ id: bridge.sampleEdgeId, clientX: e.clientX, clientY: e.clientY })
        }}
        onPointerOut={(e) => {
          e.stopPropagation()
          onHoverEdgeIdChange?.(null)
          onHoverEdge?.(null)
        }}
        onClick={(e) => {
          e.stopPropagation()
          onSelectEdge?.(bridge.sampleEdgeId)
        }}
      >
        <meshStandardMaterial
          ref={matRef}
          color={colorBase}
          emissive={colorBase}
          emissiveIntensity={0.25}
          transparent
          opacity={baseOpacity}
          roughness={0.45}
          metalness={0.1}
          depthWrite={false}
        />
      </mesh>
      {particlesEnabled && particleCount > 0 ? (
        <CurveFlowParticles
          curve={curve}
          count={particleCount}
          speed={particleSpeed}
          color={hovered ? '#ffffff' : colorBase}
          size={particleSize}
          paused={paused}
        />
      ) : null}
    </group>
  )
}

export function VoxelBridgeTubes({ data, positions, schema, paused, hoveredEdgeId, onSelectEdge, onHoverEdge, onHoverEdgeIdChange }: {
  data: GraphData
  positions: Record<string, Vec3>
  schema: GraphSchema
  paused?: boolean
  hoveredEdgeId?: string | null
  onSelectEdge?: (id: string) => void
  onHoverEdge?: (info: { id: string; clientX: number; clientY: number } | null) => void
  onHoverEdgeIdChange?: (id: string | null) => void
}) {
  const three = schema.three || {}
  const voxelGridStep = resolveVoxelGridStep(schema)
  const radiusRaw = typeof three.voxelBridgeTubeRadius === 'number' && Number.isFinite(three.voxelBridgeTubeRadius) ? three.voxelBridgeTubeRadius : 2.2
  const radius = clamp(radiusRaw, 0.2, voxelGridStep * 6)
  const opacityRaw = typeof three.voxelBridgeTubeOpacity === 'number' && Number.isFinite(three.voxelBridgeTubeOpacity) ? three.voxelBridgeTubeOpacity : 0.55
  const baseOpacity = clamp(opacityRaw, 0.02, 1)
  const pulseStrengthRaw = typeof three.voxelBridgeTubePulseStrength === 'number' && Number.isFinite(three.voxelBridgeTubePulseStrength) ? three.voxelBridgeTubePulseStrength : 0.45
  const pulseStrength = clamp(pulseStrengthRaw, 0, 1.4)
  const archHeightFactorRaw = typeof three.voxelBridgeArchHeightFactor === 'number' && Number.isFinite(three.voxelBridgeArchHeightFactor) ? three.voxelBridgeArchHeightFactor : 0.18
  const archHeightFactor = clamp(archHeightFactorRaw, 0.02, 0.9)
  const maxTubesRaw = typeof three.voxelBridgeMaxTubes === 'number' && Number.isFinite(three.voxelBridgeMaxTubes) ? three.voxelBridgeMaxTubes : 60
  const maxTubes = clamp(Math.floor(maxTubesRaw), 0, 400)
  const particlesEnabled = (three.voxelBridgeParticlesEnabled ?? true) === true
  const particleDensityRaw = typeof three.voxelBridgeParticleDensity === 'number' && Number.isFinite(three.voxelBridgeParticleDensity) ? three.voxelBridgeParticleDensity : 0.7
  const particleDensity = clamp(particleDensityRaw, 0, 4)
  const particleSpeedRaw = typeof three.voxelBridgeParticleSpeed === 'number' && Number.isFinite(three.voxelBridgeParticleSpeed) ? three.voxelBridgeParticleSpeed : 0.75
  const particleSpeed = clamp(particleSpeedRaw, 0.01, 6)
  const particleSizeRaw = typeof three.voxelBridgeParticleSize === 'number' && Number.isFinite(three.voxelBridgeParticleSize) ? three.voxelBridgeParticleSize : 1.1
  const particleSize = clamp(particleSizeRaw, 0.2, voxelGridStep * 2)
  const maxParticlesTotalRaw = typeof three.voxelBridgeParticlesMaxTotal === 'number' && Number.isFinite(three.voxelBridgeParticlesMaxTotal) ? three.voxelBridgeParticlesMaxTotal : 240
  const maxParticlesTotal = clamp(Math.floor(maxParticlesTotalRaw), 0, 5000)

  const nodeById = React.useMemo(() => {
    const m = new Map<string, GraphNode>()
    for (let i = 0; i < data.nodes.length; i += 1) {
      const n = data.nodes[i]
      const id = String(n?.id || '').trim()
      if (id && !m.has(id)) m.set(id, n)
    }
    return m
  }, [data.nodes])

  const hubs = React.useMemo(() => {
    const stats = new Map<string, { x: number; y: number; z: number; count: number; sample: GraphNode | null }>()
    for (let i = 0; i < data.nodes.length; i += 1) {
      const n = data.nodes[i]
      const p = positions[n.id]
      if (!p) continue
      const g = resolveVoxelClusterKey(n)
      if (!g) continue
      const prev = stats.get(g)
      if (!prev) stats.set(g, { x: p[0], y: p[1], z: p[2], count: 1, sample: n })
      else {
        prev.x += p[0]
        prev.y += p[1]
        prev.z += p[2]
        prev.count += 1
        if (!prev.sample) prev.sample = n
      }
    }
    const out = new Map<string, ClusterHub>()
    for (const [k, v] of stats.entries()) {
      const inv = v.count > 0 ? 1 / v.count : 1
      const color = (v.sample && resolveVoxelClusterColor(v.sample)) || '#00f5ff'
      out.set(k, { key: k, pos: [v.x * inv, v.y * inv, v.z * inv] as Vec3, color, sample: v.sample })
    }
    return out
  }, [data.nodes, positions])

  const bridges = React.useMemo(() => {
    const byKey = new Map<string, { aKey: string; bKey: string; count: number; sampleEdgeId: string }>()
    for (let i = 0; i < data.edges.length; i += 1) {
      const e = data.edges[i]
      const src = nodeById.get(String(e.source)) || null
      const tgt = nodeById.get(String(e.target)) || null
      if (!src || !tgt) continue
      const a = resolveVoxelClusterKey(src)
      const b = resolveVoxelClusterKey(tgt)
      if (!a || !b) continue
      if (a === b) continue
      const aKey = a < b ? a : b
      const bKey = a < b ? b : a
      const key = aKey + '|' + bKey
      const prev = byKey.get(key)
      if (!prev) byKey.set(key, { aKey, bKey, count: 1, sampleEdgeId: String(e.id) })
      else {
        prev.count += 1
      }
    }
    const out: Bridge[] = []
    for (const [k, v] of byKey.entries()) {
      const a = hubs.get(v.aKey)
      const b = hubs.get(v.bKey)
      if (!a || !b) continue
      out.push({ key: k, a, b, count: v.count, sampleEdgeId: v.sampleEdgeId })
    }
    out.sort((x, y) => {
      const d = y.count - x.count
      if (d) return d
      if (x.key < y.key) return -1
      if (x.key > y.key) return 1
      return 0
    })
    if (maxTubes > 0 && out.length > maxTubes) return out.slice(0, maxTubes)
    return out
  }, [data.edges, hubs, maxTubes, nodeById])

  const particleCountByBridgeKey = React.useMemo(() => {
    if (!particlesEnabled || maxParticlesTotal <= 0 || bridges.length === 0 || particleDensity <= 0) return new Map<string, number>()
    const weights = bridges.map(b => Math.sqrt(Math.max(1, b.count)))
    const totalWeight = weights.reduce((a, b) => a + b, 0) || 1
    const out = new Map<string, number>()
    let remaining = maxParticlesTotal
    for (let i = 0; i < bridges.length; i += 1) {
      const b = bridges[i]!
      const w = weights[i]!
      const share = Math.max(0, Math.floor((maxParticlesTotal * w) / totalWeight))
      const base = Math.floor(clamp(share * particleDensity, 0, 64))
      const n = Math.min(remaining, base)
      out.set(b.key, n)
      remaining -= n
      if (remaining <= 0) break
    }
    return out
  }, [bridges, maxParticlesTotal, particleDensity, particlesEnabled])

  if (bridges.length === 0) return null
  return (
    <group>
      {bridges.map((b) => (
        <VoxelBridgeTube
          key={b.key}
          bridge={b}
          radius={radius}
          baseOpacity={baseOpacity}
          pulseStrength={pulseStrength}
          archHeightFactor={archHeightFactor}
          particleCount={particleCountByBridgeKey.get(b.key) || 0}
          particleSpeed={particleSpeed}
          particleSize={particleSize}
          particlesEnabled={particlesEnabled}
          paused={paused}
          hoveredEdgeId={hoveredEdgeId}
          onSelectEdge={onSelectEdge}
          onHoverEdge={onHoverEdge}
          onHoverEdgeIdChange={onHoverEdgeIdChange}
        />
      ))}
    </group>
  )
}
