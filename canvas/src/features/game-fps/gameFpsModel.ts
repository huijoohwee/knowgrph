export const GAME_FPS_MISSION_ID = 'game-fps-mission-1'
export const GAME_FPS_FIXED_STEP_SECONDS = 1 / 60
export const GAME_FPS_MAX_FRAME_SECONDS = 0.25

export const GAME_FPS_NPC_ACTIONS = ['hold', 'alert', 'engage', 'flee'] as const
export type GameFpsNpcAction = (typeof GAME_FPS_NPC_ACTIONS)[number]

export const GAME_FPS_FIRE_RESULTS = [
  'idle',
  'hit',
  'eliminated',
  'miss',
  'empty',
  'cooldown',
  'reloaded',
  'reload-unavailable',
] as const
export type GameFpsFireResult = (typeof GAME_FPS_FIRE_RESULTS)[number]

export type GameFpsPhase = 'stopped' | 'playing' | 'won' | 'lost'

export type GameFpsDecisionRecord = Readonly<{
  decisionId: string
  decisionType: 'quest_flag' | 'world_tick_result'
  entityRef: string
  payload: Readonly<Record<string, unknown>>
  producedAt: string
}>

export type GameFpsPlayerSnapshot = Readonly<{
  x: number
  z: number
  yaw: number
  pitch: number
  health: number
}>

export type GameFpsNpcSnapshot = Readonly<{
  id: string
  x: number
  z: number
  health: number
  action: GameFpsNpcAction
}>

export type GameFpsCostLog = Readonly<{
  model: 'none'
  prompt_tokens: 0
  completion_tokens: 0
  cache_hits: 0
  estimated_cost_usd: 0
  incomplete: false
}>

export type GameFpsSnapshot = Readonly<{
  phase: GameFpsPhase
  player: GameFpsPlayerSnapshot
  npcs: readonly GameFpsNpcSnapshot[]
  ammo: number
  reserve: number
  enemiesAlive: number
  fireResult: GameFpsFireResult
  tick: number
  elapsedSeconds: number
  pendingDecisions: readonly GameFpsDecisionRecord[]
  lastCostLog: GameFpsCostLog
  revision: number
}>

export type GameFpsInputPatch = Readonly<{
  forward?: number
  strafe?: number
  lookYawDelta?: number
  lookPitchDelta?: number
  sprint?: boolean
}>

export type GameFpsTickInput = Readonly<{
  forward: number
  strafe: number
  lookYawDelta: number
  lookPitchDelta: number
  sprint: boolean
  fire: boolean
  reload: boolean
}>

export type GameFpsBlocker = Readonly<{
  id: string
  centerX: number
  centerZ: number
  halfWidth: number
  halfDepth: number
  height: number
}>

export const GAME_FPS_MAP = Object.freeze({
  halfWidth: 18,
  halfDepth: 24,
  blockers: Object.freeze([
    Object.freeze({ id: 'cover-west', centerX: -6, centerZ: -7, halfWidth: 2, halfDepth: 1, height: 2.4 }),
    Object.freeze({ id: 'cover-east', centerX: 7, centerZ: -12, halfWidth: 1.5, halfDepth: 2.5, height: 3 }),
    Object.freeze({ id: 'cover-center', centerX: 0, centerZ: -15, halfWidth: 2.2, halfDepth: 1, height: 2.2 }),
  ] satisfies readonly GameFpsBlocker[]),
})

export const GAME_FPS_PLAYER_SPAWN = Object.freeze({ x: 0, z: 2, yaw: 0, pitch: 0 })

export const GAME_FPS_NPC_SEEDS = Object.freeze([
  Object.freeze({ id: 'npc-scout', x: 0, z: -7 }),
  Object.freeze({ id: 'npc-west', x: -12, z: -4 }),
  Object.freeze({ id: 'npc-east', x: 10, z: -9 }),
  Object.freeze({ id: 'npc-guard', x: -4, z: -20 }),
])

export const GAME_FPS_WEAPON = Object.freeze({
  magazineCapacity: 8,
  initialReserve: 24,
  damage: 45,
  cooldownSeconds: 0.18,
  rangeMeters: 40,
  targetRadiusMeters: 0.72,
})

export const GAME_FPS_ZERO_COST_LOG: GameFpsCostLog = Object.freeze({
  model: 'none',
  prompt_tokens: 0,
  completion_tokens: 0,
  cache_hits: 0,
  estimated_cost_usd: 0,
  incomplete: false,
})

export function gameFpsNpcActionFromCode(code: number): GameFpsNpcAction {
  return GAME_FPS_NPC_ACTIONS[code] || 'hold'
}

export function gameFpsFireResultFromCode(code: number): GameFpsFireResult {
  return GAME_FPS_FIRE_RESULTS[code] || 'idle'
}

export function clampGameFpsUnit(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) throw new Error('Game FPS input values must be finite numbers')
  return Math.max(-1, Math.min(1, numeric))
}

export function clampGameFpsLookDelta(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) throw new Error('Game FPS look deltas must be finite numbers')
  return Math.max(-Math.PI, Math.min(Math.PI, numeric))
}
