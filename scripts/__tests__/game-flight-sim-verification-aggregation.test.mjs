import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  runSerialBrowserProof,
} from '../lib/game-flight-sim-browser-proof-orchestration.mjs'
import {
  captureGitRepositoryState,
  repositoryStatesEqual,
} from '../lib/git-repository-state.mjs'
import {
  NamedVerificationAggregateError,
} from '../lib/named-verification-runner.mjs'
import {
  FLIGHT_SIM_RUNTIME_VERIFICATIONS,
  runFlightSimRuntimeReadiness,
} from '../run-game-flight-sim-runtime-ready.mjs'

const QUIET_LOGGER = Object.freeze({
  error() {},
  info() {},
})

function git(repositoryRoot, args) {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).trim()
}

async function createFixtureRepository() {
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), 'knowgrph-flight-verification-'),
  )
  git(repositoryRoot, ['init', '--quiet'])
  git(repositoryRoot, ['config', 'user.email', 'flight-proof@example.invalid'])
  git(repositoryRoot, ['config', 'user.name', 'Flight Proof'])
  const sentinelPath = path.join(repositoryRoot, 'sentinel.txt')
  await writeFile(sentinelPath, 'byte-stable sentinel\n', 'utf8')
  git(repositoryRoot, ['add', 'sentinel.txt'])
  git(repositoryRoot, ['commit', '--quiet', '-m', 'fixture'])
  return Object.freeze({ repositoryRoot, sentinelPath })
}

async function repositoryEvidence(fixture) {
  return Object.freeze({
    bytes: await readFile(fixture.sentinelPath),
    state: await captureGitRepositoryState(fixture.repositoryRoot),
    status: git(fixture.repositoryRoot, [
      'status',
      '--porcelain=v1',
      '--untracked-files=all',
    ]),
  })
}

function assertAggregate(error, expectedNames) {
  assert.ok(error instanceof NamedVerificationAggregateError)
  assert.deepEqual(
    error.failures.map(failure => failure.name),
    expectedNames,
  )
  for (const expectedName of expectedNames) {
    assert.match(error.message, new RegExp(expectedName))
  }
  return true
}

test('runtime readiness executes every stage and reports every injected failure without repository mutation', async t => {
  const fixture = await createFixtureRepository()
  t.after(() => rm(fixture.repositoryRoot, { recursive: true, force: true }))
  const before = await repositoryEvidence(fixture)
  const executed = []
  const failedNames = new Set(['source authority', 'Canvas TypeScript'])

  await assert.rejects(
    runFlightSimRuntimeReadiness({
      execute: async verification => {
        executed.push(verification.name)
        if (failedNames.has(verification.name)) {
          throw new Error(`injected ${verification.name} failure`)
        }
      },
      log: QUIET_LOGGER,
      repositoryRoot: fixture.repositoryRoot,
    }),
    error => assertAggregate(error, [...failedNames]),
  )

  assert.deepEqual(
    executed,
    FLIGHT_SIM_RUNTIME_VERIFICATIONS.map(verification => verification.name),
  )
  const after = await repositoryEvidence(fixture)
  assert.equal(repositoryStatesEqual(before.state, after.state), true)
  assert.deepEqual(after.bytes, before.bytes)
  assert.equal(after.status, before.status)
})

test('browser orchestration reports failures from both serial runs and preserves repository bytes', async t => {
  const fixture = await createFixtureRepository()
  t.after(() => rm(fixture.repositoryRoot, { recursive: true, force: true }))
  const before = await repositoryEvidence(fixture)
  const executed = []
  let candidateChecks = 0
  let cleanupCalls = 0

  await assert.rejects(
    runSerialBrowserProof({
      assertExactCandidate: async () => {
        candidateChecks += 1
      },
      clearPriorEvidence: async () => {
        cleanupCalls += 1
      },
      executeRun: async runIndex => {
        executed.push(runIndex)
        throw new Error(`injected verifier failure ${runIndex}`)
      },
      log: QUIET_LOGGER,
      runCount: 2,
      validateRunEvidence: async () => {
        assert.fail('failed browser runs must not validate stale evidence')
      },
    }),
    error => assertAggregate(error, [
      'serial browser run 1',
      'serial browser run 2',
    ]),
  )

  assert.deepEqual(executed, [1, 2])
  assert.equal(candidateChecks, 3)
  assert.equal(cleanupCalls, 1)
  const after = await repositoryEvidence(fixture)
  assert.equal(repositoryStatesEqual(before.state, after.state), true)
  assert.deepEqual(after.bytes, before.bytes)
  assert.equal(after.status, before.status)
})

test('browser orchestration aggregates evidence failures after successful fresh runs', async () => {
  const validated = []
  await assert.rejects(
    runSerialBrowserProof({
      assertExactCandidate: async () => {},
      clearPriorEvidence: async () => {},
      executeRun: async () => {},
      log: QUIET_LOGGER,
      runCount: 2,
      validateRunEvidence: async runIndex => {
        validated.push(runIndex)
        throw new Error(`injected evidence failure ${runIndex}`)
      },
    }),
    error => assertAggregate(error, [
      'browser evidence run 1',
      'browser evidence run 2',
    ]),
  )
  assert.deepEqual(validated, [1, 2])
})

test('browser exact-candidate preflight remains a hard gate before evidence mutation', async () => {
  let cleanupCalled = false
  let runCalled = false
  await assert.rejects(
    runSerialBrowserProof({
      assertExactCandidate: async () => {
        throw new Error('dirty checkout')
      },
      clearPriorEvidence: async () => {
        cleanupCalled = true
      },
      executeRun: async () => {
        runCalled = true
      },
      log: QUIET_LOGGER,
      runCount: 2,
      validateRunEvidence: async () => ({}),
    }),
    error => assertAggregate(error, ['exact candidate preflight']),
  )
  assert.equal(cleanupCalled, false)
  assert.equal(runCalled, false)
})
