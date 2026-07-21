import React from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, Euler, Quaternion, Vector3, type Group, type Mesh, type MeshStandardMaterial } from 'three'
import {
  readGameFpsSpatialProfile,
  readGameFpsSnapshot,
  subscribeGameFpsSnapshot,
} from './gameFpsRuntime'
import { GAME_FPS_MAX_FRAME_SECONDS, GAME_FPS_NPC_IDS } from './gameFpsModel'
import { installGameFpsDesktopInput } from './gameFpsInput'
import {
  claimThreeViewportInputOwnership,
  releaseThreeViewportInputOwnership,
} from '@/features/three/threeViewportInputOwnership'
import { readMotionControlSnapshot } from '@/features/three/motionControlRuntime'
import { motionControlPoseToControllerInput } from '@/features/three/motionControlPose'
import {
  applyGameFpsMotionControlInput,
  releaseGameFpsMotionControlInput,
} from './gameFpsMotionControlAdapter'
import {
  advanceGameModeSimulationBy,
  readGameModeSnapshot,
} from './gameModeRuntime'

const INPUT_OWNER_ID = 'game-fps:first-person'
const READY_FRAME_COUNT = 2
const ACTION_COLORS = Object.freeze({
  hold: new Color('#60a5fa'),
  alert: new Color('#facc15'),
  engage: new Color('#ef4444'),
  flee: new Color('#c084fc'),
})

function setMeshColor(mesh: Mesh, color: Color): void {
  const material = mesh.material as MeshStandardMaterial
  if (material?.color) material.color.copy(color)
}

export function GameFpsMissionStage({ coordinateScale = 1 }: {
  coordinateScale?: number
}) {
  const { camera, gl } = useThree()
  const snapshotRef = React.useRef(readGameFpsSnapshot())
  const stageRootRef = React.useRef<Group | null>(null)
  const npcMeshRefs = React.useRef(new Map<string, Mesh>())
  const firstFramePublishedRef = React.useRef(false)
  const readyFrameCountRef = React.useRef(0)
  const inputClaimedRef = React.useRef(false)
  const cameraLocalPosition = React.useMemo(() => new Vector3(), [])
  const cameraLocalRotation = React.useMemo(() => new Euler(0, 0, 0, 'YXZ'), [])
  const cameraLocalQuaternion = React.useMemo(() => new Quaternion(), [])
  const stageWorldQuaternion = React.useMemo(() => new Quaternion(), [])

  React.useEffect(() => subscribeGameFpsSnapshot(() => {
    snapshotRef.current = readGameFpsSnapshot()
  }), [])

  React.useEffect(() => {
    const canvas = gl.domElement
    const claimed = claimThreeViewportInputOwnership(INPUT_OWNER_ID)
    inputClaimedRef.current = claimed
    canvas.dataset.kgGameFpsInputOwner = claimed ? INPUT_OWNER_ID : 'blocked'
    canvas.dataset.kgGameFpsSpatialProfile = readGameFpsSpatialProfile().id
    const input = claimed ? installGameFpsDesktopInput(canvas) : null
    return () => {
      inputClaimedRef.current = false
      input?.dispose()
      readyFrameCountRef.current = 0
      releaseGameFpsMotionControlInput()
      releaseThreeViewportInputOwnership(INPUT_OWNER_ID)
      delete canvas.dataset.kgGameFpsInputOwner
      delete canvas.dataset.kgGameFpsFirstFrame
      delete canvas.dataset.kgGameFpsSpatialProfile
      delete canvas.dataset.kgGameFpsCameraFov
    }
  }, [gl])

  useFrame((_, deltaSeconds) => {
    applyGameFpsMotionControlInput(
      motionControlPoseToControllerInput(readMotionControlSnapshot().pose),
    )
    const before = snapshotRef.current
    if (before.phase === 'playing'
      && !before.runtimeError
      && readGameModeSnapshot().simulationStatus === 'running') {
      void advanceGameModeSimulationBy(deltaSeconds).catch(() => undefined)
    }
    const snapshot = readGameFpsSnapshot()
    snapshotRef.current = snapshot
    gl.domElement.dataset.kgGameFpsSpatialProfile = readGameFpsSpatialProfile().id

    const stageRoot = stageRootRef.current
    cameraLocalPosition.set(snapshot.player.x, 1.65, snapshot.player.z)
    cameraLocalRotation.set(snapshot.player.pitch, snapshot.player.yaw, 0, 'YXZ')
    cameraLocalQuaternion.setFromEuler(cameraLocalRotation)
    if (stageRoot) {
      stageRoot.updateWorldMatrix(true, false)
      stageRoot.localToWorld(cameraLocalPosition)
      stageRoot.getWorldQuaternion(stageWorldQuaternion)
      camera.quaternion.copy(stageWorldQuaternion).multiply(cameraLocalQuaternion)
    } else {
      camera.quaternion.copy(cameraLocalQuaternion)
    }
    camera.position.copy(cameraLocalPosition)
    camera.updateMatrixWorld()
    gl.domElement.dataset.kgGameFpsCameraFov = String('fov' in camera ? camera.fov : '')

    for (const npc of snapshot.npcs) {
      const mesh = npcMeshRefs.current.get(npc.id)
      if (!mesh) continue
      mesh.position.set(npc.x, 0.9, npc.z)
      mesh.visible = npc.health > 0
      mesh.scale.y = Math.max(0.12, npc.health / 100)
      setMeshColor(mesh, ACTION_COLORS[npc.action])
    }
    if (snapshot.runtimeError || snapshot.phase === 'stopped' || !inputClaimedRef.current) {
      firstFramePublishedRef.current = false
      readyFrameCountRef.current = 0
      delete gl.domElement.dataset.kgGameFpsFirstFrame
    } else if (!firstFramePublishedRef.current) {
      readyFrameCountRef.current = deltaSeconds > 0 && deltaSeconds <= GAME_FPS_MAX_FRAME_SECONDS
        ? readyFrameCountRef.current + 1
        : 0
      if (readyFrameCountRef.current >= READY_FRAME_COUNT) {
        firstFramePublishedRef.current = true
        gl.domElement.dataset.kgGameFpsFirstFrame = '1'
      }
    }
  })

  return (
    <group ref={stageRootRef} name="kg_game_fps_mission" scale={coordinateScale} userData={{ coordinateScale }}>
      {GAME_FPS_NPC_IDS.map(id => {
        const npc = snapshotRef.current.npcs.find(candidate => candidate.id === id)!
        return (
        <mesh
          key={id}
          name={`kg_game_fps_npc_${id}`}
          ref={mesh => {
            if (mesh) npcMeshRefs.current.set(id, mesh)
            else npcMeshRefs.current.delete(id)
          }}
          position={[npc.x, 0.9, npc.z]}
          castShadow
        >
          <capsuleGeometry args={[0.45, 0.9, 4, 8]} />
          <meshStandardMaterial color="#60a5fa" roughness={0.55} />
        </mesh>
        )
      })}
    </group>
  )
}
