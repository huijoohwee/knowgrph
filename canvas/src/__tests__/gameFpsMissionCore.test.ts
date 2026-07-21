import assert from 'node:assert/strict'
import test from 'node:test'

import { hasGameFpsLineOfSight } from '../features/game-fps/gameFpsGeometry'
import {
  acknowledgeGameFpsDecisions,
  advanceGameFpsBy,
  queueGameFpsFire,
  readGameFpsSnapshot,
  reloadGameFpsWeapon,
  resetGameFpsRuntimeForTests,
  setGameFpsInput,
  startGameFpsMission,
} from '../features/game-fps/gameFpsRuntime'
import {
  GAME_FPS_FIXED_STEP_SECONDS,
  GAME_FPS_MISSION_ID,
  GAME_FPS_ZERO_COST_LOG,
  type GameFpsSnapshot,
} from '../features/game-fps/gameFpsModel'

function gameplayProjection(snapshot: GameFpsSnapshot) {
  return {
    phase: snapshot.phase,
    player: snapshot.player,
    npcs: snapshot.npcs,
    ammo: snapshot.ammo,
    reserve: snapshot.reserve,
    enemiesAlive: snapshot.enemiesAlive,
    fireResult: snapshot.fireResult,
    tick: snapshot.tick,
    elapsedSeconds: snapshot.elapsedSeconds,
    lastCostLog: snapshot.lastCostLog,
  }
}

function visibleTarget(snapshot: GameFpsSnapshot) {
  return snapshot.npcs.filter(npc => npc.health > 0 && hasGameFpsLineOfSight(snapshot.player, npc))
    .sort((left, right) => {
      const leftDistance = Math.hypot(left.x - snapshot.player.x, left.z - snapshot.player.z)
      const rightDistance = Math.hypot(right.x - snapshot.player.x, right.z - snapshot.player.z)
      return leftDistance - rightDistance || left.id.localeCompare(right.id)
    })[0]
}

async function aimAndFireAtVisibleTarget(): Promise<GameFpsSnapshot> {
  let before = readGameFpsSnapshot()
  if (before.ammo === 0) {
    reloadGameFpsWeapon()
    before = await advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS)
    assert.equal(before.fireResult, 'reloaded')
  }
  const target = visibleTarget(before)
  assert.ok(target, 'the authored mission must always expose a reachable target')
  const deltaX = target.x - before.player.x
  const deltaZ = target.z - before.player.z
  const horizontalDistance = Math.hypot(deltaX, deltaZ)
  const desiredYaw = Math.atan2(-deltaX, -deltaZ)
  const desiredPitch = Math.atan2(1.1 - 1.6, horizontalDistance)
  setGameFpsInput({
    lookYawDelta: desiredYaw - before.player.yaw,
    lookPitchDelta: desiredPitch - before.player.pitch,
  })
  queueGameFpsFire()
  const after = await advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS)
  assert.equal(after.tick, before.tick + 1, 'queued fire must resolve in one fixed World_Tick')
  assert.ok(['hit', 'eliminated'].includes(after.fireResult), `unexpected fire result: ${after.fireResult}`)
  return after
}

test('Game FPS core serializes fixed World_Ticks with deterministic zero-cost output', async () => {
  resetGameFpsRuntimeForTests()
  startGameFpsMission()
  setGameFpsInput({ forward: 1, strafe: 0.25, lookYawDelta: 0.2 })
  await Promise.all([
    advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS),
    advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS),
  ])
  const first = readGameFpsSnapshot()
  assert.equal(first.tick, 2)
  assert.deepEqual(first.lastCostLog, GAME_FPS_ZERO_COST_LOG)
  assert.equal(first.lastCostLog.model, 'none')
  assert.equal(first.lastCostLog.prompt_tokens + first.lastCostLog.completion_tokens, 0)

  const expected = gameplayProjection(first)
  resetGameFpsRuntimeForTests()
  startGameFpsMission()
  setGameFpsInput({ forward: 1, strafe: 0.25, lookYawDelta: 0.2 })
  await Promise.all([
    advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS),
    advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS),
  ])
  assert.deepEqual(gameplayProjection(readGameFpsSnapshot()), expected)
})

test('one weapon, reload, all four utility actions, and mission completion stay local', async () => {
  resetGameFpsRuntimeForTests()
  const initial = startGameFpsMission()
  assert.equal(initial.npcs.length, 4)
  assert.ok(initial.npcs.every(npc => npc.action === 'hold'))
  await advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS)

  let reloadObserved = false
  while (readGameFpsSnapshot().phase === 'playing') {
    const before = readGameFpsSnapshot()
    const after = await aimAndFireAtVisibleTarget()
    if (before.ammo === 0) reloadObserved = true
    if (after.phase === 'playing') await advanceGameFpsBy(0.2)
  }

  const completed = readGameFpsSnapshot()
  assert.equal(completed.phase, 'won')
  assert.equal(completed.enemiesAlive, 0)
  assert.equal(reloadObserved, true)
  assert.deepEqual(completed.lastCostLog, GAME_FPS_ZERO_COST_LOG)
  const events = completed.pendingDecisions.map(decision => decision.payload.event)
  assert.ok(events.includes('weapon_hit'))
  assert.ok(events.includes('mission_completed'))
  const actionEvents = new Set(completed.pendingDecisions
    .filter(decision => decision.payload.event === 'npc_action')
    .map(decision => decision.payload.action))
  assert.ok(actionEvents.has('alert'))
  assert.ok(actionEvents.has('engage'))
  assert.ok(actionEvents.has('flee'))
  assert.ok(Object.isFrozen(completed) && Object.isFrozen(completed.pendingDecisions))
})

test('validated Decisions replay terminal state and remain pending until acknowledged', async () => {
  const completed = readGameFpsSnapshot()
  const savedDecisions = completed.pendingDecisions
  assert.ok(savedDecisions.length > 0)
  assert.ok(savedDecisions.every(decision => decision.payload.missionId === GAME_FPS_MISSION_ID))

  const ids = savedDecisions.map(decision => decision.decisionId)
  acknowledgeGameFpsDecisions(ids)
  assert.equal(readGameFpsSnapshot().pendingDecisions.length, 0)

  resetGameFpsRuntimeForTests()
  const restored = startGameFpsMission({ decisions: savedDecisions })
  assert.equal(restored.phase, 'won')
  assert.equal(restored.enemiesAlive, 0)
  assert.equal(restored.pendingDecisions.length, 0, 'already-persisted Decisions must not be re-queued')

  const weaponHit = savedDecisions.find(decision => decision.payload.event === 'weapon_hit')!
  const malformed = {
    ...weaponHit,
    payload: { ...weaponHit.payload, remainingHealth: -1 },
  }
  const beforeRejectedRestore = readGameFpsSnapshot()
  assert.throws(
    () => startGameFpsMission({ decisions: [malformed] }),
    /remainingHealth must be a finite number from 0 to 100/,
  )
  assert.equal(readGameFpsSnapshot(), beforeRejectedRestore, 'malformed restore must not replace the active mission')
})
