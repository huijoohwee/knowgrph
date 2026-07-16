import type { Canvas3dModeId } from '@/lib/config'

export type CameraControlsOrbitProfile = Readonly<{
  rotateFactor: number
  zoomFactor: number
  minPolar: number
  maxPolar: number
  minDistance: number
  maxDistance: number
  topBiased: boolean
}>

const VOXEL_ORBIT_PROFILE: CameraControlsOrbitProfile = Object.freeze({
  rotateFactor: 0.68,
  zoomFactor: 0.52,
  minPolar: 0.12,
  maxPolar: Math.PI * 0.46,
  minDistance: 16,
  maxDistance: 1200,
  topBiased: true,
})

const MODEL_ASSET_ORBIT_PROFILE: CameraControlsOrbitProfile = Object.freeze({
  rotateFactor: 1,
  zoomFactor: 1,
  minPolar: 0.03,
  maxPolar: Math.PI - 0.03,
  minDistance: 0.05,
  maxDistance: Infinity,
  topBiased: false,
})

const SHARED_CAMERA_FRAMING_ORBIT_PROFILE: CameraControlsOrbitProfile = Object.freeze({
  ...MODEL_ASSET_ORBIT_PROFILE,
  minPolar: 0,
  maxPolar: Math.PI,
})

export function resolveCameraControlsOrbitProfile({
  mode,
  modelAssetMode,
}: {
  mode: Canvas3dModeId
  modelAssetMode: boolean
}): CameraControlsOrbitProfile {
  if (mode === 'voxel') return VOXEL_ORBIT_PROFILE
  if (mode === '3d' || mode === 'xr') return SHARED_CAMERA_FRAMING_ORBIT_PROFILE
  return MODEL_ASSET_ORBIT_PROFILE
}
