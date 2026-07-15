import type { GlbFit } from '@/lib/three/GlbAssetModel'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as THREE from 'three'

export type ImageToGlbPreviewCameraPlacement = {
  boundingRadius: number
  distance: number
  far: number
  fov: number
  maxDistance: number
  minDistance: number
  near: number
  position: [number, number, number]
  target: [number, number, number]
}

const degreesToRadians = (value: number) => value * Math.PI / 180

export function computeImageToGlbPreviewCamera(
  fit: GlbFit | null,
  viewportAspect: number,
): ImageToGlbPreviewCameraPlacement {
  const fov = 32
  const yaw = degreesToRadians(32)
  const elevation = degreesToRadians(20)
  const cosYaw = Math.cos(yaw)
  const sinYaw = Math.sin(yaw)
  const cosElevation = Math.cos(elevation)
  const sinElevation = Math.sin(elevation)
  const direction = [
    sinYaw * cosElevation,
    sinElevation,
    cosYaw * cosElevation,
  ] as const
  const size = fit?.scaledSize || [118, 84, 92]
  const half = size.map(value => Math.max(0.5, Math.abs(value) / 2)) as [number, number, number]
  const right = [cosYaw, 0, -sinYaw] as const
  const up = [-sinYaw * sinElevation, cosElevation, -cosYaw * sinElevation] as const
  const projectedHalfWidth = Math.abs(right[0]) * half[0] + Math.abs(right[2]) * half[2]
  const projectedHalfHeight = Math.abs(up[0]) * half[0] + Math.abs(up[1]) * half[1] + Math.abs(up[2]) * half[2]
  const depthHalf = Math.abs(direction[0]) * half[0] + Math.abs(direction[1]) * half[1] + Math.abs(direction[2]) * half[2]
  const boundingRadius = Math.hypot(...half)
  const verticalHalfFov = degreesToRadians(fov / 2)
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * Math.max(0.35, viewportAspect))
  const occupancy = 0.88
  const distance = Math.max(
    projectedHalfHeight / (Math.tan(verticalHalfFov) * occupancy),
    projectedHalfWidth / (Math.tan(horizontalHalfFov) * occupancy),
  ) + depthHalf
  const minDistance = Math.max(1, boundingRadius * 0.62)
  const maxDistance = Math.max(distance * 4, boundingRadius * 6)
  return {
    boundingRadius,
    distance,
    far: Math.max(1000, maxDistance + boundingRadius * 4),
    fov,
    maxDistance,
    minDistance,
    near: Math.max(0.05, boundingRadius / 240),
    position: direction.map(value => value * distance) as [number, number, number],
    target: [0, 0, 0],
  }
}

export function applyImageToGlbPreviewCameraPlacement(args: {
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  placement: ImageToGlbPreviewCameraPlacement
}): void {
  const { camera, controls, placement } = args
  const controlsEnabled = controls.enabled
  const dampingEnabled = controls.enableDamping

  controls.enabled = false
  controls.enableDamping = false
  controls.update()
  camera.fov = placement.fov
  camera.near = placement.near
  camera.far = placement.far
  camera.zoom = 1
  camera.position.set(...placement.position)
  camera.up.set(0, 1, 0)
  controls.target.set(...placement.target)
  controls.minDistance = placement.minDistance
  controls.maxDistance = placement.maxDistance
  camera.updateProjectionMatrix()
  controls.update()
  controls.saveState()
  controls.enableDamping = dampingEnabled
  controls.enabled = controlsEnabled
}
