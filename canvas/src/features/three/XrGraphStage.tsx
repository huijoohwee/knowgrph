import React from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { GraphData } from '@/lib/graph/types'
import type { Vec3 } from '@/features/three/layout'
import { THREE_RENDER_ORDER } from '@/features/three/renderOrder'

type XrGraphStageMetrics = {
  cx: number
  cy: number
  z: number
  span: number
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

function resolveXrGraphStageMetrics(data: GraphData, positions: Record<string, Vec3>): XrGraphStageMetrics {
  let minX = 0
  let maxX = 0
  let minY = 0
  let maxY = 0
  let minZ = 0
  let seen = false
  for (let i = 0; i < data.nodes.length; i += 1) {
    const p = positions[data.nodes[i]!.id]
    if (!p) continue
    const x = Number(p[0])
    const y = Number(p[1])
    const z = Number(p[2])
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue
    if (!seen) {
      minX = maxX = x
      minY = maxY = y
      minZ = z
      seen = true
    } else {
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
      minZ = Math.min(minZ, z)
    }
  }
  const width = Math.max(80, maxX - minX)
  const height = Math.max(80, maxY - minY)
  const span = clamp(Math.max(width, height) + 180, 260, 760)
  return {
    cx: seen ? (minX + maxX) / 2 : 0,
    cy: seen ? (minY + maxY) / 2 : 0,
    z: Math.min(-70, minZ - 64),
    span,
  }
}

export function XrGraphStage({
  data,
  positions,
  paused,
}: {
  data: GraphData
  positions: Record<string, Vec3>
  paused?: boolean
}) {
  const ringRef = React.useRef<THREE.Mesh | null>(null)
  const reticleRef = React.useRef<THREE.Mesh | null>(null)
  const beamRef = React.useRef<THREE.Group | null>(null)
  const metrics = React.useMemo(() => resolveXrGraphStageMetrics(data, positions), [data, positions])
  const gridOffsets = React.useMemo(() => {
    const out: number[] = []
    const steps = 8
    for (let i = -steps; i <= steps; i += 1) out.push((i / steps) * metrics.span * 0.5)
    return out
  }, [metrics.span])
  useFrame(({ clock }) => {
    if (paused) return
    const t = clock.getElapsedTime()
    if (ringRef.current) {
      const s = 1 + Math.sin(t * 0.9) * 0.035
      ringRef.current.scale.set(s, s, 1)
    }
    if (reticleRef.current) {
      reticleRef.current.rotation.z = t * 0.34
      reticleRef.current.position.z = metrics.z + 18 + Math.sin(t * 1.6) * 2.4
    }
    if (beamRef.current) {
      beamRef.current.rotation.z = Math.sin(t * 0.8) * 0.035
    }
  })
  const frame = metrics.span * 0.5
  const line = clamp(metrics.span * 0.0035, 0.9, 2.4)
  return (
    <group name="kg_graph_xr_stage" position={[metrics.cx, metrics.cy, 0]} renderOrder={THREE_RENDER_ORDER.groups - 20}>
      <mesh name="kg_graph_xr_depth_plane" position={[0, 0, metrics.z]}>
        <planeGeometry args={[metrics.span, metrics.span]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.24} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <group name="kg_graph_xr_depth_grid">
        {gridOffsets.map((offset, index) => (
          <React.Fragment key={`grid-${index}`}>
            <mesh name={`kg_graph_xr_grid_vertical_${index}`} position={[offset, 0, metrics.z + 0.4]}>
              <planeGeometry args={[line, metrics.span]} />
              <meshBasicMaterial color={index % 4 === 0 ? '#38bdf8' : '#64748b'} transparent opacity={index % 4 === 0 ? 0.34 : 0.18} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
            <mesh name={`kg_graph_xr_grid_horizontal_${index}`} position={[0, offset, metrics.z + 0.5]}>
              <planeGeometry args={[metrics.span, line]} />
              <meshBasicMaterial color={index % 4 === 0 ? '#a78bfa' : '#64748b'} transparent opacity={index % 4 === 0 ? 0.32 : 0.16} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          </React.Fragment>
        ))}
      </group>
      <group name="kg_graph_xr_boundary_frame">
        {[
          [0, frame, metrics.span, line * 1.7, '#22c55e'],
          [frame, 0, line * 1.7, metrics.span, '#f59e0b'],
          [0, -frame, metrics.span, line * 1.7, '#38bdf8'],
          [-frame, 0, line * 1.7, metrics.span, '#f472b6'],
        ].map(([x, y, w, h, color], index) => (
          <mesh key={index} name={`kg_graph_xr_boundary_${index}`} position={[Number(x), Number(y), metrics.z + 1]}>
            <planeGeometry args={[Number(w), Number(h)]} />
            <meshBasicMaterial color={String(color)} transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      <mesh ref={ringRef} name="kg_graph_xr_orientation_ring" position={[0, 0, metrics.z + 6]}>
        <torusGeometry args={[metrics.span * 0.2, line * 0.65, 8, 96]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.72} depthWrite={false} />
      </mesh>
      <mesh ref={reticleRef} name="kg_graph_xr_focus_reticle" position={[0, 0, metrics.z + 18]}>
        <ringGeometry args={[metrics.span * 0.026, metrics.span * 0.034, 48]} />
        <meshBasicMaterial color="#f8fafc" transparent opacity={0.84} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <group ref={beamRef} name="kg_graph_xr_controller_rays">
        {[
          [-metrics.span * 0.18, -metrics.span * 0.46, 24, '#22d3ee', -0.22],
          [metrics.span * 0.18, -metrics.span * 0.46, 26, '#f59e0b', 0.22],
        ].map(([x, y, zLift, color, rotation], index) => (
          <mesh key={index} name={`kg_graph_xr_controller_ray_${index}`} position={[Number(x), Number(y), metrics.z + Number(zLift)]} rotation={[0, 0, Number(rotation)]}>
            <planeGeometry args={[line * 1.5, metrics.span * 0.36]} />
            <meshBasicMaterial color={String(color)} transparent opacity={0.34} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      <group name="kg_graph_xr_status_beacons">
        {[
          [0, frame * 0.72, '#22c55e'],
          [frame * 0.72, 0, '#f59e0b'],
          [0, -frame * 0.72, '#38bdf8'],
          [-frame * 0.72, 0, '#f472b6'],
        ].map(([x, y, color], index) => (
          <mesh key={index} name={`kg_graph_xr_status_beacon_${index}`} position={[Number(x), Number(y), metrics.z + 20]}>
            <octahedronGeometry args={[metrics.span * 0.018, 0]} />
            <meshBasicMaterial color={String(color)} transparent opacity={0.86} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
