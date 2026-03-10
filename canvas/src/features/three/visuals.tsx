import React, { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import type { Vec3 } from './layout'
import { computeNodeMotion, type NodeMotionState } from './animation'
import type { GraphEdge } from '@/lib/graph/types'

type MotionProps = {
  sourceId?: string
  targetId?: string
  sourceRadius?: number
  targetRadius?: number
  motionIntensity?: number
  draggedNodeId?: string | null
}

const PARTICLE_GEOMETRY = new THREE.SphereGeometry(1.4, 8, 8)

const MAX_PARTICLE_INSTANCES = 64

type DirectionalParticlesProps = { start: Vec3; end: Vec3; count: number; color: string; speed: number }

export function DirectionalParticles({ start, end, count, color, speed, paused, name, sourceId, targetId, sourceRadius, targetRadius, motionIntensity, draggedNodeId }: DirectionalParticlesProps & MotionProps & { paused?: boolean; name?: string }) {
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

    const t = clock.getElapsedTime()
    let sx = start[0], sy = start[1], sz = start[2]
    let ex = end[0], ey = end[1], ez = end[2]

    if (sourceId && motionIntensity && motionIntensity > 0) {
      const ms: NodeMotionState = { intensity: motionIntensity, draggedNodeId }
      const p = computeNodeMotion(sourceId, start, sourceRadius || 5, ms, t)
      sx = p[0]; sy = p[1]; sz = p[2]
    }
    if (targetId && motionIntensity && motionIntensity > 0) {
      const ms: NodeMotionState = { intensity: motionIntensity, draggedNodeId }
      const p = computeNodeMotion(targetId, end, targetRadius || 5, ms, t)
      ex = p[0]; ey = p[1]; ez = p[2]
    }

    const dx = ex - sx
    const dy = ey - sy
    const dz = ez - sz
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (len < 1e-3) return

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
      name={name}
      args={[PARTICLE_GEOMETRY, undefined as THREE.Material | THREE.Material[] | undefined, MAX_PARTICLE_INSTANCES]}
    >
      <meshBasicMaterial color={color} />
    </instancedMesh>
  )
}

type ArrowHeadProps = { start: Vec3; end: Vec3; color: string; height: number; relPos: number }

