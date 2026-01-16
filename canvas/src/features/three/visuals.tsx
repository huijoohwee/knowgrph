import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Vec3 } from './layout'

const PARTICLE_GEOMETRY = new THREE.SphereGeometry(1.4, 8, 8)

const MAX_PARTICLE_INSTANCES = 64

type DirectionalParticlesProps = { start: Vec3; end: Vec3; count: number; color: string; speed: number }

export function DirectionalParticles({ start, end, count, color, speed, paused }: DirectionalParticlesProps & { paused?: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh | null>(null)
  const offsetsRef = useRef<number[]>([])
  const instanceCountRef = useRef(0)
  const posRef = useRef(new THREE.Vector3())
  const matrixRef = useRef(new THREE.Matrix4())
  React.useEffect(() => {
    const n = Math.max(0, Math.min(MAX_PARTICLE_INSTANCES, Math.floor(count)))
    const next: number[] = []
    for (let i = 0; i < n; i++) {
      next.push(Math.random())
    }
    offsetsRef.current = next
    instanceCountRef.current = n
    if (meshRef.current) {
      meshRef.current.count = n
      meshRef.current.instanceMatrix.needsUpdate = true
    }
  }, [count])
  useFrame(({ clock }) => {
    if (paused) return
    const mesh = meshRef.current
    if (!mesh) return
    const n = instanceCountRef.current
    if (!n) return
    const offsets = offsetsRef.current
    if (!offsets.length) return
    const sx = start[0], sy = start[1], sz = start[2]
    const ex = end[0], ey = end[1], ez = end[2]
    const dx = ex - sx
    const dy = ey - sy
    const dz = ez - sz
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (len < 1e-3) return
    const t = clock.getElapsedTime()
    const baseSpeed = Math.max(0.01, Math.min(5, speed || 0.6))
    const pos = posRef.current
    const matrix = matrixRef.current
    const clamped = Math.min(n, offsets.length)
    for (let i = 0; i < clamped; i++) {
      const phase = offsets[i] || 0
      const s = ((phase + t * baseSpeed) % 1)
      const px = sx + dx * s
      const py = sy + dy * s
      const pz = sz + dz * s
      pos.set(px, py, pz)
      matrix.makeTranslation(px, py, pz)
      mesh.setMatrixAt(i, matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })
  if (!count) return null
  return (
    <instancedMesh
      ref={meshRef}
      args={[PARTICLE_GEOMETRY, undefined as THREE.Material | THREE.Material[] | undefined, MAX_PARTICLE_INSTANCES]}
    >
      <meshBasicMaterial color={color} />
    </instancedMesh>
  )
}

type ArrowHeadProps = { start: Vec3; end: Vec3; color: string; height: number; relPos: number }

export function ArrowHead({ start, end, color, height, relPos, paused }: ArrowHeadProps & { paused?: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const dir = useRef(new THREE.Vector3())
  const pos = useRef(new THREE.Vector3())
  const quat = useRef(new THREE.Quaternion())
  const up = useRef(new THREE.Vector3(0, 1, 0))
  useFrame(() => {
    if (paused) return
    if (!ref.current) return
    const sx = start[0], sy = start[1], sz = start[2]
    const ex = end[0], ey = end[1], ez = end[2]
    const d = dir.current
    d.set(ex - sx, ey - sy, ez - sz)
    const len = d.length()
    if (len < 1e-3) return
    d.normalize()
    const rp = Math.max(0, Math.min(1, relPos))
    const offset = Math.max(0, (len * rp) - (height * 0.75))
    const p = pos.current
    p.copy(d).multiplyScalar(offset).add(new THREE.Vector3(sx, sy, sz))
    ref.current.position.set(p.x, p.y, p.z)
    const q = quat.current
    q.setFromUnitVectors(up.current, d)
    ref.current.setRotationFromQuaternion(q)
  })
  return (
    <mesh ref={ref}>
      <coneGeometry args={[4, height, 24]} />
      <meshLambertMaterial color={color} />
    </mesh>
  )
}

type EdgeMeshProps = { a: Vec3; b: Vec3; color: string; width: number; opacity: number; resolution: number }

export function EdgeMesh({ a, b, color, width, opacity, resolution, paused }: EdgeMeshProps & { paused?: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const diff = useRef(new THREE.Vector3())
  const mid = useRef(new THREE.Vector3())
  const quat = useRef(new THREE.Quaternion())
  const up = useRef(new THREE.Vector3(0, 1, 0))
  useFrame(() => {
    if (paused) return
    if (!ref.current) return
    const ax = a[0], ay = a[1], az = a[2]
    const bx = b[0], by = b[1], bz = b[2]
    const d = diff.current
    d.set(bx - ax, by - ay, bz - az)
    const len = d.length()
    if (len < 1e-3) return
    const m = mid.current
    m.set(ax + d.x / 2, ay + d.y / 2, az + d.z / 2)
    ref.current.position.set(m.x, m.y, m.z)
    ref.current.scale.set(width, len, width)
    const q = quat.current
    const dir = d.clone().normalize()
    q.setFromUnitVectors(up.current, dir)
    ref.current.setRotationFromQuaternion(q)
  })
  return (
    <mesh ref={ref}>
      <cylinderGeometry args={[1, 1, 1, Math.max(12, Math.min(48, Math.floor(resolution))) || 24]} />
      <meshLambertMaterial color={color} transparent opacity={opacity} />
    </mesh>
  )
}

type CurvedEdgeMeshProps = {
  a: Vec3
  b: Vec3
  color: string
  width: number
  opacity: number
  curvature: number
  resolution: number
  rotation: number
}

export function CurvedEdgeMesh({ a, b, color, width, opacity, curvature, resolution, rotation, paused }: CurvedEdgeMeshProps & { paused?: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const geomRef = useRef<THREE.BufferGeometry>(null!)
  const startRef = useRef(new THREE.Vector3())
  const endRef = useRef(new THREE.Vector3())
  const vecRef = useRef(new THREE.Vector3())
  const dirRef = useRef(new THREE.Vector3())
  const upRef = useRef(new THREE.Vector3(0, 0, 1))
  const perpBaseRef = useRef(new THREE.Vector3())
  const perpRef = useRef(new THREE.Vector3())
  const ctrlRef = useRef(new THREE.Vector3())
  const quatRotRef = useRef(new THREE.Quaternion())
  useFrame(() => {
    if (paused) return
    const ax = a[0], ay = a[1], az = a[2]
    const bx = b[0], by = b[1], bz = b[2]
    const start = startRef.current
    const end = endRef.current
    start.set(ax, ay, az)
    end.set(bx, by, bz)
    const vec = vecRef.current
    vec.subVectors(end, start)
    const len = vec.length()
    if (len < 1e-3) return
    const dir = dirRef.current
    dir.copy(vec).normalize()
    const up = upRef.current
    if (Math.abs(dir.z) < 0.99) {
      up.set(0, 0, 1)
    } else {
      up.set(0, 1, 0)
    }
    const perpBase = perpBaseRef.current
    perpBase.crossVectors(dir, up).normalize()
    const quatRot = quatRotRef.current
    quatRot.setFromAxisAngle(dir, rotation || 0)
    const perp = perpRef.current
    perp.copy(perpBase).applyQuaternion(quatRot).normalize()
    const offsetMag = Math.max(0, curvature) * (len * 0.5)
    const ctrl = ctrlRef.current
    ctrl.copy(start).add(end).multiplyScalar(0.5)
    ctrl.add(perp.multiplyScalar(offsetMag))
    const curve = new THREE.QuadraticBezierCurve3(start, ctrl, end)
    const tubularSegments = Math.max(16, Math.min(64, Math.floor(resolution) * 2 || 32))
    const radialSegments = Math.max(8, Math.min(32, Math.floor(resolution) || 16))
    const tubeRadius = Math.max(0.25, width * 0.5)
    const tube = new THREE.TubeGeometry(curve, tubularSegments, tubeRadius, radialSegments, false)
    if (geomRef.current) {
      geomRef.current.dispose()
    }
    geomRef.current = tube
    if (ref.current) {
      ref.current.geometry = tube
    }
  })
  return (
    <mesh ref={ref}>
      <meshLambertMaterial color={color} transparent opacity={opacity} />
    </mesh>
  )
}
