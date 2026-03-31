import { buildVoxelCameraIntroPoses, readVoxelCameraConfig } from '@/features/three/voxelCamera'
import { defaultSchema } from '@/lib/graph/schema'

export const testVoxelCameraDefaultsAreStable = () => {
  const cfg = readVoxelCameraConfig(defaultSchema)
  if (cfg.introEnabled !== true) throw new Error('voxel intro should default enabled')
  if (cfg.introDelayMs !== 320) throw new Error(`unexpected voxel intro delay default: ${cfg.introDelayMs}`)
  if (cfg.introDurationMs !== 1100) throw new Error(`unexpected voxel intro duration default: ${cfg.introDurationMs}`)
}

export const testVoxelCameraBuildsValidIntroPoses = () => {
  const cfg = readVoxelCameraConfig(defaultSchema)
  const poses = buildVoxelCameraIntroPoses(
    {
      a: [-80, 0, 0],
      b: [0, 0, 84],
      c: [80, 0, 168],
    },
    cfg,
  )
  if (!poses) throw new Error('expected intro poses')
  const dz = poses.end.position.z - poses.end.target.z
  if (!(dz > 0)) throw new Error('camera should sit above target in voxel z-up mode')
  const startDistance = Math.hypot(
    poses.start.position.x - poses.start.target.x,
    poses.start.position.y - poses.start.target.y,
    poses.start.position.z - poses.start.target.z,
  )
  const endDistance = Math.hypot(
    poses.end.position.x - poses.end.target.x,
    poses.end.position.y - poses.end.target.y,
    poses.end.position.z - poses.end.target.z,
  )
  if (!(startDistance > endDistance)) {
    throw new Error(`intro should move from farther to closer pose: start=${startDistance}, end=${endDistance}`)
  }
}
