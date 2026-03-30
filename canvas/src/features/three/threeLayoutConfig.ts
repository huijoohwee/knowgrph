import type { GraphSchema } from '@/lib/graph/schema'
import { getThreeConfig } from '@/lib/graph/schema'
import { clampSnapGridSize } from '@/lib/canvas/gridSnap'

export const DEFAULT_THREE_SPHERE_LAYER_SPACING = 20
export const DEFAULT_VOXEL_BASE_SPACING = 28

export const computeAutoSphereRadius = (nodeCount: number): number => {
  const n = Number.isFinite(nodeCount) ? Math.max(1, Math.floor(nodeCount)) : 1
  return Math.max(60, Math.min(140, n * 2.2))
}

export const resolveSphereRadius = (schema: GraphSchema | null, nodeCount: number): number => {
  const cfg = getThreeConfig(schema || undefined)
  const r = typeof cfg.sphereRadius === 'number' ? cfg.sphereRadius : NaN
  return Number.isFinite(r) && r > 0 ? r : computeAutoSphereRadius(nodeCount)
}

export const resolveThreeSeed = (schema: GraphSchema | null): number | undefined => {
  const cfg = getThreeConfig(schema || undefined)
  const seed = typeof cfg.seed === 'number' ? cfg.seed : undefined
  return typeof seed === 'number' && Number.isFinite(seed) ? seed : undefined
}

export const resolveMinSpacing = (schema: GraphSchema | null): number | undefined => {
  const cfg = getThreeConfig(schema || undefined)
  const ms = typeof cfg.minSpacing === 'number' ? cfg.minSpacing : undefined
  return typeof ms === 'number' && Number.isFinite(ms) && ms > 0 ? ms : undefined
}

export const resolveVoxelSeedScaleFactor = (schema: GraphSchema | null): number => {
  const cfg = getThreeConfig(schema || undefined)
  const v = typeof cfg.voxelSeedScaleFactor === 'number' ? cfg.voxelSeedScaleFactor : 1
  if (!Number.isFinite(v)) return 1
  return clamp(v, 0.3, 3)
}

export const resolveVoxelGridScaleFactor = (schema: GraphSchema | null): number => {
  const cfg = getThreeConfig(schema || undefined)
  const v = typeof cfg.voxelGridScaleFactor === 'number' ? cfg.voxelGridScaleFactor : 1
  if (!Number.isFinite(v)) return 1
  return clamp(v, 0.3, 3)
}

export const resolveVoxelGridStep = (schema: GraphSchema | null): number => {
  const voxelGridScale = resolveVoxelGridScaleFactor(schema)
  const snapSizeRaw = (schema?.behavior as unknown as { snapGrid?: unknown } | null)?.snapGrid as { size?: unknown } | null
  const snapSize = clampSnapGridSize(snapSizeRaw?.size)
  const base = Number.isFinite(snapSize) ? snapSize : DEFAULT_VOXEL_BASE_SPACING
  return clampSnapGridSize(Math.round(base * voxelGridScale))
}

export const resolveVoxelSeedGridStep = (schema: GraphSchema | null): number => {
  const voxelSeedScale = resolveVoxelSeedScaleFactor(schema)
  const grid = resolveVoxelGridStep(schema)
  return Math.max(16, Math.round(grid * 1.2 * voxelSeedScale))
}

export const quantizeVoxelCoordToGridLine = (value: number, gridStep: number): number => {
  const g = Math.max(1e-6, gridStep)
  return Math.round(value / g) * g
}

export const resolveSphereLayerSpacing = (_schema: GraphSchema | null): number => {
  return DEFAULT_THREE_SPHERE_LAYER_SPACING
}

const clamp = (value: number, min: number, max: number): number => {
  if (value < min) return min
  if (value > max) return max
  return value
}

export const resolveSphereEllipsoidAxes = (schema: GraphSchema | null): { x: number; y: number; z: number } => {
  const cfg = getThreeConfig(schema || undefined)
  const x = typeof cfg.globeSphereEllipsoidX === 'number' && Number.isFinite(cfg.globeSphereEllipsoidX) ? cfg.globeSphereEllipsoidX : 1
  const y = typeof cfg.globeSphereEllipsoidY === 'number' && Number.isFinite(cfg.globeSphereEllipsoidY) ? cfg.globeSphereEllipsoidY : 1
  const z = typeof cfg.globeSphereEllipsoidZ === 'number' && Number.isFinite(cfg.globeSphereEllipsoidZ) ? cfg.globeSphereEllipsoidZ : 1
  return {
    x: clamp(x, 0.5, 1.8),
    y: clamp(y, 0.5, 1.8),
    z: clamp(z, 0.5, 1.8),
  }
}
