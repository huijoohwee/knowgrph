import { GAME_FPS_MAP, type GameFpsBlocker } from './gameFpsModel'

export type GameFpsPoint = Readonly<{ x: number; z: number }>

const EPSILON = 1e-8

export function clampGameFpsPitch(value: number): number {
  return Math.max(-1.2, Math.min(1.2, value))
}

export function normalizeGameFpsYaw(value: number): number {
  const fullTurn = Math.PI * 2
  return ((value + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI
}

function insideBlocker(point: GameFpsPoint, blocker: GameFpsBlocker, radius: number): boolean {
  return Math.abs(point.x - blocker.centerX) < blocker.halfWidth + radius
    && Math.abs(point.z - blocker.centerZ) < blocker.halfDepth + radius
}

function validPosition(point: GameFpsPoint, radius: number): boolean {
  if (Math.abs(point.x) > GAME_FPS_MAP.halfWidth - radius) return false
  if (Math.abs(point.z) > GAME_FPS_MAP.halfDepth - radius) return false
  return !GAME_FPS_MAP.blockers.some(blocker => insideBlocker(point, blocker, radius))
}

export function resolveGameFpsMovement(
  origin: GameFpsPoint,
  delta: GameFpsPoint,
  radius: number,
): GameFpsPoint {
  const both = { x: origin.x + delta.x, z: origin.z + delta.z }
  if (validPosition(both, radius)) return both
  const xOnly = { x: origin.x + delta.x, z: origin.z }
  if (validPosition(xOnly, radius)) return xOnly
  const zOnly = { x: origin.x, z: origin.z + delta.z }
  return validPosition(zOnly, radius) ? zOnly : origin
}

function segmentIntersectsBlocker(
  start: GameFpsPoint,
  end: GameFpsPoint,
  blocker: GameFpsBlocker,
  padding = 0,
): boolean {
  const minX = blocker.centerX - blocker.halfWidth - padding
  const maxX = blocker.centerX + blocker.halfWidth + padding
  const minZ = blocker.centerZ - blocker.halfDepth - padding
  const maxZ = blocker.centerZ + blocker.halfDepth + padding
  const dx = end.x - start.x
  const dz = end.z - start.z
  let entry = 0
  let exit = 1
  for (const [origin, delta, min, max] of [
    [start.x, dx, minX, maxX],
    [start.z, dz, minZ, maxZ],
  ] as const) {
    if (Math.abs(delta) <= EPSILON) {
      if (origin < min || origin > max) return false
      continue
    }
    const first = (min - origin) / delta
    const second = (max - origin) / delta
    entry = Math.max(entry, Math.min(first, second))
    exit = Math.min(exit, Math.max(first, second))
    if (entry > exit) return false
  }
  return exit > EPSILON && entry < 1 - EPSILON
}

export function hasGameFpsLineOfSight(start: GameFpsPoint, end: GameFpsPoint): boolean {
  return !GAME_FPS_MAP.blockers.some(blocker => segmentIntersectsBlocker(start, end, blocker))
}

export function gameFpsHorizontalDistance(left: GameFpsPoint, right: GameFpsPoint): number {
  return Math.hypot(right.x - left.x, right.z - left.z)
}

export function gameFpsLookDirection(yaw: number, pitch: number): readonly [number, number, number] {
  const horizontal = Math.cos(pitch)
  return Object.freeze([
    -Math.sin(yaw) * horizontal,
    Math.sin(pitch),
    -Math.cos(yaw) * horizontal,
  ])
}

export function gameFpsRayTargetDistance(args: {
  origin: readonly [number, number, number]
  direction: readonly [number, number, number]
  target: readonly [number, number, number]
  radius: number
}): number | null {
  const offsetX = args.target[0] - args.origin[0]
  const offsetY = args.target[1] - args.origin[1]
  const offsetZ = args.target[2] - args.origin[2]
  const along = offsetX * args.direction[0]
    + offsetY * args.direction[1]
    + offsetZ * args.direction[2]
  if (along <= 0) return null
  const offsetSquared = offsetX ** 2 + offsetY ** 2 + offsetZ ** 2
  const perpendicularSquared = Math.max(0, offsetSquared - along ** 2)
  return perpendicularSquared <= args.radius ** 2 ? along : null
}
