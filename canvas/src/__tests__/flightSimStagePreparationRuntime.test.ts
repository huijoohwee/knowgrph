import assert from 'node:assert/strict'
import test from 'node:test'
import {
  beginFlightSimStagePreparation,
  cancelFlightSimStagePreparation,
  completeFlightSimStagePreparation,
  readCurrentFlightSimStagePreparationRequest,
  resetFlightSimStagePreparationForTests,
  waitForFlightSimStagePreparation,
} from '@/features/game-flight-sim/flightSimStagePreparationRuntime'

test('surface preparation waits for its exact committed mission-stage request', async () => {
  resetFlightSimStagePreparationForTests()
  const requestId = beginFlightSimStagePreparation()
  assert.equal(readCurrentFlightSimStagePreparationRequest(), requestId)
  let resolved = false
  const waiting = waitForFlightSimStagePreparation(
    requestId,
    { limitMs: 1_000 },
  ).then(() => {
    resolved = true
  })

  await Promise.resolve()
  assert.equal(resolved, false)
  assert.equal(completeFlightSimStagePreparation(requestId), true)
  await waiting
  assert.equal(resolved, true)
  assert.equal(readCurrentFlightSimStagePreparationRequest(), null)
  cancelFlightSimStagePreparation(requestId)
  resetFlightSimStagePreparationForTests()
})

test('a stale stage instance cannot satisfy a newer preparation request', async () => {
  resetFlightSimStagePreparationForTests()
  const staleRequestId = beginFlightSimStagePreparation()
  const currentRequestId = beginFlightSimStagePreparation()
  let resolved = false
  const waiting = waitForFlightSimStagePreparation(
    currentRequestId,
    { limitMs: 1_000 },
  ).then(() => {
    resolved = true
  })

  assert.equal(completeFlightSimStagePreparation(staleRequestId), false)
  await Promise.resolve()
  assert.equal(resolved, false)
  assert.equal(completeFlightSimStagePreparation(currentRequestId), true)
  await waiting
  assert.equal(resolved, true)
  cancelFlightSimStagePreparation(currentRequestId)
  resetFlightSimStagePreparationForTests()
})

test('an aborted late request cannot satisfy the next activation', async () => {
  resetFlightSimStagePreparationForTests()
  const abortedRequestId = beginFlightSimStagePreparation()
  const controller = new AbortController()
  const abortedWait = waitForFlightSimStagePreparation(abortedRequestId, {
    limitMs: 1_000,
    signal: controller.signal,
  })
  controller.abort(new Error('injected preparation abort'))
  await assert.rejects(abortedWait, /injected preparation abort/)
  cancelFlightSimStagePreparation(abortedRequestId)

  const currentRequestId = beginFlightSimStagePreparation()
  let resolved = false
  const currentWait = waitForFlightSimStagePreparation(
    currentRequestId,
    { limitMs: 1_000 },
  ).then(() => {
    resolved = true
  })
  assert.equal(completeFlightSimStagePreparation(abortedRequestId), false)
  await Promise.resolve()
  assert.equal(resolved, false)
  assert.equal(completeFlightSimStagePreparation(currentRequestId), true)
  await currentWait
  cancelFlightSimStagePreparation(currentRequestId)
  resetFlightSimStagePreparationForTests()
})

test('a timed-out request stays stale across reset and a monotonic next token', async () => {
  resetFlightSimStagePreparationForTests()
  const timedOutRequestId = beginFlightSimStagePreparation()
  await assert.rejects(
    waitForFlightSimStagePreparation(timedOutRequestId, { limitMs: 0 }),
    /did not complete within 0 ms/,
  )
  resetFlightSimStagePreparationForTests()

  const currentRequestId = beginFlightSimStagePreparation()
  assert.ok(currentRequestId > timedOutRequestId)
  let resolved = false
  const currentWait = waitForFlightSimStagePreparation(
    currentRequestId,
    { limitMs: 1_000 },
  ).then(() => {
    resolved = true
  })
  assert.equal(completeFlightSimStagePreparation(timedOutRequestId), false)
  await Promise.resolve()
  assert.equal(resolved, false)
  assert.equal(completeFlightSimStagePreparation(currentRequestId), true)
  await currentWait
  cancelFlightSimStagePreparation(currentRequestId)
  resetFlightSimStagePreparationForTests()
})
