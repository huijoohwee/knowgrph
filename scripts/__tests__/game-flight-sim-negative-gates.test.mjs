import assert from 'node:assert/strict'
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  assertDependencyClosure,
} from '../lib/game-flight-sim-asset-readiness.mjs'
import {
  assertFlightSimBoundary,
} from '../lib/game-flight-sim-boundary.mjs'
import {
  FLIGHT_SIM_DISALLOWED_AUTHORING_OPERATIONS,
  FlightSimOfflineAuthoringBlockedError,
  runFlightSimOfflineAuthoringTransaction,
} from '../lib/game-flight-sim-offline-authoring.mjs'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
)

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function createDependencyFixture(t) {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'flight-sim-dependencies-'))
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }))
  const rootPackage = JSON.parse(
    await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'),
  )
  await Promise.all([
    cp(
      path.join(repositoryRoot, 'canvas/src/features/game-flight-sim'),
      path.join(fixtureRoot, 'canvas/src/features/game-flight-sim'),
      { recursive: true },
    ),
    cp(
      path.join(repositoryRoot, 'package.json'),
      path.join(fixtureRoot, 'package.json'),
    ),
    cp(
      path.join(repositoryRoot, 'package-lock.json'),
      path.join(fixtureRoot, 'package-lock.json'),
    ),
    ...(rootPackage.workspaces || []).map(async workspacePath => {
      const target = path.join(fixtureRoot, workspacePath, 'package.json')
      await mkdir(path.dirname(target), { recursive: true })
      await cp(path.join(repositoryRoot, workspacePath, 'package.json'), target)
    }),
  ])
  return fixtureRoot
}

test('offline authoring names every disallowed operation before commit and preserves bytes', async t => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'flight-sim-authoring-'))
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }))
  const committedPath = path.join(fixtureRoot, 'vehicle-airplane.scene.json')
  const committedBytes = Buffer.from('{"identity":"committed-aircraft"}\n', 'utf8')
  await writeFile(committedPath, committedBytes)

  for (const operation of FLIGHT_SIM_DISALLOWED_AUTHORING_OPERATIONS) {
    let authorInvoked = false
    let commitInvoked = false
    await assert.rejects(
      runFlightSimOfflineAuthoringTransaction({
        attemptedOperations: [operation],
        author: async () => {
          authorInvoked = true
          return Buffer.from('replacement')
        },
        commit: async output => {
          commitInvoked = true
          await writeFile(committedPath, output)
        },
      }),
      error => {
        assert.ok(error instanceof FlightSimOfflineAuthoringBlockedError)
        assert.equal(error.code, 'FLIGHT_SIM_OFFLINE_AUTHORING_OPERATION_BLOCKED')
        assert.equal(error.operation, operation)
        assert.equal(error.beforeCommit, true)
        assert.match(error.message, new RegExp(operation))
        return true
      },
    )
    assert.equal(authorInvoked, false)
    assert.equal(commitInvoked, false)
    assert.deepEqual(await readFile(committedPath), committedBytes)
  }
})

test('dependency gate names a crafted unauthorized runtime package', async t => {
  const fixtureRoot = await createDependencyFixture(t)
  const prohibitedPackage = ['@dimforge', 'rapier3d-compat'].join('/')
  await writeFile(
    path.join(
      fixtureRoot,
      'canvas/src/features/game-flight-sim/craftedUnauthorizedDependency.ts',
    ),
    `import '${prohibitedPackage}'\n`,
    'utf8',
  )
  await assert.rejects(
    assertDependencyClosure(fixtureRoot),
    error => {
      assert.match(error.message, /direct external dependency set changed/)
      assert.match(error.message, new RegExp(prohibitedPackage.replace('/', '\\/')))
      return true
    },
  )
})

test('dependency gate names a crafted non-OSI license', async t => {
  const fixtureRoot = await createDependencyFixture(t)
  const lockPath = path.join(fixtureRoot, 'package-lock.json')
  const lock = JSON.parse(await readFile(lockPath, 'utf8'))
  lock.packages['node_modules/three'].license = 'Proprietary-Test-License'
  await writeJson(lockPath, lock)
  await assert.rejects(
    assertDependencyClosure(fixtureRoot),
    /Flight Sim dependency three license changed: expected MIT, received Proprietary-Test-License/,
  )
})

test('named-contamination scanner reports a crafted external-project boundary violation', () => {
  const externalIdentity = ['Flight', 'Gear'].join('')
  assert.throws(
    () => assertFlightSimBoundary([{
      relativePath: 'canvas/src/features/game-flight-sim/copied-flight-model.ts',
      source: `import { dynamics } from '${externalIdentity}'`,
    }]),
    error => {
      assert.match(error.message, /named-contamination\/provenance boundary failed/)
      assert.match(error.message, /copied-flight-model\.ts/)
      assert.match(error.message, new RegExp(externalIdentity))
      return true
    },
  )
})
