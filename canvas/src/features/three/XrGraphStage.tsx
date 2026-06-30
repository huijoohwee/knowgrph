import React from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { GraphData } from '@/lib/graph/types'
import type { Vec3 } from '@/features/three/layout'
import { THREE_RENDER_ORDER } from '@/features/three/renderOrder'
import {
  installXrPhysicsKeyboardControls,
  readXrPhysicsPlaygroundControls,
  subscribeXrPhysicsPlaygroundControls,
} from '@/features/three/xrPhysicsPlaygroundControls'
import {
  projectXrPhysicsWorldToCanvasStage,
  resolveXrPhysicsPlaygroundState,
  type XrPhysicsPlaygroundControls,
} from '@/features/three/xrPhysicsPlaygroundModel'

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
  const physicsRollRef = React.useRef<THREE.Mesh | null>(null)
  const physicsThrustRef = React.useRef<THREE.Group | null>(null)
  const physicsVelocityRef = React.useRef<THREE.Mesh | null>(null)
  const physicsCameraAnchorRef = React.useRef<THREE.Mesh | null>(null)
  const physicsControlsRef = React.useRef<XrPhysicsPlaygroundControls>(readXrPhysicsPlaygroundControls())
  const metrics = React.useMemo(() => resolveXrGraphStageMetrics(data, positions), [data, positions])
  const gridOffsets = React.useMemo(() => {
    const out: number[] = []
    const steps = 8
    for (let i = -steps; i <= steps; i += 1) out.push((i / steps) * metrics.span * 0.5)
    return out
  }, [metrics.span])

  React.useEffect(() => {
    if (paused) return undefined
    const unsubscribe = subscribeXrPhysicsPlaygroundControls(controls => {
      physicsControlsRef.current = controls
    })
    const uninstallKeyboard = installXrPhysicsKeyboardControls()
    return () => {
      uninstallKeyboard()
      unsubscribe()
    }
  }, [paused])

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
    const physics = resolveXrPhysicsPlaygroundState(metrics, t, physicsControlsRef.current)
    if (physicsRollRef.current) {
      physicsRollRef.current.position.set(...physics.rollPosition)
      physicsRollRef.current.rotation.z = -t * 1.4
      physicsRollRef.current.scale.setScalar(physics.activeMode === 'roll' ? 1.12 + physics.inputIntensity * 0.1 : 0.92)
    }
    if (physicsThrustRef.current) {
      physicsThrustRef.current.position.set(...physics.thrustPosition)
      physicsThrustRef.current.rotation.z = Math.sin(t * 1.1) * 0.16
      physicsThrustRef.current.scale.setScalar(physics.activeMode === 'thrust' ? 1.16 + physics.inputIntensity * 0.14 : 0.9)
    }
    if (physicsVelocityRef.current) {
      physicsVelocityRef.current.position.set(
        physics.activeMode === 'roll' ? physics.rollPosition[0] : physics.thrustPosition[0],
        physics.activeMode === 'roll' ? physics.rollPosition[1] : physics.thrustPosition[1],
        physics.activeMode === 'roll' ? physics.rollPosition[2] : physics.thrustPosition[2],
      )
      physicsVelocityRef.current.scale.set(1, Math.max(line * 12, Math.hypot(...physics.velocityVector) * 0.65), 1)
      physicsVelocityRef.current.rotation.z = Math.atan2(physics.velocityVector[1], physics.velocityVector[0]) - Math.PI / 2
    }
    if (physicsCameraAnchorRef.current) {
      physicsCameraAnchorRef.current.position.set(...physics.cameraAnchor)
      physicsCameraAnchorRef.current.scale.setScalar(0.85 + physics.stabilization * 0.2)
    }
  })
  const frame = metrics.span * 0.5
  const line = clamp(metrics.span * 0.0035, 0.9, 2.4)
  const projectPhysicsWorldPosition = (x: number, zForward: number, yUp: number): [number, number, number] => [
    ...projectXrPhysicsWorldToCanvasStage(metrics, [x, yUp, zForward]),
  ]
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
      <group name="kg_graph_xr_physics_playground_terrain">
        {[
          ['kg_graph_xr_physics_ball_spawn_platform', -metrics.span * 0.28, -metrics.span * 0.2, metrics.span * 0.2, metrics.span * 0.1, '#334155'],
          ['kg_graph_xr_physics_rocket_spawn_platform', metrics.span * 0.28, metrics.span * 0.2, metrics.span * 0.2, metrics.span * 0.1, '#334155'],
          ['kg_graph_xr_physics_jump_ramp', -metrics.span * 0.1, metrics.span * 0.08, metrics.span * 0.24, metrics.span * 0.06, '#0e7490'],
          ['kg_graph_xr_physics_thrust_ramp', metrics.span * 0.1, -metrics.span * 0.08, metrics.span * 0.24, metrics.span * 0.06, '#b45309'],
        ].map(([name, x, y, w, h, color], index) => (
          <mesh
            key={String(name)}
            name={String(name)}
            position={projectPhysicsWorldPosition(Number(x), Number(y), 26 + index * 0.2)}
            rotation={[0, 0, index > 1 ? (index === 2 ? -0.18 : 0.18) : 0]}
          >
            <boxGeometry args={[Number(w), Number(h), line * 3]} />
            <meshBasicMaterial color={String(color)} transparent opacity={0.74} depthWrite={false} />
          </mesh>
        ))}
        {[
          [-metrics.span * 0.34, metrics.span * 0.14, '#ef4444'],
          [-metrics.span * 0.06, -metrics.span * 0.3, '#f97316'],
          [metrics.span * 0.34, -metrics.span * 0.08, '#ef4444'],
          [metrics.span * 0.08, metrics.span * 0.31, '#f97316'],
        ].map(([x, y, color], index) => (
          <mesh
            key={index}
            name={`kg_graph_xr_physics_collision_obstacle_${index}`}
            position={projectPhysicsWorldPosition(Number(x), Number(y), 36)}
          >
            <boxGeometry args={[metrics.span * 0.045, metrics.span * 0.045, line * 8]} />
            <meshBasicMaterial color={String(color)} transparent opacity={0.82} depthWrite={false} />
          </mesh>
        ))}
        {[
          ['kg_graph_xr_physics_roll_swap_pad', -metrics.span * 0.08, -metrics.span * 0.44, '#38bdf8'],
          ['kg_graph_xr_physics_thrust_swap_pad', metrics.span * 0.08, -metrics.span * 0.44, '#f59e0b'],
          ['kg_graph_xr_physics_input_map_panel', 0, -metrics.span * 0.5, '#64748b'],
        ].map(([name, x, y, color], index) => (
          <mesh key={String(name)} name={String(name)} position={projectPhysicsWorldPosition(Number(x), Number(y), 44 + index * 0.2)}>
            <boxGeometry args={[index === 2 ? metrics.span * 0.28 : metrics.span * 0.1, metrics.span * 0.035, line * 2.4]} />
            <meshBasicMaterial color={String(color)} transparent opacity={0.7} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <group name="kg_graph_xr_physics_playground">
        <mesh name="kg_graph_xr_physics_collision_boundaries" position={[0, 0, metrics.z + 24]}>
          <ringGeometry args={[metrics.span * 0.305, metrics.span * 0.315, 96]} />
          <meshBasicMaterial color="#22c55e" transparent opacity={0.32} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={physicsRollRef} name="kg_graph_xr_physics_roll_controller" position={[0, -metrics.span * 0.18, metrics.z + 34]}>
          <sphereGeometry args={[metrics.span * 0.026, 24, 16]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.9} depthWrite={false} />
        </mesh>
        <group ref={physicsThrustRef} name="kg_graph_xr_physics_thrust_controller" position={[0, metrics.span * 0.18, metrics.z + 62]}>
          <mesh name="kg_graph_xr_physics_thrust_body">
            <coneGeometry args={[metrics.span * 0.032, metrics.span * 0.1, 24]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.88} depthWrite={false} />
          </mesh>
          <mesh name="kg_graph_xr_physics_thrust_plume" position={[0, -metrics.span * 0.07, 0]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[metrics.span * 0.024, metrics.span * 0.07, 18]} />
            <meshBasicMaterial color="#f97316" transparent opacity={0.42} depthWrite={false} />
          </mesh>
        </group>
        <mesh ref={physicsVelocityRef} name="kg_graph_xr_physics_velocity_vector" position={[0, 0, metrics.z + 42]}>
          <planeGeometry args={[line * 1.4, metrics.span * 0.12]} />
          <meshBasicMaterial color="#f8fafc" transparent opacity={0.46} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={physicsCameraAnchorRef} name="kg_graph_xr_physics_camera_anchor" position={[0, 0, metrics.z + metrics.span * 0.16]}>
          <ringGeometry args={[metrics.span * 0.018, metrics.span * 0.026, 32]} />
          <meshBasicMaterial color="#a78bfa" transparent opacity={0.78} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}
