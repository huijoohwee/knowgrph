import React from 'react'
import * as THREE from 'three'
import {
  XR_MOTION_REFERENCE_GRAPH_METADATA_KEY,
  resolveXrMotionReferenceStage,
  sampleXrMotionReferenceMarks,
  xrMotionReferenceSceneKey,
} from '@/features/three/xrMotionReferenceModel'
import {
  hydrateXrMotionReferenceRuntime,
  readXrMotionReferenceRuntime,
  subscribeXrMotionReferenceRuntime,
} from '@/features/three/xrMotionReferenceRuntime'
import { THREE_RENDER_ORDER } from '@/features/three/renderOrder'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import { XrSceneLibrarySubject } from '@/features/three/XrSceneLibrarySubject'
import { xrMotionReferenceWorldPosition } from '@/features/three/xrMotionReferenceCoordinates'
import { XrStagePresetGeometry } from '@/features/three/XrStagePresetGeometry'

const EMPTY_XR_WORLD_NODES: readonly GraphNode[] = Object.freeze([])

function PathSegment({
  left,
  right,
  scale,
  groundY,
  color,
  thickness,
}: {
  left: readonly [number, number, number]
  right: readonly [number, number, number]
  scale: number
  groundY: number
  color: string
  thickness: number
}) {
  const start = xrMotionReferenceWorldPosition(left, scale, groundY)
  const end = xrMotionReferenceWorldPosition(right, scale, groundY)
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
  groundY,
  renderLiveActor,
}: {
  track: ReturnType<typeof readXrMotionReferenceRuntime>['plan']['cast'][number]
  playheadSeconds: number
  scale: number
  groundY: number
  renderLiveActor: boolean
}) {
  const sampled = sampleXrMotionReferenceMarks(track.marks, playheadSeconds)
  const sampledPosition = xrMotionReferenceWorldPosition(sampled, scale, groundY)
  const markerSize = Math.max(0.7, scale * 0.16)
  return (
    <group name={`kg_xr_motion_cast_${track.actorId}`}>
      {track.marks.slice(1).map((mark, index) => (
        <PathSegment
          key={`${track.actorId}:path:${mark.id}`}
          left={track.marks[index]!.position}
          right={mark.position}
          scale={scale}
          groundY={groundY}
          color={track.color}
          thickness={Math.max(0.25, scale * 0.035)}
        />
      ))}
      {track.marks.map((mark, index) => {
        const position = xrMotionReferenceWorldPosition(mark.position, scale, groundY)
        return (
          <mesh
            key={mark.id}
            name={`kg_xr_motion_cast_mark_${track.actorId}_${index + 1}`}
            position={[position[0], position[1] + 0.35, position[2]]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[markerSize * 0.72, markerSize, 28]} />
            <meshBasicMaterial color={track.color} transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        )
      })}
      {renderLiveActor ? <group name={`kg_xr_motion_cast_live_${track.actorId}`} position={sampledPosition}>
        <mesh position={[0, scale * 0.92, 0]}>
          <boxGeometry args={[scale * 0.54, scale * 1.25, scale * 0.36]} />
          <meshStandardMaterial color={track.color} roughness={0.92} metalness={0} />
        </mesh>
        <mesh position={[0, scale * 1.78, 0]}>
          <sphereGeometry args={[scale * 0.3, 18, 12]} />
          <meshStandardMaterial color={track.color} roughness={0.86} metalness={0} />
        </mesh>
      </group> : null}
    </group>
  )
}

export function XrMotionReferenceStage({
  graphData,
  span,
  groundY,
}: {
  graphData: GraphData | null
  span: number
  groundY: number
}) {
  const documentName = useGraphStore(state => state.markdownDocumentName)
  const canonicalGraphData = useGraphStore(state => state.graphData)
  const persistedValue = canonicalGraphData
    ? canonicalGraphData.metadata?.[XR_MOTION_REFERENCE_GRAPH_METADATA_KEY]
    : graphData?.metadata?.[XR_MOTION_REFERENCE_GRAPH_METADATA_KEY]
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
      persistedValue,
    })
  }, [graphData?.metadata, nodes, persistedValue, sceneKey])
  const stage = resolveXrMotionReferenceStage(runtime.plan.stageId)
  const scale = span / Math.max(stage.sizeMeters[0], stage.sizeMeters[1], 1)
  const floorHeight = stage.sizeMeters[1] * scale
  const subjectIds = React.useMemo(() => new Set(runtime.plan.subjects.map(subject => subject.id)), [runtime.plan.subjects])

  return (
    <group
      name="kg_xr_motion_reference_stage"
      renderOrder={THREE_RENDER_ORDER.groups - 10}
      userData={{ schema: runtime.plan.schema, stageId: stage.id, playheadSeconds: runtime.playheadSeconds }}
    >
      <XrStagePresetGeometry stage={stage} span={span} groundY={groundY} />
      <group name="kg_xr_motion_cast_tracks">
        {runtime.plan.cast.map(track => (
          <CastTrack
            key={track.actorId}
            track={track}
            playheadSeconds={runtime.playheadSeconds}
            scale={scale}
            groundY={groundY}
            renderLiveActor={!subjectIds.has(track.actorId)}
          />
        ))}
      </group>
      <group name="kg_xr_scene_library_subjects">
        {runtime.plan.subjects.map(subject => {
          const track = runtime.plan.cast.find(candidate => candidate.actorId === subject.id)
          const subjectPosition = track
            ? sampleXrMotionReferenceMarks(track.marks, runtime.playheadSeconds)
            : subject.position
          return (
            <XrSceneLibrarySubject
              key={subject.id}
              subject={subject}
              position={xrMotionReferenceWorldPosition(subjectPosition, scale, groundY)}
              stageScale={scale}
            />
          )
        })}
      </group>
      <group name="kg_xr_motion_camera_track">
        {runtime.plan.camera.length === 0 ? (
          <group
            name="kg_xr_motion_default_camera"
            position={[0, groundY + scale * 1.5, floorHeight * 0.32]}
          >
            <mesh>
              <boxGeometry args={[scale * 0.72, scale * 0.42, scale * 0.48]} />
              <meshStandardMaterial color="#e2e8f0" roughness={0.84} metalness={0} />
            </mesh>
            <mesh position={[0, 0, -scale * 0.48]} rotation={[-Math.PI / 2, 0, 0]}>
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
            groundY={groundY}
            color="#f8fafc"
            thickness={Math.max(0.3, scale * 0.045)}
          />
        ))}
        {runtime.plan.camera.map((mark, index) => {
          const position = xrMotionReferenceWorldPosition(mark.pose.position, scale, groundY)
          const target = xrMotionReferenceWorldPosition(mark.pose.target, scale, groundY)
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
              <mesh position={[0, scale * 0.64, 0]} rotation={[Math.PI / 2, 0, 0]}>
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
