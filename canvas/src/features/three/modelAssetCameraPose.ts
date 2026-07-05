import type { GlbFit } from '@/lib/three/GlbAssetModel'

export type ModelAssetCameraFit = Pick<
  GlbFit,
  'cameraProfile' | 'cameraTarget' | 'floorY' | 'preserveFlatFacing' | 'flatAxis' | 'stageSpan' | 'scaledSize'
>

export type ModelAssetCameraPose = {
  position: [number, number, number]
  target: [number, number, number]
  up: [number, number, number]
  near: number
  far: number
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

function readCameraTarget(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length < 3) return null
  const x = Number(value[0])
  const y = Number(value[1])
  const z = Number(value[2])
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null
  return [x, y, z]
}

export function readModelAssetCameraPose(fit?: ModelAssetCameraFit | null): ModelAssetCameraPose {
  const scaledSize = Array.isArray(fit?.scaledSize) ? fit.scaledSize : [0, 0, 0]
  const maxScaledDim = Math.max(
    Math.abs(Number(scaledSize[0] || 0)),
    Math.abs(Number(scaledSize[1] || 0)),
    Math.abs(Number(scaledSize[2] || 0)),
    Math.abs(Number(fit?.stageSpan || 0)) * 0.36,
    92,
  )
  const span = clamp(maxScaledDim, 32, 900)
  const near = Math.max(0.01, span / 5000)
  const far = Math.max(5000, span * 50)
  const lateralSpan = Math.max(Math.abs(Number(scaledSize[0] || 0)), Math.abs(Number(scaledSize[2] || 0)))
  const verticalSpan = Math.abs(Number(scaledSize[1] || 0))
  if (fit?.cameraProfile === 'spatial-capture') {
    const cameraTarget = readCameraTarget(fit.cameraTarget)
    const floorY = Number.isFinite(Number(fit.floorY)) ? Number(fit.floorY) : -span * 0.24
    const eyeY = clamp(floorY + verticalSpan * 0.58, -span * 0.18, span * 0.22)
    const targetX = cameraTarget ? cameraTarget[0] : 0
    const targetY = cameraTarget ? cameraTarget[1] : clamp(eyeY + verticalSpan * 0.02, -span * 0.12, span * 0.2)
    const targetZ = cameraTarget ? cameraTarget[2] : 0
    return {
      position: [
        targetX + span * 2.2,
        eyeY + span * 0.9,
        targetZ + span * 2.65,
      ],
      target: [
        targetX,
        targetY,
        targetZ,
      ],
      up: [0, 1, 0],
      near,
      far,
    }
  }
  if (fit?.preserveFlatFacing) {
    if (fit.flatAxis === 'y') {
      return {
        position: [0, span * 2.65, span * 0.02],
        target: [0, 0, 0],
        up: [0, 0, -1],
        near,
        far,
      }
    }
    if (fit.flatAxis === 'x') {
      return {
        position: [span * 2.8, 0, 0],
        target: [0, 0, 0],
        up: [0, 1, 0],
        near,
        far,
      }
    }
    return {
      position: [0, 0, span * 2.8],
      target: [0, 0, 0],
      up: [0, 1, 0],
      near,
      far,
    }
  }
  if (lateralSpan > 0 && verticalSpan <= lateralSpan * 0.22) {
    return {
      position: [0, span * 2.65, span * 0.02],
      target: [0, clamp(verticalSpan * 0.12, 0, span * 0.08), 0],
      up: [0, 0, -1],
      near,
      far,
    }
  }
  return {
    position: [span * 1.56, Math.max(72, span * 1.08), span * 2.05],
    target: [0, clamp(Math.abs(Number(scaledSize[1] || 0)) * 0.18, 0, span * 0.1), 0],
    up: [0, 1, 0],
    near,
    far,
  }
}
