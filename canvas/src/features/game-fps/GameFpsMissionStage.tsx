import React from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, type Mesh, type MeshStandardMaterial } from 'three'
import {
  advanceGameFpsBy,
  readGameFpsSnapshot,
  subscribeGameFpsSnapshot,
} from './gameFpsRuntime'
import { GAME_FPS_MAP, GAME_FPS_NPC_SEEDS } from './gameFpsModel'
import { installGameFpsDesktopInput } from './gameFpsInput'
import {
  claimThreeViewportInputOwnership,
  releaseThreeViewportInputOwnership,
} from '@/features/three/threeViewportInputOwnership'

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

export function GameFpsMissionStage() {
  const { camera, gl } = useThree()
  const snapshotRef = React.useRef(readGameFpsSnapshot())
  const npcMeshRefs = React.useRef(new Map<string, Mesh>())
  const firstFramePublishedRef = React.useRef(false)

  React.useEffect(() => subscribeGameFpsSnapshot(() => {
    snapshotRef.current = readGameFpsSnapshot()
  }), [])

  React.useEffect(() => {
    const canvas = gl.domElement
    const claimed = claimThreeViewportInputOwnership(INPUT_OWNER_ID)
    canvas.dataset.kgGameFpsInputOwner = claimed ? INPUT_OWNER_ID : 'blocked'
    const input = claimed ? installGameFpsDesktopInput(canvas) : null
    return () => {
      input?.dispose()
      releaseThreeViewportInputOwnership(INPUT_OWNER_ID)
      delete canvas.dataset.kgGameFpsInputOwner
      delete canvas.dataset.kgGameFpsFirstFrame
    }
  }, [gl])

  useFrame((_, deltaSeconds) => {
    const before = snapshotRef.current
    if (before.phase === 'playing') void advanceGameFpsBy(deltaSeconds)
    const snapshot = readGameFpsSnapshot()
    snapshotRef.current = snapshot

    camera.position.set(snapshot.player.x, 1.65, snapshot.player.z)
    camera.rotation.order = 'YXZ'
    camera.rotation.set(snapshot.player.pitch, snapshot.player.yaw, 0, 'YXZ')
    camera.updateMatrixWorld()

    for (const npc of snapshot.npcs) {
      const mesh = npcMeshRefs.current.get(npc.id)
      if (!mesh) continue
      mesh.position.set(npc.x, 0.9, npc.z)
      mesh.visible = npc.health > 0
      mesh.scale.y = Math.max(0.12, npc.health / 100)
      setMeshColor(mesh, ACTION_COLORS[npc.action])
    }
    if (!firstFramePublishedRef.current && snapshot.phase !== 'stopped') {
      firstFramePublishedRef.current = true
      gl.domElement.dataset.kgGameFpsFirstFrame = '1'
    }
  })

  return (
    <group name="kg_game_fps_mission">
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
        <mesh
          key={blocker.id}
          position={[blocker.centerX, blocker.height / 2, blocker.centerZ]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[blocker.halfWidth * 2, blocker.height, blocker.halfDepth * 2]} />
          <meshStandardMaterial color="#64748b" roughness={0.82} />
        </mesh>
      ))}

      {GAME_FPS_NPC_SEEDS.map(npc => (
        <mesh
          key={npc.id}
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

      <gridHelper args={[GAME_FPS_MAP.halfWidth * 2, 18, '#4b8074', '#29473f']} position={[0, 0.01, 0]} />
    </group>
  )
}
