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

test('accepts the policy document only while honest provenance markers remain', () => {
  assert.doesNotThrow(() => assertFlightSimBoundary([{
    relativePath: 'docs/documents/knowgrph-game-flight-sim-prd-tad.md',
    source: `${externalOwner}/${externalProject}: inspiration only; source-authored provenance attestation; named identity, path, content-marker, binary/asset, and declared-dependency contamination; takes no dependency; scanner cannot prove the absence of arbitrary derived code`,
  }]))
  assert.equal(findFlightSimBoundaryViolations([{
    relativePath: 'docs/documents/knowgrph-game-flight-sim-prd-tad.md',
    source: `${externalOwner}/${externalProject}: inspiration only`,
  }]).length, 1)
})

test('accepts an explicit named-contamination boundary in the authored workspace seed', () => {
  assert.doesNotThrow(() => assertFlightSimBoundary([{
    relativePath: 'docs/workspace-seeds/knowgrph-game-flight-sim-demo.md',
    source: `${upstreamEngine}: concepts and architecture only; source-authored provenance attestation; named identity, path, content-marker, binary/asset, and declared-dependency contamination; takes no dependency; scanner does not prove the absence of arbitrary derived code`,
  }]))
})

test('accepts external references only in the exact canonical tracked Kiro policy paths', () => {
  const source = `${upstreamEngine}: concepts and architecture only; maintainers attest source-authored provenance; named identity, path, content-marker, binary/asset, and declared-dependency contamination; zero build-time, external, or runtime dependency; gate cannot prove the absence of arbitrary derived code`
  assert.doesNotThrow(() => assertFlightSimBoundary([{
    relativePath: '.kiro/specs/knowgrph-game-flight-sim/requirements.md',
    source,
  }]))
  assert.equal(findFlightSimBoundaryViolations([{
    relativePath: '.kiro/specs/lookalike-flight-sim/requirements.md',
    source,
  }]).length, 1)
})

test('rejects an import injected into an otherwise marker-complete Kiro policy file', () => {
  const policy = `${upstreamEngine}: concepts and architecture only; maintainers attest source-authored provenance; named identity, path, content-marker, binary/asset, and declared-dependency contamination; zero build-time, external, or runtime dependency; gate cannot prove the absence of arbitrary derived code`
  assert.throws(() => assertFlightSimBoundary([{
    relativePath: '.kiro/specs/knowgrph-game-flight-sim/design.md',
    source: `${policy}\nimport simulator from '${upstreamEngine}'`,
  }]), /executable or package-dependency/)
})

test('rejects a dependency injected into an otherwise marker-complete Kiro policy file', () => {
  const policy = `${upstreamEngine}: concepts and architecture only; maintainers attest source-authored provenance; named identity, path, content-marker, binary/asset, and declared-dependency contamination; zero build-time, external, or runtime dependency; gate cannot prove the absence of arbitrary derived code`
  assert.throws(() => assertFlightSimBoundary([{
    relativePath: '.kiro/specs/knowgrph-game-flight-sim/requirements.md',
    source: `${policy}\n"${upstreamLibrary}": "1.2.3"`,
  }]), /executable or package-dependency/)
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
  }]), /named-contamination\/provenance boundary failed/)
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
