import React from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Mesh } from 'three'
import {
  createXrNativeControllerInput,
  mergeXrNativeControllerInputs,
  readXrNativeControllerGamepadInput,
  readXrNativeControllerKeyboardInput,
  shouldConsumeXrNativeControllerKeyUp,
  xrNativeControllerInputCode,
} from './xrNativeControllerInput'
import {
  exitXrNativeControllerDemo,
  readSharedXrNativeControllerDemoFrame,
  readXrNativeControllerDemo,
  setSharedXrNativeControllerDemoInput,
  stepSharedXrNativeControllerDemo,
  subscribeXrNativeControllerDemo,
} from './xrNativeControllerDemoRuntime'

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null
  if (!element) return false
  const tagName = element.tagName.toLowerCase()
  return element.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select'
}

function BallVisual({ rootRef }: { rootRef: React.RefObject<Group | null> }) {
  return (
    <group ref={rootRef} name="kg_xr_native_ball_visual">
      <mesh position={[0, 0.5, 0]} castShadow>
        <sphereGeometry args={[0.5, 32, 20]} />
        <meshStandardMaterial color="#22d3ee" roughness={0.42} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.405, 0.045, 10, 40]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.405, 0.035, 10, 40]} />
        <meshStandardMaterial color="#0f172a" roughness={0.72} />
      </mesh>
    </group>
  )
}

function RocketVisual({
  flameRef,
  rootRef,
}: {
  flameRef: React.RefObject<Mesh | null>
  rootRef: React.RefObject<Group | null>
}) {
  return (
    <group ref={rootRef} name="kg_xr_native_rocket_visual">
      <mesh position={[0, 0.72, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.46, 1.22, 18]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.35} metalness={0.32} />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <coneGeometry args={[0.32, 0.65, 18]} />
        <meshStandardMaterial color="#f43f5e" roughness={0.5} metalness={0.12} />
      </mesh>
      {[-1, 1].map(side => (
        <mesh key={`x:${side}`} position={[side * 0.46, 0.42, 0]} rotation={[0, 0, side * -0.24]}>
          <boxGeometry args={[0.3, 0.55, 0.1]} />
          <meshStandardMaterial color="#fb7185" roughness={0.52} />
        </mesh>
      ))}
      {[-1, 1].map(side => (
        <mesh key={`z:${side}`} position={[0, 0.42, side * 0.46]} rotation={[side * 0.24, 0, 0]}>
          <boxGeometry args={[0.1, 0.55, 0.3]} />
          <meshStandardMaterial color="#fb7185" roughness={0.52} />
        </mesh>
      ))}
      <mesh ref={flameRef} position={[0, -0.18, 0]} visible={false}>
        <coneGeometry args={[0.26, 0.75, 14]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.88} />
      </mesh>
    </group>
  )
}

function Arena() {
  const wallMaterial = () => <meshStandardMaterial color="#0f766e" transparent opacity={0.3} roughness={0.86} />
  return (
    <group name="kg_xr_native_controller_arena">
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow>
        <planeGeometry args={[15.5, 15.5, 1, 1]} />
        <meshStandardMaterial color="#082f49" transparent opacity={0.42} roughness={1} />
      </mesh>
      <gridHelper args={[15, 15, '#22d3ee', '#155e75']} position={[0, 0.02, 0]} />
      <mesh position={[-7.75, 1.5, 0]}><boxGeometry args={[0.5, 3, 16]} />{wallMaterial()}</mesh>
      <mesh position={[7.75, 1.5, 0]}><boxGeometry args={[0.5, 3, 16]} />{wallMaterial()}</mesh>
      <mesh position={[0, 1.5, -7.75]}><boxGeometry args={[16, 3, 0.5]} />{wallMaterial()}</mesh>
      <mesh position={[0, 1.5, 7.75]}><boxGeometry args={[16, 3, 0.5]} />{wallMaterial()}</mesh>
      <mesh position={[3.9, 0.45, -4.3]} castShadow receiveShadow>
        <boxGeometry args={[3.6, 0.9, 3]} />
        <meshStandardMaterial color="#164e63" roughness={0.76} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0.035, -3.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 1.05, 32]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.72} />
      </mesh>
    </group>
  )
}

