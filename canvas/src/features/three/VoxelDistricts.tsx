import React from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BoxGeometry, Color, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3, type Material } from 'three'
import type { GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { Vec3 } from './layout'
import { resolveVoxelClusterColor, resolveVoxelClusterKey } from './voxelStyle'
import { quantizeVoxelCoordToGridLine, resolveVoxelGridStep } from './threeLayoutConfig'
import { THREE_RENDER_ORDER } from './renderOrder'

type District = {
  key: string
  cx: number
  cy: number
  cz: number
  w: number
  h: number
  d: number
  color: string
}

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

export function VoxelDistricts({ nodes, positions, schema, paused }: { nodes: GraphNode[]; positions: Record<string, Vec3>; schema: GraphSchema; paused?: boolean }) {
  const three = schema.three || {}
  const enabled = (three.voxelDistrictsEnabled ?? true) === true
  const voxelGridStep = resolveVoxelGridStep(schema)
  const paddingCellsRaw = typeof three.voxelDistrictPaddingCells === 'number' && Number.isFinite(three.voxelDistrictPaddingCells)
    ? three.voxelDistrictPaddingCells
    : 2
  const paddingCells = clamp(Math.floor(paddingCellsRaw), 0, 64)
  const opacityRaw = typeof three.voxelDistrictOpacity === 'number' && Number.isFinite(three.voxelDistrictOpacity)
    ? three.voxelDistrictOpacity
    : 0.14
  const opacity = clamp(opacityRaw, 0, 1)
  const heightRaw = typeof three.voxelDistrictHeight === 'number' && Number.isFinite(three.voxelDistrictHeight)
    ? three.voxelDistrictHeight
    : voxelGridStep * 0.6
  const height = clamp(heightRaw, voxelGridStep * 0.1, voxelGridStep * 12)
  const emissiveBase = 0.08
  const emissiveRef = React.useRef<number>(emissiveBase)
  const meshRef = React.useRef<InstancedMesh | null>(null)
  const materialRef = React.useRef<MeshStandardMaterial | null>(null)
  const geom = React.useMemo(() => new BoxGeometry(1, 1, 1), [])
  React.useEffect(() => {
    return () => {
      try {
        geom.dispose()
      } catch {
        void 0
      }
    }
  }, [geom])
  const colorTmp = React.useMemo(() => new Color(), [])
  const matrixTmp = React.useMemo(() => new Matrix4(), [])
  const scaleTmp = React.useMemo(() => new Vector3(), [])
  const posTmp = React.useMemo(() => new Vector3(), [])
  const quatTmp = React.useMemo(() => new Quaternion(), [])
  const districts: District[] = React.useMemo(() => {
    if (!enabled) return []
    const stats = new Map<string, { minX: number; maxX: number; minY: number; maxY: number; minZ: number; sumX: number; sumY: number; sumZ: number; count: number; sample: GraphNode | null }>()
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const p = positions[n.id]
      if (!p) continue
      const g = resolveVoxelClusterKey(n)
      if (!g) continue
      const x = Number(p[0])
      const y = Number(p[1])
      const z = Number(p[2])
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue
      const prev = stats.get(g)
      if (!prev) {
        stats.set(g, { minX: x, maxX: x, minY: y, maxY: y, minZ: z, sumX: x, sumY: y, sumZ: z, count: 1, sample: n })
      } else {
        if (x < prev.minX) prev.minX = x
        if (x > prev.maxX) prev.maxX = x
        if (y < prev.minY) prev.minY = y
        if (y > prev.maxY) prev.maxY = y
        if (z < prev.minZ) prev.minZ = z
        prev.sumX += x
        prev.sumY += y
        prev.sumZ += z
        prev.count += 1
        if (!prev.sample) prev.sample = n
      }
    }
    const pad = paddingCells * voxelGridStep
    const out: District[] = []
    for (const [key, v] of stats.entries()) {
      const inv = v.count > 0 ? 1 / v.count : 1
      const cx = v.sumX * inv
      const cy = v.sumY * inv
      const czBase = v.sumZ * inv
      const minX = quantizeVoxelCoordToGridLine(v.minX - pad, voxelGridStep)
      const maxX = quantizeVoxelCoordToGridLine(v.maxX + pad, voxelGridStep)
      const minY = quantizeVoxelCoordToGridLine(v.minY - pad, voxelGridStep)
      const maxY = quantizeVoxelCoordToGridLine(v.maxY + pad, voxelGridStep)
      const w = Math.max(voxelGridStep * 2, maxX - minX)
      const h = Math.max(voxelGridStep * 2, maxY - minY)
      const cz = quantizeVoxelCoordToGridLine(v.minZ - voxelGridStep, voxelGridStep) - height * 0.5
      const color = (v.sample && resolveVoxelClusterColor(v.sample)) || '#00f5ff'
      void czBase
      out.push({ key, cx, cy, cz, w, h, d: height, color })
    }
    out.sort((a, b) => {
      const aw = a.w * a.h
      const bw = b.w * b.h
      const d = bw - aw
      if (d) return d
      if (a.key < b.key) return -1
      if (a.key > b.key) return 1
      return 0
    })
    return out
  }, [enabled, height, nodes, paddingCells, positions, voxelGridStep])

  React.useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const n = districts.length
    mesh.count = n
    for (let i = 0; i < n; i += 1) {
      const d = districts[i]!
      posTmp.set(d.cx, d.cy, d.cz)
      scaleTmp.set(d.w, d.h, d.d)
      matrixTmp.compose(posTmp, quatTmp, scaleTmp)
      mesh.setMatrixAt(i, matrixTmp)
      colorTmp.set(d.color)
      mesh.setColorAt(i, colorTmp)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [colorTmp, districts, matrixTmp, posTmp, quatTmp, scaleTmp])

  useFrame(({ clock }) => {
    if (paused) return
    const mat = materialRef.current
    if (!mat) return
    const t = clock.getElapsedTime()
    const pulse = 0.7 + 0.3 * Math.sin(t * 0.6)
    const next = emissiveBase + pulse * 0.04
    if (Math.abs(next - emissiveRef.current) < 0.001) return
    emissiveRef.current = next
    mat.emissiveIntensity = next
  })

  if (!enabled || districts.length === 0) return null
  const alphaTest = 0
  return (
    <instancedMesh
      ref={meshRef}
      args={[geom, undefined as unknown as Material, Math.max(1, districts.length)]}
      renderOrder={THREE_RENDER_ORDER.groups - 6}
      receiveShadow
      frustumCulled
    >
      <meshStandardMaterial
        ref={materialRef}
        transparent
        opacity={opacity}
        roughness={0.92}
        metalness={0.12}
        emissive={'#ffffff'}
        emissiveIntensity={emissiveBase}
        vertexColors
        depthWrite={false}
        alphaTest={alphaTest}
      />
    </instancedMesh>
  )
}

