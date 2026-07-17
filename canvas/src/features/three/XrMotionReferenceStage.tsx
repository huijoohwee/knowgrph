import React from 'react'
import * as THREE from 'three'
import {
  XR_MOTION_REFERENCE_GRAPH_METADATA_KEY,
  resolveXrMotionReferenceStage,
  sampleXrMotionReferenceMarks,
  xrMotionReferenceSceneKey,
} from '@/features/three/xrMotionReferenceModel'
import {
  dropXrMotionReferenceCastMark,
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
import { getVoxelLabelTexture } from '@/features/three/voxelLabelTexture'

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
  const nextMark = track.marks.find(mark => mark.timeSeconds > playheadSeconds)
  const previousMark = [...track.marks].reverse().find(mark => mark.timeSeconds <= playheadSeconds) || track.marks[0]
  const facingDelta = nextMark && previousMark
    ? [nextMark.position[0] - previousMark.position[0], nextMark.position[2] - previousMark.position[2]] as const
    : [0, 0] as const
  const moving = Math.hypot(facingDelta[0], facingDelta[1]) > 0.001
  const facingY = moving ? Math.atan2(facingDelta[0], facingDelta[1]) : 0
  const walkSwing = moving ? Math.sin(playheadSeconds * Math.PI * 4) * 0.42 : 0
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
          <React.Fragment key={mark.id}>
            <mesh
              name={`kg_xr_motion_cast_mark_${track.actorId}_${index + 1}`}
              position={[position[0], position[1] + 0.35, position[2]]}
              rotation={[-Math.PI / 2, 0, 0]}
              userData={{ actorId: track.actorId, markNumber: index + 1, timeSeconds: mark.timeSeconds }}
            >
              <ringGeometry args={[markerSize * 0.72, markerSize, 28]} />
              <meshBasicMaterial color={track.color} transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
            <MarkNumberSprite number={index + 1} color={track.color} position={[position[0], position[1] + markerSize * 1.9, position[2]]} size={markerSize} />
          </React.Fragment>
        )
      })}
      {renderLiveActor ? <group name={`kg_xr_motion_cast_live_${track.actorId}`} position={sampledPosition} rotation={[0, facingY, 0]}>
        <mesh position={[0, scale * 0.92, 0]}>
          <boxGeometry args={[scale * 0.54, scale * 1.25, scale * 0.36]} />
          <meshStandardMaterial color={track.color} roughness={0.92} metalness={0} />
        </mesh>
        <mesh position={[0, scale * 1.78, 0]}>
          <sphereGeometry args={[scale * 0.3, 18, 12]} />
          <meshStandardMaterial color={track.color} roughness={0.86} metalness={0} />
        </mesh>
        <mesh position={[-scale * 0.16, scale * 0.3, 0]} rotation={[walkSwing, 0, 0]}>
          <boxGeometry args={[scale * 0.18, scale * 0.72, scale * 0.2]} />
          <meshStandardMaterial color={track.color} roughness={0.92} metalness={0} />
        </mesh>
        <mesh position={[scale * 0.16, scale * 0.3, 0]} rotation={[-walkSwing, 0, 0]}>
          <boxGeometry args={[scale * 0.18, scale * 0.72, scale * 0.2]} />
          <meshStandardMaterial color={track.color} roughness={0.92} metalness={0} />
        </mesh>
      </group> : null}
    </group>
  )
}

function MarkNumberSprite({
  number,
  color,
  position,
  size,
}: {
  number: number
  color: string
  position: readonly [number, number, number]
  size: number
}) {
  const label = React.useMemo(() => {
    if (typeof document === 'undefined') return null
    return getVoxelLabelTexture({
      text: String(number),
      fontSizePx: 24,
      textColor: '#ffffff',
      bgColor: color,
      bgOpacity: 0.96,
    })
  }, [color, number])
  if (!label) return null
  const aspect = label.widthPx / Math.max(1, label.heightPx)
  return (
    <sprite position={position} scale={[size * 1.45 * aspect, size * 1.45, 1]} renderOrder={THREE_RENDER_ORDER.overlays}>
      <spriteMaterial map={label.texture} transparent depthTest={false} depthWrite={false} />
    </sprite>
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
  const placeCastMark = React.useCallback((point: readonly [number, number, number]) => {
    const halfWidth = stage.sizeMeters[0] / 2
    const halfDepth = stage.sizeMeters[1] / 2
    dropXrMotionReferenceCastMark([
      Math.max(-halfWidth, Math.min(halfWidth, point[0] / scale)),
      0,
      Math.max(-halfDepth, Math.min(halfDepth, point[2] / scale)),
    ])
  }, [scale, stage.sizeMeters])

  return (
    <group
      name="kg_xr_motion_reference_stage"
      renderOrder={THREE_RENDER_ORDER.groups - 10}
      userData={{ schema: runtime.plan.schema, stageId: stage.id, playheadSeconds: runtime.playheadSeconds }}
    >
      <XrStagePresetGeometry
        stage={stage}
        span={span}
        groundY={groundY}
        onFloorPoint={runtime.castMarkArmed ? placeCastMark : undefined}
      />
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
            <group key={mark.id} name={`kg_xr_motion_camera_mark_${index + 1}`} position={position} quaternion={quaternion} userData={{ rig: mark.rig, lensMm: mark.settings.focalLengthMm }}>
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
