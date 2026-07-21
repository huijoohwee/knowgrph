import { allocateEntity, createWorld, registerComponent, worldTick } from '../../../../ecs/index.js'
import { normalizeDecisionRecord } from '../../../../ecs/kgcNodeContract.js'
import { snapshotWorld } from '../../../../ecs/world.js'
import {
  gameFpsHorizontalDistance,
  gameFpsLookDirection,
  gameFpsRayTargetDistance,
  hasGameFpsLineOfSight,
  normalizeGameFpsYaw,
  clampGameFpsPitch,
  resolveGameFpsMovement,
} from './gameFpsGeometry'
import {
  GAME_FPS_FIXED_STEP_SECONDS,
  GAME_FPS_FIRE_RESULTS,
  GAME_FPS_MISSION_ID,
  GAME_FPS_NPC_ACTIONS,
  GAME_FPS_NPC_SEEDS,
  GAME_FPS_PLAYER_SPAWN,
  GAME_FPS_WEAPON,
  gameFpsFireResultFromCode,
  gameFpsNpcActionFromCode,
  type GameFpsCostLog,
  type GameFpsDecisionRecord,
  type GameFpsFireResult,
  type GameFpsNpcAction,
  type GameFpsNpcSnapshot,
  type GameFpsPhase,
  type GameFpsPlayerSnapshot,
  type GameFpsTickInput,
} from './gameFpsModel'

const PLAYER_REF = 'game-fps:player'
const MISSION_REF = `game-fps:mission:${GAME_FPS_MISSION_ID}`
const PLAYER_ENTITY_HEIGHT = 1.6
const NPC_TARGET_HEIGHT = 1.1
const NPC_MAX_HEALTH = 100
const PLAYER_MAX_HEALTH = 100
const ACTION_HOLD = 0
const ACTION_ALERT = 1
const ACTION_ENGAGE = 2
const ACTION_FLEE = 3
const PHASE_PLAYING = 1
const PHASE_WON = 2
const PHASE_LOST = 3
const DECISION_EPOCH_MS = Date.UTC(2026, 0, 1)

type EcsContext = {
  query(names: string[]): number[]
  read(entityId: number, component: string, field: string): number
  write(entityId: number, component: string, field: string, value: number): void
  emitDecision(decision: GameFpsDecisionRecord): void
}

type RuntimeEntity = Readonly<{
  entityId: number
  entityRef: string
  components: Record<string, Record<string, number>>
}>

type ReplayState = {
  tick: number
  phase: number
  playerHealth: number
  npcHealth: Map<string, number>
  npcActions: Map<string, number>
}

export type GameFpsMissionCapture = Readonly<{
  phase: Exclude<GameFpsPhase, 'stopped'>
  player: GameFpsPlayerSnapshot
  npcs: readonly GameFpsNpcSnapshot[]
  ammo: number
  reserve: number
  enemiesAlive: number
  fireResult: GameFpsFireResult
  tick: number
  elapsedSeconds: number
}>

export type GameFpsMissionTickResult = Readonly<{
  capture: GameFpsMissionCapture
  decisions: readonly GameFpsDecisionRecord[]
  costLog: GameFpsCostLog
}>

