import React from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3, type PerspectiveCamera, type WebGLRenderer } from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { flightSimForwardVector } from '@/features/game-flight-sim/flightModel'
import { readFlightSimSnapshot } from '@/features/game-flight-sim/flightSimRuntime'
import { readXrNativeControllerCamera } from './xrNativeControllerCameraRuntime'
import { useXrNativeControllerDemoCamera } from './useXrNativeControllerDemoCamera'

type ControlsCapabilities = Readonly<{
  enablePan: boolean
  enableRotate: boolean
  enableZoom: boolean
}>

function useFlightAircraftFollowCamera({
  active,
  camera,
  controls,
  coordinateScale,
  renderer,
}: {
  active: boolean
  camera: PerspectiveCamera
  controls: OrbitControls
  coordinateScale: number
  renderer: WebGLRenderer
}) {
  const followingRef = React.useRef(false)
  const controlsCapabilitiesRef = React.useRef<ControlsCapabilities | null>(null)
  const previousFovRef = React.useRef<number | null>(null)
  const targetRef = React.useRef(new Vector3())
  const desiredCameraRef = React.useRef(new Vector3())
  const previousRunIdRef = React.useRef(-1)

  const releaseFollowCamera = React.useCallback(() => {
    if (previousFovRef.current !== null) {
      camera.fov = previousFovRef.current
      camera.updateProjectionMatrix()
      previousFovRef.current = null
    }
    if (controlsCapabilitiesRef.current) {
      Object.assign(controls, controlsCapabilitiesRef.current)
      controlsCapabilitiesRef.current = null
    }
    followingRef.current = false
    previousRunIdRef.current = -1
  }, [camera, controls])

  React.useEffect(() => releaseFollowCamera, [releaseFollowCamera])

  useFrame((_state, deltaSecondsValue) => {
    const flight = readFlightSimSnapshot()
    const fixedFollow = readXrNativeControllerCamera().mode === 'fixed-follow'
    if (active && !fixedFollow && document.pointerLockElement === renderer.domElement) {
      void document.exitPointerLock()
    }
    const followsAircraft = active
      && flight.active
      && flight.webglSupported
      && !flight.runtimeError
      && !renderer.xr.isPresenting
      && fixedFollow
    if (!followsAircraft) {
      if (followingRef.current) releaseFollowCamera()
      return
    }

    if (!controlsCapabilitiesRef.current) {
      controlsCapabilitiesRef.current = {
        enablePan: controls.enablePan,
        enableRotate: controls.enableRotate,
        enableZoom: controls.enableZoom,
      }
    }
    controls.enablePan = false
    controls.enableRotate = false
    controls.enableZoom = false
    if (previousFovRef.current === null) previousFovRef.current = camera.fov

    const scale = Number.isFinite(coordinateScale) && coordinateScale > 0
      ? coordinateScale
      : 1
    const forward = flightSimForwardVector(flight.aircraft.pitch, flight.aircraft.yaw)
    const target = targetRef.current.set(
      flight.aircraft.position[0] * scale,
      (flight.aircraft.position[1] + 0.8) * scale,
      flight.aircraft.position[2] * scale,
    )
    const desiredCamera = desiredCameraRef.current.set(
      target.x - forward[0] * 8 * scale,
      target.y - forward[1] * 2 * scale + 3.2 * scale,
      target.z - forward[2] * 8 * scale,
    )
    const resetDetected = flight.runId !== previousRunIdRef.current || !followingRef.current
    previousRunIdRef.current = flight.runId
    if (resetDetected) {
      controls.target.copy(target)
      camera.position.copy(desiredCamera)
    } else {
      const deltaSeconds = Number.isFinite(deltaSecondsValue)
        ? Math.max(0, Math.min(0.1, deltaSecondsValue))
        : 0
      controls.target.lerp(target, 1 - Math.exp(-8 * deltaSeconds))
      camera.position.lerp(desiredCamera, 1 - Math.exp(-5.5 * deltaSeconds))
    }
    if (Math.abs(camera.fov - 58) > 0.01) {
      camera.fov += (58 - camera.fov) * 0.12
      camera.updateProjectionMatrix()
    }
    camera.lookAt(controls.target)
    controls.update()
    followingRef.current = true
  })
}

export function useXrGameplayCameraArbitration({
  camera,
  controls,
  coordinateScale,
  flightSimActive,
  renderer,
  suspended,
}: {
  camera: PerspectiveCamera
  controls: OrbitControls
  coordinateScale: number
  flightSimActive: boolean
  renderer: WebGLRenderer
  suspended: boolean
}) {
  const flightCameraActive = flightSimActive && !suspended
  useXrNativeControllerDemoCamera({
    camera,
    controls,
    suspended: flightCameraActive || suspended,
  })
  useFlightAircraftFollowCamera({
    active: flightCameraActive,
    camera,
    controls,
    coordinateScale,
    renderer,
  })
}
