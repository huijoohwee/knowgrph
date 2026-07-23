import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertFlightSimBoundary,
  findFlightSimBoundaryViolations,
} from '../lib/game-flight-sim-boundary.mjs'

const upstreamEngine = ['Flight', 'Gear'].join('')
const upstreamLibrary = ['Sim', 'Gear'].join('')
const externalOwner = ['Arnie', '016'].join('')
const externalProject = ['flight', 'simulator', 'fable5'].join('-')

test('accepts tracked content with no external project identity', () => {
  assert.deepEqual(findFlightSimBoundaryViolations([
    { relativePath: 'canvas/src/local.ts', source: 'export const local = true' },
  ]), [])
})

test('accepts the policy document only while all no-copy markers remain', () => {
  assert.doesNotThrow(() => assertFlightSimBoundary([{
    relativePath: 'docs/documents/knowgrph-game-flight-sim-prd-tad.md',
    source: `${externalOwner}/${externalProject}: inspiration only; FORBID source copy; no dependency`,
  }]))
  assert.equal(findFlightSimBoundaryViolations([{
    relativePath: 'docs/documents/knowgrph-game-flight-sim-prd-tad.md',
    source: `${externalOwner}/${externalProject}: inspiration only`,
  }]).length, 1)
})

test('accepts an explicit no-copy boundary in the authored workspace seed', () => {
  assert.doesNotThrow(() => assertFlightSimBoundary([{
    relativePath: 'docs/workspace-seeds/knowgrph-game-flight-sim-demo.md',
    source: `${upstreamEngine}: inspiration only; copies none of its source; takes no dependency`,
  }]))
})

test('rejects external engine identity in source text', () => {
  const violations = findFlightSimBoundaryViolations([{
    relativePath: 'canvas/src/copied.ts',
    source: `import { simulator } from '${upstreamEngine}'`,
  }])
  assert.equal(violations.length, 1)
  assert.deepEqual(violations[0].identifiers, [upstreamEngine])
})

test('rejects external library identity in dependency manifests', () => {
  assert.throws(() => assertFlightSimBoundary([{
    relativePath: 'package.json',
    source: JSON.stringify({ dependencies: { [upstreamLibrary]: 'git+https://example.test' } }),
  }]), /no-copy\/dependency boundary failed/)
})

test('rejects external identity embedded in binary bytes', () => {
  const bytes = Buffer.concat([
    Buffer.from([0, 1, 2, 3]),
    Buffer.from(externalProject, 'utf8'),
    Buffer.from([4, 5, 6]),
  ])
  assert.equal(findFlightSimBoundaryViolations([{
    relativePath: 'canvas/public/model.bin',
    bytes,
  }]).length, 1)
})

test('rejects tracked paths named for an external project', () => {
  const violations = findFlightSimBoundaryViolations([{
    relativePath: `vendor/${upstreamEngine}/readme.md`,
    source: 'renamed content',
  }])
  assert.equal(violations.length, 1)
  assert.match(violations[0].reason, /tracked path/)
})
