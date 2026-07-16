import React from 'react'
import * as THREE from 'three'
import {
  XR_MOTION_REFERENCE_GRAPH_METADATA_KEY,
  resolveXrMotionReferenceStage,
  sampleXrMotionReferenceMarks,
  xrMotionReferenceSceneKey,
  type XrMotionReferenceVector,
} from '@/features/three/xrMotionReferenceModel'
import {
  hydrateXrMotionReferenceRuntime,
  readXrMotionReferenceRuntime,
  subscribeXrMotionReferenceRuntime,
} from '@/features/three/xrMotionReferenceRuntime'
import { THREE_RENDER_ORDER } from '@/features/three/renderOrder'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { useGraphStore } from '@/hooks/useGraphStore'

const STRUCTURE_TONES = {
  light: '#94a3b8',
  mid: '#64748b',
  dark: '#334155',
  accent: '#0f766e',
} as const

const EMPTY_XR_WORLD_NODES: readonly GraphNode[] = Object.freeze([])

function stagePosition(
  position: XrMotionReferenceVector,
  scale: number,
  floorDepth: number,
): [number, number, number] {
  return [position[0] * scale, position[2] * scale, floorDepth + position[1] * scale]
}

function PathSegment({
  left,
  right,
  scale,
  floorDepth,
  color,
  thickness,
}: {
  left: XrMotionReferenceVector
  right: XrMotionReferenceVector
  scale: number
  floorDepth: number
  color: string
  thickness: number
}) {
  const start = stagePosition(left, scale, floorDepth)
  const end = stagePosition(right, scale, floorDepth)
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const dz = end[2] - start[2]
  const length = Math.hypot(dx, dy, dz)
  if (length < 0.001) return null
  const direction = new THREE.Vector3(dx, dy, dz).normalize()
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction)
  return (
    <mesh
      position={[(start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2]}
      quaternion={quaternion}
    >
      <boxGeometry args={[length, thickness, thickness]} />
      <meshBasicMaterial color={color} transparent opacity={0.66} depthWrite={false} />
    </mesh>
  )
}

function CastTrack({
  track,
  playheadSeconds,
  scale,
  floorDepth,
}: {
  track: ReturnType<typeof readXrMotionReferenceRuntime>['plan']['cast'][number]
  playheadSeconds: number
  scale: number
  floorDepth: number
}) {
  const sampled = sampleXrMotionReferenceMarks(track.marks, playheadSeconds)
  const sampledPosition = stagePosition(sampled, scale, floorDepth)
  const markerSize = Math.max(0.7, scale * 0.16)
  return (
    <group name={`kg_xr_motion_cast_${track.actorId}`}>
      {track.marks.slice(1).map((mark, index) => (
        <PathSegment
          key={`${track.actorId}:path:${mark.id}`}
          left={track.marks[index]!.position}
          right={mark.position}
          scale={scale}
          floorDepth={floorDepth}
          color={track.color}
          thickness={Math.max(0.25, scale * 0.035)}
        />
      ))}
      {track.marks.map((mark, index) => {
        const position = stagePosition(mark.position, scale, floorDepth)
        return (
          <mesh key={mark.id} name={`kg_xr_motion_cast_mark_${track.actorId}_${index + 1}`} position={[position[0], position[1], position[2] + 0.35]}>
            <ringGeometry args={[markerSize * 0.72, markerSize, 28]} />
            <meshBasicMaterial color={track.color} transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        )
      })}
      <group name={`kg_xr_motion_cast_live_${track.actorId}`} position={sampledPosition}>
        <mesh position={[0, 0, scale * 0.92]}>
          <boxGeometry args={[scale * 0.54, scale * 0.36, scale * 1.25]} />
          <meshStandardMaterial color={track.color} roughness={0.92} metalness={0} />
        </mesh>
        <mesh position={[0, 0, scale * 1.78]}>
          <sphereGeometry args={[scale * 0.3, 18, 12]} />
          <meshStandardMaterial color={track.color} roughness={0.86} metalness={0} />
        </mesh>
      </group>
    </group>
  )
}