export function XrNativeControllerDemoStage({
  stageScale,
  groundY,
}: {
  stageScale: number
  groundY: number
}) {
  const runtime = React.useSyncExternalStore(
    subscribeXrNativeControllerDemo,
    readXrNativeControllerDemo,
    readXrNativeControllerDemo,
  )
  const pressedCodesRef = React.useRef(new Set<string>())
  const playerRootRef = React.useRef<Group | null>(null)
  const ballRootRef = React.useRef<Group | null>(null)
  const rocketRootRef = React.useRef<Group | null>(null)
  const flameRef = React.useRef<Mesh | null>(null)
  const crateARef = React.useRef<Mesh | null>(null)
  const crateBRef = React.useRef<Mesh | null>(null)

  React.useEffect(() => {
    const clearInput = () => {
      pressedCodesRef.current.clear()
      setSharedXrNativeControllerDemoInput(createXrNativeControllerInput())
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (runtime.phase === 'off' || isEditableTarget(event.target) || !xrNativeControllerInputCode(event.code)) return
      pressedCodesRef.current.add(event.code)
      event.preventDefault()
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (!xrNativeControllerInputCode(event.code)) return
      const wasCaptured = pressedCodesRef.current.delete(event.code)
      if (shouldConsumeXrNativeControllerKeyUp({
        active: runtime.phase !== 'off',
        code: event.code,
        editableTarget: isEditableTarget(event.target),
        wasCaptured,
      })) event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', clearInput)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', clearInput)
      clearInput()
    }
  }, [runtime.phase])

  React.useEffect(() => () => {
    exitXrNativeControllerDemo()
  }, [])

  useFrame((_state, deltaSeconds) => {
    const keyboard = readXrNativeControllerKeyboardInput(pressedCodesRef.current)
    const pads = typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function'
      ? Array.from(navigator.getGamepads()).filter(Boolean)
      : []
    const gamepad = readXrNativeControllerGamepadInput(pads[0])
    setSharedXrNativeControllerDemoInput(mergeXrNativeControllerInputs(keyboard, gamepad))
    stepSharedXrNativeControllerDemo(deltaSeconds)
    const frame = readSharedXrNativeControllerDemoFrame()
    const root = playerRootRef.current
    if (root) {
      root.position.set(...frame.player.position)
      root.visible = frame.phase !== 'off'
    }
    if (ballRootRef.current) {
      ballRootRef.current.visible = frame.mode === 'ball'
      ballRootRef.current.rotation.set(...frame.ballRotation)
    }
    if (rocketRootRef.current) {
      rocketRootRef.current.visible = frame.mode === 'rocket'
      rocketRootRef.current.rotation.set(...frame.rocketRotation)
    }
    if (flameRef.current) {
      flameRef.current.visible = frame.rocketThrusting
      const pulse = 0.86 + Math.sin(frame.elapsedSeconds * 34) * 0.14
      flameRef.current.scale.set(1, pulse, 1)
    }
    const crateA = frame.bodies.find(body => body.subjectId === 'native-crate-a')
    const crateB = frame.bodies.find(body => body.subjectId === 'native-crate-b')
    if (crateA && crateARef.current) crateARef.current.position.set(crateA.position[0], crateA.position[1] + 0.55, crateA.position[2])
    if (crateB && crateBRef.current) crateBRef.current.position.set(crateB.position[0], crateB.position[1] + 0.4, crateB.position[2])
  })

  return (
    <group
      name="kg_xr_native_controller_demo"
      position={[0, groundY, 0]}
      scale={stageScale}
      visible={runtime.phase !== 'off'}
      userData={{
        schema: runtime.schema,
        phase: runtime.phase,
        mode: runtime.mode,
        input: 'keyboard-gamepad',
        followCamera: runtime.followCamera,
      }}
    >
      <Arena />
      <group ref={playerRootRef} name="kg_xr_native_controller_player">
        <BallVisual rootRef={ballRootRef} />
        <RocketVisual rootRef={rocketRootRef} flameRef={flameRef} />
      </group>
      <mesh ref={crateARef} castShadow receiveShadow name="kg_xr_native_dynamic_crate_a">
        <boxGeometry args={[1.1, 1.1, 1.1]} />
        <meshStandardMaterial color="#f97316" roughness={0.78} />
      </mesh>
      <mesh ref={crateBRef} castShadow receiveShadow name="kg_xr_native_dynamic_crate_b">
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <meshStandardMaterial color="#a78bfa" roughness={0.68} />
      </mesh>
    </group>
  )
}
