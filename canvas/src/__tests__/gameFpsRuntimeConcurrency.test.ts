import assert from 'node:assert/strict'
import test from 'node:test'
import {
  acknowledgeGameFpsDecisions,
  advanceGameFpsBy,
  captureGameFpsAdvance,
  queueGameFpsFire,
  readGameFpsRunId,
  readGameFpsSnapshot,
  resetGameFpsRuntimeForTests,
  restartGameFpsMission,
  setGameFpsInput,
  setGameFpsMotionInput,
  startGameFpsMission,
  stopGameFpsMission,
  subscribeGameFpsSnapshot,
} from '../features/game-fps/gameFpsRuntime'
import {
  GAME_FPS_FIXED_STEP_SECONDS,
  GAME_FPS_MISSION_ID,
  type GameFpsSnapshot,
} from '../features/game-fps/gameFpsModel'
import {
  bindGameFpsSimulationInputQueue,
  createGameFpsSimulationClock,
  queueGameFpsSimulationInputStep,
} from '../features/game-fps/gameFpsSimulationClock'

async function reachInFlightWorldTick(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

async function settleSimulationClock(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve()
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

test('queued World_Ticks preserve the movement input active at enqueue across key release', async () => {
  resetGameFpsRuntimeForTests()
  const initial = startGameFpsMission()

  setGameFpsInput({ forward: 1 })
  const firstAdvance = advanceGameFpsBy(0.25)
  setGameFpsInput({ forward: 0 })
  const firstMoved = await firstAdvance
  assert.equal(firstMoved.tick, 15)
  assert.notEqual(firstMoved.player.z, initial.player.z)

  const released = await advanceGameFpsBy(0.25)
  assert.equal(released.player.z, firstMoved.player.z, 'release must neutralize later queued ticks')

  setGameFpsInput({ forward: 1 })
  const secondAdvance = advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS * 2)
  setGameFpsInput({ forward: 0 })
  const secondMoved = await secondAdvance
  assert.notEqual(secondMoved.player.z, released.player.z, 'a second press cycle must retain its own queued input')
})

test('a movement press released between rendered frames survives until one fixed World_Tick', async () => {
  resetGameFpsRuntimeForTests()
  const initial = startGameFpsMission()

  setGameFpsInput({ forward: 1 })
  setGameFpsInput({ forward: 0 })
  const beforeStep = await advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS / 2)
  assert.equal(beforeStep.tick, 0)
  assert.equal(beforeStep.player.z, initial.player.z)

  const moved = await advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS / 2)
  assert.equal(moved.tick, 1)
  assert.notEqual(moved.player.z, initial.player.z)

  const neutral = await advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS)
  assert.equal(neutral.player.z, moved.player.z, 'the buffered movement edge must be consumed exactly once')
})

test('a held analog axis is not doubled by its buffered movement edge', async () => {
  resetGameFpsRuntimeForTests()
  const initial = startGameFpsMission()

  setGameFpsInput({ forward: 0.25 })
  const first = await advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS)
  const second = await advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS)
  const firstDisplacement = first.player.z - initial.player.z
  const secondDisplacement = second.player.z - first.player.z

  assert.ok(Math.abs(firstDisplacement - secondDisplacement) < 1e-10)
})

test('a buffered local movement pulse composes with Motion Control independent of frame sampling', async () => {
  const run = async (deltas: readonly number[]) => {
    resetGameFpsRuntimeForTests()
    startGameFpsMission()
    setGameFpsMotionInput({ forward: 0, strafe: 1, sprint: false, primary: false })
    setGameFpsInput({ forward: 1 })
    setGameFpsInput({ forward: 0 })
    for (const delta of deltas) await advanceGameFpsBy(delta)
    return readGameFpsSnapshot().player
  }

  const oneFrame = await run([GAME_FPS_FIXED_STEP_SECONDS])
  const twoFrames = await run([
    GAME_FPS_FIXED_STEP_SECONDS / 2,
    GAME_FPS_FIXED_STEP_SECONDS / 2,
  ])
  assert.equal(oneFrame.x, twoFrames.x)
  assert.equal(oneFrame.z, twoFrames.z)
  assert.notEqual(oneFrame.x, 0)
  assert.notEqual(oneFrame.z, 5.04)
})