export function XrMotionReferenceStage({
  graphData,
  span,
  floorDepth,
}: {
  graphData: GraphData | null
  span: number
  floorDepth: number
}) {
  const documentName = useGraphStore(state => state.markdownDocumentName)
  const runtime = React.useSyncExternalStore(
    subscribeXrMotionReferenceRuntime,
    readXrMotionReferenceRuntime,
    readXrMotionReferenceRuntime,
  )
  const sceneKey = React.useMemo(
    () => xrMotionReferenceSceneKey(documentName, graphData),
    [documentName, graphData],
  )
  const nodes = graphData?.nodes || EMPTY_XR_WORLD_NODES
  React.useEffect(() => {
    hydrateXrMotionReferenceRuntime({
      sceneKey,
      nodes,
      persistedValue: graphData?.metadata?.[XR_MOTION_REFERENCE_GRAPH_METADATA_KEY],
    })
  }, [graphData?.metadata, nodes, sceneKey])
  const stage = resolveXrMotionReferenceStage(runtime.plan.stageId)
  const scale = span / Math.max(stage.sizeMeters[0], stage.sizeMeters[1], 1)
  const floorWidth = stage.sizeMeters[0] * scale
  const floorHeight = stage.sizeMeters[1] * scale
  const floorThickness = Math.max(0.5, scale * 0.08)

  return (
    <group
      name="kg_xr_motion_reference_stage"
      renderOrder={THREE_RENDER_ORDER.groups - 10}
      userData={{ schema: runtime.plan.schema, stageId: stage.id, playheadSeconds: runtime.playheadSeconds }}
    >
      <mesh name="kg_xr_motion_stage_floor" position={[0, 0, floorDepth]}>
        <boxGeometry args={[floorWidth, floorHeight, floorThickness]} />
        <meshStandardMaterial color="#475569" roughness={1} metalness={0} transparent opacity={0.68} />
      </mesh>
      <gridHelper
        name="kg_xr_motion_world_grid"
        args={[floorWidth, Math.max(12, Math.round(stage.sizeMeters[0] * 2)), '#38bdf8', '#334155']}
        position={[0, 0, floorDepth + floorThickness * 0.7]}
        rotation={[Math.PI / 2, 0, 0]}
      />
      <axesHelper
        name="kg_xr_motion_world_origin"
        args={[Math.max(4, scale * 2.4)]}
        position={[0, 0, floorDepth + floorThickness]}
      />
      <group name={`kg_xr_motion_stage_preset_${stage.id}`}>
        {stage.structures.map(structure => {
          const position = stagePosition(structure.position, scale, floorDepth)
          return (
            <mesh key={structure.id} name={`kg_xr_motion_structure_${structure.id}`} position={position}>
              <boxGeometry args={[
                structure.size[0] * scale,
                structure.size[2] * scale,
                structure.size[1] * scale,
              ]} />
              <meshStandardMaterial color={STRUCTURE_TONES[structure.tone]} roughness={0.95} metalness={0} transparent opacity={0.78} />
            </mesh>
          )
        })}
      </group>
      <group name="kg_xr_motion_cast_tracks">
        {runtime.plan.cast.map(track => (
          <CastTrack
            key={track.actorId}
            track={track}
            playheadSeconds={runtime.playheadSeconds}
            scale={scale}
            floorDepth={floorDepth + floorThickness}
          />
        ))}
      </group>
      <group name="kg_xr_motion_camera_track">
        {runtime.plan.camera.length === 0 ? (
          <group
            name="kg_xr_motion_default_camera"
            position={[0, -floorHeight * 0.32, floorDepth + scale * 1.5]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <mesh>
              <boxGeometry args={[scale * 0.72, scale * 0.42, scale * 0.48]} />
              <meshStandardMaterial color="#e2e8f0" roughness={0.84} metalness={0} />
            </mesh>
            <mesh position={[0, 0, scale * 0.48]}>
              <coneGeometry args={[scale * 0.3, scale * 0.72, 4]} />
              <meshBasicMaterial color="#f8fafc" transparent opacity={0.88} depthWrite={false} />
            </mesh>
          </group>
        ) : null}
        {runtime.plan.camera.slice(1).map((mark, index) => (
          <PathSegment
            key={`camera-path:${mark.id}`}
            left={runtime.plan.camera[index]!.pose.position}
            right={mark.pose.position}
            scale={scale}
            floorDepth={floorDepth + floorThickness}
            color="#f8fafc"
            thickness={Math.max(0.3, scale * 0.045)}
          />
        ))}
        {runtime.plan.camera.map((mark, index) => {
          const position = stagePosition(mark.pose.position, scale, floorDepth + floorThickness)
          const target = stagePosition(mark.pose.target, scale, floorDepth + floorThickness)
          const direction = new THREE.Vector3(target[0] - position[0], target[1] - position[1], target[2] - position[2])
          const quaternion = direction.lengthSq() > 0.000001
            ? new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
            : new THREE.Quaternion()
          return (
            <group key={mark.id} name={`kg_xr_motion_camera_mark_${index + 1}`} position={position} quaternion={quaternion}>
              <mesh>
                <coneGeometry args={[scale * 0.34, scale * 0.8, 4]} />
                <meshBasicMaterial color="#f8fafc" transparent opacity={0.92} depthWrite={false} />
              </mesh>
              <mesh position={[0, 0, scale * 0.64]}>
                <ringGeometry args={[scale * 0.18, scale * 0.25, 24]} />
                <meshBasicMaterial color="#f8fafc" transparent opacity={0.8} depthWrite={false} side={THREE.DoubleSide} />
              </mesh>
            </group>
          )
        })}
      </group>
    </group>
  )
}
