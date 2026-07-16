import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  findActiveScopeConflicts,
  readContract,
  selectAffectedCommands,
  validatePullRequestMetadata,
  validateTaskBranch,
} from '../collaboration-contract.mjs'
import { findProtectedPushes, parsePrePushEntries } from '../check-pre-push-refs.mjs'
import { classifyPrePushGate } from '../run-pre-push-gate.mjs'

test('device end delegates to the canonical Agentic Canvas OS checkout wrapper', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
  assert.equal(pkg.scripts?.['device:end'], 'node ../agentic-canvas-os/scripts/device-branch.mjs end')
})

test('canonical contract is valid and selects deduplicated affected checks', async () => {
  const contract = await readContract()
  const plan = selectAffectedCommands([
    'canvas/src/app/main.ts',
    'mcp/server.js',
    'package.json',
    'README.md',
  ], contract)

  assert.deepEqual(plan.scopes, ['dependencies', 'canvas', 'runtime', 'documentation'])
  assert.deepEqual(plan.unmatchedPaths, [])
  assert.deepEqual(plan.commands, [
    ['npm', 'run', 'check'],
    ['npm', 'run', 'runtime:check'],
  ])
})

test('Rich Media preview timing owners always select schema and browser contract gates', async () => {
  const contract = await readContract()
  const timingOwnerPaths = [
    'canvas/schemas/rich-media-catalog-preview-timing.v1.schema.json',
    'canvas/scripts/lib/rich-media-catalog-preview-timing-schema.mjs',
    'canvas/scripts/validate_rich_media_catalog_preview_timing.mjs',
    'canvas/scripts/__tests__/rich-media-catalog-preview-timing-schema.test.mjs',
    'canvas/scripts/run_rich_media_browser_smoke.mjs',
    'canvas/scripts/verify_rich_media_browser_smoke.py',
    'canvas/src/features/testing/RichMediaBrowserSmokePage.tsx',
    'canvas/src/features/testing/richMediaBrowserSmokeFixtures.json',
    'canvas/src/__tests__/richMediaBrowserSmokeContract.test.ts',
  ]

  for (const ownerPath of timingOwnerPaths) {
    const plan = selectAffectedCommands([ownerPath], contract)
    assert.ok(plan.scopes.includes('rich_media_preview_timing'), ownerPath)
    assert.deepEqual(plan.unmatchedPaths, [], ownerPath)
    assert.ok(plan.commands.some(command => command.join(' ') === (
      'npm --prefix canvas run test:smoke:rich-media:timing-schema'
    )), ownerPath)
    assert.ok(plan.commands.some(command => command.join(' ') === (
      'npm --prefix canvas run test:ci:unit -- richMedia.browserSmokeContract'
    )), ownerPath)
  }
})

test('ready pull request metadata follows slash hash at grammar', async () => {
  const contract = await readContract()
  const metadata = validatePullRequestMetadata(`---
action: /fix
scope: "#canvas.render"
actor: "@codex-task"
base_sha: "0123456789abcdef0123456789abcdef01234567"
---
`, contract)

  assert.equal(metadata.scope, '#canvas.render')
})

test('draft pull requests may omit incomplete metadata', async () => {
  const contract = await readContract()
  assert.equal(validatePullRequestMetadata('', contract, { allowIncomplete: true }), null)
  assert.equal(validatePullRequestMetadata(`---
action: /change
scope: "#replace.with-semantic-scope"
actor: "@replace-with-owner"
base_sha: "replace-with-40-character-origin-main-sha"
---
`, contract, { allowIncomplete: true }), null)
  assert.throws(() => validatePullRequestMetadata('', contract), /must declare collaboration frontmatter/)
})

test('task branches encode one device and semantic scope', async () => {
  const contract = await readContract()
  assert.equal(validateTaskBranch('agent/macbook/canvas-render', contract, '#canvas.render'), 'agent/macbook/canvas-render')
  assert.throws(() => validateTaskBranch('feature/canvas-render', contract), /branch must satisfy/)
  assert.throws(() => validateTaskBranch('agent/macbook/canvas/render', contract), /branch must satisfy/)
  assert.throws(() => validateTaskBranch('agent/macbook/runtime-contract', contract, '#canvas.render'), /branch scope must be/)
})

test('active pull requests cannot claim the same semantic scope', async () => {
  const contract = await readContract()
  const body = (scope, actor) => `---
action: /change
scope: "${scope}"
actor: "${actor}"
base_sha: "0123456789abcdef0123456789abcdef01234567"
---
`
  const pullRequests = [
    { number: 11, body: body('#canvas.render', '@macbook-codex'), head: { ref: 'agent/macbook/canvas-render' } },
    { number: 12, body: body('#canvas.render', '@desktop-codex'), head: { ref: 'agent/desktop/canvas-render' } },
    { number: 13, body: body('#runtime.contract', '@laptop-codex'), head: { ref: 'agent/laptop/runtime-contract' } },
  ]

  assert.deepEqual(findActiveScopeConflicts(pullRequests, 11, contract), [{
    actor: '@desktop-codex',
    branch: 'agent/desktop/canvas-render',
    number: 12,
    scope: '#canvas.render',
    url: '',
  }])
  assert.deepEqual(findActiveScopeConflicts(pullRequests, 13, contract), [])
})

test('pre-push protection is derived from canonical refs', async () => {
  const contract = await readContract()
  const input = [
    'refs/heads/agent/macbook/canvas-render a refs/heads/agent/macbook/canvas-render b',
    'refs/heads/main c refs/heads/main d',
  ].join('\n')
  assert.deepEqual(findProtectedPushes(input, contract.coordination.protected_push_refs), ['refs/heads/main'])
  const entries = parsePrePushEntries(input)
  assert.equal(entries.length, 2)
  assert.equal(classifyPrePushGate({
    entries: [entries[0]],
    headRevision: 'a',
    headRef: 'refs/heads/agent/macbook/canvas-render',
  }), 'checkout')
  assert.equal(classifyPrePushGate({
    entries: [entries[0]],
    headRevision: 'different',
    headRef: 'refs/heads/agent/macbook/canvas-render',
  }), 'object')
})
