import assert from 'node:assert/strict'
import test from 'node:test'
import {
  findActiveScopeConflicts,
  readContract,
  selectAffectedCommands,
  validatePullRequestMetadata,
  validateTaskBranch,
} from '../collaboration-contract.mjs'
import { findProtectedPushes } from '../check-pre-push-refs.mjs'

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
})