export function ArrowHead({ start, end, color, height, relPos, paused, name, sourceId, targetId, sourceRadius, targetRadius, motionIntensity, draggedNodeId }: ArrowHeadProps & MotionProps & { paused?: boolean; name?: string }) {
  const ref = useRef<THREE.Mesh>(null!)
  const dir = useRef(new THREE.Vector3())
  const pos = useRef(new THREE.Vector3())
  const quat = useRef(new THREE.Quaternion())
  const up = useRef(new THREE.Vector3(0, 1, 0))
  useFrame(({ clock }) => {
    if (paused) return
    if (!ref.current) return
    const t = clock.getElapsedTime()
    let sx = start[0], sy = start[1], sz = start[2]
    let ex = end[0], ey = end[1], ez = end[2]
    
    if (sourceId && motionIntensity && motionIntensity > 0) {
      const ms: NodeMotionState = { intensity: motionIntensity, draggedNodeId }
      const p = computeNodeMotion(sourceId, start, sourceRadius || 5, ms, t)
      sx = p[0]; sy = p[1]; sz = p[2]
    }
    if (targetId && motionIntensity && motionIntensity > 0) {
      const ms: NodeMotionState = { intensity: motionIntensity, draggedNodeId }
      const p = computeNodeMotion(targetId, end, targetRadius || 5, ms, t)
      ex = p[0]; ey = p[1]; ez = p[2]
    }

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
    <mesh ref={ref} name={name}>
      <coneGeometry args={[4, height, 24]} />
      <meshLambertMaterial color={color} />
    </mesh>
  )
}

type EdgeMeshProps = { a: Vec3; b: Vec3; color: string; width: number; opacity: number; resolution: number }

export function EdgeMesh({ a, b, color, width, opacity, resolution, paused, name, sourceId, targetId, sourceRadius, targetRadius, motionIntensity, draggedNodeId }: EdgeMeshProps & MotionProps & { paused?: boolean; name?: string }) {
  const ref = useRef<THREE.Mesh>(null!)
  const diff = useRef(new THREE.Vector3())
  const mid = useRef(new THREE.Vector3())
  const quat = useRef(new THREE.Quaternion())
  const up = useRef(new THREE.Vector3(0, 1, 0))
  useFrame(({ clock }) => {
    if (paused) return
    if (!ref.current) return
    const t = clock.getElapsedTime()
    let ax = a[0], ay = a[1], az = a[2]
    let bx = b[0], by = b[1], bz = b[2]
    
    if (sourceId && motionIntensity && motionIntensity > 0) {
      const ms: NodeMotionState = { intensity: motionIntensity, draggedNodeId }
      const p = computeNodeMotion(sourceId, a, sourceRadius || 5, ms, t)
      ax = p[0]; ay = p[1]; az = p[2]
    }
    if (targetId && motionIntensity && motionIntensity > 0) {
      const ms: NodeMotionState = { intensity: motionIntensity, draggedNodeId }
      const p = computeNodeMotion(targetId, b, targetRadius || 5, ms, t)
      bx = p[0]; by = p[1]; bz = p[2]
    }

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
    <mesh ref={ref} name={name}>
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
  name?: string
}

export function CurvedEdgeMesh({ a, b, color, width, opacity, curvature, resolution, rotation, paused, name, sourceId, targetId, sourceRadius, targetRadius, motionIntensity, draggedNodeId }: CurvedEdgeMeshProps & MotionProps & { paused?: boolean }) {
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
  useFrame(({ clock }) => {
    if (paused) return
    const t = clock.getElapsedTime()
    let ax = a[0], ay = a[1], az = a[2]
    let bx = b[0], by = b[1], bz = b[2]
    
    if (sourceId && motionIntensity && motionIntensity > 0) {
      const ms: NodeMotionState = { intensity: motionIntensity, draggedNodeId }
      const p = computeNodeMotion(sourceId, a, sourceRadius || 5, ms, t)
      ax = p[0]; ay = p[1]; az = p[2]
    }
    if (targetId && motionIntensity && motionIntensity > 0) {
      const ms: NodeMotionState = { intensity: motionIntensity, draggedNodeId }
      const p = computeNodeMotion(targetId, b, targetRadius || 5, ms, t)
      bx = p[0]; by = p[1]; bz = p[2]
    }

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
    <mesh ref={ref} name={name}>
      <meshLambertMaterial color={color} transparent opacity={opacity} />
    </mesh>
  )
}

export function ShaderLineEdges({
  edges,
  positions,
  nodeRadiusById,
  colorByLabel,
  neutralEdgeColor,
  selectedEdgeColor,
  selectionMode,
  selectedEdgeIdSet,
  selectedNodeIdSet,
  dimmedEdgeOpacity,
  selectedEdgeWidth,
  paused,
  motionIntensity,
  draggedNodeId,
  lineWidthPx,
  onSelectEdge,
  onHoverEdge,
}: {
  edges: GraphEdge[]
  positions: Record<string, Vec3>
  nodeRadiusById: Map<string, number>
  colorByLabel: (label: string) => string
  neutralEdgeColor: string
  selectedEdgeColor: string
  selectionMode: 'none' | 'node' | 'edge'
  selectedEdgeIdSet: Set<string>
  selectedNodeIdSet: Set<string>
  dimmedEdgeOpacity: number
  selectedEdgeWidth: number
  paused?: boolean
  motionIntensity?: number
  draggedNodeId?: string | null
  lineWidthPx: number
  onSelectEdge: (id: string) => void
  onHoverEdge?: (info: { id: string; clientX: number; clientY: number } | null) => void
}) {
  const { size, gl } = useThree()
  const lineRef = React.useRef<LineSegments2 | null>(null)
  const geomRef = React.useRef<LineSegmentsGeometry | null>(null)
  const posArrayRef = React.useRef<Float32Array>(new Float32Array(0))
  const colorArrayRef = React.useRef<Float32Array>(new Float32Array(0))
  const edgeIdsRef = React.useRef<string[]>([])
  const motionRef = React.useRef<{ intensity: number; draggedNodeId?: string | null }>({ intensity: 0, draggedNodeId: null })
  motionRef.current = { intensity: motionIntensity || 0, draggedNodeId: draggedNodeId || null }

  React.useEffect(() => {
    const n = edges.length
    const posArray = new Float32Array(Math.max(1, n * 6))
    const colorArray = new Float32Array(Math.max(1, n * 6))
    const ids: string[] = new Array(n)
    for (let i = 0; i < n; i += 1) ids[i] = String(edges[i]?.id || '')
    posArrayRef.current = posArray
    colorArrayRef.current = colorArray
    edgeIdsRef.current = ids

    const geom = new LineSegmentsGeometry()
    geom.setPositions(posArray)
    geom.setColors(colorArray)
    geomRef.current = geom

    const mat = new LineMaterial({
      color: 0xffffff,
      linewidth: Math.max(0.5, Number(lineWidthPx) || 2),
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthTest: true,
      depthWrite: false,
    })
    mat.resolution.set(Math.max(1, size.width), Math.max(1, size.height))

    const line = new LineSegments2(geom, mat)
    line.frustumCulled = false
    lineRef.current = line

    return () => {
      try {
        lineRef.current = null
      } catch {
        void 0
      }
      try {
        geom.dispose()
      } catch {
        void 0
      }
      try {
        mat.dispose()
      } catch {
        void 0
      }
      geomRef.current = null
    }
  }, [edges])

  React.useEffect(() => {
    const line = lineRef.current
    if (!line) return
    const mat = line.material as LineMaterial
    mat.linewidth = Math.max(0.5, Number(lineWidthPx) || 2)
  }, [lineWidthPx])

  React.useEffect(() => {
    const line = lineRef.current
    if (!line) return
    const mat = line.material as LineMaterial
    mat.resolution.set(Math.max(1, size.width), Math.max(1, size.height))
  }, [size.height, size.width, gl])

  React.useEffect(() => {
    const geom = geomRef.current
    if (!geom) return
    const colors = colorArrayRef.current
    const n = edges.length
    const bg = new THREE.Color(0, 0, 0)
    const tmp = new THREE.Color()
    for (let i = 0; i < n; i += 1) {
      const e = edges[i]
      const srcId = String(e.source)
      const tgtId = String(e.target)
      const isSelectedEdge = selectedEdgeIdSet.has(String(e.id))
      const isIncidentToSelectedNode = selectedNodeIdSet.size > 0 && (selectedNodeIdSet.has(srcId) || selectedNodeIdSet.has(tgtId))
      let finalColor = colorByLabel(e.label)
      let finalOpacity = 1
      if (selectionMode === 'edge') {
        if (isSelectedEdge) {
          finalColor = selectedEdgeColor
          finalOpacity = 1
        } else {
          finalColor = neutralEdgeColor
          finalOpacity = Math.min(1, dimmedEdgeOpacity)
        }
      } else if (selectionMode === 'node') {
        if (isIncidentToSelectedNode) {
          finalColor = selectedEdgeColor
          finalOpacity = 1
        } else {
          finalColor = colorByLabel(e.label)
          finalOpacity = Math.min(1, dimmedEdgeOpacity)
        }
      }
      void selectedEdgeWidth
      tmp.set(finalColor)
      tmp.lerp(bg, 1 - Math.max(0, Math.min(1, finalOpacity)))
      const r = tmp.r
      const g = tmp.g
      const b = tmp.b
      const o = i * 6
      colors[o + 0] = r
      colors[o + 1] = g
      colors[o + 2] = b
      colors[o + 3] = r
      colors[o + 4] = g
      colors[o + 5] = b
    }
    const attr = geom.attributes.instanceColorStart as THREE.InterleavedBufferAttribute | undefined
    if (attr && attr.data) {
      attr.data.needsUpdate = true
    }
  }, [colorByLabel, dimmedEdgeOpacity, edges, neutralEdgeColor, selectedEdgeColor, selectedEdgeIdSet, selectedNodeIdSet, selectionMode, selectedEdgeWidth])

  useFrame(({ clock }) => {
    if (paused) return
    const geom = geomRef.current
    if (!geom) return
    const arr = posArrayRef.current
    const n = edges.length
    const t = clock.getElapsedTime()
    const ms: NodeMotionState = { intensity: motionRef.current.intensity, draggedNodeId: motionRef.current.draggedNodeId || null }
    for (let i = 0; i < n; i += 1) {
      const e = edges[i]
      const a = positions[String(e.source)]
      const b = positions[String(e.target)]
      const o = i * 6
      if (!a || !b) {
        arr[o + 0] = 0
        arr[o + 1] = 0
        arr[o + 2] = 0
        arr[o + 3] = 0
        arr[o + 4] = 0
        arr[o + 5] = 0
        continue
      }
      const srcId = String(e.source)
      const tgtId = String(e.target)
      const srcR = nodeRadiusById.get(srcId) || 5
      const tgtR = nodeRadiusById.get(tgtId) || 5
      const p0 = ms.intensity > 0 ? computeNodeMotion(srcId, a, srcR, ms, t) : a
      const p1 = ms.intensity > 0 ? computeNodeMotion(tgtId, b, tgtR, ms, t) : b
      arr[o + 0] = p0[0]
      arr[o + 1] = p0[1]
      arr[o + 2] = p0[2]
      arr[o + 3] = p1[0]
      arr[o + 4] = p1[1]
      arr[o + 5] = p1[2]
    }
    const attr = geom.attributes.instanceStart as THREE.InterleavedBufferAttribute | undefined
    if (attr && attr.data) {
      attr.data.needsUpdate = true
    }
  })

  const obj = lineRef.current
  if (!obj) return null
  return (
    <primitive
      object={obj}
      onClick={(evt: unknown) => {
        const e = evt as { stopPropagation?: () => void; instanceId?: number }
        if (e.stopPropagation) e.stopPropagation()
        const idx = typeof e.instanceId === 'number' ? e.instanceId : null
        const id = idx != null ? edgeIdsRef.current[idx] : null
        if (id) onSelectEdge(id)
      }}
      onPointerOver={(evt: unknown) => {
        if (!onHoverEdge) return
        const e = evt as { instanceId?: number; clientX: number; clientY: number }
        const idx = typeof e.instanceId === 'number' ? e.instanceId : null
        const id = idx != null ? edgeIdsRef.current[idx] : null
        if (!id) return
        onHoverEdge({ id, clientX: e.clientX, clientY: e.clientY })
      }}
      onPointerMove={(evt: unknown) => {
        if (!onHoverEdge) return
        const e = evt as { instanceId?: number; clientX: number; clientY: number }
        const idx = typeof e.instanceId === 'number' ? e.instanceId : null
        const id = idx != null ? edgeIdsRef.current[idx] : null
        if (!id) return
        onHoverEdge({ id, clientX: e.clientX, clientY: e.clientY })
      }}
      onPointerOut={() => {
        if (!onHoverEdge) return
        onHoverEdge(null)
      }}
    />
  )
}
