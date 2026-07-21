import {
  readSharedXrNativeControllerDemoColliders,
  readXrNativeControllerDemo,
} from '@/features/three/xrNativeControllerDemoRuntime'
import { resolveXrMotionReferenceStage } from '@/features/three/xrSceneLibrary'
import { resolveXrTerrainPerimeter } from '@/features/three/xrTerrainPerimeter'
import { isGameFpsPositionValid, type GameFpsPoint } from './gameFpsGeometry'
import type { GameFpsBlocker, GameFpsSpatialMap, GameFpsSpatialProfile } from './gameFpsModel'

const BOUNDARY_COLLIDER_IDS = new Set([
  'native-island-west',
  'native-island-east',
  'native-island-north',
  'native-island-south',
])
const GROUND_ACTOR_STEP_HEIGHT_METERS = 0.45
const GROUND_ACTOR_HEIGHT_METERS = 1.8
const SPAWN_CLEARANCE_METERS = 0.45
const SPAWN_GRID_STEP_METERS = 0.5
const MINIMUM_SPAWN_SEPARATION_METERS = 1.2

function isBoundaryCollider(id: string): boolean {
  return BOUNDARY_COLLIDER_IDS.has(id) || /^terrain:[^:]+:(?:west|east|north|south)$/.test(id)
}

function obstructsGroundActor(collider: Readonly<{
  center: readonly [number, number, number]
  sizeMeters: readonly [number, number, number]
}>): boolean {
  const bottom = collider.center[1] - collider.sizeMeters[1] / 2
  const top = collider.center[1] + collider.sizeMeters[1] / 2
  return top > GROUND_ACTOR_STEP_HEIGHT_METERS && bottom < GROUND_ACTOR_HEIGHT_METERS
}

function spawnCandidates(preferred: GameFpsPoint, map: GameFpsSpatialMap): readonly GameFpsPoint[] {
  const maximumXStep = Math.floor((map.halfWidth - SPAWN_CLEARANCE_METERS) / SPAWN_GRID_STEP_METERS)
  const maximumZStep = Math.floor((map.halfDepth - SPAWN_CLEARANCE_METERS) / SPAWN_GRID_STEP_METERS)
  const candidates: GameFpsPoint[] = [preferred]
  for (let zStep = -maximumZStep; zStep <= maximumZStep; zStep += 1) {
    for (let xStep = -maximumXStep; xStep <= maximumXStep; xStep += 1) {
      candidates.push({ x: xStep * SPAWN_GRID_STEP_METERS, z: zStep * SPAWN_GRID_STEP_METERS })
    }
  }
  return candidates.sort((left, right) => {
    const leftDistance = (left.x - preferred.x) ** 2 + (left.z - preferred.z) ** 2
    const rightDistance = (right.x - preferred.x) ** 2 + (right.z - preferred.z) ** 2
    return leftDistance - rightDistance || left.z - right.z || left.x - right.x
  })
}

function resolveSpawn(
  preferred: GameFpsPoint,
  map: GameFpsSpatialMap,
  occupied: readonly GameFpsPoint[],
): GameFpsPoint {
  const minimumSeparationSquared = MINIMUM_SPAWN_SEPARATION_METERS ** 2
  const spawn = spawnCandidates(preferred, map).find(candidate => (
    isGameFpsPositionValid(candidate, SPAWN_CLEARANCE_METERS, map)
    && occupied.every(point => (candidate.x - point.x) ** 2 + (candidate.z - point.z) ** 2 >= minimumSeparationSquared)
  ))
  if (!spawn) throw new Error('Authored XR terrain has no valid deterministic Game Mode spawn.')
  return Object.freeze(spawn)
}

export function readGameModeXrSpatialProfile(): GameFpsSpatialProfile {
  const stage = resolveXrMotionReferenceStage(readXrNativeControllerDemo().terrainId)
  const perimeter = resolveXrTerrainPerimeter(stage)
  const blockers = readSharedXrNativeControllerDemoColliders()
    .filter(collider => !isBoundaryCollider(collider.id) && obstructsGroundActor(collider))
    .map<GameFpsBlocker>(collider => Object.freeze({
      id: collider.id,
      centerX: collider.center[0],
      centerZ: collider.center[2],
      halfWidth: collider.sizeMeters[0] / 2,
      halfDepth: collider.sizeMeters[2] / 2,
      height: collider.sizeMeters[1],
    }))
  const halfWidth = perimeter.halfWidthMeters
  const halfDepth = perimeter.halfDepthMeters
  const map = Object.freeze({ halfWidth, halfDepth, blockers: Object.freeze(blockers) })
  const playerPosition = resolveSpawn({ x: 0, z: halfDepth * 0.42 }, map, [])
  const npcPreferences = [
    { id: 'npc-scout' as const, x: 0, z: -halfDepth * 0.24 },
    { id: 'npc-west' as const, x: -halfWidth * 0.44, z: -halfDepth * 0.08 },
    { id: 'npc-east' as const, x: halfWidth * 0.44, z: -halfDepth * 0.08 },
    { id: 'npc-guard' as const, x: -halfWidth * 0.2, z: -halfDepth * 0.66 },
  ]
  const occupied: GameFpsPoint[] = [playerPosition]
  const npcSeeds = npcPreferences.map(preference => {
    const position = resolveSpawn(preference, map, occupied)
    occupied.push(position)
    return Object.freeze({ id: preference.id, ...position })
  })
  return Object.freeze({
    id: 'xr-authored',
    map,
    playerSpawn: Object.freeze({ ...playerPosition, yaw: 0, pitch: 0 }),
    npcSeeds: Object.freeze(npcSeeds),
  })
}