export function VoxelDistrictAmbientField({ nodes, positions, schema, paused }: { nodes: GraphNode[]; positions: Record<string, Vec3>; schema: GraphSchema; paused?: boolean }) {
  const three = schema.three || {}
  const enabled = (three.voxelBridgeAmbientFieldEnabled ?? true) === true
  const perDistrictRaw = typeof three.voxelBridgeAmbientFieldParticlesPerDistrict === 'number' && Number.isFinite(three.voxelBridgeAmbientFieldParticlesPerDistrict)
    ? three.voxelBridgeAmbientFieldParticlesPerDistrict
    : 10
  const perDistrict = clamp(Math.floor(perDistrictRaw), 0, 64)
  const voxelGridStep = resolveVoxelGridStep(schema)
  const particleSizeRaw = typeof three.voxelBridgeParticleSize === 'number' && Number.isFinite(three.voxelBridgeParticleSize)
    ? three.voxelBridgeParticleSize
    : 1.1
  const particleSize = clamp(particleSizeRaw, 0.2, voxelGridStep * 2)
  const clusters = React.useMemo(() => {
    if (!enabled || perDistrict <= 0) return [] as Array<{ key: string; cx: number; cy: number; cz: number; r: number; color: string }>
    const stats = new Map<string, { x: number; y: number; z: number; count: number; maxR2: number; sample: GraphNode | null }>()
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const p = positions[n.id]
      if (!p) continue
      const g = resolveVoxelClusterKey(n)
      if (!g) continue
      const x = Number(p[0])
      const y = Number(p[1])
      const z = Number(p[2])
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue
      const prev = stats.get(g)
      if (!prev) stats.set(g, { x, y, z, count: 1, maxR2: 0, sample: n })
      else {
        prev.x += x
        prev.y += y
        prev.z += z
        prev.count += 1
        if (!prev.sample) prev.sample = n
      }
    }
    const centers = new Map<string, { cx: number; cy: number; cz: number }>()
    for (const [k, v] of stats.entries()) {
      const inv = v.count > 0 ? 1 / v.count : 1
      centers.set(k, { cx: v.x * inv, cy: v.y * inv, cz: v.z * inv })
    }
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const p = positions[n.id]
      if (!p) continue
      const g = resolveVoxelClusterKey(n)
      if (!g) continue
      const c = centers.get(g)
      if (!c) continue
      const dx = Number(p[0]) - c.cx
      const dy = Number(p[1]) - c.cy
      const r2 = dx * dx + dy * dy
      const st = stats.get(g)
      if (st && Number.isFinite(r2) && r2 > st.maxR2) st.maxR2 = r2
    }
    const out: Array<{ key: string; cx: number; cy: number; cz: number; r: number; color: string }> = []
    for (const [k, v] of stats.entries()) {
      const c = centers.get(k)
      if (!c) continue
      const r = Math.max(voxelGridStep * 3, Math.sqrt(Math.max(0, v.maxR2)) + voxelGridStep * 2)
      const color = (v.sample && resolveVoxelClusterColor(v.sample)) || '#00f5ff'
      out.push({ key: k, cx: c.cx, cy: c.cy, cz: c.cz + voxelGridStep * 2, r, color })
    }
    out.sort((a, b) => {
      if (a.key < b.key) return -1
      if (a.key > b.key) return 1
      return 0
    })
    return out
  }, [enabled, nodes, perDistrict, positions, voxelGridStep])

  const effectivePerDistrict = React.useMemo(() => {
    const maxTotal = 1500
    if (!enabled || perDistrict <= 0) return 0
    const per = Math.floor(maxTotal / Math.max(1, clusters.length))
    return clamp(Math.min(perDistrict, per), 0, 64)
  }, [clusters.length, enabled, perDistrict])

  const total = clusters.length * effectivePerDistrict
  const meshRef = React.useRef<InstancedMesh | null>(null)
  const geom = React.useMemo(() => new SphereGeometry(particleSize, 8, 8), [particleSize])
  React.useEffect(() => {
    return () => {
      try {
        geom.dispose()
      } catch {
        void 0
      }
    }
  }, [geom])
  const matRef = React.useRef<MeshBasicMaterial | null>(null)
  const tmpMat = React.useMemo(() => new Matrix4(), [])
  const tmpPos = React.useMemo(() => new Vector3(), [])
  const tmpScale = React.useMemo(() => new Vector3(1, 1, 1), [])
  const tmpQuat = React.useMemo(() => new Quaternion(), [])
  const tmpColor = React.useMemo(() => new Color(), [])
  const orbitSeedByIndex = React.useMemo(() => {
    const seeds: number[] = []
    for (let i = 0; i < total; i += 1) {
      seeds.push(stableHash01(String(i) + '|ambient'))
    }
    return seeds
  }, [total])

  React.useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    mesh.count = total
    let idx = 0
    for (let i = 0; i < clusters.length; i += 1) {
      const c = clusters[i]!
      tmpColor.set(c.color)
      for (let j = 0; j < effectivePerDistrict; j += 1) {
        tmpPos.set(c.cx, c.cy, c.cz)
        tmpMat.compose(tmpPos, tmpQuat, tmpScale)
        mesh.setMatrixAt(idx, tmpMat)
        mesh.setColorAt(idx, tmpColor)
        idx += 1
      }
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [clusters, effectivePerDistrict, tmpColor, tmpMat, tmpPos, tmpQuat, tmpScale, total])

  useFrame(({ clock }) => {
    if (paused) return
    const mesh = meshRef.current
    if (!mesh || total <= 0) return
    const t = clock.getElapsedTime()
    let idx = 0
    for (let i = 0; i < clusters.length; i += 1) {
      const c = clusters[i]!
      for (let j = 0; j < effectivePerDistrict; j += 1) {
        const seed = orbitSeedByIndex[idx] || 0
        const phase = t * (0.35 + seed * 0.7) + seed * 10
        const ang = phase * Math.PI * 2
        const rr = c.r * (0.35 + 0.45 * seed)
        tmpPos.set(c.cx + Math.cos(ang) * rr, c.cy + Math.sin(ang) * rr, c.cz + Math.sin(phase * 0.8) * voxelGridStep * 0.4)
        tmpMat.compose(tmpPos, tmpQuat, tmpScale)
        mesh.setMatrixAt(idx, tmpMat)
        idx += 1
      }
    }
    mesh.instanceMatrix.needsUpdate = true
    const mat = matRef.current
    if (mat) {
      const pulse = 0.7 + 0.3 * Math.sin(t * 0.45)
      mat.opacity = clamp(0.18 + pulse * 0.22, 0, 1)
    }
  })

  if (!enabled || effectivePerDistrict <= 0 || clusters.length === 0) return null
  return (
    <instancedMesh
      ref={meshRef}
      args={[geom, undefined as unknown as Material, Math.max(1, total)]}
      renderOrder={THREE_RENDER_ORDER.edges - 2}
      frustumCulled
    >
      <meshBasicMaterial ref={matRef} transparent opacity={0.28} vertexColors depthWrite={false} blending={AdditiveBlending} />
    </instancedMesh>
  )
}
