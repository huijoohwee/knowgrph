import React from 'react'
import { useFrame } from '@react-three/fiber'
import type { PerspectiveCamera } from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  bindThreeViewportControlsOwnership,
  createThreeObjectCameraPoseLock,
  readThreeObjectInputOwnership,
} from './threeObjectInputOwnership'

export function useThreeObjectCameraInputOwnership(args: {
  camera: PerspectiveCamera
  controls: OrbitControls
  baseEnabled: boolean
}): void {
  const poseLock = React.useMemo(() => createThreeObjectCameraPoseLock({
    capture: () => ({
      position: args.camera.position.clone(),
      quaternion: args.camera.quaternion.clone(),
      up: args.camera.up.clone(),
      target: args.controls.target.clone(),
      fov: args.camera.fov,
      zoom: args.camera.zoom,
    }),
    restore: pose => {
      args.camera.position.copy(pose.position)
      args.camera.quaternion.copy(pose.quaternion)
      args.camera.up.copy(pose.up)
      args.controls.target.copy(pose.target)
      args.camera.fov = pose.fov
      args.camera.zoom = pose.zoom
      args.camera.updateProjectionMatrix()
      args.camera.updateMatrixWorld()
    },
  }), [args.camera, args.controls])

  useFrame(() => {
    if (!readThreeObjectInputOwnership().active) return
    args.controls.autoRotate = false
    poseLock.enforce()
  })

  React.useLayoutEffect(() => bindThreeViewportControlsOwnership({
    controls: args.controls,
    baseEnabled: args.baseEnabled,
    onActiveChange: active => {
      if (active) poseLock.start()
      else poseLock.finish()
    },
  }), [args.baseEnabled, args.controls, poseLock])
}
