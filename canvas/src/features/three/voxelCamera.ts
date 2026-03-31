import type { GraphSchema } from '@/lib/graph/schema'
import type { Vec3 } from './layout'

export type VoxelCameraPose = {
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
}

export type VoxelCameraConfig = {
  introEnabled: boolean
  introDelayMs: number
  introDurationMs: number
  yawDeg: number
  tiltDeg: number
  distanceFactor: number
  targetLift: number
}

const clamp = (v: number, min: number, max: number): number => {
  if (v < min) return min
  if (v > max) return max
  return v
}

export const readVoxelCameraConfig = (schema: GraphSchema): VoxelCameraConfig => {
  const three = schema.three || {}
  const introEnabled = three.voxelAnimationEnabled !== false
  const introDelayMs = typeof three.voxelIntroDelayMs === 'number' && Number.isFinite(three.voxelIntroDelayMs)
    ? clamp(Math.floor(three.voxelIntroDelayMs), 0, 8000)
    : 320
  const introDurationMs = typeof three.voxelIntroDurationMs === 'number' && Number.isFinite(three.voxelIntroDurationMs)
    ? clamp(Math.floor(three.voxelIntroDurationMs), 80, 8000)
    : 1100
  const yawDeg = typeof three.voxelDefaultYawDeg === 'number' && Number.isFinite(three.voxelDefaultYawDeg)
    ? clamp(three.voxelDefaultYawDeg, -180, 180)
    : -36
  const tiltDeg = typeof three.voxelDefaultTiltDeg === 'number' && Number.isFinite(three.voxelDefaultTiltDeg)
    ? clamp(three.voxelDefaultTiltDeg, 5, 80)
    : 32
  const distanceFactor = typeof three.voxelDefaultDistanceFactor === 'number' && Number.isFinite(three.voxelDefaultDistanceFactor)
    ? clamp(three.voxelDefaultDistanceFactor, 0.8, 6)
    : 2.2
  const targetLift = typeof three.voxelDefaultTargetLift === 'number' && Number.isFinite(three.voxelDefaultTargetLift)
    ? clamp(three.voxelDefaultTargetLift, -200, 200)
    : 8
  return { introEnabled, introDelayMs, introDurationMs, yawDeg, tiltDeg, distanceFactor, targetLift }
}

export const buildVoxelCameraIntroPoses = (
  positions: Record<string, Vec3>,
  cfg: VoxelCameraConfig,
): { start: VoxelCameraPose; end: VoxelCameraPose } | null => {
  const vals = Object.values(positions || {})
  if (!vals.length) return null
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  let count = 0
  for (let i = 0; i < vals.length; i += 1) {
    const p = vals[i]
    if (!p) continue
    const x = Number(p[0])
    const y = Number(p[1])
    const z = Number(p[2])
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (z < minZ) minZ = z
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
    if (z > maxZ) maxZ = z
    count += 1
  }
  if (count < 1 || !Number.isFinite(minX)) return null
  const cx = (minX + maxX) * 0.5
  const cy = (minY + maxY) * 0.5
  const cz = (minZ + maxZ) * 0.5
  const halfSpan = Math.max(12, (maxX - minX) * 0.5, (maxY - minY) * 0.5)
  const distance = Math.max(30, halfSpan * cfg.distanceFactor)
  const yaw = (cfg.yawDeg * Math.PI) / 180
  const tilt = (cfg.tiltDeg * Math.PI) / 180
  const planar = Math.max(0.0001, Math.cos(tilt)) * distance
  const elev = Math.sin(tilt) * distance
  const target = { x: cx, y: cy, z: cz + cfg.targetLift }
  const end: VoxelCameraPose = {
    target,
    position: {
      x: target.x + Math.cos(yaw) * planar,
      y: target.y + Math.sin(yaw) * planar,
      z: target.z + elev,
    },
  }
  const startTilt = clamp(cfg.tiltDeg - 8, 5, 80) * (Math.PI / 180)
  const startDistance = distance * 1.18
  const startPlanar = Math.max(0.0001, Math.cos(startTilt)) * startDistance
  const startElev = Math.sin(startTilt) * startDistance
  const startTarget = { x: target.x, y: target.y, z: target.z - Math.max(2, halfSpan * 0.16) }
  const start: VoxelCameraPose = {
    target: startTarget,
    position: {
      x: startTarget.x + Math.cos(yaw) * startPlanar,
      y: startTarget.y + Math.sin(yaw) * startPlanar,
      z: startTarget.z + startElev,
    },
  }
  return { start, end }
}