test('the fixed clock coalesces one input-aware step under backpressure and fences disposal', async () => {
  let releaseFirstStep!: () => void
  const firstStep = new Promise<void>(resolve => {
    releaseFirstStep = resolve
  })
  let inputRevision = 0
  const sampledRevisions: number[] = []
  const clock = createGameFpsSimulationClock({
    runStep: async () => {
      sampledRevisions.push(inputRevision)
      if (sampledRevisions.length === 1) await firstStep
    },
    onStepError: error => assert.fail(error instanceof Error ? error : String(error)),
    minimumStepIntervalMs: 0,
  })
  const releaseInputQueue = bindGameFpsSimulationInputQueue(clock.queueInputStep)

  clock.requestStep()
  await settleSimulationClock()
  inputRevision = 1
  queueGameFpsSimulationInputStep()
  queueGameFpsSimulationInputStep()
  assert.deepEqual(sampledRevisions, [0])
  releaseFirstStep()
  await settleSimulationClock()
  assert.deepEqual(sampledRevisions, [0, 1], 'pending intervals must become one live-input step')

  let releaseDisposedStep!: () => void
  const disposedStep = new Promise<void>(resolve => {
    releaseDisposedStep = resolve
  })
  let disposedStepCount = 0
  const disposedClock = createGameFpsSimulationClock({
    runStep: async () => {
      disposedStepCount += 1
      await disposedStep
    },
    onStepError: error => assert.fail(error instanceof Error ? error : String(error)),
    minimumStepIntervalMs: 0,
  })
  disposedClock.requestStep()
  await settleSimulationClock()
  disposedClock.requestStep()
  disposedClock.dispose()
  releaseDisposedStep()
  await settleSimulationClock()
  assert.equal(disposedStepCount, 1)
  releaseInputQueue()
  clock.dispose()
})

test('a disposed fixed clock ignores a late in-flight step rejection', async () => {
  let rejectStep!: (error: Error) => void
  const inFlightStep = new Promise<void>((_, reject) => {
    rejectStep = reject
  })
  const publishedErrors: unknown[] = []
  const clock = createGameFpsSimulationClock({
    runStep: () => inFlightStep,
    onStepError: error => publishedErrors.push(error),
    minimumStepIntervalMs: 0,
  })

  clock.requestStep()
  await settleSimulationClock()
  clock.dispose()
  rejectStep(new Error('stale Game Mode stage failure'))
  await settleSimulationClock()

  assert.deepEqual(publishedErrors, [])
})

test('input wakeups cannot advance the fixed clock faster than its interval', async () => {
  let currentTimeMs = 0
  let nextHandle = 0
  const scheduled = new Map<number, { at: number; callback: () => void }>()
  const schedule = (callback: () => void, delayMs: number) => {
    const handle = nextHandle + 1
    nextHandle = handle
    scheduled.set(handle, { at: currentTimeMs + delayMs, callback })
    return handle
  }
  const advanceTimeTo = async (targetTimeMs: number) => {
    while (true) {
      const next = [...scheduled.entries()]
        .filter(([, value]) => value.at <= targetTimeMs)
        .sort((left, right) => left[1].at - right[1].at || left[0] - right[0])[0]
      if (!next) break
      scheduled.delete(next[0])
      currentTimeMs = next[1].at
      next[1].callback()
      await settleSimulationClock()
    }
    currentTimeMs = targetTimeMs
    await settleSimulationClock()
  }
  let stepCount = 0
  const clock = createGameFpsSimulationClock({
    runStep: async () => {
      stepCount += 1
    },
    onStepError: error => assert.fail(error instanceof Error ? error : String(error)),
    minimumStepIntervalMs: 16,
    now: () => currentTimeMs,
    schedule,
    cancelScheduled: handle => scheduled.delete(Number(handle)),
  })

  for (let timeMs = 0; timeMs < 105; timeMs += 1) {
    clock.queueInputStep()
    await settleSimulationClock()
    await advanceTimeTo(timeMs + 1)
  }
  assert.equal(stepCount, 7, 'a 16 ms clock may start only at 0, 16, …, 96 ms')
  clock.dispose()
})

test('overlapping movement taps retain every axis until the next fixed World_Tick', async () => {
  resetGameFpsRuntimeForTests()
  const initial = startGameFpsMission()

  setGameFpsInput({ forward: 1, strafe: 0 })
  setGameFpsInput({ forward: 1, strafe: 1 })
  setGameFpsInput({ forward: 0, strafe: 1 })
  setGameFpsInput({ forward: 0, strafe: 0 })
  const moved = await advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS)

  assert.notEqual(moved.player.x, initial.player.x)
  assert.notEqual(moved.player.z, initial.player.z)
})

test('queued one-shot input remains staged until a fixed World_Tick consumes it', async () => {
  resetGameFpsRuntimeForTests()
  const initial = startGameFpsMission()

  queueGameFpsFire()
  const beforeStep = await advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS / 2)
  assert.equal(beforeStep.tick, 0)
  assert.equal(beforeStep.ammo, initial.ammo)

  const fired = await advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS / 2)
  assert.equal(fired.tick, 1)
  assert.equal(fired.ammo, initial.ammo - 1)
})

test('captured World_Tick input is opaque and can be consumed only once', async () => {
  resetGameFpsRuntimeForTests()
  const initial = startGameFpsMission()

  queueGameFpsFire()
  const advance = captureGameFpsAdvance(GAME_FPS_FIXED_STEP_SECONDS)
  const fired = await advance()
  assert.equal(fired.tick, 1)
  assert.equal(fired.ammo, initial.ammo - 1)

  await assert.rejects(advance(), /already consumed/)
  assert.equal(readGameFpsSnapshot().tick, fired.tick)
  assert.equal(readGameFpsSnapshot().ammo, fired.ammo)
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