export type GameFpsAuthoredMission = Readonly<{
  world: object
  playerEntityId: number
  missionEntityId: number
  npcEntityIds: ReadonlyMap<string, number>
}>

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string`)
  return value
}

function boundedHealth(value: unknown, label: string): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
    throw new Error(`${label} must be a finite number from 0 to 100`)
  }
  return numeric
}

function decisionTick(payload: Record<string, unknown>): number {
  const tick = Number(payload.tick)
  if (!Number.isSafeInteger(tick) || tick < 0) throw new Error('Game FPS Decision tick must be a non-negative integer')
  return tick
}

function decisionRunId(payload: Record<string, unknown>): number {
  const runId = Number(payload.runId)
  if (!Number.isSafeInteger(runId) || runId < 1) throw new Error('Game FPS Decision runId must be a positive integer')
  return runId
}

function resetReplayState(state: ReplayState): void {
  state.tick = 0
  state.phase = PHASE_PLAYING
  state.playerHealth = PLAYER_MAX_HEALTH
  state.npcHealth = new Map(GAME_FPS_NPC_SEEDS.map(seed => [seed.id, NPC_MAX_HEALTH]))
  state.npcActions = new Map(GAME_FPS_NPC_SEEDS.map(seed => [seed.id, ACTION_HOLD]))
}

function replayDecisions(values: readonly unknown[]): ReplayState {
  const state: ReplayState = {
    tick: 0,
    phase: PHASE_PLAYING,
    playerHealth: PLAYER_MAX_HEALTH,
    npcHealth: new Map(GAME_FPS_NPC_SEEDS.map(seed => [seed.id, NPC_MAX_HEALTH])),
    npcActions: new Map(GAME_FPS_NPC_SEEDS.map(seed => [seed.id, ACTION_HOLD])),
  }
  const normalized = values.map((value, index) => normalizeDecisionRecord(value, `decisions[${index}]`))
    .filter(decision => decision.payload.missionId === GAME_FPS_MISSION_ID)
    .map(decision => ({ decision, runId: decisionRunId(decision.payload) }))
    .sort((left, right) => {
      const runDelta = left.runId - right.runId
      const tickDelta = decisionTick(left.decision.payload) - decisionTick(right.decision.payload)
      return runDelta || tickDelta || left.decision.decisionId.localeCompare(right.decision.decisionId)
    })

  let activeRunId = 0
  for (const entry of normalized) {
    const { decision } = entry
    if (entry.runId !== activeRunId) {
      resetReplayState(state)
      activeRunId = entry.runId
    }
    const payload = record(decision.payload, `${decision.decisionId}.payload`)
    const event = requiredString(payload.event, `${decision.decisionId}.payload.event`)
    const tick = decisionTick(payload)
    state.tick = Math.max(state.tick, tick)
    if (decision.decisionType === 'world_tick_result' && event === 'weapon_hit') {
      const targetRef = requiredString(payload.targetRef, `${decision.decisionId}.payload.targetRef`)
      if (!state.npcHealth.has(targetRef)) throw new Error(`Unknown Game FPS NPC in Decision: ${targetRef}`)
      state.npcHealth.set(targetRef, boundedHealth(payload.remainingHealth, `${decision.decisionId}.payload.remainingHealth`))
    } else if (decision.decisionType === 'world_tick_result' && event === 'npc_action') {
      const action = requiredString(payload.action, `${decision.decisionId}.payload.action`) as GameFpsNpcAction
      if (!GAME_FPS_NPC_ACTIONS.includes(action)) throw new Error(`Unsupported Game FPS NPC action: ${action}`)
      if (!state.npcActions.has(decision.entityRef)) throw new Error(`Unknown Game FPS NPC in Decision: ${decision.entityRef}`)
      state.npcActions.set(decision.entityRef, GAME_FPS_NPC_ACTIONS.indexOf(action))
    } else if (decision.decisionType === 'world_tick_result' && event === 'player_damaged') {
      state.playerHealth = boundedHealth(payload.remainingHealth, `${decision.decisionId}.payload.remainingHealth`)
    } else if (decision.decisionType === 'quest_flag' && event === 'mission_completed') {
      if (payload.status !== 'won') throw new Error('Completed Game FPS Decision must have won status')
      state.phase = PHASE_WON
      for (const id of state.npcHealth.keys()) state.npcHealth.set(id, 0)
    } else if (decision.decisionType === 'quest_flag' && event === 'mission_failed') {
      if (payload.status !== 'lost') throw new Error('Failed Game FPS Decision must have lost status')
      state.phase = PHASE_LOST
      state.playerHealth = 0
    } else {
      throw new Error(`Unsupported Game FPS Decision event: ${decision.decisionType}:${event}`)
    }
  }
  if (state.phase === PHASE_WON) {
    for (const id of state.npcHealth.keys()) state.npcHealth.set(id, 0)
  } else if (state.phase === PHASE_LOST) {
    state.playerHealth = 0
  }
  return state
}

function phaseName(code: number): Exclude<GameFpsPhase, 'stopped'> {
  return code === PHASE_WON ? 'won' : code === PHASE_LOST ? 'lost' : 'playing'
}

function makeDecisionFactory(runId: number) {
  let ordinal = 0
  return (
    context: EcsContext,
    decisionType: GameFpsDecisionRecord['decisionType'],
    entityRef: string,
    tick: number,
    payload: Record<string, unknown>,
  ) => {
    ordinal += 1
    context.emitDecision({
      decisionId: `game-fps:run-${runId}:tick-${tick}:decision-${ordinal}`,
      decisionType,
      entityRef,
      payload: { ...payload, missionId: GAME_FPS_MISSION_ID, runId, tick },
      producedAt: new Date(DECISION_EPOCH_MS + tick * 17 + ordinal).toISOString(),
    })
  }
}

function zeroCostLog(value: unknown): GameFpsCostLog {
  const cost = record(value, 'Game FPS Cost_Log')
  if (cost.model !== 'none'
    || cost.prompt_tokens !== 0
    || cost.completion_tokens !== 0
    || cost.cache_hits !== 0
    || cost.estimated_cost_usd !== 0
    || cost.incomplete !== false) {
    throw new Error('Game FPS ticks must produce exactly one zero-token Cost_Log')
  }
  return Object.freeze({ ...cost }) as GameFpsCostLog
}

export function createGameFpsAuthoredMission(args: {
  runId: number
  decisions?: readonly unknown[]
}): GameFpsAuthoredMission {
  const replay = replayDecisions(args.decisions || [])
  const entityIds = new Map<string, number>()
  let playerEntityId = -1
  let missionEntityId = -1
  const emitDecision = makeDecisionFactory(args.runId)

  const clockSystem = (context: EcsContext) => {
    if (context.read(missionEntityId, 'Mission', 'phase') !== PHASE_PLAYING) return
    context.write(missionEntityId, 'Mission', 'tick', context.read(missionEntityId, 'Mission', 'tick') + 1)
    context.write(
      missionEntityId,
      'Mission',
      'elapsed',
      context.read(missionEntityId, 'Mission', 'elapsed') + GAME_FPS_FIXED_STEP_SECONDS,
    )
  }

  const playerSystem = (context: EcsContext, input: GameFpsTickInput) => {
    if (context.read(missionEntityId, 'Mission', 'phase') !== PHASE_PLAYING) return
    const yaw = normalizeGameFpsYaw(context.read(playerEntityId, 'Transform', 'yaw') + input.lookYawDelta)
    const pitch = clampGameFpsPitch(context.read(playerEntityId, 'Transform', 'pitch') + input.lookPitchDelta)
    context.write(playerEntityId, 'Transform', 'yaw', yaw)
    context.write(playerEntityId, 'Transform', 'pitch', pitch)
    const inputLength = Math.hypot(input.forward, input.strafe)
    if (inputLength <= 0) return
    const scale = Math.min(1, inputLength) / inputLength
    const forward = input.forward * scale
    const strafe = input.strafe * scale
    const speed = input.sprint ? 6.4 : 4.2
    const distance = speed * GAME_FPS_FIXED_STEP_SECONDS
    const delta = {
      x: (-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) * distance,
      z: (-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) * distance,
    }
    const origin = {
      x: context.read(playerEntityId, 'Transform', 'x'),
      z: context.read(playerEntityId, 'Transform', 'z'),
    }
    const next = resolveGameFpsMovement(origin, delta, 0.35)
    context.write(playerEntityId, 'Transform', 'x', next.x)
    context.write(playerEntityId, 'Transform', 'z', next.z)
  }

  const weaponSystem = (context: EcsContext, input: GameFpsTickInput) => {
    if (context.read(missionEntityId, 'Mission', 'phase') !== PHASE_PLAYING) return
    const cooldown = Math.max(0, context.read(playerEntityId, 'Weapon', 'cooldown') - GAME_FPS_FIXED_STEP_SECONDS)
    context.write(playerEntityId, 'Weapon', 'cooldown', cooldown)
    if (input.reload) {
      const ammo = context.read(playerEntityId, 'Weapon', 'ammo')
      const reserve = context.read(playerEntityId, 'Weapon', 'reserve')
      const transfer = Math.min(GAME_FPS_WEAPON.magazineCapacity - ammo, reserve)
      if (transfer <= 0) {
        context.write(playerEntityId, 'Weapon', 'result', GAME_FPS_FIRE_RESULTS.indexOf('reload-unavailable'))
        return
      }
      context.write(playerEntityId, 'Weapon', 'ammo', ammo + transfer)
      context.write(playerEntityId, 'Weapon', 'reserve', reserve - transfer)
      context.write(playerEntityId, 'Weapon', 'result', GAME_FPS_FIRE_RESULTS.indexOf('reloaded'))
      return
    }
    if (!input.fire) return
    if (cooldown > 1e-6) {
      context.write(playerEntityId, 'Weapon', 'result', GAME_FPS_FIRE_RESULTS.indexOf('cooldown'))
      return
    }
    const ammo = context.read(playerEntityId, 'Weapon', 'ammo')
    if (ammo <= 0) {
      context.write(playerEntityId, 'Weapon', 'result', GAME_FPS_FIRE_RESULTS.indexOf('empty'))
      return
    }
    context.write(playerEntityId, 'Weapon', 'ammo', ammo - 1)
    context.write(playerEntityId, 'Weapon', 'cooldown', GAME_FPS_WEAPON.cooldownSeconds)
    const playerX = context.read(playerEntityId, 'Transform', 'x')
    const playerZ = context.read(playerEntityId, 'Transform', 'z')
    const direction = gameFpsLookDirection(
      context.read(playerEntityId, 'Transform', 'yaw'),
      context.read(playerEntityId, 'Transform', 'pitch'),
    )
    let target: { id: string; entityId: number; distance: number } | null = null
    for (const [id, entityId] of entityIds) {
      if (context.read(entityId, 'Npc', 'active') !== 1) continue
      const x = context.read(entityId, 'Transform', 'x')
      const z = context.read(entityId, 'Transform', 'z')
      if (!hasGameFpsLineOfSight({ x: playerX, z: playerZ }, { x, z })) continue
      const distance = gameFpsRayTargetDistance({
        origin: [playerX, PLAYER_ENTITY_HEIGHT, playerZ],
        direction,
        target: [x, NPC_TARGET_HEIGHT, z],
        radius: GAME_FPS_WEAPON.targetRadiusMeters,
      })
      if (distance == null || distance > GAME_FPS_WEAPON.rangeMeters) continue
      if (!target || distance < target.distance) target = { id, entityId, distance }
    }
    if (!target) {
      context.write(playerEntityId, 'Weapon', 'result', GAME_FPS_FIRE_RESULTS.indexOf('miss'))
      return
    }
    const previousHealth = context.read(target.entityId, 'Health', 'current')
    const remainingHealth = Math.max(0, previousHealth - GAME_FPS_WEAPON.damage)
    context.write(target.entityId, 'Health', 'current', remainingHealth)
    if (remainingHealth === 0) context.write(target.entityId, 'Npc', 'active', 0)
    const result = remainingHealth === 0 ? 'eliminated' : 'hit'
    context.write(playerEntityId, 'Weapon', 'result', GAME_FPS_FIRE_RESULTS.indexOf(result))
    emitDecision(
      context,
      'world_tick_result',
      target.id,
      context.read(missionEntityId, 'Mission', 'tick'),
      { event: 'weapon_hit', targetRef: target.id, damage: GAME_FPS_WEAPON.damage, remainingHealth },
    )
  }

  const npcSystem = (context: EcsContext) => {
    if (context.read(missionEntityId, 'Mission', 'phase') !== PHASE_PLAYING) return
    const player = {
      x: context.read(playerEntityId, 'Transform', 'x'),
      z: context.read(playerEntityId, 'Transform', 'z'),
    }
    for (const [id, entityId] of entityIds) {
      if (context.read(entityId, 'Npc', 'active') !== 1) continue
      const position = {
        x: context.read(entityId, 'Transform', 'x'),
        z: context.read(entityId, 'Transform', 'z'),
      }
      const distance = gameFpsHorizontalDistance(position, player)
      const health = context.read(entityId, 'Health', 'current')
      const lineOfSight = hasGameFpsLineOfSight(position, player)
      const action = health <= 35
        ? ACTION_FLEE
        : lineOfSight && distance <= 9
          ? ACTION_ENGAGE
          : distance <= 17
            ? ACTION_ALERT
            : ACTION_HOLD
      const previousAction = context.read(entityId, 'NpcBrain', 'action')
      if (action !== previousAction) {
        context.write(entityId, 'NpcBrain', 'action', action)
        emitDecision(
          context,
          'world_tick_result',
          id,
          context.read(missionEntityId, 'Mission', 'tick'),
          {
            event: 'npc_action',
            action: gameFpsNpcActionFromCode(action),
            from: gameFpsNpcActionFromCode(previousAction),
          },
        )
      }
      const away = action === ACTION_FLEE ? -1 : 1
      const moveSpeed = action === ACTION_FLEE ? 2.8 : action === ACTION_ENGAGE ? 1.5 : action === ACTION_ALERT ? 0.7 : 0
      if (moveSpeed > 0 && distance > 1e-6) {
        const delta = {
          x: ((player.x - position.x) / distance) * moveSpeed * GAME_FPS_FIXED_STEP_SECONDS * away,
          z: ((player.z - position.z) / distance) * moveSpeed * GAME_FPS_FIXED_STEP_SECONDS * away,
        }
        const next = resolveGameFpsMovement(position, delta, 0.4)
        context.write(entityId, 'Transform', 'x', next.x)
        context.write(entityId, 'Transform', 'z', next.z)
        context.write(entityId, 'Transform', 'yaw', Math.atan2(-(player.x - next.x), -(player.z - next.z)))
      }
      const attackCooldown = Math.max(
        0,
        context.read(entityId, 'NpcBrain', 'attackCooldown') - GAME_FPS_FIXED_STEP_SECONDS,
      )
      context.write(entityId, 'NpcBrain', 'attackCooldown', attackCooldown)
      if (action !== ACTION_ENGAGE || distance > 2.2 || attackCooldown > 1e-6) continue
      const previousPlayerHealth = context.read(playerEntityId, 'Health', 'current')
      const remainingHealth = Math.max(0, previousPlayerHealth - 10)
      context.write(playerEntityId, 'Health', 'current', remainingHealth)
      context.write(entityId, 'NpcBrain', 'attackCooldown', 0.9)
      emitDecision(
        context,
        'world_tick_result',
        PLAYER_REF,
        context.read(missionEntityId, 'Mission', 'tick'),
        { event: 'player_damaged', sourceRef: id, damage: 10, remainingHealth },
      )
    }
  }

  const missionSystem = (context: EcsContext) => {
    if (context.read(missionEntityId, 'Mission', 'phase') !== PHASE_PLAYING) return
    let enemiesAlive = 0
    for (const entityId of entityIds.values()) {
      if (context.read(entityId, 'Npc', 'active') === 1) enemiesAlive += 1
    }
    context.write(missionEntityId, 'Mission', 'enemiesAlive', enemiesAlive)
    const tick = context.read(missionEntityId, 'Mission', 'tick')
    if (enemiesAlive === 0) {
      context.write(missionEntityId, 'Mission', 'phase', PHASE_WON)
      emitDecision(context, 'quest_flag', MISSION_REF, tick, {
        event: 'mission_completed', status: 'won', enemiesAlive: 0,
      })
    } else if (context.read(playerEntityId, 'Health', 'current') <= 0) {
      context.write(missionEntityId, 'Mission', 'phase', PHASE_LOST)
      emitDecision(context, 'quest_flag', MISSION_REF, tick, {
        event: 'mission_failed', status: 'lost', enemiesAlive,
      })
    }
  }

  const world = createWorld({ systems: [clockSystem, playerSystem, weaponSystem, npcSystem, missionSystem] })
  registerComponent(world, 'Transform', { x: 'f32', z: 'f32', yaw: 'f32', pitch: 'f32' })
  registerComponent(world, 'Health', { current: 'f32', maximum: 'f32' })
  registerComponent(world, 'Player', { active: 'u8' })
  registerComponent(world, 'Weapon', { ammo: 'u16', reserve: 'u16', cooldown: 'f32', result: 'u8' })
  registerComponent(world, 'Npc', { active: 'u8' })
  registerComponent(world, 'NpcBrain', { action: 'u8', attackCooldown: 'f32' })
  registerComponent(world, 'Mission', { phase: 'u8', tick: 'u32', elapsed: 'f64', enemiesAlive: 'u8' })

  playerEntityId = allocateEntity(world, {
    entityRef: PLAYER_REF,
    components: {
      Transform: { ...GAME_FPS_PLAYER_SPAWN },
      Health: { current: replay.playerHealth, maximum: PLAYER_MAX_HEALTH },
      Player: { active: replay.playerHealth > 0 ? 1 : 0 },
      Weapon: {
        ammo: GAME_FPS_WEAPON.magazineCapacity,
        reserve: GAME_FPS_WEAPON.initialReserve,
        cooldown: 0,
        result: GAME_FPS_FIRE_RESULTS.indexOf('idle'),
      },
    },
  })
  for (const seed of GAME_FPS_NPC_SEEDS) {
    const health = replay.npcHealth.get(seed.id) ?? NPC_MAX_HEALTH
    entityIds.set(seed.id, allocateEntity(world, {
      entityRef: seed.id,
      components: {
        Transform: { x: seed.x, z: seed.z, yaw: 0, pitch: 0 },
        Health: { current: health, maximum: NPC_MAX_HEALTH },
        Npc: { active: health > 0 ? 1 : 0 },
        NpcBrain: { action: replay.npcActions.get(seed.id) ?? ACTION_HOLD, attackCooldown: 0 },
      },
    }))
  }
  missionEntityId = allocateEntity(world, {
    entityRef: MISSION_REF,
    components: {
      Mission: {
        phase: replay.phase,
        tick: replay.tick,
        elapsed: replay.tick * GAME_FPS_FIXED_STEP_SECONDS,
        enemiesAlive: [...replay.npcHealth.values()].filter(health => health > 0).length,
      },
    },
  })
  return Object.freeze({ world, playerEntityId, missionEntityId, npcEntityIds: entityIds })
}

function component(entity: RuntimeEntity, name: string): Record<string, number> {
  const value = entity.components[name]
  if (!value) throw new Error(`Game FPS entity ${entity.entityRef} is missing ${name}`)
  return value
}

export function captureGameFpsAuthoredMission(mission: GameFpsAuthoredMission): GameFpsMissionCapture {
  const worldSnapshot = snapshotWorld(mission.world) as { entities: RuntimeEntity[] }
  const byRef = new Map(worldSnapshot.entities.map(entity => [entity.entityRef, entity]))
  const playerEntity = byRef.get(PLAYER_REF)!
  const missionEntity = byRef.get(MISSION_REF)!
  const playerTransform = component(playerEntity, 'Transform')
  const playerHealth = component(playerEntity, 'Health')
  const weapon = component(playerEntity, 'Weapon')
  const missionState = component(missionEntity, 'Mission')
  const npcs = GAME_FPS_NPC_SEEDS.map(seed => {
    const entity = byRef.get(seed.id)!
    const transform = component(entity, 'Transform')
    const health = component(entity, 'Health')
    const brain = component(entity, 'NpcBrain')
    return Object.freeze({
      id: seed.id,
      x: transform.x,
      z: transform.z,
      health: health.current,
      action: gameFpsNpcActionFromCode(brain.action),
    })
  })
  return Object.freeze({
    phase: phaseName(missionState.phase),
    player: Object.freeze({
      x: playerTransform.x,
      z: playerTransform.z,
      yaw: playerTransform.yaw,
      pitch: playerTransform.pitch,
      health: playerHealth.current,
    }),
    npcs: Object.freeze(npcs),
    ammo: weapon.ammo,
    reserve: weapon.reserve,
    enemiesAlive: missionState.enemiesAlive,
    fireResult: gameFpsFireResultFromCode(weapon.result),
    tick: missionState.tick,
    elapsedSeconds: missionState.elapsed,
  })
}

export async function tickGameFpsAuthoredMission(
  mission: GameFpsAuthoredMission,
  input: GameFpsTickInput,
): Promise<GameFpsMissionTickResult> {
  const result = await worldTick(mission.world, input)
  if (!result.ok) throw new Error(`Game FPS World_Tick failed: ${result.errorCode}: ${result.message}`)
  if (result.deferred_decisions.length !== 0 || result.cost_logs.length !== 1) {
    throw new Error('Game FPS World_Tick must remain deterministic and LLM-free')
  }
  return Object.freeze({
    capture: captureGameFpsAuthoredMission(mission),
    decisions: Object.freeze(result.decisions.map((decision: GameFpsDecisionRecord) => Object.freeze(decision))),
    costLog: zeroCostLog(result.cost_logs[0]),
  })
}
