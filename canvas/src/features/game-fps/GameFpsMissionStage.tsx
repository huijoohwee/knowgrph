import React from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, Euler, Quaternion, Vector3, type Group, type Mesh, type MeshStandardMaterial } from 'three'
import {
  readGameFpsSpatialProfile,
  readGameFpsSnapshot,
  subscribeGameFpsSnapshot,
} from './gameFpsRuntime'
import { GAME_FPS_MAP, GAME_FPS_NPC_SEEDS } from './gameFpsModel'
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
  subscribeGameModeSnapshot,
} from './gameModeRuntime'
import type { GameFpsScenePresentation } from './gameModeSceneComposition'

const INPUT_OWNER_ID = 'game-fps:first-person'
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

function GameFpsArenaEnvironment() {
  return (
    <group name="kg_game_fps_arena">
      <ambientLight intensity={0.62} />
      <hemisphereLight args={['#b9e6ff', '#172033', 0.72]} />
      <directionalLight position={[8, 16, 5]} intensity={1.2} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[GAME_FPS_MAP.halfWidth * 2, GAME_FPS_MAP.halfDepth * 2]} />
        <meshStandardMaterial color="#1f3b36" roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.5, -GAME_FPS_MAP.halfDepth]} castShadow receiveShadow>
        <boxGeometry args={[GAME_FPS_MAP.halfWidth * 2, 3, 0.5]} />
        <meshStandardMaterial color="#314158" />
      </mesh>
      <mesh position={[0, 1.5, GAME_FPS_MAP.halfDepth]} castShadow receiveShadow>
        <boxGeometry args={[GAME_FPS_MAP.halfWidth * 2, 3, 0.5]} />
        <meshStandardMaterial color="#314158" />
      </mesh>
      <mesh position={[-GAME_FPS_MAP.halfWidth, 1.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 3, GAME_FPS_MAP.halfDepth * 2]} />
        <meshStandardMaterial color="#26364c" />
      </mesh>
      <mesh position={[GAME_FPS_MAP.halfWidth, 1.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 3, GAME_FPS_MAP.halfDepth * 2]} />
        <meshStandardMaterial color="#26364c" />
      </mesh>
      {GAME_FPS_MAP.blockers.map(blocker => (
        <mesh key={blocker.id} position={[blocker.centerX, blocker.height / 2, blocker.centerZ]} castShadow receiveShadow>
          <boxGeometry args={[blocker.halfWidth * 2, blocker.height, blocker.halfDepth * 2]} />
          <meshStandardMaterial color="#64748b" roughness={0.82} />
        </mesh>
      ))}
      <gridHelper args={[GAME_FPS_MAP.halfWidth * 2, 18, '#4b8074', '#29473f']} position={[0, 0.01, 0]} />
    </group>
  )
}

export function GameFpsMissionStage({
  coordinateScale = 1,
  presentation,
}: {
  coordinateScale?: number
  presentation: GameFpsScenePresentation
}) {
  const { camera, gl } = useThree()
  const gameMode = React.useSyncExternalStore(
    subscribeGameModeSnapshot,
    readGameModeSnapshot,
    readGameModeSnapshot,
  )
  const snapshotRef = React.useRef(readGameFpsSnapshot())
  const stageRootRef = React.useRef<Group | null>(null)
  const npcMeshRefs = React.useRef(new Map<string, Mesh>())
  const firstFramePublishedRef = React.useRef(false)
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
    canvas.dataset.kgGameFpsPresentation = presentation
    canvas.dataset.kgGameFpsSpatialProfile = readGameFpsSpatialProfile().id
    const input = claimed ? installGameFpsDesktopInput(canvas) : null
    return () => {
      inputClaimedRef.current = false
      input?.dispose()
      releaseGameFpsMotionControlInput()
      releaseThreeViewportInputOwnership(INPUT_OWNER_ID)
      delete canvas.dataset.kgGameFpsInputOwner
      delete canvas.dataset.kgGameFpsFirstFrame
      delete canvas.dataset.kgGameFpsPresentation
      delete canvas.dataset.kgGameFpsSpatialProfile
      delete canvas.dataset.kgGameFpsCameraFov
    }
  }, [gl, presentation])

  useFrame((_, deltaSeconds) => {
    applyGameFpsMotionControlInput(
      motionControlPoseToControllerInput(readMotionControlSnapshot().pose),
    )
    const before = snapshotRef.current
    if (before.phase === 'playing' && !before.runtimeError && gameMode.simulationStatus === 'running') {
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
    if (snapshot.runtimeError) {
      firstFramePublishedRef.current = false
      delete gl.domElement.dataset.kgGameFpsFirstFrame
    } else if (!firstFramePublishedRef.current && inputClaimedRef.current && snapshot.phase !== 'stopped') {
      firstFramePublishedRef.current = true
      gl.domElement.dataset.kgGameFpsFirstFrame = '1'
    }
  })

  return (
    <group ref={stageRootRef} name="kg_game_fps_mission" scale={coordinateScale} userData={{ coordinateScale, presentation }}>
      {presentation === 'arena' ? <GameFpsArenaEnvironment /> : null}
      {GAME_FPS_NPC_SEEDS.map(npc => (
        <mesh
          key={npc.id}
          name={`kg_game_fps_npc_${npc.id}`}
          ref={mesh => {
            if (mesh) npcMeshRefs.current.set(npc.id, mesh)
            else npcMeshRefs.current.delete(npc.id)
          }}
          position={[npc.x, 0.9, npc.z]}
          castShadow
        >
          <capsuleGeometry args={[0.45, 0.9, 4, 8]} />
          <meshStandardMaterial color="#60a5fa" roughness={0.55} />
        </mesh>
      ))}
    </group>
  )
}
