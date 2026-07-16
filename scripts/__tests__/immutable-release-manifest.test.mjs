import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { repoRoot } from '../collaboration-contract.mjs'
import {
  buildImmutableReleaseManifest,
  serializeImmutableReleaseManifest,
  validateImmutableReleaseManifestSource,
} from '../immutable-release-manifest.mjs'

const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repoRoot,
  encoding: 'utf8',
}).trim()
const targetRef = 'refs/heads/agent/test-device/runtime-revision-identity'

test('immutable release manifest binds one exact source tree to the pinned docs and catalog revision', async () => {
  const manifest = await buildImmutableReleaseManifest({ sourceRevision, targetRef })
  assert.equal(manifest.sourceRevision, sourceRevision)
  assert.equal(manifest.catalogRevision, manifest.agenticCanvasOs.revision)
  assert.match(manifest.sourceTree, /^[0-9a-f]{40}$/)
  const result = await validateImmutableReleaseManifestSource(
    serializeImmutableReleaseManifest(manifest),
    {
      sourceRevision,
      agenticCanvasOsRevision: manifest.agenticCanvasOs.revision,
    },
  )
  assert.match(result.digest, /^[0-9a-f]{64}$/)
})

test('immutable release manifest rejects mutable target refs and cross-commit replay', async () => {
  await assert.rejects(
    buildImmutableReleaseManifest({
      sourceRevision,
      targetRef: 'refs/heads/main',
      publicationMode: 'checkout-free',
      pushHookMode: 'repository-owned-object-gate',
    }),
    /contract-valid unprotected task branch/,
  )
  const manifest = await buildImmutableReleaseManifest({ sourceRevision, targetRef })
  await assert.rejects(
    validateImmutableReleaseManifestSource(
      serializeImmutableReleaseManifest(manifest),
      { sourceRevision: 'f'.repeat(40) },
    ),
    /source revision mismatch/,
  )
})
