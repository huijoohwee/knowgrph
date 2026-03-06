
import { type Vec3 } from './layout'

const HASH_PRIME = 16777619
const HASH_OFFSET = 2166136261

// FNV-1a hash
function fnv1a(str: string): number {
  let hash = HASH_OFFSET
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, HASH_PRIME)
  }
  return hash >>> 0
}

// Deterministic 0-1 float from string
function hash01(str: string): number {
  return fnv1a(str) / 4294967296
}

export type NodeMotionState = {
  intensity: number
  draggedNodeId?: string | null
}

export function computeNodeMotion(
  nodeId: string,
  basePos: Vec3,
  radius: number,
  state: NodeMotionState,
  time: number
): Vec3 {
  const { intensity, draggedNodeId } = state
  if (intensity < 1e-4) return basePos
  
  // If this specific node is being dragged, return base pos (no wobble)
  if (draggedNodeId === nodeId) return basePos

  const seed = hash01(nodeId) * Math.PI * 2
  
  // Per-axis phase seeds
  const seedX = hash01(`${nodeId}:fx`)
  const seedY = hash01(`${nodeId}:fy`)
  const seedZ = hash01(`${nodeId}:fz`)

  // Scale wobble amplitude by node size so big nodes wobble more visibly but proportionally
  // Clamp amplitude to avoid excessive movement
  const amp = Math.max(0.3, Math.min(6, radius * 0.08)) * intensity

  const ox = Math.sin(time * (0.65 + seedX * 0.7) + seed) * amp
  const oy = Math.cos(time * (0.72 + seedY * 0.7) + seed * 1.31) * amp
  // Z wobble is subtler
  const oz = Math.sin(time * (0.48 + seedZ * 0.45) + seed * 2.17) * (amp * 0.35)

  return [basePos[0] + ox, basePos[1] + oy, basePos[2] + oz]
}
