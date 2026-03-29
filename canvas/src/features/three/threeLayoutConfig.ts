import type { GraphSchema } from '@/lib/graph/schema'
import { getThreeConfig } from '@/lib/graph/schema'

export const DEFAULT_THREE_SPHERE_LAYER_SPACING = 20

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
