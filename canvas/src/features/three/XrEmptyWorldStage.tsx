import React from 'react'
import * as THREE from 'three'
import { THREE_RENDER_ORDER } from '@/features/three/renderOrder'
import {
  XR_MOTION_STAGE_FLOOR_DEPTH,
  XR_MOTION_STAGE_SPAN,
} from '@/features/three/XrGraphStage'

const WORLD_SPAN = XR_MOTION_STAGE_SPAN * 2.6
const WORLD_GRID_DIVISIONS = 52
const CENTER_RING_INNER_RADIUS = 34
const CENTER_RING_OUTER_RADIUS = 43

function EmptyWorldCamera() {
  const position: [number, number, number] = [210, -280, 42]
  const target: [number, number, number] = [0, 0, XR_MOTION_STAGE_FLOOR_DEPTH]
  const direction = new THREE.Vector3(
    target[0] - position[0],
    target[1] - position[1],
    target[2] - position[2],
  ).normalize()
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)

  return (
    <group name="kg_xr_empty_world_camera" position={position} quaternion={quaternion}>
      <mesh>
        <boxGeometry args={[18, 11, 13]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.82} metalness={0.08} />
      </mesh>
      <mesh position={[0, 11, 0]}>
        <coneGeometry args={[7, 20, 4]} />
        <meshBasicMaterial color="#f8fafc" transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <mesh position={[0, -10, 0]}>
        <ringGeometry args={[5, 7, 32]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

export function XrEmptyWorldStage() {
  const floorDepth = XR_MOTION_STAGE_FLOOR_DEPTH
  return (
    <group
      name="kg_xr_empty_world_stage"
      renderOrder={THREE_RENDER_ORDER.groups - 12}
      userData={{ schema: 'knowgrph-xr-empty-world/v1', source: 'no-document' }}
    >
      <mesh name="kg_xr_empty_world_floor" position={[0, 0, floorDepth - 1]} receiveShadow>
        <boxGeometry args={[WORLD_SPAN, WORLD_SPAN, 2]} />
        <meshStandardMaterial color="#0b2f4a" roughness={1} metalness={0} />
      </mesh>
      <gridHelper
        name="kg_xr_empty_world_grid"
        args={[WORLD_SPAN, WORLD_GRID_DIVISIONS, '#4fb3d1', '#174d69']}
        position={[0, 0, floorDepth + 0.3]}
        rotation={[Math.PI / 2, 0, 0]}
      />
      <mesh name="kg_xr_empty_world_center_target" position={[0, 0, floorDepth + 0.8]}>
        <ringGeometry args={[CENTER_RING_INNER_RADIUS, CENTER_RING_OUTER_RADIUS, 72]} />
        <meshBasicMaterial color="#dbeafe" transparent opacity={0.78} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh name="kg_xr_empty_world_center_disc" position={[0, 0, floorDepth + 0.55]}>
        <circleGeometry args={[8, 40]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <mesh name="kg_xr_empty_world_vertical_axis" position={[0, 0, floorDepth + 125]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.7, 0.7, 250, 12]} />
        <meshBasicMaterial color="#5eead4" transparent opacity={0.68} depthWrite={false} />
      </mesh>
      <axesHelper name="kg_xr_empty_world_axes" args={[70]} position={[0, 0, floorDepth + 1]} />
      <EmptyWorldCamera />
    </group>
  )
}
