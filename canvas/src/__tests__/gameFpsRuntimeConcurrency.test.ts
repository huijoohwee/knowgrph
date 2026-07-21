import assert from 'node:assert/strict'
import test from 'node:test'
import {
  acknowledgeGameFpsDecisions,
  advanceGameFpsBy,
  readGameFpsRunId,
  readGameFpsSnapshot,
  resetGameFpsRuntimeForTests,
  restartGameFpsMission,
  startGameFpsMission,
  stopGameFpsMission,
  subscribeGameFpsSnapshot,
} from '../features/game-fps/gameFpsRuntime'
import {
  GAME_FPS_FIXED_STEP_SECONDS,
  GAME_FPS_MISSION_ID,
  type GameFpsSnapshot,
} from '../features/game-fps/gameFpsModel'

async function reachInFlightWorldTick(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

function maximumTickDecision(decisionId: string) {
  return {
    decisionId,
    decisionType: 'world_tick_result' as const,
    entityRef: 'npc-scout',
    payload: {
      event: 'npc_action',
      missionId: GAME_FPS_MISSION_ID,
      runId: 1,
      tick: 0xffff_fffe,
      action: 'hold',
    },
    producedAt: '2026-01-01T00:00:00.000Z',
  }
}

test('Stop during an underway World_Tick preserves exactly that completed tick', async () => {
  resetGameFpsRuntimeForTests()
  startGameFpsMission()
  const advancing = advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS * 2)
  await reachInFlightWorldTick()

  const stopped = stopGameFpsMission()
  assert.equal(stopped.phase, 'stopped')
  assert.equal(stopped.tick, 0, 'Stop must expose only the last safely captured tick immediately')

  const settled = await advancing
  assert.equal(settled.phase, 'stopped')
  assert.equal(settled.tick, 1, 'the atomic tick already underway must settle before Stop takes effect')
  assert.equal(readGameFpsSnapshot(), settled)
})

test('Stop then immediate Start resumes the same mission after its underway World_Tick settles', async () => {
  resetGameFpsRuntimeForTests()
  startGameFpsMission()
  const runIdBeforeStop = readGameFpsRunId()
  const observed: GameFpsSnapshot[] = []
  const unsubscribe = subscribeGameFpsSnapshot(() => observed.push(readGameFpsSnapshot()))
  try {
    const advancing = advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS * 2)
    await reachInFlightWorldTick()

    const stopped = stopGameFpsMission()
    assert.equal(stopped.phase, 'stopped')
    assert.equal(stopped.tick, 0)

    const resumed = startGameFpsMission()
    assert.equal(resumed.phase, 'playing')
    assert.equal(resumed.tick, 0, 'Start must reuse the last safe capture while World_Tick is underway')
    assert.equal(readGameFpsRunId(), runIdBeforeStop, 'Start must resume instead of replacing the mission')

    const settled = await advancing
    assert.equal(settled.phase, 'playing')
    assert.equal(settled.tick, 1, 'the completed stopped tick must become the resumed mission boundary')
    assert.equal(settled.runtimeError, null)
    assert.equal(
      observed.filter(value => value.phase === 'stopped' && value.tick === 1).length,
      1,
      'the underway tick must publish its completed stopped boundary exactly once before resuming',
    )

    const next = await advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS)
    assert.equal(next.phase, 'playing')
    assert.equal(next.tick, 2, 'the resumed mission must accept the next serialized World_Tick')
  } finally {
    unsubscribe()
  }
})

test('Restart during an underway World_Tick discards the replaced mission result', async () => {
  resetGameFpsRuntimeForTests()
  startGameFpsMission()
  const firstRunId = readGameFpsRunId()
  const advancing = advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS)
  await reachInFlightWorldTick()

  const restarted = restartGameFpsMission()
  assert.equal(readGameFpsRunId(), firstRunId + 1)
  assert.equal(restarted.tick, 0)

  const staleResult = await advancing
  assert.equal(staleResult, restarted)
  assert.equal(readGameFpsSnapshot(), restarted)
  assert.equal(readGameFpsSnapshot().tick, 0, 'the replaced mission tick must never publish')
})

test('Restart fences a stale World_Tick failure from the replacement mission', async () => {
  resetGameFpsRuntimeForTests()
  startGameFpsMission({ decisions: [maximumTickDecision('game-fps:stale-failure-boundary')] })
  const failingAdvance = advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS)
  await reachInFlightWorldTick()

  const restarted = restartGameFpsMission()
  assert.equal(await failingAdvance, restarted)
  assert.equal(readGameFpsSnapshot(), restarted)
  assert.equal(restarted.runtimeError, null, 'a replaced mission failure must not poison the new run')
})

test('Stop then immediate Start publishes an underway same-mission World_Tick failure', async () => {
  resetGameFpsRuntimeForTests()
  startGameFpsMission({ decisions: [maximumTickDecision('game-fps:resumed-failure-boundary')] })
  const runIdBeforeStop = readGameFpsRunId()
  const failingAdvance = advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS)
  await reachInFlightWorldTick()

  stopGameFpsMission()
  const resumed = startGameFpsMission()
  assert.equal(resumed.phase, 'playing')
  assert.equal(readGameFpsRunId(), runIdBeforeStop)

  await assert.rejects(failingAdvance, /exhausted its bounded tick range/)
  const failed = readGameFpsSnapshot()
  assert.equal(failed.phase, 'playing')
  assert.match(failed.runtimeError || '', /exhausted its bounded tick range/)
  assert.equal(failed.tick, 0xffff_fffe, 'a failed atomic tick must not publish partial World state')

  const blockedAdvance = await advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS)
  assert.equal(blockedAdvance, failed, 'runtimeError must fail closed until explicit Restart')
})

test('Decision acknowledgement projects pending state without observing an underway World_Tick', async () => {
  resetGameFpsRuntimeForTests()
  startGameFpsMission()
  await advanceGameFpsBy(0.25)
  const pending = readGameFpsSnapshot().pendingDecisions
  assert.ok(pending.length > 0, 'the NPC decision interval must provide an acknowledgement fixture')

  const advancing = advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS * 2)
  await reachInFlightWorldTick()
  const acknowledged = acknowledgeGameFpsDecisions(pending.map(decision => decision.decisionId))
  assert.ok(pending.every(decision => (
    !acknowledged.pendingDecisions.some(candidate => candidate.decisionId === decision.decisionId)
  )))

  const settled = await advancing
  assert.equal(settled.runtimeError, null)
  assert.ok(pending.every(decision => (
    !settled.pendingDecisions.some(candidate => candidate.decisionId === decision.decisionId)
  )))
})
